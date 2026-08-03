const { pool } = require('../db/pool');

// Statuses that hold a date range on the calendar — anything not yet decided, awaiting
// payment, or already paid. 'rejected' and 'cancelled' free the dates back up
// immediately; 'completed' bookings are always in the past so they're moot either way.
const BLOCKING_STATUSES = ['pending_approval', 'awaiting_payment', 'confirmed', 'completed'];

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
        renterNote: row.renter_note,
        rejectionReason: row.rejection_reason,
        decidedAt: row.decided_at,
        decidedBy: row.decided_by,
        cancellationFreeDays: row.cancellation_free_days !== null && row.cancellation_free_days !== undefined ? Number(row.cancellation_free_days) : null,
        cancellationFeePercent: row.cancellation_fee_percent !== null && row.cancellation_fee_percent !== undefined ? Number(row.cancellation_fee_percent) : null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// Overlap check against any booking that's still holding its dates (see BLOCKING_STATUSES
// above): (existing.start <= new.end) AND (existing.end >= new.start)
async function hasOverlap(itemId, startDate, endDate) {
    const { rows } = await pool.query(
        `SELECT 1 FROM bookings
         WHERE item_id = $1
           AND status = ANY($4::text[])
           AND start_date <= $3
           AND end_date >= $2
         LIMIT 1`,
        [itemId, startDate, endDate, BLOCKING_STATUSES]
    );
    return rows.length > 0;
}

// A request always starts as 'pending_approval' — the lender must explicitly approve
// (POST /:id/approve) before a proforma invoice is issued or payment becomes possible.
// The item's cancellation policy (if any) is snapshotted onto the booking now, so a
// lender editing their policy later never changes the terms of a request already made.
async function createBooking({
    itemId,
    renterId,
    startDate,
    endDate,
    totalAmount,
    currency = 'USD',
    renterNote,
    cancellationFreeDays,
    cancellationFeePercent,
}) {
    const { rows } = await pool.query(
        `INSERT INTO bookings (item_id, renter_id, start_date, end_date, total_amount, currency, status, renter_note, cancellation_free_days, cancellation_fee_percent)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending_approval', $7, $8, $9)
         RETURNING *`,
        [itemId, renterId, startDate, endDate, totalAmount, currency, renterNote || null, cancellationFreeDays ?? null, cancellationFeePercent ?? null]
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

// Only succeeds from 'pending_approval' (enforced by the WHERE clause, not just the
// caller) so two concurrent approve/reject calls can't both "win".
async function approveBooking(id, decidedById) {
    const { rows } = await pool.query(
        `UPDATE bookings SET status = 'awaiting_payment', decided_at = now(), decided_by = $1, updated_at = now()
         WHERE id = $2 AND status = 'pending_approval'
         RETURNING *`,
        [decidedById, id]
    );
    return toPublicBooking(rows[0]);
}

async function rejectBooking(id, decidedById, reason) {
    const { rows } = await pool.query(
        `UPDATE bookings SET status = 'rejected', rejection_reason = $1, decided_at = now(), decided_by = $2, updated_at = now()
         WHERE id = $3 AND status = 'pending_approval'
         RETURNING *`,
        [reason, decidedById, id]
    );
    return toPublicBooking(rows[0]);
}

// Computes the refund for cancelling a *paid* (confirmed) booking against its
// snapshotted cancellation policy. No policy snapshotted (both fields null, i.e. the
// item had no policy set at request time) means the original, generous default: a full
// refund, no fee — this keeps every booking made before Phase 6 behaving exactly as it
// did before. `today` is injectable for tests; real callers just use the default.
function computeRefund(booking, today = new Date()) {
    const total = Number(booking.total_amount);
    const freeDays = booking.cancellation_free_days;
    const feePercent = booking.cancellation_fee_percent;

    if (freeDays === null || freeDays === undefined || feePercent === null || feePercent === undefined) {
        return { refundPercent: 100, refundAmount: total, feePercent: 0, feeAmount: 0, daysBeforeStart: null };
    }

    const start = new Date(booking.start_date);
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysBeforeStart = Math.floor((start.getTime() - today.getTime()) / msPerDay);

    if (daysBeforeStart >= Number(freeDays)) {
        return { refundPercent: 100, refundAmount: total, feePercent: 0, feeAmount: 0, daysBeforeStart };
    }

    const refundPercent = 100 - Number(feePercent);
    const refundAmount = Math.round(total * refundPercent) / 100;
    const feeAmount = Math.round((total - refundAmount) * 100) / 100;
    return { refundPercent, refundAmount, feePercent: Number(feePercent), feeAmount, daysBeforeStart };
}

// Just the date ranges (no renter identity) for any booking still holding its dates on
// this item — this is what powers the public "is it available" calendar, so it
// deliberately exposes nothing about who booked it.
async function listBookedDateRanges(itemId, { from, to } = {}) {
    const params = [itemId, BLOCKING_STATUSES];
    let where = `item_id = $1 AND status = ANY($2::text[])`;
    if (from) {
        params.push(from);
        where += ` AND end_date >= $${params.length}`;
    }
    if (to) {
        params.push(to);
        where += ` AND start_date <= $${params.length}`;
    }
    const { rows } = await pool.query(
        `SELECT start_date, end_date FROM bookings WHERE ${where} ORDER BY start_date ASC`,
        params
    );
    return rows.map((r) => ({ startDate: r.start_date, endDate: r.end_date }));
}

// Same shape documentModel.js's findByDocumentNumberWithContext uses — item + the
// other party's name/email, so the dashboard list is self-contained (no follow-up
// per-row requests) and each side has what they need to coordinate pickup.
function toEnrichedBooking(row) {
    return {
        ...toPublicBooking(row),
        item: { id: row.item_id_full, title: row.item_title },
        otherParty: { id: row.other_party_id, name: `${row.other_party_first_name} ${row.other_party_last_name}`, email: row.other_party_email },
    };
}

async function listBookingsForRenter(renterId) {
    const { rows } = await pool.query(
        `SELECT b.*, i.id AS item_id_full, i.title AS item_title,
                owner.id AS other_party_id, owner.first_name AS other_party_first_name,
                owner.last_name AS other_party_last_name, owner.email AS other_party_email
         FROM bookings b
         JOIN items i ON i.id = b.item_id
         JOIN users owner ON owner.id = i.owner_id
         WHERE b.renter_id = $1
         ORDER BY b.created_at DESC`,
        [renterId]
    );
    return rows.map(toEnrichedBooking);
}

// Bookings for items owned by a given lender (join through items).
// Single-booking detail for the dedicated Lender/Renter booking pages — returns both
// parties (owner and renter) so the route can decide which one is "the other party" and
// whether the viewer is allowed to act (approve/reject/cancel) without a second query.
async function findBookingWithContext(id) {
    const { rows } = await pool.query(
        `SELECT b.*,
                i.id AS item_id_full, i.title AS item_title, i.price_per_day AS item_price_per_day,
                i.currency AS item_currency, i.pickup_address AS item_pickup_address,
                owner.id AS owner_id, owner.first_name AS owner_first_name,
                owner.last_name AS owner_last_name, owner.email AS owner_email,
                renter.id AS renter_id_full, renter.first_name AS renter_first_name,
                renter.last_name AS renter_last_name, renter.email AS renter_email
         FROM bookings b
         JOIN items i ON i.id = b.item_id
         JOIN users owner ON owner.id = i.owner_id
         JOIN users renter ON renter.id = b.renter_id
         WHERE b.id = $1`,
        [id]
    );
    const row = rows[0];
    if (!row) return null;
    return {
        ...toPublicBooking(row),
        item: {
            id: row.item_id_full,
            title: row.item_title,
            pricePerDay: Number(row.item_price_per_day),
            currency: row.item_currency,
            pickupAddress: row.item_pickup_address,
        },
        owner: { id: row.owner_id, name: `${row.owner_first_name} ${row.owner_last_name}`, email: row.owner_email },
        renter: { id: row.renter_id_full, name: `${row.renter_first_name} ${row.renter_last_name}`, email: row.renter_email },
    };
}

async function listBookingsForOwner(ownerId) {
    const { rows } = await pool.query(
        `SELECT b.*, i.id AS item_id_full, i.title AS item_title,
                renter.id AS other_party_id, renter.first_name AS other_party_first_name,
                renter.last_name AS other_party_last_name, renter.email AS other_party_email
         FROM bookings b
         JOIN items i ON i.id = b.item_id
         JOIN users renter ON renter.id = b.renter_id
         WHERE i.owner_id = $1
         ORDER BY b.created_at DESC`,
        [ownerId]
    );
    return rows.map(toEnrichedBooking);
}

module.exports = {
    toPublicBooking,
    hasOverlap,
    createBooking,
    findBookingById,
    setBookingStatus,
    approveBooking,
    rejectBooking,
    computeRefund,
    findBookingWithContext,
    listBookedDateRanges,
    listBookingsForRenter,
    listBookingsForOwner,
};
