const express = require('express');
const crypto = require('crypto');
const { findByGoogleId, findByEmail, createUserFromGoogle, linkGoogleAccount, toPublicUser } = require('../models/userModel');
const { signToken, setAuthCookie } = require('../middleware/auth');
const { logAudit, clientIp } = require('../utils/audit');

const router = express.Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';
const REACT_URL = process.env.REACT_URL || 'http://localhost:5173';
const STATE_COOKIE = 'gs_oauth_state';
const VALID_INTENTS = new Set(['renter', 'owner', 'both']);

function isGoogleConfigured() {
    return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

/**
 * Kicks off Google's OAuth2 authorization-code flow. `intent` (renter/owner/both,
 * from the account-type selector on the Registration page) is carried through the
 * `state` param so a brand-new account gets the right renter/lender capability flags —
 * `state` doubles as a CSRF token: the exact same value is stashed in a short-lived
 * httpOnly cookie and must match what Google echoes back on the callback.
 */
router.get('/google', (req, res) => {
    if (!isGoogleConfigured()) {
        return res.redirect(`${REACT_URL}/login?error=google_not_configured`);
    }

    const intent = VALID_INTENTS.has(req.query.intent) ? req.query.intent : '';
    const csrf = crypto.randomBytes(16).toString('hex');
    const state = `${csrf}:${intent}`;

    res.cookie(STATE_COOKIE, state, {
        httpOnly: true,
        secure: process.env.COOKIE_SECURE === 'true',
        sameSite: 'lax',
        maxAge: 5 * 60 * 1000, // the whole round trip should take seconds, not minutes
    });

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', GOOGLE_CALLBACK_URL);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('prompt', 'select_account');
    authUrl.searchParams.set('access_type', 'online');

    res.redirect(authUrl.toString());
});

router.get('/google/callback', async (req, res) => {
    const ip = clientIp(req);
    const cookieState = req.cookies?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE);

    const failGoogle = async (reason, userId = null) => {
        await logAudit({ userId, action: 'auth.login_failed', metadata: { provider: 'google', reason }, ip });
        res.redirect(`${REACT_URL}/login?error=google_auth_failed`);
    };

    if (req.query.error) return await failGoogle(`google_denied:${req.query.error}`);
    if (!req.query.code || !req.query.state || req.query.state !== cookieState) {
        return await failGoogle('state_mismatch');
    }
    if (!isGoogleConfigured()) return await failGoogle('not_configured');

    const [, intent] = String(cookieState).split(':');

    try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code: req.query.code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: GOOGLE_CALLBACK_URL,
                grant_type: 'authorization_code',
            }),
        });
        const tokens = await tokenResponse.json();
        if (!tokenResponse.ok || !tokens.access_token) {
            return await failGoogle(`token_exchange_failed:${tokens.error || tokenResponse.status}`);
        }

        const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const profile = await profileResponse.json();
        if (!profileResponse.ok || !profile.email) {
            return await failGoogle('userinfo_failed');
        }

        let user = await findByGoogleId(profile.sub);

        if (!user) {
            const existing = await findByEmail(profile.email);
            if (existing) {
                user = await linkGoogleAccount(existing.id, profile.sub);
                await logAudit({ userId: user.id, action: 'auth.google_linked', entityType: 'user', entityId: user.id, ip });
            } else {
                user = await createUserFromGoogle({
                    firstName: profile.given_name || 'GearShare',
                    lastName: profile.family_name || 'User',
                    email: profile.email,
                    googleId: profile.sub,
                    isRenter: intent === 'renter' || intent === 'both',
                    isLender: intent === 'owner' || intent === 'both',
                });
                await logAudit({
                    userId: user.id,
                    action: 'user.registered',
                    entityType: 'user',
                    entityId: user.id,
                    metadata: { email: user.email, provider: 'google' },
                    ip,
                });
            }
        }

        if (user.status !== 'active') return await failGoogle('account_not_active', user.id);

        const publicUser = toPublicUser(user);
        const token = signToken(publicUser, { rememberMe: true });
        setAuthCookie(res, token, { rememberMe: true });

        await logAudit({
            userId: publicUser.id,
            action: 'auth.login_succeeded',
            entityType: 'user',
            entityId: publicUser.id,
            metadata: { email: publicUser.email, provider: 'google' },
            ip,
        });

        // Full-page redirect can't hand the SPA a JS return value, so land on a small
        // page that reads the now-set auth cookie via GET /me and routes from there.
        res.redirect(`${REACT_URL}/auth/complete`);
    } catch (err) {
        console.error('❌ Google OAuth callback error:', err);
        await failGoogle(`exception:${err.message}`);
    }
});

module.exports = router;
