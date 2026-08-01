const { logSystemError } = require('../utils/errorLog');

/**
 * Centralized error handler. `require('express-async-errors')` (see app.js) makes
 * every `async (req, res) => {...}` route handler forward thrown/rejected errors
 * here automatically — without it, an unhandled rejection in an async Express 4
 * route just hangs the request instead of responding, and this handler (and the
 * error_log table it feeds) would never see it.
 */
function errorHandler(err, req, res, _next) {
    console.error('❌ Unhandled error:', err);

    logSystemError({
        message: err.message || 'Unknown error',
        stack: err.stack,
        method: req.method,
        route: req.originalUrl,
        statusCode: 500,
        userId: req.user?.id ?? null,
    });

    if (res.headersSent) return; // response already started streaming, nothing more we can do
    res.status(500).json({ ok: false, error: 'Internal server error' });
}

module.exports = { errorHandler };
