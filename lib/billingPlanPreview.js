/**
 * Preview proration for a subscription plan change using Stripe upcoming invoice.
 */

/**
 * @param {import('stripe').default} stripe
 * @param {string} subscriptionId
 * @param {string} newPriceId
 */
async function previewSubscriptionPlanChange(stripe, subscriptionId, newPriceId) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price'],
  });
  const item = sub.items?.data?.[0];
  if (!item) {
    const err = new Error('No subscription items on subscription.');
    err.code = 'NO_SUBSCRIPTION_ITEMS';
    throw err;
  }
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  if (!customerId) {
    const err = new Error('No customer on subscription.');
    err.code = 'NO_CUSTOMER';
    throw err;
  }
  const invoice = await stripe.invoices.retrieveUpcoming({
    customer: customerId,
    subscription: subscriptionId,
    subscription_details: {
      items: [
        {
          id: item.id,
          price: newPriceId,
          quantity: item.quantity || 1,
        },
      ],
      proration_behavior: 'create_prorations',
    },
  });
  return invoice;
}

function formatMoney(amountCents, currency) {
  if (amountCents == null || Number.isNaN(Number(amountCents))) return null;
  const cur = (currency || 'usd').toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: cur,
    }).format(Number(amountCents) / 100);
  } catch {
    return (Number(amountCents) / 100).toFixed(2) + ' ' + String(currency || '').toUpperCase();
  }
}

/**
 * @param {import('stripe').Stripe.UpcomingInvoice} invoice
 */
function summarizeUpcomingInvoice(invoice) {
  const currency = invoice.currency || 'usd';
  const amountDue = invoice.amount_due != null ? invoice.amount_due : 0;
  return {
    amountDue,
    amountDueFormatted: formatMoney(amountDue, currency),
    currency,
    total: invoice.total,
    totalFormatted: formatMoney(invoice.total, currency),
  };
}

module.exports = {
  previewSubscriptionPlanChange,
  summarizeUpcomingInvoice,
  formatMoney,
};
