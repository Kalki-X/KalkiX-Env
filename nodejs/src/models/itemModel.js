const { pool } = require('../db/pool');

function toPublicItem(row) {
    if (!row) return null;
    return {
        id: row.id,
        ownerId: row.owner_id,
        title: row.title,
        description: row.description,
        category: row.category,
        pricePerDay: Number(row.price_per_day),
        currency: row.currency,
        status: row.status,
        pickupAddress: row.pickup_address,
        pickupLat: row.pickup_lat !== null && row.pickup_lat !== undefined ? Number(row.pickup_lat) : null,
        pickupLng: row.pickup_lng !== null && row.pickup_lng !== undefined ? Number(row.pickup_lng) : null,
        // Only populated by queries that join it in (list/detail below); normalized to
        // null (rather than left undefined) for rows from plain RETURNING * queries
        // (create/update/status-change) so the shape is always consistent for the
        // frontend regardless of which query produced it.
        primaryImageId: row.primary_image_id ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// Every read that needs to feed the marketplace grid or a single item's detail page
// joins in the lowest-position image id in one query instead of N+1-ing per item.
const PRIMARY_IMAGE_SUBQUERY = `(
    SELECT id FROM item_images WHERE item_id = i.id ORDER BY position ASC, id ASC LIMIT 1
) AS primary_image_id`;

async function listActiveItems({ category, search } = {}) {
    const params = [];
    let where = `i.status = 'active'`;
    if (category) {
        params.push(category);
        where += ` AND i.category = $${params.length}`;
    }
    if (search) {
        params.push(`%${search}%`);
        where += ` AND (i.title ILIKE $${params.length} OR i.description ILIKE $${params.length})`;
    }
    const { rows } = await pool.query(
        `SELECT i.*, ${PRIMARY_IMAGE_SUBQUERY} FROM items i WHERE ${where} ORDER BY i.created_at DESC LIMIT 200`,
        params
    );
    return rows.map(toPublicItem);
}

async function listItemsByOwner(ownerId, { search } = {}) {
    const params = [ownerId];
    let where = 'i.owner_id = $1';
    if (search) {
        params.push(`%${search}%`);
        where += ` AND (i.title ILIKE $${params.length} OR i.description ILIKE $${params.length})`;
    }
    const { rows } = await pool.query(
        `SELECT i.*, ${PRIMARY_IMAGE_SUBQUERY} FROM items i WHERE ${where} ORDER BY i.created_at DESC`,
        params
    );
    return rows.map(toPublicItem);
}

// Raw snake_case row — used internally (bookings.routes.js reads item.owner_id,
// item.price_per_day, item.status directly). Do not expose this shape over the API;
// use findPublicItemById for anything client-facing.
async function findItemById(id) {
    const { rows } = await pool.query('SELECT * FROM items WHERE id = $1', [id]);
    return rows[0] || null;
}

async function findPublicItemById(id) {
    const { rows } = await pool.query(
        `SELECT i.*, ${PRIMARY_IMAGE_SUBQUERY} FROM items i WHERE i.id = $1`,
        [id]
    );
    return toPublicItem(rows[0]);
}

async function createItem({ ownerId, title, description, category, pricePerDay, currency = 'USD', pickupAddress, pickupLat, pickupLng }) {
    const { rows } = await pool.query(
        `INSERT INTO items (owner_id, title, description, category, price_per_day, currency, status, pickup_address, pickup_lat, pickup_lng)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9)
         RETURNING *`,
        [ownerId, title, description || null, category || null, pricePerDay, currency, pickupAddress || null, pickupLat ?? null, pickupLng ?? null]
    );
    return toPublicItem(rows[0]);
}

async function updateItemStatus(id, ownerId, status) {
    const { rows } = await pool.query(
        `UPDATE items SET status = $1, updated_at = now()
         WHERE id = $2 AND owner_id = $3
         RETURNING *`,
        [status, id, ownerId]
    );
    return toPublicItem(rows[0]);
}

// Partial update of the editable listing fields (everything except status, which stays
// on its own dedicated endpoint since that's a workflow action, not a field edit).
async function updateItemFields(id, ownerId, fields) {
    const columns = {
        title: 'title',
        description: 'description',
        category: 'category',
        pricePerDay: 'price_per_day',
        currency: 'currency',
        pickupAddress: 'pickup_address',
        pickupLat: 'pickup_lat',
        pickupLng: 'pickup_lng',
    };
    const sets = [];
    const params = [];
    for (const [key, column] of Object.entries(columns)) {
        if (fields[key] !== undefined) {
            params.push(fields[key]);
            sets.push(`${column} = $${params.length}`);
        }
    }
    if (sets.length === 0) return findPublicItemById(id);

    sets.push('updated_at = now()');
    params.push(id, ownerId);

    const { rows } = await pool.query(
        `UPDATE items SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND owner_id = $${params.length} RETURNING *`,
        params
    );
    return toPublicItem(rows[0]);
}

async function countBookingsForItem(itemId) {
    const { rows } = await pool.query('SELECT count(*)::int AS count FROM bookings WHERE item_id = $1', [itemId]);
    return rows[0].count;
}

// Hard delete is only safe when nothing references this item's booking/payment/document
// history — callers must check countBookingsForItem first and archive instead otherwise
// (see the /status endpoint). Returns true if a row was deleted.
async function deleteItem(id, ownerId) {
    const { rowCount } = await pool.query('DELETE FROM items WHERE id = $1 AND owner_id = $2', [id, ownerId]);
    return rowCount > 0;
}

module.exports = {
    toPublicItem,
    listActiveItems,
    listItemsByOwner,
    findItemById,
    findPublicItemById,
    createItem,
    updateItemStatus,
    updateItemFields,
    countBookingsForItem,
    deleteItem,
};
