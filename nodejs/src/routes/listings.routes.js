const express = require('express');
const multer = require('multer');
const { attachUser, requireAuth, requireCapability } = require('../middleware/auth');
const { logAudit, clientIp } = require('../utils/audit');
const {
    listActiveItems,
    listItemsByOwner,
    findItemById,
    findPublicItemById,
    createItem,
    updateItemStatus,
    updateItemFields,
    countBookingsForItem,
    deleteItem,
} = require('../models/itemModel');
const {
    MAX_IMAGES_PER_ITEM,
    listItemImageMeta,
    countItemImages,
    findItemImageWithData,
    addItemImage,
    deleteItemImage,
} = require('../models/itemImageModel');
const {
    listAvailabilityBlocks,
    addAvailabilityBlock,
    deleteAvailabilityBlock,
} = require('../models/itemAvailabilityModel');
const { hasOverlap, listBookedDateRanges } = require('../models/bookingModel');

const router = express.Router();

// Images live as bytea rows in Postgres (see schema.sql), so multer just needs to hand
// us the raw buffer — no disk staging.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB/image
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'));
        }
        cb(null, true);
    },
});

// Ownership check shared by every :id-scoped lender route below. Admin/super_admin can
// also manage any listing (same precedent as requireCapability elsewhere in this app).
async function loadOwnedItem(req, res) {
    const item = await findItemById(req.params.id);
    if (!item) {
        res.status(404).json({ ok: false, error: 'Item not found' });
        return null;
    }
    if (item.owner_id !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) {
        res.status(403).json({ ok: false, error: 'Not your listing' });
        return null;
    }
    return item;
}

// ---------- Items ----------

// Public browse — no auth required (the "Public" role from CLAUDE.md).
router.get('/', attachUser, async (req, res) => {
    const items = await listActiveItems({ category: req.query.category, search: req.query.search });
    res.json({ ok: true, items });
});

router.get('/mine', attachUser, requireAuth, requireCapability('isLender'), async (req, res) => {
    const items = await listItemsByOwner(req.user.id);
    res.json({ ok: true, items });
});

router.get('/:id', attachUser, async (req, res) => {
    const item = await findPublicItemById(req.params.id);
    const isOwnerOrStaff = req.user && (req.user.id === item?.ownerId || ['admin', 'super_admin', 'support'].includes(req.user.role));
    if (!item || (item.status !== 'active' && !isOwnerOrStaff)) {
        return res.status(404).json({ ok: false, error: 'Item not found' });
    }
    res.json({ ok: true, item });
});

router.post('/', attachUser, requireAuth, requireCapability('isLender'), async (req, res) => {
    const { title, description, category, pricePerDay, currency, pickupAddress, pickupLat, pickupLng } = req.body || {};
    if (!title || pricePerDay === undefined || pricePerDay === null) {
        return res.status(400).json({ ok: false, error: 'title and pricePerDay are required' });
    }
    if (Number(pricePerDay) < 0) {
        return res.status(400).json({ ok: false, error: 'pricePerDay must be >= 0' });
    }

    const item = await createItem({
        ownerId: req.user.id,
        title,
        description,
        category,
        pricePerDay,
        currency,
        pickupAddress,
        pickupLat,
        pickupLng,
    });

    await logAudit({
        userId: req.user.id,
        action: 'item.created',
        entityType: 'item',
        entityId: item.id,
        metadata: { title: item.title },
        ip: clientIp(req),
    });

    res.status(201).json({ ok: true, item });
});

// Field edits (title/description/category/price/currency/pickup location). Kept
// separate from /status below since that's a workflow action, this is a content edit.
router.patch('/:id', attachUser, requireAuth, requireCapability('isLender'), async (req, res) => {
    const owned = await loadOwnedItem(req, res);
    if (!owned) return;

    const { title, description, category, pricePerDay, currency, pickupAddress, pickupLat, pickupLng } = req.body || {};
    if (title !== undefined && !title) {
        return res.status(400).json({ ok: false, error: 'title cannot be empty' });
    }
    if (pricePerDay !== undefined && Number(pricePerDay) < 0) {
        return res.status(400).json({ ok: false, error: 'pricePerDay must be >= 0' });
    }

    const item = await updateItemFields(req.params.id, owned.owner_id, {
        title,
        description,
        category,
        pricePerDay,
        currency,
        pickupAddress,
        pickupLat,
        pickupLng,
    });

    await logAudit({
        userId: req.user.id,
        action: 'item.updated',
        entityType: 'item',
        entityId: item.id,
        metadata: { fields: Object.keys(req.body || {}) },
        ip: clientIp(req),
    });

    res.json({ ok: true, item });
});

router.patch('/:id/status', attachUser, requireAuth, requireCapability('isLender'), async (req, res) => {
    const { status } = req.body || {};
    if (!['active', 'paused', 'archived'].includes(status)) {
        return res.status(400).json({ ok: false, error: 'Invalid status' });
    }

    const item = await updateItemStatus(req.params.id, req.user.id, status);
    if (!item) {
        return res.status(404).json({ ok: false, error: 'Item not found or not owned by you' });
    }

    await logAudit({
        userId: req.user.id,
        action: 'item.status_changed',
        entityType: 'item',
        entityId: item.id,
        metadata: { status },
        ip: clientIp(req),
    });

    res.json({ ok: true, item });
});

// Hard delete only if nothing references this item's booking/payment/document history —
// otherwise deleting the row would orphan (or cascade-delete, per the FK) real financial
// records. Archive (PATCH /:id/status) is the right move once an item has any bookings.
router.delete('/:id', attachUser, requireAuth, requireCapability('isLender'), async (req, res) => {
    const owned = await loadOwnedItem(req, res);
    if (!owned) return;

    const bookingCount = await countBookingsForItem(owned.id);
    if (bookingCount > 0) {
        return res.status(409).json({
            ok: false,
            error: `This listing has ${bookingCount} booking(s) on record and can't be deleted. Archive it instead to hide it from the marketplace while keeping booking history intact.`,
        });
    }

    await deleteItem(owned.id, owned.owner_id);

    await logAudit({
        userId: req.user.id,
        action: 'item.deleted',
        entityType: 'item',
        entityId: owned.id,
        metadata: { title: owned.title },
        ip: clientIp(req),
    });

    res.json({ ok: true });
});

// ---------- Images ----------

router.get('/:id/images', attachUser, async (req, res) => {
    const images = await listItemImageMeta(req.params.id);
    res.json({ ok: true, images });
});

// Streams the raw bytes — this is what an <img src="/api/items/:id/images/:imageId">
// tag points at. Draft/paused/archived listings only expose images to their owner or
// staff, matching the same visibility rule as the item detail route.
router.get('/:id/images/:imageId', attachUser, async (req, res) => {
    const item = await findItemById(req.params.id);
    if (!item) return res.status(404).end();

    const isOwnerOrStaff = req.user && (req.user.id === item.owner_id || ['admin', 'super_admin', 'support'].includes(req.user.role));
    if (item.status !== 'active' && !isOwnerOrStaff) {
        return res.status(404).end();
    }

    const image = await findItemImageWithData(req.params.imageId);
    if (!image || String(image.item_id) !== String(item.id)) {
        return res.status(404).end();
    }

    res.set('Content-Type', image.mime_type);
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(image.data);
});

router.post('/:id/images', attachUser, requireAuth, requireCapability('isLender'), upload.single('image'), async (req, res) => {
    const owned = await loadOwnedItem(req, res);
    if (!owned) return;
    if (!req.file) {
        return res.status(400).json({ ok: false, error: 'No image file uploaded (field name must be "image")' });
    }

    const existing = await countItemImages(owned.id);
    if (existing >= MAX_IMAGES_PER_ITEM) {
        return res.status(409).json({ ok: false, error: `A listing can have at most ${MAX_IMAGES_PER_ITEM} images` });
    }

    const image = await addItemImage({ itemId: owned.id, mimeType: req.file.mimetype, data: req.file.buffer });

    await logAudit({
        userId: req.user.id,
        action: 'item.image_added',
        entityType: 'item',
        entityId: owned.id,
        metadata: { imageId: image.id },
        ip: clientIp(req),
    });

    res.status(201).json({ ok: true, image });
});

router.delete('/:id/images/:imageId', attachUser, requireAuth, requireCapability('isLender'), async (req, res) => {
    const owned = await loadOwnedItem(req, res);
    if (!owned) return;

    const deleted = await deleteItemImage(req.params.imageId, owned.id);
    if (!deleted) return res.status(404).json({ ok: false, error: 'Image not found' });

    await logAudit({
        userId: req.user.id,
        action: 'item.image_removed',
        entityType: 'item',
        entityId: owned.id,
        metadata: { imageId: Number(req.params.imageId) },
        ip: clientIp(req),
    });

    res.json({ ok: true });
});

// Multer errors (oversized file, wrong mimetype) reach here as regular thrown errors —
// surface them as 400s instead of falling through to the generic 500 handler.
router.use((err, _req, res, next) => {
    if (err instanceof multer.MulterError || (err && /image files/i.test(err.message))) {
        return res.status(400).json({ ok: false, error: err.message });
    }
    next(err);
});

// ---------- Availability ----------

// Public: merges lender-defined blocks with existing pending/confirmed bookings into a
// single "unavailable" date-range list, without exposing who booked what. Powers the
// renter-facing availability calendar. Block entries include `id` (harmless to expose —
// just a sequence number) so the lender's own management UI can reuse this same
// response to know which entries are removable blocks (id present) vs. bookings
// (id null, cancel the booking instead).
router.get('/:id/availability', attachUser, async (req, res) => {
    const { from, to } = req.query;
    const [blocks, booked] = await Promise.all([
        listAvailabilityBlocks(req.params.id, { from, to }),
        listBookedDateRanges(req.params.id, { from, to }),
    ]);
    const unavailable = [
        ...blocks.map((b) => ({ id: b.id, startDate: b.startDate, endDate: b.endDate, reason: b.reason || 'Unavailable' })),
        ...booked.map((b) => ({ id: null, startDate: b.startDate, endDate: b.endDate, reason: 'Booked' })),
    ];
    res.json({ ok: true, unavailable });
});

router.post('/:id/availability', attachUser, requireAuth, requireCapability('isLender'), async (req, res) => {
    const owned = await loadOwnedItem(req, res);
    if (!owned) return;

    const { startDate, endDate, reason } = req.body || {};
    if (!startDate || !endDate) {
        return res.status(400).json({ ok: false, error: 'startDate and endDate are required' });
    }
    if (new Date(endDate) < new Date(startDate)) {
        return res.status(400).json({ ok: false, error: 'endDate must be on/after startDate' });
    }

    // A lender shouldn't be able to block dates a renter has already booked — cancel
    // the booking first if the item genuinely needs to come off the market.
    const bookingConflict = await hasOverlap(owned.id, startDate, endDate);
    if (bookingConflict) {
        return res.status(409).json({ ok: false, error: 'These dates overlap an existing booking. Cancel the booking first.' });
    }

    const block = await addAvailabilityBlock({ itemId: owned.id, startDate, endDate, reason });

    await logAudit({
        userId: req.user.id,
        action: 'item.availability_blocked',
        entityType: 'item',
        entityId: owned.id,
        metadata: { startDate, endDate, reason: reason || null },
        ip: clientIp(req),
    });

    res.status(201).json({ ok: true, block });
});

router.delete('/:id/availability/:blockId', attachUser, requireAuth, requireCapability('isLender'), async (req, res) => {
    const owned = await loadOwnedItem(req, res);
    if (!owned) return;

    const deleted = await deleteAvailabilityBlock(req.params.blockId, owned.id);
    if (!deleted) return res.status(404).json({ ok: false, error: 'Block not found' });

    await logAudit({
        userId: req.user.id,
        action: 'item.availability_unblocked',
        entityType: 'item',
        entityId: owned.id,
        metadata: { blockId: Number(req.params.blockId) },
        ip: clientIp(req),
    });

    res.json({ ok: true });
});

module.exports = router;
