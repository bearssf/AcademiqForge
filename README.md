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

## Features

- **Home:** Black background, centered AcademiqForge logo (`public/logo.png`).
- **Header (signed out):** Email and password, Sign in, and **Create an account** below.
- **Header (signed in):** **Welcome, [first name]** and Sign out (login UI hidden).
- **Registration:** Title (Mr., Mrs., Ms., Miss, Mx., Dr.), first/last name, email, password + confirmation; optional university (datalist of US institutions + free text), research focus, preferred search engine (preset list including “Other/University Specific”).
- Passwords hashed with **bcrypt**. On first connection, the app ensures a `users` table and profile columns exist in your database.

## Repository

```bash
git remote add origin https://github.com/bearssf/AcademiqForge.git
```

Push your branch after configuring remotes and authentication with GitHub.
