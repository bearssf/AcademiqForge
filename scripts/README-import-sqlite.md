# Import SQLite schema into AWS SQL Server

The file `import-sqlite-schema.js` streams a SQLite dump (e.g. `2026-03-15.sql`), converts `CREATE TABLE` statements to T-SQL, and runs them against the database defined in `.env` (same as the main app: `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`).

## Usage

From the project root (with `.env` configured for your AWS database):

```bash
node scripts/import-sqlite-schema.js /path/to/2026-03-15.sql
```

Default path if omitted: `~/Downloads/2026-03-15.sql`.

## What it does

- **Creates tables only** (no data). The dump is ~4.6 GB; loading all data would require a separate ETL or batching.
- Skips tables that already exist.
- Converts SQLite → T-SQL: `integer AUTOINCREMENT` → `INT IDENTITY(1,1)`, backticks → square brackets, `varchar` → `NVARCHAR`, `longtext` → `NVARCHAR(MAX)`, `datetime` → `DATETIME2`, `UNIQUE`/`FOREIGN KEY` constraints.

## Current status

- **19 tables** were created successfully on the AWS database (e.g. `stddata_country`, `stddata_date`, `gcd_series_bond_type`, `gcd_publisher`-related, and others).
- Some tables still fail due to:
  - SQLite-specific `DEFAULT` values (e.g. `replace()`, `char()`).
  - Complex `CONSTRAINT`/`FOREIGN KEY` ordering or syntax.
  - Semicolons or special characters inside default values.

To create the remaining tables you can:

1. Fix and re-run the script (adjust conversion in `sqliteToTsql` for the failing cases).
2. Or create them manually in SSMS from the SQLite `CREATE TABLE` definitions, converted to T-SQL.
3. For **data** load (optional): use a dedicated ETL tool, or batch-insert from the dump with a script that parses `INSERT` statements and runs them in chunks.

## Loading data later

The dump contains millions of `INSERT` rows. To load data into the tables you created:

- Use SQL Server tools (e.g. **bcp**, **Bulk Insert**, or SSIS), or
- Write a script that reads the `.sql` file in chunks, parses `INSERT INTO table VALUES(...)`, and runs parameterized inserts in batches (e.g. 1000 rows at a time) to avoid timeouts and memory issues.
