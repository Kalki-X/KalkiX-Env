const { pool } = require('../db/pool');
const { toPublicItem } = require('./itemModel');

// Every read that needs to feed the marketplace grid joins in the lowest-position
// image id in one query instead of N+1-ing per item (same pattern as itemModel.js).
const PRIMARY_IMAGE_SUBQUERY = `(
    SELECT id FROM item_images WHERE item_id = i.id ORDER BY position ASC, id ASC LIMIT 1
) AS primary_image_id`;

function toPublicFeatured(row) {
    if (!row) return null;
    return {
        id: row.id,
        itemId: row.item_id,
        purchasedBy: row.purchased_by,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        feeAmount: Number(row.fee_amount),
        currency: row.currency,
        status: row.status,
        createdAt: row.created_at,
    };
}

async function purchaseFeaturedSlot({ itemId, purchasedBy, days, feeAmount, currency, providerRef }) {
    const { rows } = await pool.query(
        `INSERT INTO featured_listings (item_id, purchased_by, ends_at, fee_amount, currency, provider_ref)
         VALUES ($1, $2, now() + ($3 || ' days')::interval, $4, $5, $6)
         RETURNING *`,
        [itemId, purchasedBy, days, feeAmount, currency, providerRef]
    );
    return toPublicFeatured(rows[0]);
}

// Currently-active featured items (paid slot not expired/cancelled, item still active),
// joined with the item itself for the homepage Trending rail. Most-recently-purchased
// first.
async function listActiveFeaturedItems(limit = 12) {
    const { rows } = await pool.query(
        `SELECT i.*, ${PRIMARY_IMAGE_SUBQUERY}, f.ends_at AS featured_ends_at
         FROM featured_listings f
         JOIN items i ON i.id = f.item_id
         WHERE f.status = 'active' AND f.ends_at > now() AND i.status = 'active'
         ORDER BY f.created_at DESC
         LIMIT $1`,
        [limit]
    );
    return rows.map((r) => ({ ...toPublicItem(r), featuredUntil: r.featured_ends_at }));
}

async function listFeaturedForOwner(ownerId) {
    const { rows } = await pool.query(
        `SELECT f.*, i.title AS item_title
         FROM featured_listings f
         JOIN items i ON i.id = f.item_id
         WHERE i.owner_id = $1
         ORDER BY f.created_at DESC`,
        [ownerId]
    );
    return rows.map((r) => ({ ...toPublicFeatured(r), itemTitle: r.item_title }));
}

async function listAllFeatured({ activeOnly = false } = {}) {
    const where = activeOnly ? `WHERE f.status = 'active' AND f.ends_at > now()` : '';
    const { rows } = await pool.query(
        `SELECT f.*, i.title AS item_title, i.owner_id
         FROM featured_listings f
         JOIN items i ON i.id = f.item_id
         ${where}
         ORDER BY f.created_at DESC`
    );
    return rows.map((r) => ({ ...toPublicFeatured(r), itemTitle: r.item_title, ownerId: r.owner_id }));
}

async function findFeaturedById(id) {
    const { rows } = await pool.query('SELECT * FROM featured_listings WHERE id = $1', [id]);
    return rows[0] || null;
}

async function findActiveFeaturedForItem(itemId) {
    const { rows } = await pool.query(
        `SELECT * FROM featured_listings WHERE item_id = $1 AND status = 'active' AND ends_at > now() ORDER BY ends_at DESC LIMIT 1`,
        [itemId]
    );
    return toPublicFeatured(rows[0]);
}

// Admin manual unfeature — flips status rather than deleting, keeping the paid-slot
// audit trail intact (same "never delete financial-ish records" precedent used for
// voided documents elsewhere in this app).
async function cancelFeaturedSlot(id) {
    const { rows } = await pool.query(`UPDATE featured_listings SET status = 'cancelled' WHERE id = $1 RETURNING *`, [id]);
    return toPublicFeatured(rows[0]);
}

module.exports = {
    toPublicFeatured,
    purchaseFeaturedSlot,
    listActiveFeaturedItems,
    listFeaturedForOwner,
    listAllFeatured,
    findFeaturedById,
    findActiveFeaturedForItem,
    cancelFeaturedSlot,
};
