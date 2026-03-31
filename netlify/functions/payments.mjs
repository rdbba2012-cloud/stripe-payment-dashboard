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
    const from = params.from;
    const to = params.to;
    const status = params.status || 'all';
    const cursor = params.cursor;
    const limit = Math.min(parseInt(params.limit) || 100, 100);

    const listParams = {
      limit,
      expand: ['data.customer', 'data.invoice'],
    };

    if (cursor) {
      listParams.starting_after = cursor;
    }

    // Date filtering
    if (from || to) {
      listParams.created = {};
      if (from) listParams.created.gte = Math.floor(new Date(from).getTime() / 1000);
      if (to) listParams.created.lte = Math.floor(new Date(to + 'T23:59:59').getTime() / 1000);
    }

    const charges = await stripe.charges.list(listParams);

    // Filter by status if specified
    let filtered = charges.data;
    if (status === 'succeeded') {
      filtered = filtered.filter(c => c.status === 'succeeded');
    } else if (status === 'failed') {
      filtered = filtered.filter(c => c.status === 'failed');
    }

    // Stripe's default retry settings: typically 4 attempts over ~3 weeks
    // The invoice object contains attempt_count and next_payment_attempt
    const maxRetries = parseInt(params.max_retries) || 4;

    const payments = filtered.map(charge => {
      const invoice = typeof charge.invoice === 'object' ? charge.invoice : null;

      return {
        id: charge.id,
        amount: charge.amount,
        currency: charge.currency,
        status: charge.status,
        failureCode: charge.failure_code,
        failureMessage: charge.failure_message,
        created: charge.created,
        customerId: typeof charge.customer === 'object' ? charge.customer?.id : charge.customer,
        customerName: typeof charge.customer === 'object' ? charge.customer?.name : null,
        customerEmail: typeof charge.customer === 'object' ? charge.customer?.email : null,
        description: charge.description,
        paymentMethod: charge.payment_method_details?.type || 'unknown',
        receiptUrl: charge.receipt_url,
        // Retry data from the linked invoice
        invoiceId: invoice?.id || null,
        invoiceStatus: invoice?.status || null,
        attemptCount: invoice?.attempt_count || (charge.status === 'failed' ? 1 : 0),
        maxRetries,
        retriesRemaining: invoice ? Math.max(0, maxRetries - (invoice.attempt_count || 1)) : (charge.status === 'failed' ? maxRetries - 1 : 0),
        nextRetryDate: invoice?.next_payment_attempt || null,
        autoAdvance: invoice?.auto_advance ?? null,
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        payments,
        hasMore: charges.has_more,
        nextCursor: charges.has_more ? charges.data[charges.data.length - 1]?.id : null,
      }),
    };
  } catch (error) {
    console.error('Payments error:', error);
    return {
      statusCode: error.statusCode || 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
