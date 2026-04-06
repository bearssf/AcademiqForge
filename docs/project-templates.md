# Project templates — durability

## What went wrong before

Templates were read/written from **`data/project-templates.json` on the server filesystem**. That file is **in the Git repo**, so every **deploy** that checks out the branch can **replace** the live file with whatever is committed. Manual edits made only on the server (or saved before someone committed defaults) were easy to lose.

## What we do now

- **Source of truth:** MySQL table **`project_templates_store`** (single row `id = 1`).
- **Startup:** The app loads templates from the database. If the row is missing (first run), it **seeds** from `data/project-templates.json` once and saves to the database.
- **Admin save:** Writes **only to the database** by default. Deploys no longer overwrite your production templates.
- **Optional file mirror (local dev):** Set **`PROJECT_TEMPLATES_MIRROR_FILE=1`** to also write `data/project-templates.json` when you save (e.g. to diff in Git).

## Backups

- Back up your **database** (includes `project_templates_store`).
- After changing templates in admin, you can copy the JSON from the editor and keep a copy offline if you want belt-and-suspenders.

## Repo file `data/project-templates.json`

It remains the **default seed** for new environments and the first migration. It is **not** what production uses after the DB has been populated.
