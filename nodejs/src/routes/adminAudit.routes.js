const express = require('express');
const { attachUser, requireAuth, requireRole } = require('../middleware/auth');
const { listAuditLog } = require('../models/auditModel');

const router = express.Router();

// Super Admin only — audit trail access isn't part of Admin & Support's or
// Finance's spec'd capabilities.
router.use(attachUser, requireAuth, requireRole('super_admin'));

router.get('/', async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize, 10) || 50));

    const result = await listAuditLog({
        userId: req.query.userId ? Number(req.query.userId) : undefined,
        action: req.query.action,
        entityType: req.query.entityType,
        from: req.query.from,
        to: req.query.to,
        page,
        pageSize,
    });

    res.json({ ok: true, ...result });
});

module.exports = router;
