const express = require('express');
const bcrypt = require('bcryptjs');
const { findByEmail, createUser, toPublicUser } = require('../models/userModel');
const { signToken, setAuthCookie, clearAuthCookie, attachUser, requireAuth } = require('../middleware/auth');
const { logAudit, clientIp } = require('../utils/audit');
const { isValidEmail, isValidPassword, MIN_PASSWORD_LENGTH } = require('../utils/validators');

const router = express.Router();

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
    const token = signToken(publicUser);
    setAuthCookie(res, token);

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
    const { email, password } = req.body || {};
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
    const token = signToken(publicUser);
    setAuthCookie(res, token);

    await logAudit({
        userId: publicUser.id,
        action: 'auth.login_succeeded',
        entityType: 'user',
        entityId: publicUser.id,
        metadata: { email },
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

module.exports = router;
