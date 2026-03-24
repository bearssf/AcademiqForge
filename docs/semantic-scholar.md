# Semantic Scholar (`lib/semanticScholar.js`)

The app includes a **Semantic Scholar Graph API** client for paper search (`/graph/v1/paper/search`). It is used by **`npm run test:s2`** (see `scripts/test-semantic-scholar.js`) to verify connectivity from your network.

## Configuration

| Variable | Purpose |
|----------|---------|
| `SEMANTIC_SCHOLAR_API_KEY` | Optional. Sent as `x-api-key` if set. Semantic Scholar documents a public key on their site; you can also obtain your own. |

## Troubleshooting

- From the repo root run **`npm run test:s2`** to verify S2 returns papers from your network.
- **Per-request timeout** — Each S2 HTTP call can abort after a bounded wait so one slow request does not block the process indefinitely.
