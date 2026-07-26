const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');
const { findByEmail, createUser, toPublicUser } = require('../models/userModel');
const { attachUser, requireAuth, requireRole } = require('../middleware/auth');
const { logAudit, clientIp } = require('../utils/audit');
const { isValidEmail, isValidPassword, MIN_PASSWORD_LENGTH } = require('../utils/validators');

const router = express.Router();

// Every route below is Super Admin only. There is no self-registration path for
// admin/support/finance — Super Admin is the only account type that can create them.
router.use(attachUser, requireAuth, requireRole('super_admin'));

// Platform-wide counts for the Super Admin dashboard's overview tiles.
router.get('/stats', async (_req, res) => {
    const { rows } = await pool.query(`
        SELECT
            count(*) FILTER (WHERE true)                AS total_users,
            count(*) FILTER (WHERE role = 'super_admin') AS super_admins,
            count(*) FILTER (WHERE role = 'admin')       AS admins,
            count(*) FILTER (WHERE role = 'support')     AS support,
            count(*) FILTER (WHERE role = 'finance')     AS finance,
            count(*) FILTER (WHERE role = 'platform_user') AS platform_users,
            count(*) FILTER (WHERE is_renter)            AS renters,
            count(*) FILTER (WHERE is_lender)            AS lenders,
            count(*) FILTER (WHERE status = 'suspended') AS suspended
        FROM users
    `);
    const r = rows[0];
    const asInt = (v) => Number(v);

    res.json({
        ok: true,
        stats: {
            totalUsers: asInt(r.total_users),
            byRole: {
                superAdmins: asInt(r.super_admins),
                admins: asInt(r.admins),
                support: asInt(r.support),
                finance: asInt(r.finance),
                platformUsers: asInt(r.platform_users),
            },
            renters: asInt(r.renters),
            lenders: asInt(r.lenders),
            suspended: asInt(r.suspended),
        },
    });
});

const PROVISIONABLE_ROLES = ['admin', 'support', 'finance'];

// Super Admin provisions staff accounts here. Per spec, Admin & Support can also act
// as a renter and/or lender on the platform, so isRenter/isLender are accepted (and
// default to false) rather than forced either way.
router.post('/users', async (req, res) => {
    const { firstName, lastName, email, phone, password, role, isRenter, isLender } = req.body || {};

    if (!firstName || !lastName || !email || !password || !role) {
        return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ ok: false, error: 'Invalid email address' });
    }
    if (!isValidPassword(password)) {
        return res.status(400).json({ ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }
    if (!PROVISIONABLE_ROLES.includes(role)) {
        return res.status(400).json({ ok: false, error: `role must be one of: ${PROVISIONABLE_ROLES.join(', ')}` });
    }

    const existing = await findByEmail(email);
    if (existing) {
        return res.status(409).json({ ok: false, error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser({
        firstName,
        lastName,
        email,
        phone,
        passwordHash,
        role,
        isRenter: !!isRenter,
        isLender: !!isLender,
    });
    const publicUser = toPublicUser(user);

    await logAudit({
        userId: req.user.id,
        action: 'admin.staff_account_created',
        entityType: 'user',
        entityId: publicUser.id,
        metadata: { email: publicUser.email, role },
        ip: clientIp(req),
    });

    res.status(201).json({ ok: true, user: publicUser });
});

module.exports = router;
