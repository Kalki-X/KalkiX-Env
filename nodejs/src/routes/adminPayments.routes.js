const express = require('express');
const { attachUser, requireAuth, requireRole } = require('../middleware/auth');
const { logAudit, clientIp } = require('../utils/audit');
const { listPayments, findPaymentById, markPaymentRefunded } = require('../models/paymentModel');

const router = express.Router();

// Payment management is spec'd for Super Admin and Finance.
router.use(attachUser, requireAuth, requireRole('super_admin', 'finance'));

router.get('/', async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));

    const result = await listPayments({
        status: req.query.status,
        from: req.query.from,
        to: req.query.to,
        page,
        pageSize,
    });

    res.json({ ok: true, ...result });
});

// Manual override for handling a dispute/chargeback outside the normal booking-cancel
// flow. This only flips the payment record — it does not touch the booking's status
// or generate a credit note; use booking cancellation for the normal refund path.
router.patch('/:id/refund', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: 'Invalid payment id' });

    const payment = await findPaymentById(id);
    if (!payment) return res.status(404).json({ ok: false, error: 'Payment not found' });
    if (payment.status !== 'succeeded') {
        return res.status(409).json({ ok: false, error: `Only succeeded payments can be refunded (this one is ${payment.status})` });
    }

    const updated = await markPaymentRefunded(id);

    await logAudit({
        userId: req.user.id,
        action: 'payment.refunded',
        entityType: 'payment',
        entityId: id,
        metadata: { amount: updated.amount, bookingId: updated.bookingId },
        ip: clientIp(req),
    });

    res.json({ ok: true, payment: updated });
});

module.exports = router;
