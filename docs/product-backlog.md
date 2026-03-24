# Product backlog (post–core solid)

Reference list for deferred and in-flight work. **Do not put API keys in this file** — use environment variables (e.g. `SEMANTIC_SCHOLAR_API_KEY`).

## Phases (vision alignment)

| # | Item | Notes |
|---|------|--------|
| 6 | Feedback persistence | DB + API for suggestions (category, text, open / applied / ignored, optional anchor). Bedrock and scoring consume this. |
| 7 | AWS Bedrock | Server route, debounced per-paragraph review + bibliography context → suggestions via Phase 6 API. |
| 8 | Score strip | Right rail top: Weak / Moderate / Improving / Strong from stored counts. |
| 9 | Section-change guard | Before switching sections: citation / completeness checks in the rail (soft warning or confirm). |
| 10 | Progress awareness (center) | Word count, section status, last reviewed — middle column once shell exists. |

## Polish & features

1. **Delete project** — Portfolio: irreversible delete with explicit confirmation (implemented: `DELETE /api/projects/:id` + dashboard UI).
2. **Sidebar active state** — Only highlight the project row when in that project’s workspace (`navActive === 'workspace'` + `currentProjectId`); non-workspace pages pass `currentProjectId: null`).
3. **Anvil default font** — From project citation style (e.g. Times New Roman 12pt; IEEE 10pt).
4. **Export styling** — Font matches citation style; text always black in exports.
5. **Insert image in Anvil** — Beyond paste: explicit insert action.
6. **Export copy** — Removed whole-project hint and whole-project export links from Anvil bar; export block below save row.
7. **Sources: Select all** — *(Removed with The Crucible workspace.)* Was: apply a source to all sections at once (All / None bulk actions).
8. **Sources: citation count badge** — *(Removed with The Crucible workspace.)* Was: per-source in-text usage count; modal with excerpts.
9. **Sources: source sort** — *(Removed with The Crucible workspace.)* Was: alphabetical vs date added with session persistence.
10. **Anvil paste** — Normalize pasted text color to white and font to style; keep other formatting.
11. **Anvil rail spacing** — Extra gap between feedback pane and citations (~1/8″).
12. **Sources: DOI** — Optional field on `sources`; Anvil citations rail may link when present. *(The Crucible UI for bulk source management was removed.)*
13. **Related articles** — *(Removed with The Crucible workspace.)* Was: Semantic Scholar + optional Bedrock fallback via `GET /api/projects/:id/related-reading`. Client helper `lib/relatedArticles.js` deleted; `lib/semanticScholar.js` remains for `npm run test:s2` — see [semantic-scholar.md](./semantic-scholar.md).

## Semantic Scholar integration notes

- Rate limit: **one successful request per second** cumulative across endpoints; implement a client-side limit **below** 1/s if possible.
- Configure **`SEMANTIC_SCHOLAR_API_KEY`** in `.env` / host secrets only.
