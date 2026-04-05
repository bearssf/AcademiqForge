# Research Anatomy pipeline — Lambda orchestration (reference)

The app currently runs the **Upload → Extract → Chunk → Evaluate → Score → Store → Present** flow **inside the Node process** after `POST /api/projects/:projectId/research-anatomy/run`: the browser uploads the assembled manuscript text to S3 via a **presigned PUT**, then the server loads that object (or falls back to the live project bundle), runs Bedrock passes, and writes results to MySQL.

For heavier scale or longer timeouts, you can move orchestration to AWS with a **simple chain**:

1. **Upload** — Browser → presigned `PutObject` to bucket `academiqforgedocs` (or `RESEARCH_ANATOMY_S3_BUCKET`), key prefix `users/{userId}/projects/{projectId}/ra/`.
2. **Trigger** — `StartExecution` on Step Functions, or S3 event → **Lambda A**.
3. **Extract** — Lambda A reads the object (UTF-8 text today; optional **docx** path: unzip + `mammoth`/similar for HTML → text). Persist `processing_status` in MySQL.
4. **Chunk** — Shared library or Lambda layer: section-aware splits + overlap (same strategy as `lib/researchAnatomyPipeline.js`).
5. **Evaluate / Score** — Lambda B/C invoke **Bedrock** (Claude) with temperature `0` for scoring; aggregate JSON per component.
6. **Store** — Write `research_anatomy_runs` (or a normalized child table) with `results_json`, `cooldown_until`, `status`.
7. **Present** — Front end polls `GET .../research-anatomy/status` or receives push/WebSocket when `status === 'complete'`.

Environment variables to mirror the app server: `AWS_REGION`, Bedrock model/profile vars (`BEDROCK_*`), S3 bucket, and MySQL connectivity from Lambda (VPC if required).
