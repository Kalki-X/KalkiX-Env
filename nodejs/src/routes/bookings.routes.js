const express = require('express');
const { pool } = require('../db/pool');
const { attachUser, requireAuth, requireCapability } = require('../middleware/auth');
const { logAudit, clientIp } = require('../utils/audit');
const { findItemById } = require('../models/itemModel');
const {
    hasOverlap,
    createBooking,
    findBookingById,
    setBookingStatus,
    listBookingsForRenter,
    listBookingsForOwner,
} = require('../models/bookingModel');
const { createDocument, listDocumentsForBooking } = require('../models/documentModel');
const { hasAvailabilityBlockOverlap } = require('../models/itemAvailabilityModel');

const router = express.Router();

function daysBetween(startDate, endDate) {
    const ms = new Date(endDate) - new Date(startDate);
    return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1); // inclusive of both dates
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
    if (booking.renter_id !== req.user.id && !['admin', 'super_admin', 'finance'].includes(req.user.role)) {
        return res.status(403).json({ ok: false, error: 'Not your booking' });
    }
    const documents = await listDocumentsForBooking(booking.id);
    res.json({ ok: true, documents });
});

// Step 1: renter requests a booking. Availability is checked, a pending booking is created,
// and a proforma invoice is issued up front so the renter knows what they'll owe.
router.post('/', attachUser, requireAuth, requireCapability('isRenter'), async (req, res) => {
    const { itemId, startDate, endDate } = req.body || {};
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
    });

    const proforma = await createDocument({
        bookingId: booking.id,
        type: 'proforma_invoice',
        amount: totalAmount,
        currency: item.currency,
        payload: {
            item: { id: item.id, title: item.title, pricePerDay: Number(item.price_per_day) },
            days,
            startDate,
            endDate,
        },
    });

    await logAudit({
        userId: req.user.id,
        action: 'booking.created',
        entityType: 'booking',
        entityId: booking.id,
        metadata: { itemId, totalAmount },
        ip: clientIp(req),
    });
    await logAudit({
        userId: req.user.id,
        action: 'document.generated',
        entityType: 'document',
        entityId: proforma.id,
        metadata: { type: proforma.type, documentNumber: proforma.documentNumber, bookingId: booking.id },
        ip: clientIp(req),
    });

    res.status(201).json({ ok: true, booking, document: proforma });
});

// Step 2: payment confirmation -> booking confirmed + real invoice issued.
// This simulates a successful payment; wiring a real payment provider is follow-up work.
router.post('/:id/confirm', attachUser, requireAuth, async (req, res) => {
    const booking = await findBookingById(req.params.id);
    if (!booking) return res.status(404).json({ ok: false, error: 'Booking not found' });
    if (booking.renter_id !== req.user.id) {
        return res.status(403).json({ ok: false, error: 'Not your booking' });
    }
    if (booking.status !== 'pending') {
        return res.status(409).json({ ok: false, error: `Booking is already ${booking.status}` });
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

// Step 3 (optional): cancellation -> credit note if it had already been paid/confirmed.
router.post('/:id/cancel', attachUser, requireAuth, async (req, res) => {
    const booking = await findBookingById(req.params.id);
    if (!booking) return res.status(404).json({ ok: false, error: 'Booking not found' });

    const isOwnerOfItem = async () => {
        const item = await findItemById(booking.item_id);
        return item && item.owner_id === req.user.id;
    };
    if (booking.renter_id !== req.user.id && !(await isOwnerOfItem())) {
        return res.status(403).json({ ok: false, error: 'Not your booking' });
    }
    if (['cancelled', 'completed'].includes(booking.status)) {
        return res.status(409).json({ ok: false, error: `Booking is already ${booking.status}` });
    }

    const wasConfirmed = booking.status === 'confirmed';
    const updated = await setBookingStatus(booking.id, 'cancelled');
    const ip = clientIp(req);

    let creditNote = null;
    if (wasConfirmed) {
        creditNote = await createDocument({
            bookingId: booking.id,
            type: 'credit_note',
            amount: booking.total_amount,
            currency: booking.currency,
            payload: { reason: req.body?.reason || 'Booking cancelled after confirmation' },
        });
        await logAudit({ userId: req.user.id, action: 'document.generated', entityType: 'document', entityId: creditNote.id, metadata: { type: creditNote.type, documentNumber: creditNote.documentNumber }, ip });
    }

    await logAudit({ userId: req.user.id, action: 'booking.cancelled', entityType: 'booking', entityId: booking.id, metadata: { wasConfirmed }, ip });

    res.json({ ok: true, booking: updated, document: creditNote });
});

module.exports = router;
