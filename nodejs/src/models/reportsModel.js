const { pool } = require('../db/pool');

const VALID_GROUPINGS = ['day', 'week', 'month'];

// "Sales" = bookings that were actually paid for (confirmed or completed) — pending
// bookings haven't been paid yet, cancelled ones never were (or were refunded via a
// credit note), so neither counts as revenue.
const SALE_STATUSES = ['confirmed', 'completed'];

async function getSalesReport({ from, to, groupBy = 'day' }) {
    const grouping = VALID_GROUPINGS.includes(groupBy) ? groupBy : 'day';

    const conditions = [`status = ANY($1)`];
    const params = [SALE_STATUSES];
    if (from) {
        params.push(from);
        conditions.push(`created_at >= $${params.length}`);
    }
    if (to) {
        params.push(to);
        conditions.push(`created_at <= $${params.length}`);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;

    const { rows: series } = await pool.query(
        `SELECT
            date_trunc('${grouping}', created_at) AS period,
            count(*) AS bookings,
            sum(total_amount) AS revenue
         FROM bookings
         ${where}
         GROUP BY period
         ORDER BY period ASC`,
        params
    );

    const { rows: totalsRows } = await pool.query(
        `SELECT count(*) AS bookings, coalesce(sum(total_amount), 0) AS revenue
         FROM bookings ${where}`,
        params
    );
    const totals = totalsRows[0];

    return {
        groupBy: grouping,
        series: series.map((r) => ({
            period: r.period,
            bookings: Number(r.bookings),
            revenue: Number(r.revenue),
        })),
        totals: {
            bookings: Number(totals.bookings),
            revenue: Number(totals.revenue),
            averageBookingValue: Number(totals.bookings) > 0 ? Number(totals.revenue) / Number(totals.bookings) : 0,
        },
    };
}

module.exports = { getSalesReport };
