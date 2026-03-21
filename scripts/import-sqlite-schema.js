#!/usr/bin/env node
/**
 * Streams a SQLite dump file, extracts CREATE TABLE statements,
 * converts them to T-SQL, and runs them against the AWS SQL Server (using .env).
 * Creates tables only (no data). For 2026-03-15.sql (~4.6GB), run from project root:
 *   node scripts/import-sqlite-schema.js /path/to/2026-03-15.sql
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const readline = require('readline');
const sql = require('mssql');

const dbConfig = {
  server: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: { max: 1, min: 0 },
};

function sqliteToTsql(createSql) {
  const tableMatch = createSql.match(/CREATE TABLE\s+`([^`]+)`/i);
  const tableName = tableMatch ? tableMatch[1] : null;
  if (!tableName) return { tsql: null, tableName: null };

  let s = createSql
    .replace(/\r\n/g, '\n')
    .replace(/`([^`]+)`/g, '[$1]')
    .replace(/\binteger\s+NOT NULL\s+PRIMARY KEY\s+AUTOINCREMENT\b/gi, 'INT IDENTITY(1,1) NOT NULL PRIMARY KEY')
    .replace(/\binteger\s+PRIMARY KEY\s+AUTOINCREMENT\b/gi, 'INT IDENTITY(1,1) PRIMARY KEY')
    .replace(/\binteger\b/gi, 'INT')
    .replace(/\bvarchar\s*\(\s*(\d+)\s*\)/gi, 'NVARCHAR($1)')
    .replace(/\blongtext\b/gi, 'NVARCHAR(MAX)')
    .replace(/\bdatetime\b/gi, 'DATETIME2')
    .replace(/\bDEFAULT\s+'([^']*(?:''[^']*)*)'/g, (_, v) => "DEFAULT (N'" + v.replace(/'/g, "''") + "')")
    .replace(/\bDEFAULT\s+(\d+)/g, 'DEFAULT ($1)')
    .replace(/\bDEFAULT\s+NULL\b/gi, 'NULL');

  s = s.replace(/\s*,\s*UNIQUE\s*\(\s*\[([^\]]+)\]\s*\)/gi, (_, col) => {
    const safeName = (tableName + '_' + col).replace(/[\],\s\[\]]/g, '_');
    return ', CONSTRAINT [UQ_' + safeName + '] UNIQUE ([' + col.replace(/\],\s*\[/g, '], [') + '])';
  });
  s = s.replace(/,?\s*CONSTRAINT\s+\[([^\]]+)\]\s+FOREIGN KEY\s*\(\s*\[([^\]]+)\]\s*\)\s+REFERENCES\s+\[([^\]]+)\]\s*\(\s*\[([^\]]+)\]\s*\)[^;]*/gi, ', CONSTRAINT [$1] FOREIGN KEY ([$2]) REFERENCES [$3]([$4])');
  s = s.replace(/\s*\);?\s*$/m, '').trimEnd();
  s = s.replace(/,(\s*)\)/g, '$1)');
  s = s.replace(/\s*,\s*,/g, ',');
  while (s.match(/,\s*\)/)) s = s.replace(/,\s*\)/g, ')');
  if (s.endsWith(',')) s = s.slice(0, -1);
  s = s.trimEnd();
  if (!s.endsWith(')')) s += ')';
  return { tsql: s, tableName };
}

async function main() {
  const sqlPath = process.argv[2] || require('path').join(process.env.HOME || '', 'Downloads', '2026-03-15.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('File not found:', sqlPath);
    console.error('Usage: node scripts/import-sqlite-schema.js <path-to-sqlite-dump.sql>');
    process.exit(1);
  }

  if (!dbConfig.server || !dbConfig.database || !dbConfig.user || !dbConfig.password) {
    console.error('Set DB_HOST, DB_NAME, DB_USER, DB_PASSWORD in .env');
    process.exit(1);
  }

  console.log('Connecting to', dbConfig.server, '...');
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    console.log('Connected.');
  } catch (err) {
    console.error('DB connection failed:', err.message);
    process.exit(1);
  }

  const rl = readline.createInterface({ input: fs.createReadStream(sqlPath, { encoding: 'utf8' }), crlfDelay: Infinity });
  let inCreate = false;
  let buffer = [];
  let count = 0;

  for await (const line of rl) {
    if (line.startsWith('CREATE TABLE')) {
      inCreate = true;
      buffer = [line];
      continue;
    }
    if (inCreate) {
      buffer.push(line);
      if (line.trim() === ');') {
        inCreate = false;
        const block = buffer.join('\n');
        const { tsql, tableName } = sqliteToTsql(block);
        if (tsql && tableName) {
          try {
            const exists = await pool.request().query(`SELECT 1 AS ok FROM sys.tables WHERE name = '${tableName.replace(/'/g, "''")}'`);
            if (exists.recordset.length > 0) {
              console.log('Skip (exists):', tableName);
              continue;
            }
            await pool.request().query(tsql);
            count++;
            console.log('Created table:', tableName);
          } catch (err) {
            console.error('Error creating', tableName, ':', err.message);
          }
        }
      }
    }
  }

  console.log('Done. Tables created:', count);
  await pool.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
