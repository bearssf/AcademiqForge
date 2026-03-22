const sql = require('mssql');

const MAX_TAG_LEN = 120;
const MAX_TAGS_PER_SOURCE = 40;

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
function normalizeTags(raw) {
  if (raw == null) return [];
  let arr = raw;
  if (!Array.isArray(arr)) {
    if (typeof raw === 'string') {
      arr = raw.split(/[,;\n]+/);
    } else {
      return [];
    }
  }
  const seen = new Set();
  const out = [];
  for (const t of arr) {
    const s = String(t || '')
      .trim()
      .slice(0, MAX_TAG_LEN);
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= MAX_TAGS_PER_SOURCE) break;
  }
  return out;
}

/**
 * Replace all tags for a source (caller must own the source row).
 * @param {import('mssql').ConnectionPool} pool
 * @param {number} sourceId
 * @param {string[]} tags
 */
async function replaceSourceTags(pool, sourceId, tags) {
  const p = pool;
  await p.request().input('source_id', sql.Int, sourceId).query(`DELETE FROM source_tags WHERE source_id = @source_id`);
  for (const tag of tags) {
    await p
      .request()
      .input('source_id', sql.Int, sourceId)
      .input('tag', sql.NVarChar(MAX_TAG_LEN), tag)
      .query(`INSERT INTO source_tags (source_id, tag) VALUES (@source_id, @tag)`);
  }
}

module.exports = {
  normalizeTags,
  replaceSourceTags,
  MAX_TAG_LEN,
};
