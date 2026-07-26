const express = require('express');
const { attachUser, requireAuth, requireCapability } = require('../middleware/auth');
const { logAudit, clientIp } = require('../utils/audit');
const {
    listActiveItems,
    listItemsByOwner,
    findItemById,
    createItem,
    updateItemStatus,
} = require('../models/itemModel');

const router = express.Router();

// Public browse — no auth required (the "Public" role from CLAUDE.md).
router.get('/', attachUser, async (req, res) => {
    const items = await listActiveItems({ category: req.query.category });
    res.json({ ok: true, items });
});

router.get('/mine', attachUser, requireAuth, requireCapability('isLender'), async (req, res) => {
    const items = await listItemsByOwner(req.user.id);
    res.json({ ok: true, items });
});

router.get('/:id', attachUser, async (req, res) => {
    const item = await findItemById(req.params.id);
    if (!item || item.status !== 'active') {
        return res.status(404).json({ ok: false, error: 'Item not found' });
    }
    res.json({ ok: true, item });
});

router.post('/', attachUser, requireAuth, requireCapability('isLender'), async (req, res) => {
    const { title, description, category, pricePerDay, currency } = req.body || {};
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

module.exports = router;
