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
    const search = params.search;
    const cursor = params.cursor;
    const limit = Math.min(parseInt(params.limit) || 100, 100);

    let customers;

    if (search) {
      // Stripe search API for customers
      customers = await stripe.customers.search({
        query: `name~"${search}" OR email~"${search}"`,
        limit,
      });
    } else {
      const listParams = { limit };
      if (cursor) listParams.starting_after = cursor;
      customers = await stripe.customers.list(listParams);
    }

    const result = customers.data.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      created: c.created,
      metadata: c.metadata,
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        customers: result,
        hasMore: customers.has_more,
        nextCursor: customers.has_more ? customers.data[customers.data.length - 1]?.id : null,
      }),
    };
  } catch (error) {
    console.error('Customers error:', error);
    return {
      statusCode: error.statusCode || 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
