const express = require('express');
const { attachUser, requireAuth, requireRole } = require('../middleware/auth');
const { getSalesReport } = require('../models/reportsModel');
const { logAudit, clientIp } = require('../utils/audit');

const router = express.Router();

// Super Admin only, per spec.
router.use(attachUser, requireAuth, requireRole('super_admin'));

router.get('/sales', async (req, res) => {
    const report = await getSalesReport({
        from: req.query.from,
        to: req.query.to,
        groupBy: req.query.groupBy,
    });

    const isExport = req.query.export === '1' || req.query.export === 'true';
    if (isExport) {
        await logAudit({
            userId: req.user.id,
            action: 'admin.sales_report_exported',
            metadata: { from: req.query.from || null, to: req.query.to || null, groupBy: req.query.groupBy || null },
            ip: clientIp(req),
        });
    }

    res.json({ ok: true, report });
});

module.exports = router;
