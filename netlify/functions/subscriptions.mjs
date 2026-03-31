import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const params = event.queryStringParameters || {};
    const status = params.status || 'all';
    const cursor = params.cursor;
    const limit = Math.min(parseInt(params.limit) || 100, 100);

    const listParams = {
      limit,
      expand: ['data.customer', 'data.latest_invoice'],
    };

    if (status !== 'all') {
      listParams.status = status;
    }
    if (cursor) {
      listParams.starting_after = cursor;
    }

    const subscriptions = await stripe.subscriptions.list(listParams);

    const result = subscriptions.data.map(sub => ({
      id: sub.id,
      status: sub.status,
      customerId: typeof sub.customer === 'object' ? sub.customer?.id : sub.customer,
      customerName: typeof sub.customer === 'object' ? sub.customer?.name : null,
      customerEmail: typeof sub.customer === 'object' ? sub.customer?.email : null,
      currentPeriodStart: sub.current_period_start,
      currentPeriodEnd: sub.current_period_end,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      amount: sub.items?.data?.[0]?.price?.unit_amount || 0,
      currency: sub.items?.data?.[0]?.price?.currency || 'gbp',
      interval: sub.items?.data?.[0]?.price?.recurring?.interval || 'month',
      latestInvoiceStatus: typeof sub.latest_invoice === 'object' ? sub.latest_invoice?.status : null,
      latestInvoiceAmount: typeof sub.latest_invoice === 'object' ? sub.latest_invoice?.amount_due : null,
      created: sub.created,
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        subscriptions: result,
        hasMore: subscriptions.has_more,
        nextCursor: subscriptions.has_more ? subscriptions.data[subscriptions.data.length - 1]?.id : null,
      }),
    };
  } catch (error) {
    console.error('Subscriptions error:', error);
    return {
      statusCode: error.statusCode || 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
