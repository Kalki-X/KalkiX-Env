const { pool } = require('../db/pool');

function toPublicPayment(row) {
    return {
        id: row.id,
        bookingId: row.booking_id,
        amount: Number(row.amount),
        currency: row.currency,
        method: row.method,
        status: row.status,
        providerRef: row.provider_ref,
        // The platform's cut of this payment and what's left over for the lender's
        // payout. Both null on payments made before Phase 9 (fee tracking wasn't
        // recorded yet) — the frontend shows those as "not tracked" rather than $0.
        platformFeeAmount: row.platform_fee_amount !== null && row.platform_fee_amount !== undefined ? Number(row.platform_fee_amount) : null,
        payoutAmount: row.payout_amount !== null && row.payout_amount !== undefined ? Number(row.payout_amount) : null,
        createdAt: row.created_at,
        item: row.item_title ? { id: row.item_id, title: row.item_title } : null,
        renter: row.renter_email
            ? { id: row.renter_id, name: `${row.renter_first_name} ${row.renter_last_name}`, email: row.renter_email }
            : null,
    };
}

async function listPayments({ status, from, to, page = 1, pageSize = 20 }) {
    const conditions = [];
    const params = [];

    if (status) {
        params.push(status);
        conditions.push(`p.status = $${params.length}`);
    }
    if (from) {
        params.push(from);
        conditions.push(`p.created_at >= $${params.length}`);
    }
    if (to) {
        params.push(to);
        conditions.push(`p.created_at <= $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Math.max(1, page) - 1) * pageSize;

    const { rows: countRows } = await pool.query(`SELECT count(*) AS total FROM payments p ${where}`, params);
    const total = Number(countRows[0].total);

    params.push(pageSize, offset);
    const { rows } = await pool.query(
        `SELECT
            p.*,
            i.id AS item_id, i.title AS item_title,
            renter.id AS renter_id, renter.first_name AS renter_first_name,
            renter.last_name AS renter_last_name, renter.email AS renter_email
         FROM payments p
         JOIN bookings b ON b.id = p.booking_id
         JOIN items i ON i.id = b.item_id
         JOIN users renter ON renter.id = b.renter_id
         ${where}
         ORDER BY p.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
    );

    return { payments: rows.map(toPublicPayment), total, page: Math.max(1, page), pageSize };
}

async function findPaymentById(id) {
    const { rows } = await pool.query('SELECT * FROM payments WHERE id = $1', [id]);
    return rows[0] || null;
}

async function markPaymentRefunded(id) {
    const { rows } = await pool.query(
        `UPDATE payments SET status = 'refunded' WHERE id = $1 RETURNING *`,
        [id]
    );
    return toPublicPayment(rows[0]);
}

module.exports = { listPayments, findPaymentById, markPaymentRefunded, toPublicPayment };
