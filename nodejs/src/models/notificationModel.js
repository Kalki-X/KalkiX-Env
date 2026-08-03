const { pool } = require('../db/pool');

function toPublicNotification(row) {
    if (!row) return null;
    return {
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        link: row.link,
        entityType: row.entity_type,
        entityId: row.entity_id,
        readAt: row.read_at,
        createdAt: row.created_at,
    };
}

async function createNotification({ userId, type, title, body, link, entityType, entityId }) {
    const { rows } = await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, link, entity_type, entity_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [userId, type, title, body || null, link || null, entityType || null, entityId ? String(entityId) : null]
    );
    return toPublicNotification(rows[0]);
}

async function listNotificationsForUser(userId, { page = 1, pageSize = 20 } = {}) {
    const offset = (Math.max(1, page) - 1) * pageSize;
    const { rows } = await pool.query(
        `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [userId, pageSize, offset]
    );
    const { rows: countRows } = await pool.query('SELECT count(*)::int AS total FROM notifications WHERE user_id = $1', [userId]);
    return { notifications: rows.map(toPublicNotification), total: countRows[0].total, page: Math.max(1, page), pageSize };
}

async function countUnread(userId) {
    const { rows } = await pool.query(
        'SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL',
        [userId]
    );
    return rows[0].n;
}

// Scoped by userId so one person can never mark another's notification as read, even by
// guessing an id.
async function markAsRead(id, userId) {
    const { rows } = await pool.query(
        `UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL RETURNING *`,
        [id, userId]
    );
    return toPublicNotification(rows[0]);
}

async function markAllAsRead(userId) {
    const { rowCount } = await pool.query(
        `UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`,
        [userId]
    );
    return rowCount;
}

module.exports = {
    toPublicNotification,
    createNotification,
    listNotificationsForUser,
    countUnread,
    markAsRead,
    markAllAsRead,
};
