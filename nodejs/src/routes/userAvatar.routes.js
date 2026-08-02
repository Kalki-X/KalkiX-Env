const express = require('express');
const { findAvatar } = require('../models/userModel');

const router = express.Router();

// Public — avatars are meant to be visible to whoever a user interacts with (the other
// party on a booking, anyone browsing a lender's listings), same as any marketplace
// profile photo. No auth required, mirrors the item image serving route.
router.get('/:id/avatar', async (req, res) => {
    const avatar = await findAvatar(req.params.id);
    if (!avatar || !avatar.avatar_data) {
        return res.status(404).end();
    }
    res.set('Content-Type', avatar.avatar_mime_type);
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(avatar.avatar_data);
});

module.exports = router;
