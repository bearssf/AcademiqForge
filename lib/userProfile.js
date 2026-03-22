const sql = require('mssql');

async function getUserProfileRow(getPool, userId) {
  const p = await getPool();
  const r = await p
    .request()
    .input('id', sql.Int, userId)
    .query(
      `SELECT id, title, first_name, last_name, email, university, research_focus, preferred_search_engine
       FROM users WHERE id = @id`
    );
  return r.recordset[0] || null;
}

function rowToPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    title: row.title,
    university: row.university,
    researchFocus: row.research_focus,
    preferredSearchEngine: row.preferred_search_engine,
  };
}

module.exports = { getUserProfileRow, rowToPublicUser };
