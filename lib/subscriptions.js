const sql = require('mssql');

async function ensureSubscriptionRow(getPool, userId) {
  const p = await getPool();
  const r = await p
    .request()
    .input('user_id', sql.Int, userId)
    .query('SELECT id FROM subscriptions WHERE user_id = @user_id');
  if (r.recordset[0]) return;
  await p
    .request()
    .input('user_id', sql.Int, userId)
    .query(
      `INSERT INTO subscriptions (user_id, status, trial_end, updated_at)
       VALUES (@user_id, 'trialing', DATEADD(day, 7, GETDATE()), GETDATE())`
    );
}

async function getSubscriptionRow(getPool, userId) {
  const p = await getPool();
  const r = await p
    .request()
    .input('user_id', sql.Int, userId)
    .query('SELECT * FROM subscriptions WHERE user_id = @user_id');
  return r.recordset[0] || null;
}

/**
 * Foundry: paid (active subscription) only — not included in trial.
 */
function appAccessFromRow(row) {
  if (!row) {
    return {
      paid: false,
      trialing: false,
      trialEndsAt: null,
      trialEndsLabel: '',
      foundryUnlocked: false,
    };
  }
  const now = Date.now();
  const trialEndMs = row.trial_end ? new Date(row.trial_end).getTime() : 0;
  const paid = row.status === 'active';
  const trialing = row.status === 'trialing' && trialEndMs > now;
  return {
    paid,
    trialing,
    trialEndsAt: row.trial_end ? new Date(row.trial_end) : null,
    trialEndsLabel: row.trial_end
      ? new Date(row.trial_end).toLocaleDateString(undefined, { dateStyle: 'medium' })
      : '',
    foundryUnlocked: paid,
  };
}

module.exports = { ensureSubscriptionRow, getSubscriptionRow, appAccessFromRow };
