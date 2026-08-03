const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
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
const { createResetToken } = require('../models/passwordResetModel');
const { renderTemplate } = require('../models/emailTemplateModel');
const { attachUser, requireAuth, requireRole } = require('../middleware/auth');
const { logAudit, clientIp } = require('../utils/audit');
const { sendMail } = require('../utils/mailer');
const { isValidEmail, isValidPassword, MIN_PASSWORD_LENGTH } = require('../utils/validators');
const { generateOneTimeToken } = require('../utils/tokens');

const REACT_URL = process.env.REACT_URL || 'http://localhost:5173';

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
//
// `password` is now optional. Leaving it blank is the recommended path: the account
// gets an unusable random hash (same trick used for Google-created accounts in
// userModel.js) and the new staff member is emailed a secure one-time link — the exact
// same mechanism as "forgot password" — to set their own password. Nothing sensitive
// ever travels by email that way. If a Super Admin still wants to hand a password to
// someone directly (in person, over a call, etc.), they can type one here instead and
// no email is sent — that hand-off happens outside the system entirely.
router.post('/users', async (req, res) => {
    const { firstName, lastName, email, phone, password, role, isRenter, isLender } = req.body || {};

    if (!firstName || !lastName || !email || !role) {
        return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ ok: false, error: 'Invalid email address' });
    }
    if (password && !isValidPassword(password)) {
        return res.status(400).json({ ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }
    if (!PROVISIONABLE_ROLES.includes(role)) {
        return res.status(400).json({ ok: false, error: `role must be one of: ${PROVISIONABLE_ROLES.join(', ')}` });
    }

    const existing = await findByEmail(email);
    if (existing) {
        return res.status(409).json({ ok: false, error: 'An account with this email already exists' });
    }

    const sendCredentialsEmail = !password;
    const passwordHash = password
        ? await bcrypt.hash(password, 12)
        : await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12); // unusable until they set a real one

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
        metadata: { email: publicUser.email, role, credentialsEmailSent: sendCredentialsEmail },
        ip: clientIp(req),
    });

    if (sendCredentialsEmail) {
        try {
            const { token, tokenHash } = generateOneTimeToken();
            await createResetToken(publicUser.id, tokenHash);
            const setPasswordLink = `${REACT_URL}/reset-password?token=${token}`;

            const { subject, text, html } = await renderTemplate(
                'staff_credentials',
                { firstName: publicUser.firstName, email: publicUser.email, role: publicUser.role },
                { actionUrl: setPasswordLink }
            );
            await sendMail({
                to: publicUser.email,
                subject,
                text,
                html,
                auditContext: { userId: req.user.id, entityType: 'user', entityId: publicUser.id, ip: clientIp(req) },
            });
        } catch (err) {
            console.error('⚠️  Failed to send staff credentials email:', err.message, { userId: publicUser.id });
        }
    }

    res.status(201).json({ ok: true, user: publicUser, credentialsEmailSent: sendCredentialsEmail });
});

// ---------- Role management ----------

router.get('/users', async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    // Normal pagination caps at 100/page; the "export" flag (set by the frontend's
    // export-to-CSV/Excel/PDF buttons) needs the full filtered result set in one
    // shot, so it gets a much higher cap instead of a separate endpoint.
    const isExport = req.query.export === '1' || req.query.export === 'true';
    const maxPageSize = isExport ? 5000 : 100;
    const pageSize = Math.min(maxPageSize, Math.max(1, parseInt(req.query.pageSize, 10) || 20));

    const result = await listUsers({
        search: req.query.search,
        role: req.query.role,
        status: req.query.status,
        page,
        pageSize,
    });

    if (isExport) {
        await logAudit({
            userId: req.user.id,
            action: 'admin.users_exported',
            entityType: 'user',
            entityId: null,
            metadata: { search: req.query.search || null, role: req.query.role || null, status: req.query.status || null, count: result.users.length },
            ip: clientIp(req),
        });
    }

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
    const ip = clientIp(req);

    // One specific, filterable entry per thing that actually changed (compared against
    // `target`, the pre-update row) rather than a single generic "updated" blob — the
    // Audit Trail's action filter and downstream reporting both key off these names, so
    // "suspend a user" needs to show up as exactly that, not buried in a diff object.
    const STATUS_ACTION = {
        suspended: 'admin.user_suspended',
        deactivated: 'admin.user_deactivated',
        active: 'admin.user_reactivated',
    };
    if (status !== undefined && status !== target.status) {
        await logAudit({
            userId: req.user.id,
            action: STATUS_ACTION[status],
            entityType: 'user',
            entityId: targetId,
            metadata: { targetEmail: target.email, from: target.status, to: status },
            ip,
        });
    }
    if (role !== undefined && role !== target.role) {
        await logAudit({
            userId: req.user.id,
            action: 'admin.user_role_changed',
            entityType: 'user',
            entityId: targetId,
            metadata: { targetEmail: target.email, from: target.role, to: role },
            ip,
        });
    }
    const isRenterChanged = isRenter !== undefined && isRenter !== target.isRenter;
    const isLenderChanged = isLender !== undefined && isLender !== target.isLender;
    if (isRenterChanged || isLenderChanged) {
        await logAudit({
            userId: req.user.id,
            action: 'admin.user_capabilities_changed',
            entityType: 'user',
            entityId: targetId,
            metadata: {
                targetEmail: target.email,
                isRenter: isRenter ?? target.isRenter,
                isLender: isLender ?? target.isLender,
            },
            ip,
        });
    }

    res.json({ ok: true, user: updated });
});

module.exports = router;
