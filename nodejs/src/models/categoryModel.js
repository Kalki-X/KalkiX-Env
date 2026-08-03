const { pool } = require('../db/pool');

function toPublicCategory(row) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        hasIcon: !!row.icon_data,
        sortOrder: row.sort_order,
        active: row.active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

async function listCategories({ activeOnly = false } = {}) {
    const where = activeOnly ? 'WHERE active = true' : '';
    const { rows } = await pool.query(`SELECT * FROM categories ${where} ORDER BY sort_order ASC, name ASC`);
    return rows.map(toPublicCategory);
}

async function findCategoryById(id) {
    const { rows } = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
    return rows[0] || null;
}

async function createCategory({ name, sortOrder }, updatedById) {
    const { rows } = await pool.query(
        `INSERT INTO categories (name, sort_order, updated_by) VALUES ($1, $2, $3) RETURNING *`,
        [name, sortOrder ?? 0, updatedById]
    );
    return toPublicCategory(rows[0]);
}

async function updateCategory(id, { name, sortOrder, active }, updatedById) {
    const sets = [];
    const params = [];
    if (name !== undefined) {
        params.push(name);
        sets.push(`name = $${params.length}`);
    }
    if (sortOrder !== undefined) {
        params.push(sortOrder);
        sets.push(`sort_order = $${params.length}`);
    }
    if (active !== undefined) {
        params.push(active);
        sets.push(`active = $${params.length}`);
    }
    if (sets.length === 0) return toPublicCategory(await findCategoryById(id));

    params.push(updatedById);
    sets.push(`updated_by = $${params.length}`);
    sets.push('updated_at = now()');
    params.push(id);
    const { rows } = await pool.query(`UPDATE categories SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    return toPublicCategory(rows[0]);
}

async function setCategoryIcon(id, { mimeType, data }, updatedById) {
    const { rows } = await pool.query(
        `UPDATE categories SET icon_mime_type = $1, icon_data = $2, updated_by = $3, updated_at = now() WHERE id = $4 RETURNING *`,
        [mimeType, data, updatedById, id]
    );
    return toPublicCategory(rows[0]);
}

// Includes the raw bytea — only for the byte-serving route.
async function getCategoryIconWithData(id) {
    const { rows } = await pool.query('SELECT icon_mime_type, icon_data FROM categories WHERE id = $1', [id]);
    const row = rows[0];
    if (!row || !row.icon_data) return null;
    return { mimeType: row.icon_mime_type, data: row.icon_data };
}

async function countItemsUsingCategory(name) {
    const { rows } = await pool.query('SELECT count(*)::int AS count FROM items WHERE category = $1', [name]);
    return rows[0].count;
}

async function deleteCategory(id) {
    const { rowCount } = await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    return rowCount > 0;
}

module.exports = {
    toPublicCategory,
    listCategories,
    findCategoryById,
    createCategory,
    updateCategory,
    setCategoryIcon,
    getCategoryIconWithData,
    countItemsUsingCategory,
    deleteCategory,
};
