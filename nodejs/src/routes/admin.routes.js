const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');
const {
    findByEmail,
    findById,
    createUser,
    toPublicUser,
    listUsers,
    updateUserAdmin,
    countActiveSuperAdmins,
    VALID_ROLES,
    VALID_STATUSES,
} = require('../models/userModel');
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

// ---------- Role management ----------

router.get('/users', async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));

    const result = await listUsers({
        search: req.query.search,
        role: req.query.role,
        status: req.query.status,
        page,
        pageSize,
    });

    res.json({ ok: true, ...result });
});

router.patch('/users/:id', async (req, res) => {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId)) {
        return res.status(400).json({ ok: false, error: 'Invalid user id' });
    }

    const { role, isRenter, isLender, status } = req.body || {};
    if (role !== undefined && !VALID_ROLES.includes(role)) {
        return res.status(400).json({ ok: false, error: `role must be one of: ${VALID_ROLES.join(', ')}` });
    }
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ ok: false, error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const target = await findById(targetId);
    if (!target) return res.status(404).json({ ok: false, error: 'User not found' });

    // Guard against locking the platform out of Super Admin entirely: block demoting
    // or suspending/deactivating the *last* active super_admin (yourself included).
    const demotingRole = role !== undefined && role !== 'super_admin';
    const deactivating = status !== undefined && status !== 'active';
    if (target.role === 'super_admin' && (demotingRole || deactivating)) {
        const remaining = await countActiveSuperAdmins(target.id);
        if (remaining === 0) {
            return res.status(409).json({
                ok: false,
                error: 'Cannot remove the last active Super Admin. Promote another account first.',
            });
        }
    }

    const updated = await updateUserAdmin(targetId, { role, isRenter, isLender, status });

    await logAudit({
        userId: req.user.id,
        action: 'admin.user_updated',
        entityType: 'user',
        entityId: targetId,
        metadata: { changes: { role, isRenter, isLender, status }, targetEmail: target.email },
        ip: clientIp(req),
    });

    res.json({ ok: true, user: updated });
});

module.exports = router;
