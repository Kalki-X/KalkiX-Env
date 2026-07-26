const jwt = require('jsonwebtoken');
const { findById } = require('../models/userModel');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
const COOKIE_NAME = 'gs_token';

function signToken(user) {
    return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
}

function setAuthCookie(res, token) {
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.COOKIE_SECURE === 'true',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
}

function clearAuthCookie(res) {
    res.clearCookie(COOKIE_NAME);
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
