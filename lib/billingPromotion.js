/**
 * Resolve a customer-facing Stripe Promotion Code to a promotion_code id for Subscription.discounts.
 * Codes are created in Stripe Dashboard (Product catalog → Coupons / Promotion codes).
 *
 * @param {import('stripe').default} stripe
 * @param {string} raw
 * @returns {Promise<string|null>} promotion_code id (promo_...) or null if empty
 */
async function resolvePromotionCodeId(stripe, raw) {
  const code = String(raw || '').trim();
  if (!code) return null;
  const list = await stripe.promotionCodes.list({
    code,
    active: true,
    limit: 1,
  });
  if (!list.data.length) {
    const err = new Error('That promotion code is not valid or is no longer active.');
    err.code = 'INVALID_PROMOTION_CODE';
    throw err;
  }
  return list.data[0].id;
}

module.exports = {
  resolvePromotionCodeId,
};
