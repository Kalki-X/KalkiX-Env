const express = require('express');
const { attachUser, requireAuth, requireRole } = require('../middleware/auth');
const { listSystemErrors } = require('../utils/errorLog');

const router = express.Router();

// System error reports are spec'd for Super Admin and Admin & Support.
router.use(attachUser, requireAuth, requireRole('super_admin', 'admin', 'support'));

router.get('/', async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize, 10) || 50));

    const result = await listSystemErrors({ page, pageSize });
    res.json({ ok: true, ...result });
});

module.exports = router;
