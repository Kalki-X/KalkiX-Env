const { pool } = require('../db/pool');

function toPublicEntry(row) {
    return {
        id: row.id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        metadata: row.metadata,
        ipAddress: row.ip_address,
        createdAt: row.created_at,
        user: row.user_id
            ? { id: row.user_id, name: `${row.first_name} ${row.last_name}`, email: row.email }
            : null,
    };
}

// Powers the Super Admin audit trail viewer: filter by user, action, entity type, and
// date range, newest first. `action` matches by prefix (e.g. "auth." for every auth event).
async function listAuditLog({ userId, action, entityType, from, to, page = 1, pageSize = 50 }) {
    const conditions = [];
    const params = [];

    if (userId) {
        params.push(userId);
        conditions.push(`a.user_id = $${params.length}`);
    }
    if (action) {
        params.push(`${action}%`);
        conditions.push(`a.action LIKE $${params.length}`);
    }
    if (entityType) {
        params.push(entityType);
        conditions.push(`a.entity_type = $${params.length}`);
    }
    if (from) {
        params.push(from);
        conditions.push(`a.created_at >= $${params.length}`);
    }
    if (to) {
        params.push(to);
        conditions.push(`a.created_at <= $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Math.max(1, page) - 1) * pageSize;

    const { rows: countRows } = await pool.query(`SELECT count(*) AS total FROM audit_log a ${where}`, params);
    const total = Number(countRows[0].total);

    params.push(pageSize, offset);
    const { rows } = await pool.query(
        `SELECT a.*, u.first_name, u.last_name, u.email
         FROM audit_log a
         LEFT JOIN users u ON u.id = a.user_id
         ${where}
         ORDER BY a.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
    );

    return { entries: rows.map(toPublicEntry), total, page: Math.max(1, page), pageSize };
}

module.exports = { listAuditLog };
