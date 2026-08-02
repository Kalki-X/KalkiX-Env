const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { findByEmail, createUser, updatePasswordHash, toPublicUser, updateOwnProfile, setAvatar } = require('../models/userModel');
const { createResetToken, findValidToken, markTokenUsed } = require('../models/passwordResetModel');
const { signToken, setAuthCookie, clearAuthCookie, attachUser, requireAuth } = require('../middleware/auth');
const { logAudit, clientIp } = require('../utils/audit');
const { isValidEmail, isValidPassword, MIN_PASSWORD_LENGTH } = require('../utils/validators');
const { generateOneTimeToken, hashToken } = require('../utils/tokens');
const { sendMail } = require('../utils/mailer');

const router = express.Router();
const REACT_URL = process.env.REACT_URL || 'http://localhost:5173';

router.post('/register', async (req, res) => {
    const { firstName, lastName, email, phone, password, accountType } = req.body || {};

    if (!firstName || !lastName || !email || !password || !accountType) {
        return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ ok: false, error: 'Invalid email address' });
    }
    if (!isValidPassword(password)) {
        return res.status(400).json({ ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }
    if (!['renter', 'owner', 'both'].includes(accountType)) {
        return res.status(400).json({ ok: false, error: 'Invalid account type' });
    }

    const existing = await findByEmail(email);
    if (existing) {
        return res.status(409).json({ ok: false, error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser({
        firstName,
        lastName,
        email,
        phone,
        passwordHash,
        isRenter: accountType === 'renter' || accountType === 'both',
        isLender: accountType === 'owner' || accountType === 'both',
    });

    const publicUser = toPublicUser(user);
    // No "remember me" checkbox at signup — a brand new session defaults to persistent.
    const token = signToken(publicUser, { rememberMe: true });
    setAuthCookie(res, token, { rememberMe: true });

    await logAudit({
        userId: publicUser.id,
        action: 'user.registered',
        entityType: 'user',
        entityId: publicUser.id,
        metadata: { email: publicUser.email, accountType },
        ip: clientIp(req),
    });

    res.status(201).json({ ok: true, user: publicUser });
});

router.post('/login', async (req, res) => {
    const { email, password, remember } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ ok: false, error: 'Email and password are required' });
    }

    const user = await findByEmail(email);
    const ip = clientIp(req);

    if (!user) {
        await logAudit({ action: 'auth.login_failed', metadata: { email, reason: 'no_such_user' }, ip });
        return res.status(401).json({ ok: false, error: 'Invalid email or password' });
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash);
    if (!passwordOk) {
        await logAudit({
            userId: user.id,
            action: 'auth.login_failed',
            entityType: 'user',
            entityId: user.id,
            metadata: { email, reason: 'bad_password' },
            ip,
        });
        return res.status(401).json({ ok: false, error: 'Invalid email or password' });
    }

    if (user.status !== 'active') {
        await logAudit({
            userId: user.id,
            action: 'auth.login_failed',
            entityType: 'user',
            entityId: user.id,
            metadata: { email, reason: 'account_not_active', status: user.status },
            ip,
        });
        return res.status(403).json({ ok: false, error: 'This account is not active' });
    }

    const publicUser = toPublicUser(user);
    const rememberMe = !!remember;
    const token = signToken(publicUser, { rememberMe });
    setAuthCookie(res, token, { rememberMe });

    await logAudit({
        userId: publicUser.id,
        action: 'auth.login_succeeded',
        entityType: 'user',
        entityId: publicUser.id,
        metadata: { email, remember: rememberMe },
        ip,
    });

    res.json({ ok: true, user: publicUser });
});

router.post('/logout', attachUser, async (req, res) => {
    if (req.user) {
        await logAudit({
            userId: req.user.id,
            action: 'auth.logout',
            entityType: 'user',
            entityId: req.user.id,
            ip: clientIp(req),
        });
    }
    clearAuthCookie(res);
    res.json({ ok: true });
});

router.get('/me', attachUser, requireAuth, (req, res) => {
    res.json({ ok: true, user: req.user });
});

// Self-service profile edit: phone number only. Email is the login identity and is
// deliberately not accepted here at all — changing it would need re-verification,
// which is out of scope for now — and role/status/capabilities stay Super
// Admin/staff-only (see admin.routes.js / staffUsers.routes.js).
router.patch('/me', attachUser, requireAuth, async (req, res) => {
    const { phone } = req.body || {};
    if (phone !== undefined && phone !== null && typeof phone !== 'string') {
        return res.status(400).json({ ok: false, error: 'Invalid phone number' });
    }
    const updated = await updateOwnProfile(req.user.id, { phone });

    await logAudit({
        userId: req.user.id,
        action: 'user.profile_updated',
        entityType: 'user',
        entityId: req.user.id,
        metadata: { phone: phone || null },
        ip: clientIp(req),
    });

    res.json({ ok: true, user: updated });
});

const avatarUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB — a profile picture, not a gallery photo
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'));
        }
        cb(null, true);
    },
});

router.post('/me/avatar', attachUser, requireAuth, avatarUpload.single('avatar'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ ok: false, error: 'No image file uploaded (field name must be "avatar")' });
    }
    const updated = await setAvatar(req.user.id, { mimeType: req.file.mimetype, data: req.file.buffer });

    await logAudit({
        userId: req.user.id,
        action: 'user.avatar_updated',
        entityType: 'user',
        entityId: req.user.id,
        ip: clientIp(req),
    });

    res.json({ ok: true, user: updated });
});

// Multer errors (oversized file, wrong mimetype) reach here as regular thrown errors —
// surface them as 400s instead of falling through to the generic 500 handler.
router.use((err, _req, res, next) => {
    if (err instanceof multer.MulterError || (err && /image files/i.test(err.message))) {
        return res.status(400).json({ ok: false, error: err.message });
    }
    next(err);
});

// Always returns the same generic response whether or not the email exists —
// otherwise this endpoint becomes a way to check which emails have accounts.
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body || {};
    const GENERIC_RESPONSE = {
        ok: true,
        message: "If an account exists for that email, we've sent a password reset link.",
    };

    if (!email || !isValidEmail(email)) {
        return res.status(400).json({ ok: false, error: 'A valid email address is required' });
    }

    const user = await findByEmail(email);
    if (!user) {
        return res.json(GENERIC_RESPONSE); // don't reveal whether the account exists
    }

    const { token, tokenHash } = generateOneTimeToken();
    await createResetToken(user.id, tokenHash);

    const resetLink = `${REACT_URL}/reset-password?token=${token}`;
    await sendMail({
        to: user.email,
        subject: 'Reset your GearShare password',
        text: `We received a request to reset your GearShare password. This link expires in 1 hour:\n\n${resetLink}\n\nIf you didn't request this, you can safely ignore this email.`,
    });

    await logAudit({
        userId: user.id,
        action: 'auth.password_reset_requested',
        entityType: 'user',
        entityId: user.id,
        metadata: { email: user.email },
        ip: clientIp(req),
    });

    res.json(GENERIC_RESPONSE);
});

router.post('/reset-password', async (req, res) => {
    const { token, password } = req.body || {};
    const ip = clientIp(req);

    if (!token || !password) {
        return res.status(400).json({ ok: false, error: 'Token and new password are required' });
    }
    if (!isValidPassword(password)) {
        return res.status(400).json({ ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const tokenRow = await findValidToken(hashToken(token));
    if (!tokenRow) {
        return res.status(400).json({ ok: false, error: 'This reset link is invalid or has expired' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await updatePasswordHash(tokenRow.user_id, passwordHash);
    await markTokenUsed(tokenRow.id); // single-use

    await logAudit({
        userId: tokenRow.user_id,
        action: 'auth.password_reset_completed',
        entityType: 'user',
        entityId: tokenRow.user_id,
        ip,
    });

    res.json({ ok: true, message: 'Your password has been reset. You can now log in.' });
});

module.exports = router;
