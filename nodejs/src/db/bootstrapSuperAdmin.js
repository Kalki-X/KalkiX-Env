const bcrypt = require('bcryptjs');
const { pool } = require('./pool');

/**
 * There is no UI path to create the very first Super Admin (by design — only a Super
 * Admin can provision other staff accounts). So on startup, if no super_admin exists
 * yet and SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD are set in the environment, create one.
 * Safe to run on every startup: it's a no-op once a super_admin already exists.
 */
async function bootstrapSuperAdmin() {
    const { rows } = await pool.query("SELECT 1 FROM users WHERE role = 'super_admin' LIMIT 1");
    if (rows.length > 0) return; // already bootstrapped

    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;

    if (!email || !password) {
        console.warn(
            '⚠️  No super_admin account exists yet, and SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD ' +
            'are not set — set them in .env and restart to create the first Super Admin.'
        );
        return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query(
        `INSERT INTO users (first_name, last_name, email, password_hash, role, is_renter, is_lender, status)
         VALUES ('Super', 'Admin', $1, $2, 'super_admin', false, false, 'active')`,
        [email.toLowerCase(), passwordHash]
    );
    console.log(`✅ Created initial super_admin account for ${email}`);
}

module.exports = { bootstrapSuperAdmin };
