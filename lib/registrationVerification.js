'use strict';

const crypto = require('crypto');
const { query, withTransaction } = require('./db');
const { hashToken } = require('./passwordReset');
const { isAllowedSearchEngineKey } = require('./canonicalSelects');

const CODE_MIN = 100000;
const CODE_MAX = 999999;
const EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_MS = 3 * 60 * 1000;

function isNewUserVerificationEnabled() {
  const v = String(process.env.NEW_USER_VER_CD || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function generateSixDigitCode() {
  return String(crypto.randomInt(CODE_MIN, CODE_MAX + 1));
}

/**
 * @param {string} email
 * @returns {string}
 */
function maskEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  const at = e.indexOf('@');
  if (at <= 0) return '***';
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (local.length <= 1) return `*@${domain}`;
  const maskLen = Math.min(Math.max(local.length - 1, 1), 4);
  return `${local[0]}${'*'.repeat(maskLen)}@${domain}`;
}

async function userExistsByEmail(getPool, email) {
  const r = await query(getPool, 'SELECT id FROM users WHERE email = @email LIMIT 1', { email });
  return !!(r.recordset && r.recordset.length > 0);
}

/**
 * @param {function} getPool
 * @param {{ email: string, passwordHash: string, form: object, preferredLocale: string }} opts
 * @returns {Promise<{ ok: true, pendingId: number, code: string, expiresAt: Date, codeSentAt: Date } | { ok: false, error: string }>}
 */
async function createPendingRegistration(getPool, opts) {
  const email = String(opts.email || '').trim().toLowerCase();
  const dup = await userExistsByEmail(getPool, email);
  if (dup) return { ok: false, error: 'duplicate_user' };

  await query(getPool, 'DELETE FROM registration_pending WHERE email = @email', { email });

  const code = generateSixDigitCode();
  const codeHash = hashToken(code);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXPIRY_MINUTES * 60 * 1000);
  const formJson = JSON.stringify({
    title: opts.form.title,
    firstName: opts.form.firstName,
    lastName: opts.form.lastName,
    university: opts.form.university,
    researchFocus: opts.form.researchFocus,
    preferredSearchEngine: opts.form.preferredSearchEngine,
    subscribeChoice: opts.form.subscribeChoice,
    billingInterval: opts.form.billingInterval,
    subscribePromo: opts.form.subscribePromo,
  });

  const ins = await query(
    getPool,
    `INSERT INTO registration_pending (email, code_hash, password_hash, form_json, preferred_locale, expires_at, code_sent_at)
     VALUES (@email, @code_hash, @password_hash, @form_json, @preferred_locale, @expires_at, @code_sent_at)`,
    {
      email,
      code_hash: codeHash,
      password_hash: opts.passwordHash,
      form_json: formJson,
      preferred_locale: opts.preferredLocale,
      expires_at: expiresAt,
      code_sent_at: now,
    }
  );
  const pendingId = ins.insertId;
  if (!pendingId) return { ok: false, error: 'insert_failed' };
  return { ok: true, pendingId, code, expiresAt, codeSentAt: now };
}

async function getPendingById(getPool, id) {
  const r = await query(
    getPool,
    `SELECT id, email, code_hash, password_hash, form_json, preferred_locale, expires_at, code_sent_at
     FROM registration_pending WHERE id = @id`,
    { id: Number(id) }
  );
  return r.recordset[0] || null;
}

/**
 * @param {function} getPool
 * @param {number} pendingId
 * @param {string} rawCode
 * @returns {Promise<{ ok: true, user: object, form: object } | { ok: false, error: string }>}
 */
async function verifyCodeAndCompleteUser(getPool, pendingId, rawCode) {
  return withTransaction(getPool, async (q) => {
    const r = await q(
      `SELECT id, email, code_hash, password_hash, form_json, preferred_locale, expires_at, code_sent_at
       FROM registration_pending WHERE id = @id FOR UPDATE`,
      { id: Number(pendingId) }
    );
    const row = r.recordset[0];
    if (!row) return { ok: false, error: 'not_found' };

    const now = new Date();
    if (new Date(row.expires_at) <= now) {
      await q('DELETE FROM registration_pending WHERE id = @id', { id: row.id });
      return { ok: false, error: 'expired' };
    }

    const h = hashToken(rawCode);
    if (h !== row.code_hash) {
      return { ok: false, error: 'wrong_code' };
    }

    const form = JSON.parse(row.form_json);
    const uni = form.university || null;
    const research = form.researchFocus || null;
    const engine =
      form.preferredSearchEngine && isAllowedSearchEngineKey(form.preferredSearchEngine)
        ? form.preferredSearchEngine
        : null;

    const ins = await q(
      `INSERT INTO users (title, first_name, last_name, email, password_hash, university, research_focus, preferred_search_engine, preferred_locale)
       VALUES (@title, @first_name, @last_name, @email, @password_hash, @university, @research_focus, @preferred_search_engine, @preferred_locale)`,
      {
        title: form.title,
        first_name: form.firstName,
        last_name: form.lastName,
        email: row.email,
        password_hash: row.password_hash,
        university: uni,
        research_focus: research || null,
        preferred_search_engine: engine,
        preferred_locale: row.preferred_locale,
      }
    );

    const uid = ins.insertId;
    await q('DELETE FROM registration_pending WHERE id = @id', { id: row.id });

    const sel = await q(
      'SELECT id, first_name, last_name, email, preferred_locale FROM users WHERE id = @id',
      { id: uid }
    );
    const user = sel.recordset[0];
    return { ok: true, user, form };
  });
}

/**
 * @param {function} getPool
 * @param {number} pendingId
 * @returns {Promise<{ ok: true, code: string, expiresAt: Date, codeSentAt: Date } | { ok: false, error: string, nextResendAt?: Date }>}
 */
async function resendVerificationCode(getPool, pendingId) {
  const row = await getPendingById(getPool, pendingId);
  if (!row) return { ok: false, error: 'not_found' };

  const now = new Date();
  if (new Date(row.expires_at) <= now) {
    return { ok: false, error: 'expired' };
  }

  const sentAt = new Date(row.code_sent_at);
  if (now.getTime() - sentAt.getTime() < RESEND_COOLDOWN_MS) {
    return {
      ok: false,
      error: 'too_soon',
      nextResendAt: new Date(sentAt.getTime() + RESEND_COOLDOWN_MS),
    };
  }

  const code = generateSixDigitCode();
  const codeHash = hashToken(code);
  const expiresAt = new Date(now.getTime() + EXPIRY_MINUTES * 60 * 1000);

  await query(
    getPool,
    `UPDATE registration_pending SET code_hash = @ch, code_sent_at = @cs, expires_at = @ex WHERE id = @id`,
    { ch: codeHash, cs: now, ex: expiresAt, id: Number(pendingId) }
  );

  return { ok: true, code, expiresAt, codeSentAt: now };
}

/**
 * @param {function} getPool
 * @param {number} pendingId
 * @param {string} newEmailRaw
 * @returns {Promise<{ ok: true, code: string, email: string, expiresAt: Date, codeSentAt: Date } | { ok: false, error: string }>}
 */
async function changePendingEmail(getPool, pendingId, newEmailRaw) {
  const email = String(newEmailRaw || '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'invalid' };

  const dup = await userExistsByEmail(getPool, email);
  if (dup) return { ok: false, error: 'duplicate_user' };

  const row = await getPendingById(getPool, pendingId);
  if (!row) return { ok: false, error: 'not_found' };

  await query(getPool, 'DELETE FROM registration_pending WHERE email = @email AND id <> @id', {
    email,
    id: Number(pendingId),
  });

  const code = generateSixDigitCode();
  const codeHash = hashToken(code);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXPIRY_MINUTES * 60 * 1000);

  await query(
    getPool,
    `UPDATE registration_pending SET email = @email, code_hash = @ch, code_sent_at = @cs, expires_at = @ex WHERE id = @id`,
    { email, ch: codeHash, cs: now, ex: expiresAt, id: Number(pendingId) }
  );

  return { ok: true, code, email, expiresAt, codeSentAt: now };
}

/**
 * Load pending row for verify page; if missing or expired, returns { row: null, expired: boolean }.
 * @param {function} getPool
 * @param {number} pendingId
 */
async function loadPendingForVerifyPage(getPool, pendingId) {
  const row = await getPendingById(getPool, pendingId);
  if (!row) return { row: null, expired: false };
  const now = new Date();
  if (new Date(row.expires_at) <= now) {
    await query(getPool, 'DELETE FROM registration_pending WHERE id = @id', { id: row.id });
    return { row: null, expired: true };
  }
  return { row, expired: false };
}

module.exports = {
  isNewUserVerificationEnabled,
  generateSixDigitCode,
  maskEmail,
  createPendingRegistration,
  getPendingById,
  verifyCodeAndCompleteUser,
  resendVerificationCode,
  changePendingEmail,
  loadPendingForVerifyPage,
  EXPIRY_MINUTES,
  RESEND_COOLDOWN_MS,
};
