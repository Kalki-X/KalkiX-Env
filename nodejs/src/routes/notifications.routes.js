const express = require('express');
const { attachUser, requireAuth } = require('../middleware/auth');
const {
    listNotificationsForUser,
    countUnread,
    markAsRead,
    markAllAsRead,
} = require('../models/notificationModel');

const router = express.Router();

router.get('/', attachUser, requireAuth, async (req, res) => {
    const page = Number(req.query.page) || 1;
    const pageSize = Math.min(Number(req.query.pageSize) || 20, 100);
    const { notifications, total } = await listNotificationsForUser(req.user.id, { page, pageSize });
    const unreadCount = await countUnread(req.user.id);
    res.json({ ok: true, notifications, total, page, pageSize, unreadCount });
});

router.get('/unread-count', attachUser, requireAuth, async (req, res) => {
    const count = await countUnread(req.user.id);
    res.json({ ok: true, count });
});

router.post('/:id/read', attachUser, requireAuth, async (req, res) => {
    const notification = await markAsRead(req.params.id, req.user.id);
    if (!notification) {
        return res.status(404).json({ ok: false, error: 'Notification not found' });
    }
    res.json({ ok: true, notification });
});

router.post('/read-all', attachUser, requireAuth, async (req, res) => {
    const count = await markAllAsRead(req.user.id);
    res.json({ ok: true, count });
});

module.exports = router;
