const { pool } = require('../db/pool');

// Admin-postable banner messages ("site notices"), shown to platform users and public
// visitors alike (Phase 12) — e.g. planned maintenance, policy changes, promotions.
// Multiple can exist at once; nothing is ever hard-deleted implicitly (a plain DELETE
// route is offered, but toggling `active` off is the normal way to retire one, keeping
// a record of what was announced and when).

const VALID_SEVERITIES = ['info', 'warning', 'critical'];
// 'both' shows on the public homepage AND the logged-in dashboard; the other two are
// audience-specific. Matches the CHECK constraint on site_notices.audience.
const VALID_AUDIENCES = ['platform_users', 'public', 'both'];

function toPublicNotice(row) {
    if (!row) return null;
    return {
        id: row.id,
        message: row.message,
        severity: row.severity,
        audience: row.audience,
        active: row.active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// `audience` here is the *viewer's* context ('public' for the logged-out homepage,
// 'platform_users' for the logged-in dashboard) — a notice matches if it was targeted
// at that exact audience, or at 'both'. Omit it (as the admin listing does) to get
// every notice regardless of who it's targeted at.
async function listNotices({ activeOnly = false, audience } = {}) {
    const conditions = [];
    const params = [];
    if (activeOnly) conditions.push('active = true');
    if (audience) {
        params.push(audience);
        conditions.push(`(audience = $${params.length} OR audience = 'both')`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(`SELECT * FROM site_notices ${where} ORDER BY created_at DESC`, params);
    return rows.map(toPublicNotice);
}

async function findNoticeById(id) {
    const { rows } = await pool.query('SELECT * FROM site_notices WHERE id = $1', [id]);
    return rows[0] || null;
}

async function createNotice({ message, severity, audience }, updatedById) {
    const { rows } = await pool.query(
        `INSERT INTO site_notices (message, severity, audience, updated_by) VALUES ($1, $2, $3, $4) RETURNING *`,
        [message, severity || 'info', audience || 'both', updatedById]
    );
    return toPublicNotice(rows[0]);
}

async function updateNotice(id, { message, severity, audience, active }, updatedById) {
    const sets = [];
    const params = [];
    if (message !== undefined) {
        params.push(message);
        sets.push(`message = $${params.length}`);
    }
    if (severity !== undefined) {
        params.push(severity);
        sets.push(`severity = $${params.length}`);
    }
    if (audience !== undefined) {
        params.push(audience);
        sets.push(`audience = $${params.length}`);
    }
    if (active !== undefined) {
        params.push(active);
        sets.push(`active = $${params.length}`);
    }
    if (sets.length === 0) return toPublicNotice(await findNoticeById(id));

    params.push(updatedById);
    sets.push(`updated_by = $${params.length}`);
    sets.push('updated_at = now()');
    params.push(id);
    const { rows } = await pool.query(`UPDATE site_notices SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    return toPublicNotice(rows[0]);
}

async function deleteNotice(id) {
    const { rowCount } = await pool.query('DELETE FROM site_notices WHERE id = $1', [id]);
    return rowCount > 0;
}

module.exports = {
    VALID_SEVERITIES,
    VALID_AUDIENCES,
    toPublicNotice,
    listNotices,
    findNoticeById,
    createNotice,
    updateNotice,
    deleteNotice,
};
