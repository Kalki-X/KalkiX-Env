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

module.exports = { findByEmail, findById, createUser, toPublicUser };
