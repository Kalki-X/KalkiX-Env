const jwt = require('jsonwebtoken');
const { findById } = require('../models/userModel');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
const COOKIE_NAME = 'gs_token';

// Not remembered: short-lived, and a browser-session cookie (cleared on browser close).
// Remembered ("Remember me" checked): longer-lived, persisted cookie with a matching maxAge.
const DEFAULT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';
const REMEMBER_EXPIRES_IN = process.env.JWT_REMEMBER_EXPIRES_IN || '30d';

// Tiny duration parser so we don't need an extra dependency just to turn "30d" into
// milliseconds for the cookie's maxAge (jsonwebtoken parses the same strings itself
// for `expiresIn`, so this only ever needs to agree with our own env var values).
function durationToMs(duration) {
    const match = /^(\d+)\s*(d|h|m|s)$/i.exec(String(duration).trim());
    if (!match) return 24 * 60 * 60 * 1000; // fallback: 1 day
    const value = Number(match[1]);
    const unitMs = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 }[match[2].toLowerCase()];
    return value * unitMs;
}

function signToken(user, { rememberMe = false } = {}) {
    return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
        expiresIn: rememberMe ? REMEMBER_EXPIRES_IN : DEFAULT_EXPIRES_IN,
    });
}

const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
// The React app and API are deployed as separate origins (e.g. gearshare-web
// vs gearshare-api on Render), so this cookie is sent on cross-site fetch/XHR
// requests, not just same-site or top-level navigations. Browsers only deliver
// cookies in that case if SameSite=None, which in turn requires Secure — so
// tie the two together off the same COOKIE_SECURE flag. Locally (COOKIE_SECURE
// unset, plain http), SameSite=None would be silently rejected by the browser,
// so fall back to Lax there, which works fine for same-origin/proxied local dev.
const COOKIE_SAME_SITE = COOKIE_SECURE ? 'none' : 'lax';

function setAuthCookie(res, token, { rememberMe = false } = {}) {
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: COOKIE_SECURE,
        sameSite: COOKIE_SAME_SITE,
        // Omitting maxAge makes it a session cookie, cleared when the browser closes.
        ...(rememberMe ? { maxAge: durationToMs(REMEMBER_EXPIRES_IN) } : {}),
    });
}

function clearAuthCookie(res) {
    // Browsers match cookies to clear by name/path/domain, but some are stricter
    // about also matching Secure/SameSite than others — pass the same attributes
    // used to set it so logout reliably clears the cookie in every browser.
    res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: COOKIE_SECURE, sameSite: COOKIE_SAME_SITE });
}

// Populates req.user if a valid token is present, but does not reject the request.
// Use `requireAuth` after this for routes that must be logged in.
async function attachUser(req, _res, next) {
    try {
        const token = req.cookies?.[COOKIE_NAME];
        if (!token) return next();
        const payload = jwt.verify(token, JWT_SECRET);
        const user = await findById(payload.sub);
        if (user && user.status === 'active') {
            req.user = user;
        }
        next();
    } catch (_err) {
        next(); // invalid/expired token -> treat as anonymous
    }
}

function requireAuth(req, res, next) {
    if (!req.user) return res.status(401).json({ ok: false, error: 'Authentication required' });
    next();
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ ok: false, error: 'Authentication required' });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ ok: false, error: 'Insufficient permissions' });
        }
        next();
    };
}

// e.g. requireCapability('isLender') restricts item creation to lenders.
function requireCapability(flag) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ ok: false, error: 'Authentication required' });
        if (req.user.role === 'super_admin' || req.user.role === 'admin') return next();
        if (!req.user[flag]) {
            return res.status(403).json({ ok: false, error: `Requires ${flag} capability` });
        }
        next();
    };
}

module.exports = {
    COOKIE_NAME,
    signToken,
    setAuthCookie,
    clearAuthCookie,
    attachUser,
    requireAuth,
    requireRole,
    requireCapability,
};
