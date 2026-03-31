import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function fetchAllCharges(since) {
  const allCharges = [];
  let hasMore = true;
  let startingAfter = undefined;

  while (hasMore) {
    const params = {
      limit: 100,
      created: { gte: since },
      expand: ['data.customer'],
    };
    if (startingAfter) params.starting_after = startingAfter;

    const batch = await stripe.charges.list(params);
    allCharges.push(...batch.data);
    hasMore = batch.has_more;
    if (hasMore && batch.data.length > 0) {
      startingAfter = batch.data[batch.data.length - 1].id;
    }
  }

  return allCharges;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const ninetyDaysAgo = now - (90 * 24 * 60 * 60);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

    const allCharges = await fetchAllCharges(ninetyDaysAgo);

    const succeeded = allCharges.filter(c => c.status === 'succeeded');
    const failed = allCharges.filter(c => c.status === 'failed');

    // Last 30 days metrics
    const succeeded30d = succeeded.filter(c => c.created >= thirtyDaysAgo);
    const failed30d = failed.filter(c => c.created >= thirtyDaysAgo);
    const all30d = allCharges.filter(c => c.created >= thirtyDaysAgo);

    const totalRevenue30d = succeeded30d.reduce((sum, c) => sum + c.amount, 0);
    const totalFailed30d = failed30d.length;
    const failedAmount30d = failed30d.reduce((sum, c) => sum + c.amount, 0);
    const failureRate30d = all30d.length > 0 ? (failed30d.length / all30d.length) : 0;

    // Prior 30 days for comparison
    const sixtyDaysAgo = now - (60 * 24 * 60 * 60);
    const prior30d = allCharges.filter(c => c.created >= sixtyDaysAgo && c.created < thirtyDaysAgo);
    const priorFailed = prior30d.filter(c => c.status === 'failed');
    const priorFailureRate = prior30d.length > 0 ? (priorFailed.length / prior30d.length) : 0;

    // Repeat offenders (customers with 2+ failures in 90 days)
    const failuresByCustomer = {};
    for (const charge of failed) {
      const custId = typeof charge.customer === 'object' ? charge.customer?.id : charge.customer;
      if (!custId) continue;
      if (!failuresByCustomer[custId]) {
        failuresByCustomer[custId] = {
          customerId: custId,
          customerName: typeof charge.customer === 'object' ? charge.customer?.name : null,
          customerEmail: typeof charge.customer === 'object' ? charge.customer?.email : null,
          failures: [],
          totalFailedAmount: 0,
        };
      }
      failuresByCustomer[custId].failures.push({
        date: charge.created,
        amount: charge.amount,
        failureCode: charge.failure_code,
        failureMessage: charge.failure_message,
      });
      failuresByCustomer[custId].totalFailedAmount += charge.amount;
    }

    const repeatOffenders = Object.values(failuresByCustomer)
      .filter(c => c.failures.length >= 2)
      .sort((a, b) => b.failures.length - a.failures.length)
      .map(c => ({
        ...c,
        failCount: c.failures.length,
        lastFailed: Math.max(...c.failures.map(f => f.date)),
        severity: c.failures.length >= 5 ? 'critical' : c.failures.length >= 3 ? 'high' : 'medium',
      }));

    // Failures by day of week
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const failuresByDay = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    for (const charge of failed) {
      const day = dayNames[new Date(charge.created * 1000).getDay()];
      failuresByDay[day]++;
    }

    // Monthly revenue trend (last 12 months from 90-day data, padded)
    const monthlyRevenue = {};
    const monthlyFailures = {};
    const monthlyTotal = {};
    for (const charge of allCharges) {
      const date = new Date(charge.created * 1000);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyRevenue[key]) {
        monthlyRevenue[key] = 0;
        monthlyFailures[key] = 0;
        monthlyTotal[key] = 0;
      }
      monthlyTotal[key]++;
      if (charge.status === 'succeeded') {
        monthlyRevenue[key] += charge.amount;
      } else if (charge.status === 'failed') {
        monthlyFailures[key]++;
      }
    }

    const monthlyTrend = Object.keys(monthlyRevenue).sort().map(month => ({
      month,
      revenue: monthlyRevenue[month],
      failures: monthlyFailures[month],
      total: monthlyTotal[month],
      failureRate: monthlyTotal[month] > 0 ? monthlyFailures[month] / monthlyTotal[month] : 0,
    }));

    // Weekly failure rate trend
    const weeklyData = {};
    for (const charge of allCharges) {
      const date = new Date(charge.created * 1000);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const key = weekStart.toISOString().split('T')[0];
      if (!weeklyData[key]) {
        weeklyData[key] = { total: 0, failed: 0 };
      }
      weeklyData[key].total++;
      if (charge.status === 'failed') weeklyData[key].failed++;
    }

    const weeklyTrend = Object.keys(weeklyData).sort().map(week => ({
      week,
      failureRate: weeklyData[week].total > 0 ? weeklyData[week].failed / weeklyData[week].total : 0,
      failed: weeklyData[week].failed,
      total: weeklyData[week].total,
    }));

    // Top failure reasons
    const failureReasons = {};
    for (const charge of failed) {
      const reason = charge.failure_code || 'unknown';
      failureReasons[reason] = (failureReasons[reason] || 0) + 1;
    }
    const topFailureReasons = Object.entries(failureReasons)
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({ reason, count }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        summary: {
          totalRevenue30d,
          totalFailed30d,
          failedAmount30d,
          failureRate30d,
          priorFailureRate30d: priorFailureRate,
          failureRateTrend: failureRate30d - priorFailureRate,
          revenueAtRisk: failedAmount30d,
          totalCharges30d: all30d.length,
          totalSucceeded30d: succeeded30d.length,
        },
        repeatOffenders,
        failuresByDay,
        monthlyTrend,
        weeklyTrend,
        topFailureReasons,
      }),
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return {
      statusCode: error.statusCode || 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
