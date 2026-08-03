const express = require('express');
const { pool } = require('../db/pool');
const { attachUser, requireAuth, requireCapability } = require('../middleware/auth');
const { logAudit, clientIp } = require('../utils/audit');
const { sendMail } = require('../utils/mailer');
const { findItemById } = require('../models/itemModel');
const { findById: findUserById } = require('../models/userModel');
const {
    hasOverlap,
    createBooking,
    findBookingById,
    setBookingStatus,
    approveBooking,
    rejectBooking,
    computeRefund,
    listBookingsForRenter,
    listBookingsForOwner,
} = require('../models/bookingModel');
const { createDocument, listDocumentsForBooking, voidDocumentsForBooking } = require('../models/documentModel');
const { hasAvailabilityBlockOverlap } = require('../models/itemAvailabilityModel');

const router = express.Router();

// Staff can see every document ever issued (including voided ones) via Document Lookup —
// this is the same allowlist used elsewhere for "can act on behalf of the platform".
const STAFF_ROLES = ['admin', 'super_admin', 'finance'];

function daysBetween(startDate, endDate) {
    const ms = new Date(endDate) - new Date(startDate);
    return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1); // inclusive of both dates
}

// Best-effort notification — a failed/misconfigured email must never fail the request
// that triggered it (sendMail already falls back to console logging when SMTP isn't
// configured, but this guards against any other unexpected failure too).
async function notify(args) {
    try {
        await sendMail(args);
    } catch (err) {
        console.error('⚠️  Failed to send notification email:', err.message, { to: args.to, subject: args.subject });
    }
}

router.get('/mine', attachUser, requireAuth, async (req, res) => {
    const bookings = await listBookingsForRenter(req.user.id);
    res.json({ ok: true, bookings });
});

router.get('/owner', attachUser, requireAuth, requireCapability('isLender'), async (req, res) => {
    const bookings = await listBookingsForOwner(req.user.id);
    res.json({ ok: true, bookings });
});

router.get('/:id/documents', attachUser, requireAuth, async (req, res) => {
    const booking = await findBookingById(req.params.id);
    if (!booking) return res.status(404).json({ ok: false, error: 'Booking not found' });

    const isStaff = STAFF_ROLES.includes(req.user.role);
    const item = await findItemById(booking.item_id);
    const isOwner = item && item.owner_id === req.user.id;
    if (booking.renter_id !== req.user.id && !isOwner && !isStaff) {
        return res.status(403).json({ ok: false, error: 'Not your booking' });
    }

    // Only staff ever see voided documents (a proforma/invoice superseded by a credit
    // note when a paid booking was cancelled) — the renter/lender's own view of history
    // is just: request -> (proforma) -> (invoice) -> (credit note if it was cancelled
    // after payment).
    const documents = await listDocumentsForBooking(booking.id, { includeVoided: isStaff });
    res.json({ ok: true, documents });
});

// Step 1: renter requests a booking. Availability is checked and a 'pending_approval'
// booking is created — no document is issued yet (that only happens once the lender
// approves; see Phase 6 notes below). The item's current cancellation policy (if any)
// is snapshotted onto the booking so later edits to it don't retroactively change these
// terms. The lender is emailed so they know a decision is waiting on them.
router.post('/', attachUser, requireAuth, requireCapability('isRenter'), async (req, res) => {
    const { itemId, startDate, endDate, note } = req.body || {};
    if (!itemId || !startDate || !endDate) {
        return res.status(400).json({ ok: false, error: 'itemId, startDate and endDate are required' });
    }
    if (new Date(endDate) < new Date(startDate)) {
        return res.status(400).json({ ok: false, error: 'endDate must be on/after startDate' });
    }

    const item = await findItemById(itemId);
    if (!item || item.status !== 'active') {
        return res.status(404).json({ ok: false, error: 'Item not available' });
    }
    if (item.owner_id === req.user.id) {
        return res.status(400).json({ ok: false, error: 'You cannot book your own item' });
    }

    const overlap = await hasOverlap(itemId, startDate, endDate);
    if (overlap) {
        return res.status(409).json({ ok: false, error: 'Item is not available for those dates' });
    }
    const blocked = await hasAvailabilityBlockOverlap(itemId, startDate, endDate);
    if (blocked) {
        return res.status(409).json({ ok: false, error: 'The lender has marked those dates as unavailable' });
    }

    const days = daysBetween(startDate, endDate);
    const totalAmount = Number(item.price_per_day) * days;

    const booking = await createBooking({
        itemId,
        renterId: req.user.id,
        startDate,
        endDate,
        totalAmount,
        currency: item.currency,
        renterNote: note,
        cancellationFreeDays: item.cancellation_free_days,
        cancellationFeePercent: item.cancellation_fee_percent,
    });

    await logAudit({
        userId: req.user.id,
        action: 'booking.requested',
        entityType: 'booking',
        entityId: booking.id,
        metadata: { itemId, totalAmount, hasNote: !!note },
        ip: clientIp(req),
    });

    const owner = await findUserById(item.owner_id);
    if (owner) {
        await notify({
            to: owner.email,
            subject: `New booking request for "${item.title}"`,
            text: `${req.user.firstName} ${req.user.lastName} requested to rent "${item.title}" from ${startDate} to ${endDate} (${item.currency} ${totalAmount.toFixed(2)}).${
                note ? `\n\nTheir note: ${note}` : ''
            }\n\nApprove or reject this request from your GearShare dashboard.`,
        });
    }

    res.status(201).json({ ok: true, booking });
});

// Step 2a: the lender approves a pending request. This is the point a proforma invoice
// is issued (per Phase 6 — it no longer appears at request time) and the renter becomes
// able to pay.
router.post('/:id/approve', attachUser, requireAuth, requireCapability('isLender'), async (req, res) => {
    const booking = await findBookingById(req.params.id);
    if (!booking) return res.status(404).json({ ok: false, error: 'Booking not found' });

    const item = await findItemById(booking.item_id);
    if (!item || (item.owner_id !== req.user.id && !['admin', 'super_admin'].includes(req.user.role))) {
        return res.status(403).json({ ok: false, error: 'Not your listing' });
    }
    if (booking.status !== 'pending_approval') {
        return res.status(409).json({ ok: false, error: `This request is already ${booking.status.replace('_', ' ')}` });
    }

    const updated = await approveBooking(booking.id, req.user.id);
    if (!updated) {
        return res.status(409).json({ ok: false, error: 'This request was already decided' });
    }

    const days = daysBetween(booking.start_date, booking.end_date);
    const proforma = await createDocument({
        bookingId: booking.id,
        type: 'proforma_invoice',
        amount: Number(booking.total_amount),
        currency: booking.currency,
        payload: {
            item: { id: item.id, title: item.title, pricePerDay: Number(item.price_per_day) },
            days,
            startDate: booking.start_date,
            endDate: booking.end_date,
        },
    });

    const ip = clientIp(req);
    await logAudit({ userId: req.user.id, action: 'booking.approved', entityType: 'booking', entityId: booking.id, ip });
    await logAudit({
        userId: req.user.id,
        action: 'document.generated',
        entityType: 'document',
        entityId: proforma.id,
        metadata: { type: proforma.type, documentNumber: proforma.documentNumber, bookingId: booking.id },
        ip,
    });

    const renter = await findUserById(booking.renter_id);
    if (renter) {
        await notify({
            to: renter.email,
            subject: `Your booking request for "${item.title}" was approved`,
            text: `Good news — the lender approved your request for "${item.title}" (${booking.start_date} to ${booking.end_date}).\n\nA proforma invoice (${proforma.documentNumber}) for ${booking.currency} ${Number(booking.total_amount).toFixed(2)} is ready. Head to My Bookings on GearShare to complete payment and confirm.`,
        });
    }

    res.json({ ok: true, booking: updated, document: proforma });
});

// Step 2b: the lender rejects a pending request. A reason is mandatory — it's shown to
// the renter and kept on the booking record for audit purposes. No documents are ever
// issued for a rejected request.
router.post('/:id/reject', attachUser, requireAuth, requireCapability('isLender'), async (req, res) => {
    const { reason } = req.body || {};
    if (!reason || !String(reason).trim()) {
        return res.status(400).json({ ok: false, error: 'A reason is required to reject a booking request' });
    }

    const booking = await findBookingById(req.params.id);
    if (!booking) return res.status(404).json({ ok: false, error: 'Booking not found' });

    const item = await findItemById(booking.item_id);
    if (!item || (item.owner_id !== req.user.id && !['admin', 'super_admin'].includes(req.user.role))) {
        return res.status(403).json({ ok: false, error: 'Not your listing' });
    }
    if (booking.status !== 'pending_approval') {
        return res.status(409).json({ ok: false, error: `This request is already ${booking.status.replace('_', ' ')}` });
    }

    const updated = await rejectBooking(booking.id, req.user.id, String(reason).trim());
    if (!updated) {
        return res.status(409).json({ ok: false, error: 'This request was already decided' });
    }

    const ip = clientIp(req);
    await logAudit({
        userId: req.user.id,
        action: 'booking.rejected',
        entityType: 'booking',
        entityId: booking.id,
        metadata: { reason: updated.rejectionReason },
        ip,
    });

    const renter = await findUserById(booking.renter_id);
    if (renter) {
        await notify({
            to: renter.email,
            subject: `Your booking request for "${item.title}" was declined`,
            text: `The lender declined your request for "${item.title}" (${booking.start_date} to ${booking.end_date}).\n\nReason: ${updated.rejectionReason}\n\nNo payment was taken and no documents were issued for this request.`,
        });
    }

    res.json({ ok: true, booking: updated });
});

// Step 3: payment confirmation -> booking confirmed + invoice issued. Only possible once
// the lender has approved (status 'awaiting_payment') — this simulates a successful
// payment; wiring a real payment provider is follow-up work.
router.post('/:id/confirm', attachUser, requireAuth, async (req, res) => {
    const booking = await findBookingById(req.params.id);
    if (!booking) return res.status(404).json({ ok: false, error: 'Booking not found' });
    if (booking.renter_id !== req.user.id) {
        return res.status(403).json({ ok: false, error: 'Not your booking' });
    }
    if (booking.status !== 'awaiting_payment') {
        const message =
            booking.status === 'pending_approval'
                ? 'Waiting on the lender to approve this request before it can be paid'
                : `Booking is already ${booking.status.replace('_', ' ')}`;
        return res.status(409).json({ ok: false, error: message });
    }

    const ip = clientIp(req);

    try {
        await pool.query('BEGIN');

        await pool.query(
            `INSERT INTO payments (booking_id, amount, currency, method, status, provider_ref)
             VALUES ($1, $2, $3, $4, 'succeeded', $5)`,
            [booking.id, booking.total_amount, booking.currency, req.body?.method || 'card', `sim_${Date.now()}`]
        );

        const updated = await setBookingStatus(booking.id, 'confirmed');

        const invoice = await createDocument({
            bookingId: booking.id,
            type: 'invoice',
            amount: booking.total_amount,
            currency: booking.currency,
            payload: { note: 'Generated on payment confirmation' },
        });

        await pool.query('COMMIT');

        await logAudit({ userId: req.user.id, action: 'payment.succeeded', entityType: 'booking', entityId: booking.id, metadata: { amount: booking.total_amount }, ip });
        await logAudit({ userId: req.user.id, action: 'booking.confirmed', entityType: 'booking', entityId: booking.id, ip });
        await logAudit({ userId: req.user.id, action: 'document.generated', entityType: 'document', entityId: invoice.id, metadata: { type: invoice.type, documentNumber: invoice.documentNumber }, ip });

        res.json({ ok: true, booking: updated, document: invoice });
    } catch (err) {
        await pool.query('ROLLBACK');
        await logAudit({ userId: req.user.id, action: 'payment.failed', entityType: 'booking', entityId: booking.id, metadata: { error: err.message }, ip });
        res.status(500).json({ ok: false, error: 'Payment processing failed' });
    }
});

// Step 4 (optional): cancellation. If the booking had already been paid (confirmed), a
// credit note is issued — its amount computed from the cancellation policy snapshotted
// onto the booking at request time (full refund if no policy was set, matching the
// pre-Phase-6 behavior). Either way, any proforma invoice/invoice already issued for this
// booking is voided: it's no longer a valid record for the renter/lender to act on, and
// only remains visible to staff (Admin/Super Admin/Finance) for audit purposes.
router.post('/:id/cancel', attachUser, requireAuth, async (req, res) => {
    const booking = await findBookingById(req.params.id);
    if (!booking) return res.status(404).json({ ok: false, error: 'Booking not found' });

    const item = await findItemById(booking.item_id);
    const isOwnerOfItem = item && item.owner_id === req.user.id;
    if (booking.renter_id !== req.user.id && !isOwnerOfItem) {
        return res.status(403).json({ ok: false, error: 'Not your booking' });
    }
    if (['cancelled', 'rejected', 'completed'].includes(booking.status)) {
        return res.status(409).json({ ok: false, error: `Booking is already ${booking.status}` });
    }

    const wasConfirmed = booking.status === 'confirmed';
    const updated = await setBookingStatus(booking.id, 'cancelled');
    const ip = clientIp(req);

    const voided = await voidDocumentsForBooking(booking.id, ['proforma_invoice', 'invoice']);
    for (const doc of voided) {
        await logAudit({
            userId: req.user.id,
            action: 'document.voided',
            entityType: 'document',
            entityId: doc.id,
            metadata: { type: doc.type, documentNumber: doc.documentNumber, bookingId: booking.id },
            ip,
        });
    }

    let creditNote = null;
    if (wasConfirmed) {
        const refund = computeRefund(booking);
        creditNote = await createDocument({
            bookingId: booking.id,
            type: 'credit_note',
            amount: refund.refundAmount,
            currency: booking.currency,
            payload: {
                reason: req.body?.reason || 'Booking cancelled after confirmation',
                originalAmount: Number(booking.total_amount),
                refundPercent: refund.refundPercent,
                cancellationFeePercent: refund.feePercent,
                cancellationFeeAmount: refund.feeAmount,
                daysBeforeStart: refund.daysBeforeStart,
            },
        });
        await logAudit({
            userId: req.user.id,
            action: 'document.generated',
            entityType: 'document',
            entityId: creditNote.id,
            metadata: { type: creditNote.type, documentNumber: creditNote.documentNumber, refundPercent: refund.refundPercent },
            ip,
        });
    }

    await logAudit({ userId: req.user.id, action: 'booking.cancelled', entityType: 'booking', entityId: booking.id, metadata: { wasConfirmed }, ip });

    // Let the other party know — whichever side didn't initiate the cancellation.
    const notifyUserId = req.user.id === booking.renter_id ? item?.owner_id : booking.renter_id;
    if (notifyUserId) {
        const other = await findUserById(notifyUserId);
        if (other) {
            await notify({
                to: other.email,
                subject: `Booking for "${item?.title || 'an item'}" was cancelled`,
                text: `The booking for "${item?.title || 'this item'}" (${booking.start_date} to ${booking.end_date}) was cancelled.${
                    creditNote ? ` A credit note (${creditNote.documentNumber}) for ${booking.currency} ${creditNote.amount.toFixed(2)} was issued.` : ''
                }`,
            });
        }
    }

    res.json({ ok: true, booking: updated, document: creditNote });
});

module.exports = router;
