const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../db/pool');

const PUBLIC_COLUMNS = `
    id, first_name, last_name, email, phone, role, is_renter, is_lender, status, created_at,
    (avatar_data IS NOT NULL) AS has_avatar
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
        hasAvatar: !!row.has_avatar,
    };
}

async function findByEmail(email) {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    return rows[0] || null;
}

// Returns the same camelCase shape as toPublicUser (this backs req.user everywhere
// downstream — requireCapability('isRenter'/'isLender') and resolveHomeRoute on the
// frontend both key off isRenter/isLender, so this must never return raw snake_case).
async function findById(id) {
    const { rows } = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
    return toPublicUser(rows[0]);
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

const VALID_ROLES = ['super_admin', 'admin', 'support', 'finance', 'platform_user'];
const VALID_STATUSES = ['active', 'suspended', 'deactivated'];

// Paginated, searchable list for the Super Admin "Role management" screen.
async function listUsers({ search, role, status, page = 1, pageSize = 20 }) {
    const conditions = [];
    const params = [];

    if (search) {
        params.push(`%${search.toLowerCase()}%`);
        conditions.push(`(lower(email) LIKE $${params.length} OR lower(first_name || ' ' || last_name) LIKE $${params.length})`);
    }
    if (role && VALID_ROLES.includes(role)) {
        params.push(role);
        conditions.push(`role = $${params.length}`);
    }
    if (status && VALID_STATUSES.includes(status)) {
        params.push(status);
        conditions.push(`status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Math.max(1, page) - 1) * pageSize;

    const { rows: countRows } = await pool.query(`SELECT count(*) AS total FROM users ${where}`, params);
    const total = Number(countRows[0].total);

    params.push(pageSize, offset);
    const { rows } = await pool.query(
        `SELECT ${PUBLIC_COLUMNS} FROM users ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
    );

    return { users: rows.map(toPublicUser), total, page: Math.max(1, page), pageSize };
}

async function countActiveSuperAdmins(excludingUserId = null) {
    const { rows } = await pool.query(
        `SELECT count(*) AS n FROM users WHERE role = 'super_admin' AND status = 'active' AND id != $1`,
        [excludingUserId || 0]
    );
    return Number(rows[0].n);
}

async function updateUserAdmin(id, { role, isRenter, isLender, status }) {
    const sets = [];
    const params = [];

    if (role !== undefined) {
        params.push(role);
        sets.push(`role = $${params.length}`);
    }
    if (isRenter !== undefined) {
        params.push(!!isRenter);
        sets.push(`is_renter = $${params.length}`);
    }
    if (isLender !== undefined) {
        params.push(!!isLender);
        sets.push(`is_lender = $${params.length}`);
    }
    if (status !== undefined) {
        params.push(status);
        sets.push(`status = $${params.length}`);
    }
    if (sets.length === 0) return findById(id);

    sets.push('updated_at = now()');
    params.push(id);

    const { rows } = await pool.query(
        `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${PUBLIC_COLUMNS}`,
        params
    );
    return toPublicUser(rows[0]);
}

// Self-service profile edit — deliberately its own function (not a generic "update
// user" call) that only ever touches phone. Email is the account's login identity and
// isn't editable here at all; role/status/capabilities are Super Admin/staff-only
// (see updateUserAdmin above) and this function has no way to touch them even if a
// caller tried to pass extra fields through, by construction.
async function updateOwnProfile(id, { phone }) {
    const { rows } = await pool.query(
        `UPDATE users SET phone = $1, updated_at = now() WHERE id = $2 RETURNING ${PUBLIC_COLUMNS}`,
        [phone ?? null, id]
    );
    return toPublicUser(rows[0]);
}

async function setAvatar(id, { mimeType, data }) {
    const { rows } = await pool.query(
        `UPDATE users SET avatar_mime_type = $1, avatar_data = $2, updated_at = now() WHERE id = $3 RETURNING ${PUBLIC_COLUMNS}`,
        [mimeType, data, id]
    );
    return toPublicUser(rows[0]);
}

// Raw bytes + mime type for the avatar-serving route — never exposed via toPublicUser.
async function findAvatar(id) {
    const { rows } = await pool.query('SELECT avatar_mime_type, avatar_data FROM users WHERE id = $1', [id]);
    return rows[0] || null;
}

module.exports = {
    findByEmail,
    findById,
    findByGoogleId,
    createUser,
    createUserFromGoogle,
    linkGoogleAccount,
    updatePasswordHash,
    listUsers,
    countActiveSuperAdmins,
    updateUserAdmin,
    updateOwnProfile,
    setAvatar,
    findAvatar,
    toPublicUser,
    VALID_ROLES,
    VALID_STATUSES,
};
