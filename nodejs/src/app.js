const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth.routes');
const googleAuthRoutes = require('./routes/googleAuth.routes');
const listingsRoutes = require('./routes/listings.routes');
const bookingsRoutes = require('./routes/bookings.routes');
const adminRoutes = require('./routes/admin.routes');

const REACT_URL = process.env.REACT_URL || 'http://localhost:5173';

function createApp() {
    const app = express();

    app.use(express.json());
    app.use(cookieParser());
    app.use(
        cors({
            origin: [REACT_URL],
            credentials: true,
        })
    );

    app.get('/api/ping', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

    app.use('/api/auth', authRoutes);
    app.use('/api/auth', googleAuthRoutes);
    app.use('/api/items', listingsRoutes);
    app.use('/api/bookings', bookingsRoutes);
    app.use('/api/admin', adminRoutes);

    // Centralized error handler — keeps unexpected DB/JS errors from leaking stack traces.
    app.use((err, _req, res, _next) => {
        console.error('❌ Unhandled error:', err);
        res.status(500).json({ ok: false, error: 'Internal server error' });
    });

    return app;
}

module.exports = { createApp };
