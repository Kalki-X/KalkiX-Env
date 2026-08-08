const express = require('express');
const { attachUser, requireAuth, requireRole } = require('../middleware/auth');
const { logAudit, clientIp } = require('../utils/audit');
const { findByDocumentNumberWithContext } = require('../models/documentModel');
const { findById: findUserById } = require('../models/userModel');
const { getSettings, getLogoWithData } = require('../models/siteSettingsModel');
const { buildDocumentPdf } = require('../utils/pdf/documentPdf');

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

// Same lookup, rendered as a PDF — this is what the "Download PDF" button on the
// Document Lookup screen hits. Staff can pull this for a voided document too (the
// context query includes it), unlike the renter/lender-facing route in
// bookings.routes.js, which 404s a voided one for anyone who isn't staff.
router.get('/:documentNumber/pdf', async (req, res) => {
    const doc = await findByDocumentNumberWithContext(req.params.documentNumber);
    if (!doc) {
        return res.status(404).json({ ok: false, error: 'No document found with that reference number' });
    }

    const [lender, renter, company, logo] = await Promise.all([
        findUserById(doc.owner.id),
        findUserById(doc.renter.id),
        getSettings(),
        getLogoWithData(),
    ]);

    const pdfBuffer = await buildDocumentPdf({
        document: doc,
        booking: { id: doc.booking.id, startDate: doc.booking.startDate, endDate: doc.booking.endDate },
        item: { title: doc.item.title },
        lender,
        renter,
        company,
        logo,
    });

    await logAudit({
        userId: req.user.id,
        action: 'admin.document_pdf_downloaded',
        entityType: 'document',
        entityId: doc.id,
        metadata: { documentNumber: doc.documentNumber },
        ip: clientIp(req),
    });

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${doc.documentNumber}.pdf"`);
    res.send(pdfBuffer);
});

module.exports = router;
