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
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

async function listActiveItems({ category } = {}) {
    const params = [];
    let where = `status = 'active'`;
    if (category) {
        params.push(category);
        where += ` AND category = $${params.length}`;
    }
    const { rows } = await pool.query(
        `SELECT * FROM items WHERE ${where} ORDER BY created_at DESC LIMIT 200`,
        params
    );
    return rows.map(toPublicItem);
}

async function listItemsByOwner(ownerId) {
    const { rows } = await pool.query(
        'SELECT * FROM items WHERE owner_id = $1 ORDER BY created_at DESC',
        [ownerId]
    );
    return rows.map(toPublicItem);
}

async function findItemById(id) {
    const { rows } = await pool.query('SELECT * FROM items WHERE id = $1', [id]);
    return rows[0] || null;
}

async function createItem({ ownerId, title, description, category, pricePerDay, currency = 'USD' }) {
    const { rows } = await pool.query(
        `INSERT INTO items (owner_id, title, description, category, price_per_day, currency, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'active')
         RETURNING *`,
        [ownerId, title, description || null, category || null, pricePerDay, currency]
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

module.exports = { toPublicItem, listActiveItems, listItemsByOwner, findItemById, createItem, updateItemStatus };
