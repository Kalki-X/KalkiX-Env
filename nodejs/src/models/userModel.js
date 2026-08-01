const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../db/pool');

const PUBLIC_COLUMNS = `
    id, first_name, last_name, email, phone, role, is_renter, is_lender, status, created_at
`;

function toPublicUser(row) {
    if (!row) return null;
    return {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        role: row.role,
        isRenter: row.is_renter,
        isLender: row.is_lender,
        status: row.status,
        createdAt: row.created_at,
    };
}

async function findByEmail(email) {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    return rows[0] || null;
}

async function findById(id) {
    const { rows } = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
    return rows[0] || null;
}

async function createUser({ firstName, lastName, email, phone, passwordHash, isRenter, isLender, role = 'platform_user' }) {
    const { rows } = await pool.query(
        `INSERT INTO users (first_name, last_name, email, phone, password_hash, role, is_renter, is_lender)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${PUBLIC_COLUMNS}`,
        [firstName, lastName, email.toLowerCase(), phone || null, passwordHash, role, !!isRenter, !!isLender]
    );
    return rows[0];
}

async function updatePasswordHash(userId, passwordHash) {
    await pool.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [passwordHash, userId]);
}

async function findByGoogleId(googleId) {
    const { rows } = await pool.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
    return rows[0] || null;
}

// Links a Google account to an existing (password-created) user with a matching email,
// so "Continue with Google" also works for people who registered the normal way first.
async function linkGoogleAccount(userId, googleId) {
    const { rows } = await pool.query(
        `UPDATE users SET google_id = $1, updated_at = now() WHERE id = $2 RETURNING *`,
        [googleId, userId]
    );
    return rows[0];
}

async function createUserFromGoogle({ firstName, lastName, email, googleId, isRenter, isLender }) {
    // No usable password: a random bcrypt hash satisfies the NOT NULL column without
    // creating a guessable credential. This account can only sign in via Google unless
    // the owner later uses "Forgot password" to set a real one.
    const unusablePasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);

    const { rows } = await pool.query(
        `INSERT INTO users (first_name, last_name, email, password_hash, role, is_renter, is_lender, auth_provider, google_id)
         VALUES ($1, $2, $3, $4, 'platform_user', $5, $6, 'google', $7)
         RETURNING *`,
        [firstName, lastName, email.toLowerCase(), unusablePasswordHash, !!isRenter, !!isLender, googleId]
    );
    return rows[0];
}

module.exports = {
    findByEmail,
    findById,
    findByGoogleId,
    createUser,
    createUserFromGoogle,
    linkGoogleAccount,
    updatePasswordHash,
    toPublicUser,
};
