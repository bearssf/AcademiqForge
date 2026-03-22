# AWS Bedrock (Anvil AI review — Phase 7)

Phase 7 calls **Amazon Bedrock** from the server via `POST /api/projects/:id/sections/:sectionId/review`, parses the model response, and inserts rows with the Phase 6 API (same table as manual `POST .../suggestions`).

**Model compatibility:** The app uses the **Anthropic Messages** body shape (`anthropic_version: bedrock-2023-05-31`) and **`InvokeModel`**. Set **`BEDROCK_MODEL_ID`** to a **Claude** model id (or inference profile) your account can invoke in **`AWS_REGION`**. Other model families (e.g. Titan, Llama) use different request bodies and are not supported without code changes.

## What to configure

| Variable | Where | Purpose |
|----------|--------|---------|
| `AWS_REGION` | `.env` locally; **Environment** on Render (or your host) | Region where Bedrock is enabled, e.g. `us-east-1`. |
| `AWS_ACCESS_KEY_ID` | Same | IAM user access key **or** omit if the process uses an **instance / task IAM role** with `bedrock:InvokeModel` (preferred in production). |
| `AWS_SECRET_ACCESS_KEY` | Same | Secret for the key above; omit with IAM role. |
| `BEDROCK_MODEL_ID` | Same | Inference profile or model id your account can invoke (e.g. Anthropic Claude — exact id varies by region and AWS naming). |

Optional (if you use a different env name in code later): `BEDROCK_INFERENCE_PROFILE_ARN` — some setups use an inference profile ARN instead of a raw model id.

### Bedrock-specific API keys (optional)

Some AWS consoles let you create **API keys scoped to Bedrock** (separate from IAM user access keys). If you have those, you can store them as:

| Variable | Purpose |
|----------|---------|
| `BEDROCK_API_KEY_ID` | Identifier for the Bedrock API key (e.g. may start with `bedrock-api-key-`). |
| `BEDROCK_API_KEY_VALUE` | Secret value for that key. |

The **default** Node.js AWS SDK path for `InvokeModel` uses **SigV4 with IAM** (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` or an IAM role). Bedrock API keys may use a **different** auth mechanism depending on AWS API and SDK version. **Phase 7** will use whichever combination the official docs support for your setup; keeping both IAM and Bedrock key vars in Render is fine—implementation will follow AWS guidance for precedence (often IAM first unless you standardize on API keys only).

### IAM access keys vs other “API keys”

**`AWS_ACCESS_KEY_ID` is only for IAM access keys** (from **IAM → Users → Security credentials → Create access key**). The access key **ID** usually starts with **`AKIA`** (or **`ASIA`** for temporary credentials). It is paired with **`AWS_SECRET_ACCESS_KEY`** (the secret shown once when the key is created).

If you have a **Bedrock-only** key whose id looks like **`bedrock-api-key-...`**, do **not** put that string in `AWS_ACCESS_KEY_ID`. Use **`BEDROCK_API_KEY_ID`** / **`BEDROCK_API_KEY_VALUE`** for those, and use **`AWS_ACCESS_KEY_ID`** / **`AWS_SECRET_ACCESS_KEY`** for IAM keys—or rely on IAM alone if you are not using Bedrock API keys.

## IAM

Create or attach a policy that allows **`bedrock:InvokeModel`** (and **`bedrock:InvokeModelWithResponseStream`** if you stream) on the resources you need. In the AWS console, enable **model access** for the chosen foundation model in **Bedrock → Model access**.

### Fixing “Bedrock access denied” (`AccessDeniedException`)

That message means the **IAM user** behind `AWS_ACCESS_KEY_ID` is not allowed to call **`bedrock:InvokeModel`** for the **model + region** you’re using, or the **model isn’t enabled** for the account in that region.

Work through this in order:

1. **Region match** — In Render, **`AWS_REGION`** must be the **same region** where you enabled Bedrock and **Model access** (e.g. both `us-east-1`). **`BEDROCK_MODEL_ID`** must be a model (or inference profile) that exists **in that region** (copy the id from **Bedrock → Chat / Text** or **Model access**, not from another region).

2. **Model access (console)** — AWS Console → **Amazon Bedrock** → **Model access** (or **Bedrock configurations** → model access, depending on UI). Request access to **Anthropic Claude** (the family your `BEDROCK_MODEL_ID` uses). Wait until access shows as **Available** / granted.

3. **IAM policy on your app user** — Attach an inline or managed policy to the **same IAM user** whose keys you put in Render. Minimal example (tighten `Resource` later for production):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockInvokeClaude",
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel"],
      "Resource": "*"
    }
  ]
}
```

If your organization uses **SCPs** or permission boundaries, an admin may need to allow `bedrock:InvokeModel` there as well.

4. **Inference profile** — If **`BEDROCK_MODEL_ID`** is an **application inference profile** id or ARN, IAM must still allow `InvokeModel` on that profile; some setups use `bedrock:InvokeModel` with the profile ARN as resource—if access is still denied, scope **`Resource`** to the exact ARN shown in the Bedrock console for that profile.

5. **Redeploy** — After changing IAM or env vars, **save** the IAM policy and **redeploy** Render so the app picks up any env changes.

## Local development

1. Copy `.env.example` to `.env` (never commit `.env`).
2. Add the variables above with **test** credentials or a role-backed profile (`AWS_PROFILE` if using the AWS CLI credential chain in code — only if your app supports it).

## Render (or similar PaaS)

Add the same keys under **Environment** → **Environment Variables**. Prefer **no long-lived keys**: use the platform’s IAM integration if available, or rotate keys on a schedule. After changing variables, **trigger a new deploy** (or restart) so running instances load the updated values.

## Troubleshooting (no suggestions in the Anvil)

- **Hint line** (blue banner under “Feedback & suggestions”): after deploy, the UI shows **why** a review was skipped or if Bedrock returned an error (e.g. IAM, wrong model id, or “write more” if the draft is still very short in plain text).
- **Minimum draft length:** the server skips Bedrock until plain text (HTML stripped) is at least **`MIN_DRAFT_PLAIN_CHARS`** (see `lib/bedrockReview.js`, currently low — about one short paragraph).
- **Timing:** review runs **~4.5s after you stop typing**, not 30s; there is also a **minimum gap** between successful reviews (~28s) so the same edit isn’t sent repeatedly.
- **Network tab:** `POST .../review` — **503** = env not set; **502** = Bedrock/AWS error (read JSON `error`).

## Security

- Do **not** expose AWS credentials to the browser.
- Keep prompts and Crucible context **server-side**; return only normalized suggestion payloads to the client.

See also [anvil-vision.md](anvil-vision.md) Phase 7.
