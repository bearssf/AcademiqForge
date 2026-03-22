# Semantic Scholar (related reading on The Crucible)

The Crucible **Related reading** action calls **`GET /api/projects/:projectId/related-reading`**, which:

1. Builds a **single** search string from the project’s **name** (or **publishing title** when set) plus short snippets from up to five sources.
2. Calls the **Semantic Scholar Graph API** paper search (`/graph/v1/paper/search`) with a **process-wide** queue: the next request starts only after the previous one **finishes**, then waits **~1s** so the app stays near the public **1 request/second** guideline. **429** responses retry with exponential backoff before surfacing an error.
3. If no papers are returned or the request fails, and **AWS Bedrock** is configured, the server asks the model for **short topic search phrases**. It then runs **up to three** additional Semantic Scholar searches (same queue, one at a time), merges and dedupes results, and returns **paper tiles** (title, authors, year, link). If those searches still find nothing, the UI falls back to **search phrase links** only.

## Configuration

| Variable | Purpose |
|----------|---------|
| `SEMANTIC_SCHOLAR_API_KEY` | Optional. Sent as `x-api-key` if set. Semantic Scholar documents a public key on their site; you can also obtain your own. |

See also [product-backlog.md](./product-backlog.md) (Semantic Scholar notes).

## Troubleshooting

- **Crucible “Get suggestions” spins forever** — Usually a hung outbound HTTP call or stacked duplicate click handlers (fixed in app: single listener + client/server timeouts). From the repo root run **`npm run test:s2`** to verify S2 returns papers from your network.
- **504 from `/api/.../related-reading`** — The combined Semantic Scholar (+ optional Bedrock + follow-up searches) step exceeded ~170s; try again or add **`SEMANTIC_SCHOLAR_API_KEY`**.
- **Per-request timeout** — Each S2 HTTP call aborts after **30s** so one slow request cannot block the server’s global S2 queue indefinitely.
