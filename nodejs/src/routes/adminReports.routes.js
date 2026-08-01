const express = require('express');
const { attachUser, requireAuth, requireRole } = require('../middleware/auth');
const { getSalesReport } = require('../models/reportsModel');

const router = express.Router();

// Super Admin only, per spec.
router.use(attachUser, requireAuth, requireRole('super_admin'));

router.get('/sales', async (req, res) => {
    const report = await getSalesReport({
        from: req.query.from,
        to: req.query.to,
        groupBy: req.query.groupBy,
    });
    res.json({ ok: true, report });
});

module.exports = router;
