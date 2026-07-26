const { pool } = require('../db/pool');

function toPublicBooking(row) {
    if (!row) return null;
    return {
        id: row.id,
        itemId: row.item_id,
        renterId: row.renter_id,
        startDate: row.start_date,
        endDate: row.end_date,
        status: row.status,
        totalAmount: Number(row.total_amount),
        currency: row.currency,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// Overlap check against any booking that isn't cancelled: (existing.start <= new.end) AND (existing.end >= new.start)
async function hasOverlap(itemId, startDate, endDate) {
    const { rows } = await pool.query(
        `SELECT 1 FROM bookings
         WHERE item_id = $1
           AND status IN ('pending', 'confirmed')
           AND start_date <= $3
           AND end_date >= $2
         LIMIT 1`,
        [itemId, startDate, endDate]
    );
    return rows.length > 0;
}

async function createBooking({ itemId, renterId, startDate, endDate, totalAmount, currency = 'USD' }) {
    const { rows } = await pool.query(
        `INSERT INTO bookings (item_id, renter_id, start_date, end_date, total_amount, currency, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING *`,
        [itemId, renterId, startDate, endDate, totalAmount, currency]
    );
    return toPublicBooking(rows[0]);
}

async function findBookingById(id) {
    const { rows } = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
    return rows[0] || null;
}

async function setBookingStatus(id, status) {
    const { rows } = await pool.query(
        `UPDATE bookings SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
        [status, id]
    );
    return toPublicBooking(rows[0]);
}

async function listBookingsForRenter(renterId) {
    const { rows } = await pool.query(
        'SELECT * FROM bookings WHERE renter_id = $1 ORDER BY created_at DESC',
        [renterId]
    );
    return rows.map(toPublicBooking);
}

// Bookings for items owned by a given lender (join through items).
async function listBookingsForOwner(ownerId) {
    const { rows } = await pool.query(
        `SELECT b.* FROM bookings b
         JOIN items i ON i.id = b.item_id
         WHERE i.owner_id = $1
         ORDER BY b.created_at DESC`,
        [ownerId]
    );
    return rows.map(toPublicBooking);
}

module.exports = {
    toPublicBooking,
    hasOverlap,
    createBooking,
    findBookingById,
    setBookingStatus,
    listBookingsForRenter,
    listBookingsForOwner,
};
