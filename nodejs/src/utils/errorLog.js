const { pool } = require('../db/pool');

/**
 * Persists a system error so it shows up in the Super Admin "System error reports"
 * page instead of only living in container logs. Best-effort and never throws —
 * a broken error-logging write must not mask (or replace) the original error.
 */
async function logSystemError({ message, stack, method, route, statusCode, userId = null, metadata = {} }) {
    try {
        await pool.query(
            `INSERT INTO error_log (message, stack, method, route, status_code, user_id, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [message, stack || null, method || null, route || null, statusCode || null, userId, metadata]
        );
    } catch (err) {
        console.error('⚠️  Failed to write error_log:', err.message);
    }
}

function toPublicError(row) {
    return {
        id: row.id,
        message: row.message,
        stack: row.stack,
        method: row.method,
        route: row.route,
        statusCode: row.status_code,
        userId: row.user_id,
        metadata: row.metadata,
        createdAt: row.created_at,
    };
}

async function listSystemErrors({ page = 1, pageSize = 50 } = {}) {
    const offset = (Math.max(1, page) - 1) * pageSize;
    const { rows: countRows } = await pool.query('SELECT count(*) AS total FROM error_log');
    const total = Number(countRows[0].total);

    const { rows } = await pool.query(
        'SELECT * FROM error_log ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [pageSize, offset]
    );

    return { errors: rows.map(toPublicError), total, page: Math.max(1, page), pageSize };
}

module.exports = { logSystemError, listSystemErrors };
