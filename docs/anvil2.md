# The Anvil (beta) — `anvil2`

Parallel workspace at **`/app/project/:projectId/anvil2`** for experimenting with **anchor-based structured AI feedback** without changing the classic Anvil.

- **Spec:** [ai-feedback-system-spec.md](./ai-feedback-system-spec.md)
- **API:** `POST /api/projects/:projectId/sections/:sectionId/review-structured` — returns `{ items }` from Bedrock; **does not** write to `anvil_suggestions`.
- **Data:** Uses the same `project_sections.body` as the classic Anvil (same drafts).

To remove the experiment: delete the `anvil2` route and related files; keep or drop `review-structured` and `bedrockStructuredReview.js` as needed.
