const express = require('express');
const { attachUser, requireAuth, requireRole } = require('../middleware/auth');
const { logAudit, clientIp } = require('../utils/audit');
const { findByDocumentNumberWithContext } = require('../models/documentModel');

const router = express.Router();

router.use(attachUser, requireAuth, requireRole('super_admin', 'admin', 'support', 'finance'));

// "View or download any document on the platform by just typing the ref no." — exact
// document number lookup (PI-000001 / INV-000001 / CN-000001), case-insensitive.
router.get('/:documentNumber', async (req, res) => {
    const doc = await findByDocumentNumberWithContext(req.params.documentNumber);
    if (!doc) {
        return res.status(404).json({ ok: false, error: 'No document found with that reference number' });
    }

    await logAudit({
        userId: req.user.id,
        action: 'admin.document_viewed',
        entityType: 'document',
        entityId: doc.id,
        metadata: { documentNumber: doc.documentNumber },
        ip: clientIp(req),
    });

    res.json({ ok: true, document: doc });
});

module.exports = router;
