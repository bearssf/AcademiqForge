/**
 * Labels and rows for Account “billing maintenance” #1 — status + period dates from DB.
 */

function formatLongDate(value) {
  if (value == null) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { dateStyle: 'long' });
}

/**
 * Match stored `subscriptions.plan` (first 20 chars of Stripe price id) to Monthly / Yearly / Member.
 */
function resolvePlanLabel(subscriptionRow, priceCfg) {
  if (!subscriptionRow || !subscriptionRow.plan) return null;
  const p = String(subscriptionRow.plan).trim();
  if (!p) return null;
  if (priceCfg.mode === 'dual') {
    if (priceCfg.monthly && priceCfg.monthly.substring(0, 20) === p) return 'Monthly';
    if (priceCfg.yearly && priceCfg.yearly.substring(0, 20) === p) return 'Yearly';
  }
  if (priceCfg.mode === 'legacy' && priceCfg.priceId && priceCfg.priceId.substring(0, 20) === p) {
    return 'Member';
  }
  return null;
}

/**
 * @returns {'month' | 'year' | null}
 */
function resolvePlanInterval(subscriptionRow, priceCfg) {
  const label = resolvePlanLabel(subscriptionRow, priceCfg);
  if (label === 'Monthly') return 'month';
  if (label === 'Yearly') return 'year';
  return null;
}

/**
 * True if `current_period_end` is between now and `maxDays` days from now.
 * Used to allow yearly → monthly plan switches only near renewal.
 */
function isWithinDaysBeforePeriodEnd(subscriptionRow, maxDays) {
  if (!subscriptionRow || subscriptionRow.current_period_end == null) return false;
  const end = new Date(subscriptionRow.current_period_end).getTime();
  if (Number.isNaN(end)) return false;
  const now = Date.now();
  const daysUntil = (end - now) / 86400000;
  return daysUntil >= 0 && daysUntil <= maxDays;
}

const STATUS_FALLBACK = {
  active: 'Active',
  past_due: 'Past due',
  canceled: 'Canceled',
  trialing: 'Free trial',
};

function statusDisplayLabel(status, t) {
  if (typeof t !== 'function') {
    return STATUS_FALLBACK[status] != null ? STATUS_FALLBACK[status] : status ? String(status) : '—';
  }
  switch (status) {
    case 'active':
      return t('billing.status.active');
    case 'past_due':
      return t('billing.status.past_due');
    case 'canceled':
      return t('billing.status.canceled');
    case 'trialing':
      return t('billing.status.trialing');
    default:
      return status ? String(status) : '—';
  }
}

function translatePlanDisplayLabel(planLabel, t) {
  if (!planLabel) return null;
  if (typeof t !== 'function') {
    return planLabel;
  }
  if (planLabel === 'Monthly') return t('billing.plan.monthly');
  if (planLabel === 'Yearly') return t('billing.plan.yearly');
  if (planLabel === 'Member') return t('billing.plan.member');
  return planLabel;
}

/**
 * @param {object | null} subscriptionRow — row from `subscriptions`
 * @param {object} priceCfg — from `getStripePriceConfig()`
 * @param {function(string): string} [t] — i18n translate function (optional)
 * @returns {{ lines: { label: string, value: string }[] }}
 */
const SUMMARY_FALLBACK = {
  'billing.summary.status': 'Status:',
  'billing.summary.plan': 'Plan:',
  'billing.summary.trialEnds': 'Trial ends',
  'billing.summary.autoRenewal': 'Auto-Renewal:',
  'billing.summary.autoRenewOff': 'Off (ends current period)',
  'billing.summary.autoRenewOn': 'On',
  'billing.summary.membershipExpires': 'Current membership expires',
  'billing.summary.nextRenewal': 'Next renewal',
  'billing.summary.membershipExpired': 'Membership expired',
};

function buildBillingSummaryLines(subscriptionRow, priceCfg, t) {
  if (!subscriptionRow) return { lines: [] };

  const tr =
    typeof t === 'function' ? t : (key) => SUMMARY_FALLBACK[key] || key;

  const lines = [];
  const status = subscriptionRow.status;
  lines.push({ label: tr('billing.summary.status'), value: statusDisplayLabel(status, t) });

  const plan = resolvePlanLabel(subscriptionRow, priceCfg);
  if (plan) {
    lines.push({ label: tr('billing.summary.plan'), value: translatePlanDisplayLabel(plan, t) });
  }

  if (status === 'trialing' && subscriptionRow.trial_end) {
    const v = formatLongDate(subscriptionRow.trial_end);
    if (v) lines.push({ label: tr('billing.summary.trialEnds'), value: v });
  }

  const cancelAtEnd =
    subscriptionRow.cancel_at_period_end === true || subscriptionRow.cancel_at_period_end === 1;
  if (status === 'active' || status === 'past_due') {
    lines.push({
      label: tr('billing.summary.autoRenewal'),
      value: cancelAtEnd ? tr('billing.summary.autoRenewOff') : tr('billing.summary.autoRenewOn'),
    });
  }

  const periodEnd = subscriptionRow.current_period_end;
  if (periodEnd && (status === 'active' || status === 'past_due')) {
    const v = formatLongDate(periodEnd);
    if (v) {
      lines.push({ label: tr('billing.summary.membershipExpires'), value: v });
      if (!cancelAtEnd) {
        lines.push({ label: tr('billing.summary.nextRenewal'), value: v });
      }
    }
  } else if (periodEnd && status === 'canceled') {
    const v = formatLongDate(periodEnd);
    if (v) lines.push({ label: tr('billing.summary.membershipExpired'), value: v });
  }

  return { lines };
}

module.exports = {
  buildBillingSummaryLines,
  resolvePlanInterval,
  isWithinDaysBeforePeriodEnd,
  formatLongDate,
  resolvePlanLabel,
};
