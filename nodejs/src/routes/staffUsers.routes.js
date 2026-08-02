const express = require('express');
const { attachUser, requireAuth, requireRole } = require('../middleware/auth');
const { findById, listUsers, updateUserAdmin, VALID_STATUSES } = require('../models/userModel');
const { logAudit, clientIp } = require('../utils/audit');

const router = express.Router();

// Admin & Support's "User management" capability, per spec: they can look up,
// suspend/reactivate, and toggle renter/lender capabilities for *platform users*
// only — they cannot touch other staff accounts (admin/support/finance/super_admin)
// or change anyone's role. That's Super Admin-only (see admin.routes.js). Mounted at
// its own /api/staff prefix so it never collides with admin.routes.js's blanket
// requireRole('super_admin') on /api/admin/*.
router.use(attachUser, requireAuth, requireRole('super_admin', 'admin', 'support'));

router.get('/', async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const isExport = req.query.export === '1' || req.query.export === 'true';
    const pageSize = Math.min(isExport ? 5000 : 100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));

    const result = await listUsers({
        search: req.query.search,
        // Deliberately ignore any role query param — this endpoint only ever
        // surfaces platform users, regardless of what the caller asks for.
        role: 'platform_user',
        status: req.query.status,
        page,
        pageSize,
    });

    if (isExport) {
        await logAudit({
            userId: req.user.id,
            action: 'staff.users_exported',
            metadata: { search: req.query.search || null, status: req.query.status || null, count: result.users.length },
            ip: clientIp(req),
        });
    }

    res.json({ ok: true, ...result });
});

router.patch('/:id', async (req, res) => {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId)) {
        return res.status(400).json({ ok: false, error: 'Invalid user id' });
    }

    // Role changes are Super Admin-only — reject outright rather than silently
    // ignoring the field, so staff tooling can't accidentally rely on it.
    if (req.body && req.body.role !== undefined) {
        return res.status(403).json({ ok: false, error: 'Admin & Support cannot change user roles' });
    }

    const { isRenter, isLender, status } = req.body || {};
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ ok: false, error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const target = await findById(targetId);
    if (!target) return res.status(404).json({ ok: false, error: 'User not found' });
    if (target.role !== 'platform_user') {
        return res.status(403).json({ ok: false, error: 'Admin & Support can only manage platform users' });
    }

    const updated = await updateUserAdmin(targetId, { isRenter, isLender, status });
    const ip = clientIp(req);

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
