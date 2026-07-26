const { pool } = require('../db/pool');

/**
 * Append-only audit trail. Every sensitive action (login, login failure, payment,
 * document generation, booking state change, etc.) should call this.
 * Never throws — a broken audit write must not break the request it's logging.
 */
async function logAudit({ userId = null, action, entityType = null, entityId = null, metadata = {}, ip = null }) {
    try {
        await pool.query(
            `INSERT INTO audit_log (user_id, action, entity_type, entity_id, metadata, ip_address)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, action, entityType, entityId ? String(entityId) : null, metadata, ip]
        );
    } catch (err) {
        console.error('⚠️  Failed to write audit log:', err.message, { action, entityType, entityId });
    }
}

function clientIp(req) {
    return (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim();
}

module.exports = { logAudit, clientIp };
