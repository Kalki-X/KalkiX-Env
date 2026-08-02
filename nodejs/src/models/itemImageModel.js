const { pool } = require('../db/pool');

const MAX_IMAGES_PER_ITEM = 8;

function toPublicImageMeta(row) {
    if (!row) return null;
    return { id: row.id, itemId: row.item_id, mimeType: row.mime_type, position: row.position, createdAt: row.created_at };
}

// Metadata only (no `data` blob) — used for listing/gallery UI, which then requests
// each image's bytes individually via GET /api/items/:id/images/:imageId.
async function listItemImageMeta(itemId) {
    const { rows } = await pool.query(
        'SELECT id, item_id, mime_type, position, created_at FROM item_images WHERE item_id = $1 ORDER BY position ASC, id ASC',
        [itemId]
    );
    return rows.map(toPublicImageMeta);
}

async function countItemImages(itemId) {
    const { rows } = await pool.query('SELECT count(*)::int AS count FROM item_images WHERE item_id = $1', [itemId]);
    return rows[0].count;
}

// Includes the raw bytea `data` — only for the byte-serving route, never for list APIs.
async function findItemImageWithData(imageId) {
    const { rows } = await pool.query('SELECT * FROM item_images WHERE id = $1', [imageId]);
    return rows[0] || null;
}

async function addItemImage({ itemId, mimeType, data }) {
    const { rows: posRows } = await pool.query(
        'SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM item_images WHERE item_id = $1',
        [itemId]
    );
    const { rows } = await pool.query(
        `INSERT INTO item_images (item_id, mime_type, data, position)
         VALUES ($1, $2, $3, $4)
         RETURNING id, item_id, mime_type, position, created_at`,
        [itemId, mimeType, data, posRows[0].next_position]
    );
    return toPublicImageMeta(rows[0]);
}

// Scoped by item_id too, so one lender can't delete another lender's image by guessing ids.
async function deleteItemImage(imageId, itemId) {
    const { rowCount } = await pool.query('DELETE FROM item_images WHERE id = $1 AND item_id = $2', [imageId, itemId]);
    return rowCount > 0;
}

module.exports = {
    MAX_IMAGES_PER_ITEM,
    listItemImageMeta,
    countItemImages,
    findItemImageWithData,
    addItemImage,
    deleteItemImage,
};
