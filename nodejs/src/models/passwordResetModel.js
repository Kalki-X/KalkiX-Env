const { pool } = require('../db/pool');

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

async function createResetToken(userId, tokenHash) {
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [userId, tokenHash, expiresAt]
    );
    return expiresAt;
}

// Returns the token row only if it exists, hasn't been used, and hasn't expired.
async function findValidToken(tokenHash) {
    const { rows } = await pool.query(
        `SELECT * FROM password_reset_tokens
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
        [tokenHash]
    );
    return rows[0] || null;
}

async function markTokenUsed(id) {
    await pool.query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [id]);
}

module.exports = { createResetToken, findValidToken, markTokenUsed };
