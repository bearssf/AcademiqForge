# AcademiqForge

Single-page home with centered logo, email/password sign-in, and registration backed by **Azure SQL / Microsoft SQL Server**. Intended to deploy on [Render](https://render.com) (Node) with the repository: **[bearssf/AcademiqForge](https://github.com/bearssf/AcademiqForge)**.

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and a strong `SESSION_SECRET`.
3. Run:
   ```bash
   npm start
   ```
4. Open **http://localhost:3000**.

Store database credentials only in environment variables or your host’s secret store—never commit them to git.

## Stripe (subscriptions)

Used for **Upgrade to member** on **Account** and **`subscriptions`** rows (`status`, Stripe IDs, `current_period_end`).

1. In the [Stripe Dashboard](https://dashboard.stripe.com), create a **Product** and recurring **Prices** (e.g. monthly + yearly). Copy each Price ID (`price_...`).
2. Add API keys and webhook secret to your environment (see `.env.example`):
   - **`STRIPE_SECRET_KEY`** — Secret key (`sk_test_...` or `sk_live_...`).
   - **`STRIPE_PUBLISHABLE_KEY`** — Publishable key only (`pk_test_...` / `pk_live_...`, **not** the secret `sk_...`). When set (with the variables below), **Account** sends users to **`/billing/subscribe`** so they pay **on your site** via Stripe [Payment Element](https://stripe.com/docs/payments/payment-element) (card data still stays with Stripe). If omitted or invalid, **Account** uses hosted **Stripe Checkout** at **`/billing/checkout`** (redirect to `stripe.com`). The value must start with **`pk_`** (quotes around the value in Render are OK). Aliases also read: **`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`**, **`VITE_STRIPE_PUBLISHABLE_KEY`**, **`STRIPE_PUBLIC_KEY`**.
   - **Pricing (pick one style):**
     - **Two options on Account:** **`STRIPE_PRICE_MONTHLY`** and **`STRIPE_PRICE_YEARLY`** — both required; users choose Monthly or Yearly.
     - **Single option:** **`STRIPE_PRICE_ID`** only — one “Upgrade to member” button (backward compatible).
   - **`PUBLIC_BASE_URL`** — Public origin of this app **with no trailing slash**, e.g. `https://your-app.onrender.com`. Used for return URLs after payment and for Checkout when the publishable key is not set.
3. **Webhooks:** Add endpoint **`POST /webhooks/stripe`**. For production, use your real `PUBLIC_BASE_URL` + `/webhooks/stripe`. Subscribe to at least:
   - `checkout.session.completed` (hosted Checkout only)
   - `customer.subscription.created` (on-site subscribe flow — syncs incomplete → active)
   - `customer.subscription.updated`
   - `customer.subscription.deleted`  
   Copy the **Signing secret** into **`STRIPE_WEBHOOK_SECRET`**.
4. **Local testing:** Install [Stripe CLI](https://stripe.com/docs/stripe-cli), run `stripe listen --forward-to localhost:3000/webhooks/stripe`, and paste the CLI webhook secret into **`STRIPE_WEBHOOK_SECRET`** for that session.

**Troubleshooting on-site billing:** After deploy, check Render **Logs** on boot: you should see `Stripe: on-site billing enabled` when **`STRIPE_PUBLISHABLE_KEY`** is recognized. If you see `hosted Checkout only`, the publishable key was not loaded (wrong name, wrong service, or value not starting with `pk_`). On **Account**, use **View page source** and look for `<!-- billing: subscribe-on-site -->` vs `checkout-redirect`.

Successful payment sets `subscriptions.status` to **`active`** (unlocks The Foundry). Canceled / unpaid subscriptions map to **`canceled`** (or **`past_due`** when applicable).

## Render

1. Create a **Web Service** connected to this repo, runtime **Node**, build `npm ci`, start `npm start`.
2. Set the same environment variables as in `.env.example`. Use `NODE_ENV=production` so session cookies use `Secure` behind HTTPS.
3. **Azure SQL networking (required):**
   - In **Azure Portal** → your **SQL server** (logical server, not only the database) → **Networking**:
     - Set **Public network access** to **Enabled** (Render connects over the public internet unless you use a complex private setup).
     - Under **Firewall rules**, add the **IPv4 ranges** from your Render web service: **Render Dashboard** → open the service → **Outbound** tab. For each CIDR (e.g. `74.220.48.0/24`), add a rule with **Start IP** = first address and **End IP** = last address in that range.
   - The toggle **“Allow Azure services and resources to access this server”** only helps *other Azure* services, **not** Render— you still need explicit firewall rules for Render’s outbound IPs.
   - If the deploy log shows `Failed to connect ... in 15000ms` / timeout, that is almost always **firewall or public access**, not a wrong password (wrong passwords usually fail with a login error quickly).

4. Optional: use this repo’s `render.yaml` as a [Blueprint](https://render.com/docs/infrastructure-as-code) and fill in secret values in the dashboard.
5. **Sessions (recommended in production):** Add a **Redis** instance (Render Redis or any `redis://` / `rediss://` URL) and set **`REDIS_URL`** on the web service. Without it, the app uses in-memory sessions (logins can reset on deploy or with more than one instance).

## Data model & REST API

On startup the app creates (if missing): **`subscriptions`** (trial / future Stripe fields), **`projects`**, **`project_sections`** (including optional **`body`** draft text per section), **`sources`**, **`source_sections`**. Templates for new projects live in `data/project-templates.json`.

**Session:** Sign in with the same browser session cookie. From JavaScript, call APIs with `fetch(url, { credentials: 'same-origin' })`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/me` | Profile fields, subscription row, computed `appAccess` |
| PATCH | `/api/me` | Update profile: `title`, `firstName`, `lastName`, `university`, `researchFocus`, `preferredSearchEngine` (email not changeable here) |
| POST | `/api/me/password` | `currentPassword`, `newPassword`, `confirmPassword` |
| GET | `/api/templates` | Available `templateKey` values + labels |
| GET | `/api/projects` | List projects for the signed-in user |
| POST | `/api/projects` | Body: `name`, `purpose`, `citationStyle`, `templateKey` — creates project + sections |
| GET | `/api/projects/:id` | Project + sections + `sourceCount` |
| PATCH | `/api/projects/:id` | Partial update (name, status, publishing\* fields) |
| PATCH | `/api/projects/:id/sections/:sectionId` | `status`, `progressPercent`, `body` (draft text, `NVARCHAR(MAX)`) |
| GET | `/api/projects/:id/sources` | Sources with `sectionIds` |
| POST | `/api/projects/:id/sources` | `citationText`, `notes`, optional `sectionIds[]` |
| PATCH | `/api/sources/:id` | Update source and/or replace `sectionIds` |
| DELETE | `/api/sources/:id` | Remove source |
| POST | `/api/billing/subscription-intent` | Signed-in only. JSON body `{ "interval": "month" \| "year" }` when both prices are set. Returns `{ clientSecret }` for Stripe.js (on-site subscribe page). |

**Purposes:** Dissertation, Academic Publication, Thesis, Essay, Report, Conference Document, Other. **Citation styles:** APA, MLA, Chicago, Turabian, IEEE.

**Foundry access:** `appAccess.foundryUnlocked` is true only when `subscriptions.status = 'active'` (paid via Stripe webhook or `DEV_SUBSCRIPTION_PAID`). Trial rows use `status = 'trialing'` with `trial_end`. Set `DEV_SUBSCRIPTION_PAID=true` locally to simulate paid UI without Stripe.

## Features

- **Billing:** **Account** → **`/billing/subscribe`** (on-site payment when **`STRIPE_PUBLISHABLE_KEY`** is set) or **`/billing/checkout`** (hosted Stripe Checkout otherwise); optional `?interval=month|year` when both prices are set. **`POST /webhooks/stripe`** updates `subscriptions` (see **Stripe** section above).
- **The Crucible** (`/app/project/:id/crucible`): list, add, edit, and delete sources; link each source to outline sections via the REST API (`fetch` with `credentials: 'same-origin'`).
- **The Anvil** (`/app/project/:id/anvil`): per-section draft editor with autosave; drafts persist in `project_sections.body`.
- **Framework** (`/app/project/:id/framework`): placeholder (“coming soon”) until outline/evidence UX is defined.
- **Home:** Marketing landing + sign-in; **Workspace** (`/app/dashboard`) when signed in.
- **Header (signed out):** Email and password, Sign in, and **Create an account** below.
- **Header (signed in):** **Welcome, [first name]** and Sign out (login UI hidden).
- **Account** (`/app/account`): Edit profile (same fields as registration; email read-only) and change password; subscription and billing (see **Billing**).
- **Registration:** Title (Mr., Mrs., Ms., Miss, Mx., Dr.), first/last name, email, password + confirmation; optional university (datalist of US institutions + free text), research focus, preferred search engine (preset list including “Other/University Specific”).
- Passwords hashed with **bcrypt**. On first connection, the app ensures a `users` table and profile columns exist in your database.

## Backlog

- **Account / billing:** Let a signed-in user **cancel** (or manage) their subscription from the Account page — typically [Stripe Customer Portal](https://stripe.com/docs/customer-management) (`billingPortal.sessions.create`) and/or cancel-at-period-end via the API, with **`customer.subscription.*`** webhooks keeping `subscriptions` in sync.
- **Account / billing (post-payment UX):** After returning from payment (`?subscription=success`), subscription can show **pending** until webhooks update the row — usually seconds. **Backlog:** light polling or a **Refresh status** control on Account, and/or short copy that webhook confirmation is typically immediate but can occasionally lag.
- **User management:** **Profile edit** and **password change** are on **Account** (`PATCH /api/me`, `POST /api/me/password`). **Email** change / verification — not started (would require a verified flow and Stripe sync if billing email must match).

## Repository

```bash
git remote add origin https://github.com/bearssf/AcademiqForge.git
```

Push your branch after configuring remotes and authentication with GitHub.
