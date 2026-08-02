const { pool } = require('../db/pool');

function toPublicBlock(row) {
    if (!row) return null;
    return { id: row.id, itemId: row.item_id, startDate: row.start_date, endDate: row.end_date, reason: row.reason, createdAt: row.created_at };
}

// Windowed so the renter-facing calendar doesn't have to pull every block ever created —
// defaults to a generous look-ahead if the caller doesn't specify one.
async function listAvailabilityBlocks(itemId, { from, to } = {}) {
    const params = [itemId];
    let where = 'item_id = $1';
    if (from) {
        params.push(from);
        where += ` AND end_date >= $${params.length}`;
    }
    if (to) {
        params.push(to);
        where += ` AND start_date <= $${params.length}`;
    }
    const { rows } = await pool.query(
        `SELECT * FROM item_availability_blocks WHERE ${where} ORDER BY start_date ASC`,
        params
    );
    return rows.map(toPublicBlock);
}

// Same overlap semantics as bookingModel.hasOverlap: (existing.start <= new.end) AND (existing.end >= new.start).
async function hasAvailabilityBlockOverlap(itemId, startDate, endDate) {
    const { rows } = await pool.query(
        `SELECT 1 FROM item_availability_blocks
         WHERE item_id = $1 AND start_date <= $3 AND end_date >= $2
         LIMIT 1`,
        [itemId, startDate, endDate]
    );
    return rows.length > 0;
}

async function addAvailabilityBlock({ itemId, startDate, endDate, reason }) {
    const { rows } = await pool.query(
        `INSERT INTO item_availability_blocks (item_id, start_date, end_date, reason)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [itemId, startDate, endDate, reason || null]
    );
    return toPublicBlock(rows[0]);
}

// Scoped by item_id so one lender can't delete another lender's block by guessing ids.
async function deleteAvailabilityBlock(blockId, itemId) {
    const { rowCount } = await pool.query('DELETE FROM item_availability_blocks WHERE id = $1 AND item_id = $2', [blockId, itemId]);
    return rowCount > 0;
}

module.exports = {
    listAvailabilityBlocks,
    hasAvailabilityBlockOverlap,
    addAvailabilityBlock,
    deleteAvailabilityBlock,
};
