# AI Writing Feedback System — Implementation Specification

## Purpose

This document is a build-ready specification for a text editing system that:

1. Accepts user-written content in a text editor
2. Sends that content to an AI agent for feedback after a typing pause
3. Displays feedback as clickable, categorized items
4. Allows the user to apply individual feedback suggestions without breaking other pending feedback items

The core engineering challenge: applying one feedback item can alter the text that other feedback items reference, causing downstream failures. This spec solves that with **content-anchored references**, **client-side rebasing**, and **overlap grouping**.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    EDITOR COMPONENT                      │
│  ┌───────────────┐    ┌──────────────────────────────┐  │
│  │  Text Editor   │◄──►│  Document State Manager       │  │
│  │  (ContentEditable│  │  - current document text      │  │
│  │   or CodeMirror) │  │  - version counter            │  │
│  └───────────────┘    │  - edit history                │  │
│                        └──────────┬───────────────────┘  │
│                                   │                       │
│  ┌────────────────────────────────▼────────────────────┐ │
│  │            Feedback Engine (Client-Side)              │ │
│  │  - Stores active feedback items                      │ │
│  │  - Anchors feedback to text via contextual matching  │ │
│  │  - Rebases remaining items after each apply          │ │
│  │  - Groups overlapping feedback                       │ │
│  └────────────────────────────────┬────────────────────┘ │
│                                   │                       │
│  ┌────────────────────────────────▼────────────────────┐ │
│  │            Feedback Panel (UI)                        │ │
│  │  - Categorized feedback cards                        │ │
│  │  - Apply / Dismiss / Review actions                  │ │
│  │  - Visual status: active / applied / conflicted      │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────┘
                           │
                           │ (on typing pause)
                           ▼
              ┌─────────────────────────┐
              │   AI Feedback Service    │
              │   - Receives full text   │
              │   - Returns feedback[]   │
              │   - Scoped re-call for   │
              │     partial refreshes    │
              └─────────────────────────┘
```

---

## Data Models

### Document State

```typescript
interface DocumentState {
  content: string;              // Current full text of the document
  version: number;              // Incremented on every edit (user or feedback-applied)
  feedbackGenVersion: number;   // The version number when current feedback was generated
}
```

### Feedback Item (returned from AI)

The AI must return feedback in this structured format. Each item carries the **actual text it references** (not character offsets).

```typescript
interface FeedbackItem {
  id: string;                          // Unique ID, e.g., "fb-001"
  category: FeedbackCategory;
  anchorText: string;                  // The exact text this feedback targets
  contextBefore: string;               // ~30 chars before anchorText for disambiguation
  contextAfter: string;                // ~30 chars after anchorText for disambiguation
  suggestion: string;                  // The replacement text (or "" if feedback is advisory)
  rationale: string;                   // Human-readable explanation shown in UI
  isActionable: boolean;               // true = has a concrete text replacement; false = advisory only
}

type FeedbackCategory = 
  | "spelling"
  | "grammar"
  | "formatting"
  | "logic"
  | "evidence"
  | "clarity";
```

### Client-Side Feedback State

Wraps the AI-returned item with runtime status:

```typescript
interface FeedbackState {
  item: FeedbackItem;
  status: "active" | "applied" | "dismissed" | "conflicted";
  matchPosition: { start: number; end: number } | null;  // Last known position in doc
  groupId: string | null;                                  // Overlap group, if any
}

interface FeedbackStore {
  items: FeedbackState[];
  groups: FeedbackGroup[];
}

interface FeedbackGroup {
  groupId: string;
  feedbackIds: string[];        // IDs of overlapping feedback items
  mergedAnchorStart: number;    // Start of the combined text region
  mergedAnchorEnd: number;      // End of the combined text region
}
```

---

## Core Algorithms

### 1. Contextual Anchor Matching

This is the function that locates a feedback item's target text in the **current** document. It replaces fragile position-based lookups.

```typescript
function findAnchor(
  documentText: string,
  feedback: FeedbackItem
): { start: number; end: number } | null {

  // PASS 1: Exact match with full context
  const fullPattern = feedback.contextBefore + feedback.anchorText + feedback.contextAfter;
  let idx = documentText.indexOf(fullPattern);
  if (idx !== -1) {
    const start = idx + feedback.contextBefore.length;
    return { start, end: start + feedback.anchorText.length };
  }

  // PASS 2: Exact match on anchorText alone (handle context drift)
  idx = documentText.indexOf(feedback.anchorText);
  if (idx !== -1) {
    return { start: idx, end: idx + feedback.anchorText.length };
  }

  // PASS 3: Fuzzy match (handle minor user edits to the anchor region)
  // Use a sliding window + Levenshtein distance
  const threshold = Math.floor(feedback.anchorText.length * 0.2); // Allow 20% drift
  const windowSize = feedback.anchorText.length;

  let bestMatch: { start: number; end: number; distance: number } | null = null;

  for (let i = 0; i <= documentText.length - windowSize; i++) {
    const candidate = documentText.substring(i, i + windowSize);
    const dist = levenshteinDistance(feedback.anchorText, candidate);
    if (dist <= threshold && (!bestMatch || dist < bestMatch.distance)) {
      bestMatch = { start: i, end: i + windowSize, distance: dist };
    }
  }

  // Optimization note: For large documents, limit the fuzzy search to a 
  // neighborhood around the last known matchPosition if available.

  return bestMatch ? { start: bestMatch.start, end: bestMatch.end } : null;
}
```

> **Performance note:** The fuzzy match pass can be expensive on very large documents. Optimize by:
> - Only running fuzzy if exact match fails
> - Limiting the search window to ±500 chars around the last known position
> - Using a fast Levenshtein implementation (e.g., `fastest-levenshtein` npm package)

### 2. Rebase After Apply

Run this after every feedback application. It's purely client-side string matching — no API call.

```typescript
function rebaseFeedback(
  documentText: string,
  feedbackStore: FeedbackStore
): FeedbackStore {
  const updatedItems = feedbackStore.items.map((fb) => {
    // Skip items that are already terminal
    if (fb.status === "applied" || fb.status === "dismissed") return fb;

    // Try to find the anchor in the updated document
    const match = findAnchor(documentText, fb.item);

    if (match) {
      // Anchor still exists — feedback is still valid
      return { ...fb, matchPosition: match, status: "active" as const };
    }

    // Anchor is gone. Check if the suggestion is now present (auto-resolved)
    if (fb.item.suggestion && documentText.includes(fb.item.suggestion)) {
      return { ...fb, matchPosition: null, status: "applied" as const };
    }

    // Anchor is gone and suggestion isn't present — conflicted
    return { ...fb, matchPosition: null, status: "conflicted" as const };
  });

  // Re-compute overlap groups from surviving active items
  const activeItems = updatedItems.filter((fb) => fb.status === "active" && fb.matchPosition);
  const groups = computeOverlapGroups(activeItems);

  return { items: updatedItems, groups };
}
```

### 3. Overlap Grouping

Cluster feedback items whose target regions overlap or are adjacent (within N characters).

```typescript
const ADJACENCY_THRESHOLD = 20; // chars — tune based on UX testing

function computeOverlapGroups(activeItems: FeedbackState[]): FeedbackGroup[] {
  // Sort by start position
  const sorted = [...activeItems]
    .filter((fb) => fb.matchPosition !== null)
    .sort((a, b) => a.matchPosition!.start - b.matchPosition!.start);

  const groups: FeedbackGroup[] = [];
  let currentGroup: FeedbackState[] = [];

  for (const fb of sorted) {
    if (currentGroup.length === 0) {
      currentGroup.push(fb);
      continue;
    }

    const lastInGroup = currentGroup[currentGroup.length - 1];
    const lastEnd = lastInGroup.matchPosition!.end;
    const currentStart = fb.matchPosition!.start;

    if (currentStart <= lastEnd + ADJACENCY_THRESHOLD) {
      // Overlapping or adjacent — same group
      currentGroup.push(fb);
    } else {
      // New group
      if (currentGroup.length > 1) {
        groups.push(buildGroup(currentGroup));
      }
      currentGroup = [fb];
    }
  }

  // Flush last group
  if (currentGroup.length > 1) {
    groups.push(buildGroup(currentGroup));
  }

  return groups;
}

function buildGroup(items: FeedbackState[]): FeedbackGroup {
  return {
    groupId: `group-${items[0].item.id}`,
    feedbackIds: items.map((fb) => fb.item.id),
    mergedAnchorStart: Math.min(...items.map((fb) => fb.matchPosition!.start)),
    mergedAnchorEnd: Math.max(...items.map((fb) => fb.matchPosition!.end)),
  };
}
```

### 4. Apply a Feedback Item

```typescript
function applyFeedback(
  documentState: DocumentState,
  feedbackStore: FeedbackStore,
  feedbackId: string
): { documentState: DocumentState; feedbackStore: FeedbackStore } {
  const fb = feedbackStore.items.find((f) => f.item.id === feedbackId);
  if (!fb || fb.status !== "active" || !fb.item.isActionable) {
    return { documentState, feedbackStore }; // No-op
  }

  // Locate the anchor in current text
  const match = findAnchor(documentState.content, fb.item);
  if (!match) {
    // Can't find it — mark conflicted, don't modify document
    const updatedItems = feedbackStore.items.map((f) =>
      f.item.id === feedbackId ? { ...f, status: "conflicted" as const } : f
    );
    return { documentState, feedbackStore: { ...feedbackStore, items: updatedItems } };
  }

  // Perform the replacement
  const newContent =
    documentState.content.substring(0, match.start) +
    fb.item.suggestion +
    documentState.content.substring(match.end);

  const newDocState: DocumentState = {
    content: newContent,
    version: documentState.version + 1,
    feedbackGenVersion: documentState.feedbackGenVersion,
  };

  // Mark this item as applied
  const updatedItems = feedbackStore.items.map((f) =>
    f.item.id === feedbackId ? { ...f, status: "applied" as const } : f
  );

  // Rebase all remaining feedback against the new document
  const rebasedStore = rebaseFeedback(newContent, { ...feedbackStore, items: updatedItems });

  return { documentState: newDocState, feedbackStore: rebasedStore };
}
```

---

## AI Integration

### Triggering Feedback

```typescript
const DEBOUNCE_MS = 1500; // Adjust based on UX preference (1–3 seconds typical)

// Debounced handler on text change
let debounceTimer: ReturnType<typeof setTimeout>;

function onTextChange(newContent: string) {
  documentState.content = newContent;
  documentState.version++;

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    requestFeedback(documentState);
  }, DEBOUNCE_MS);
}
```

### AI Prompt Structure

When calling the AI agent, use a system prompt that enforces the structured output format:

```
SYSTEM PROMPT (for the feedback AI agent):
---
You are a writing feedback assistant. Analyze the provided text and return 
structured feedback as a JSON array. Each item MUST include:

- id: A unique string identifier (e.g., "fb-001")
- category: One of "spelling", "grammar", "formatting", "logic", "evidence", "clarity"
- anchorText: The EXACT substring from the text that this feedback targets.
  Copy it character-for-character. This is critical for the system to work.
- contextBefore: The ~30 characters immediately before anchorText in the document.
  If anchorText is near the start, include whatever is available.
- contextAfter: The ~30 characters immediately after anchorText in the document.
  If anchorText is near the end, include whatever is available.
- suggestion: The replacement text. If the feedback is advisory (no specific 
  replacement), set this to "" and set isActionable to false.
- rationale: A concise explanation of why this change is recommended.
- isActionable: true if you are providing a concrete text replacement, 
  false if this is advisory feedback the user should address manually.

IMPORTANT RULES:
- anchorText must be a VERBATIM substring of the input. Do not correct it.
- Keep anchorText as SHORT as necessary to isolate the issue (a phrase or 
  sentence, not a paragraph), but long enough to be unique in the document.
- Prioritize: spelling > grammar > clarity > logic > evidence > formatting.
- Return a maximum of 15 feedback items per call.
- Return valid JSON only. No markdown fencing. No preamble.

Respond ONLY with the JSON array.
---
```

### Scoped Re-Call (Partial Refresh)

When multiple items become conflicted (e.g., user rewrites a paragraph), offer a targeted refresh:

```typescript
async function refreshConflictedRegion(
  documentState: DocumentState,
  feedbackStore: FeedbackStore
): Promise<FeedbackItem[]> {
  const conflicted = feedbackStore.items.filter((fb) => fb.status === "conflicted");
  if (conflicted.length === 0) return [];

  // Find the paragraph(s) that contain the conflicted regions
  // Use last known positions or search for nearby context
  const paragraphs = extractAffectedParagraphs(documentState.content, conflicted);

  // Send only those paragraphs to the AI with context
  const response = await callFeedbackAI({
    text: paragraphs.text,
    instruction: "Review ONLY the provided excerpt. Return feedback for this section only.",
    existingFeedbackIds: conflicted.map((fb) => fb.item.id), // So AI can generate new IDs
  });

  return response.feedback;
}
```

---

## UI Component Structure

### Feedback Panel

```
┌─────────────────────────────────────────┐
│  AI Feedback  (7 items)        [Refresh] │
├─────────────────────────────────────────┤
│                                          │
│  ── Spelling (2) ──────────────────────  │
│  ┌─────────────────────────────────────┐ │
│  │ "recieve" → "receive"              │ │
│  │ [Apply] [Dismiss]                   │ │
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │ "occurence" → "occurrence"          │ │
│  │ [Apply] [Dismiss]                   │ │
│  └─────────────────────────────────────┘ │
│                                          │
│  ── Logic (1) ─────────────────────────  │
│  ┌─────────────────────────────────────┐ │
│  │ "the data clearly demonstrates"     │ │
│  │ → "the data suggests"              │ │
│  │ Claim exceeds what a single table   │ │
│  │ can demonstrate.                    │ │
│  │ [Apply] [Dismiss]                   │ │
│  └─────────────────────────────────────┘ │
│                                          │
│  ── Conflicted (1) ───────────────────  │
│  ┌─────────────────────────────────────┐ │
│  │ ⚠ This section was changed.        │ │
│  │ Original: "the enrollment data..."  │ │
│  │ [Refresh This Item] [Dismiss]       │ │
│  └─────────────────────────────────────┘ │
│                                          │
│  ── Applied (3) ──── [Show/Hide] ─────  │
│  ✓ Fixed "recieve" → "receive"          │
│  ✓ Fixed comma splice in paragraph 2    │
│  ✓ Reworded passive voice               │
└─────────────────────────────────────────┘
```

### Grouped Feedback (Overlapping Region)

When feedback items overlap, present them as a stack with a combined preview:

```
┌─────────────────────────────────────────┐
│ 📎 2 suggestions for this sentence      │
│                                          │
│ BEFORE: "the data clearly demonstartes  │
│          that enrollment increased"      │
│                                          │
│  1. Spelling: "demonstartes" → "demos." │
│  2. Logic: "clearly demonstrates" →     │
│     "suggests"                           │
│                                          │
│ COMBINED PREVIEW:                        │
│ "the data suggests that enrollment      │
│  increased"                              │
│                                          │
│ [Apply All] [Apply Individually ▾]       │
└─────────────────────────────────────────┘
```

### Editor Highlights

When a feedback item is hovered or selected in the panel, highlight the anchor region in the editor:

- **Active feedback:** Light yellow underline
- **Hovered feedback:** Brighter highlight with tooltip showing the rationale
- **Conflicted:** Red dashed underline (on last known region, if approximatable)
- **Applied:** Brief green flash, then fade

---

## Lifecycle & State Machine

Each feedback item follows this state flow:

```
                    ┌──────────┐
     AI returns ──► │  ACTIVE  │
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
        User clicks   Rebase:    Rebase:
        "Apply"       anchor     anchor gone,
              │        found     suggestion
              │          │       present
              ▼          │          │
        ┌──────────┐    │          │
        │ APPLYING │    │          │
        └────┬─────┘    │          │
             │          │          │
             ▼          ▼          ▼
        ┌──────────────────────────┐     Rebase:
        │        APPLIED           │     anchor gone,
        └──────────────────────────┘     suggestion absent
                                              │
        ┌──────────┐                          │
        │ DISMISSED │ ◄── User clicks         │
        └──────────┘     "Dismiss"            ▼
                                        ┌────────────┐
                                        │ CONFLICTED  │
                                        └──────┬─────┘
                                               │
                                    User clicks "Refresh"
                                               │
                                               ▼
                                        ┌────────────┐
                                        │   ACTIVE    │
                                        │ (new item)  │
                                        └────────────┘
```

---

## Implementation Order

Build in this sequence. Each step is independently testable.

### Phase 1: Core Data Model & Anchor Matching
- [ ] Define TypeScript interfaces (DocumentState, FeedbackItem, FeedbackState)
- [ ] Implement `findAnchor()` with exact match (Passes 1 and 2 only)
- [ ] Write unit tests: anchor found, anchor moved, anchor missing
- [ ] Add fuzzy match (Pass 3) with Levenshtein
- [ ] Install `fastest-levenshtein` (or implement a simple version)

### Phase 2: Feedback Store & Rebase
- [ ] Implement `rebaseFeedback()` 
- [ ] Implement `applyFeedback()`
- [ ] Implement `computeOverlapGroups()`
- [ ] Write integration tests: apply one item, verify others rebase correctly
- [ ] Test: apply item that invalidates another → confirm conflicted status

### Phase 3: AI Integration
- [ ] Build debounced `onTextChange` handler
- [ ] Write the AI prompt (use prompt from this spec)
- [ ] Build `requestFeedback()` API call
- [ ] Parse and validate AI response into FeedbackItem[]
- [ ] Handle malformed AI responses gracefully (retry once, then skip bad items)
- [ ] Build `refreshConflictedRegion()` for scoped re-calls

### Phase 4: UI — Feedback Panel
- [ ] Build FeedbackPanel component with category sections
- [ ] Render feedback cards with Apply / Dismiss buttons
- [ ] Wire Apply button to `applyFeedback()` → update editor → rebase
- [ ] Show conflicted items with "Refresh" action
- [ ] Show applied items in a collapsible "Applied" section
- [ ] Add item count badges per category

### Phase 5: UI — Editor Integration
- [ ] Highlight anchor regions on hover / selection
- [ ] Scroll-to-anchor when a feedback card is clicked
- [ ] Green flash animation on successful apply
- [ ] Inline diff preview (before → after) on hover

### Phase 6: Overlap Groups
- [ ] Render grouped feedback as stacked cards
- [ ] Build combined preview showing all changes applied together
- [ ] "Apply All" button for groups
- [ ] Ensure group dissolves correctly when one item is applied and others rebase

### Phase 7: Polish & Edge Cases
- [ ] Handle rapid user typing during feedback display (pause rebase during active typing)
- [ ] Handle empty document / very short document
- [ ] Handle AI returning duplicate anchors
- [ ] Add "Apply All" button for entire feedback set (apply in order: spelling → grammar → clarity → logic → evidence → formatting)
- [ ] Add undo support (Ctrl+Z should revert the last applied feedback and restore it to active)
- [ ] Performance test with 5,000+ word documents and 15 feedback items

---

## Key Dependencies

| Package | Purpose |
|---|---|
| `fastest-levenshtein` | Fuzzy string matching for anchor resolution |
| Your preferred editor lib (CodeMirror, ProseMirror, TipTap, or plain contentEditable) | Text editing surface |
| Your AI API client | Calls to feedback agent |

---

## Configuration Constants

```typescript
const CONFIG = {
  DEBOUNCE_MS: 1500,                // Pause before triggering AI feedback
  MAX_FEEDBACK_ITEMS: 15,           // Cap per AI call
  FUZZY_MATCH_THRESHOLD: 0.2,       // 20% character difference tolerance
  FUZZY_SEARCH_RADIUS: 500,         // Chars around last known position for fuzzy search
  ADJACENCY_THRESHOLD: 20,          // Chars between anchors to consider "adjacent"
  CONTEXT_WINDOW: 30,               // Chars of context before/after anchor
  SCOPED_REFRESH_PADDING: 200,      // Extra chars around conflicted region for re-call
};
```

---

## Notes for Development

1. **Do NOT use character offsets from the AI response as the primary locator.** The entire architecture depends on the AI returning verbatim `anchorText` strings. Validate that `anchorText` is a real substring of the input before storing the feedback item.

2. **The rebase operation is the critical path.** It must be fast and correct. It runs after every single apply. Profile it early.

3. **The AI prompt is load-bearing.** If the AI returns anchorText that doesn't exactly match the source, everything downstream breaks. Include validation on the client: if `document.indexOf(item.anchorText) === -1`, log a warning and attempt fuzzy match immediately rather than showing a broken card.

4. **Undo is important for user trust.** If a user applies a suggestion and it makes things worse, they need a clean one-click way back. Integrate with the editor's native undo stack if possible.
