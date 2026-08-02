const express = require('express');
// Patches Express so async route handlers that throw/reject forward to the error
// middleware automatically — Express 4 doesn't do this on its own. Must be required
// before any routers are defined.
require('express-async-errors');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth.routes');
const googleAuthRoutes = require('./routes/googleAuth.routes');
const listingsRoutes = require('./routes/listings.routes');
const bookingsRoutes = require('./routes/bookings.routes');
const adminRoutes = require('./routes/admin.routes');
const adminDocumentsRoutes = require('./routes/adminDocuments.routes');
const adminAuditRoutes = require('./routes/adminAudit.routes');
const adminReportsRoutes = require('./routes/adminReports.routes');
const adminPaymentsRoutes = require('./routes/adminPayments.routes');
const adminErrorsRoutes = require('./routes/adminErrors.routes');
const staffUsersRoutes = require('./routes/staffUsers.routes');
const userAvatarRoutes = require('./routes/userAvatar.routes');
const { errorHandler } = require('./middleware/errorHandler');

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
    // More specific /api/admin/* prefixes MUST be registered before the general
    // /api/admin router below — each has its own role check (e.g. documents also
    // allow finance/support), and admin.routes.js's router-level requireRole('super_admin')
    // middleware runs for anything under /api/admin regardless of whether one of its
    // own routes matches, which would otherwise shadow these with the wrong role gate.
    app.use('/api/admin/documents', adminDocumentsRoutes);
    app.use('/api/admin/audit', adminAuditRoutes);
    app.use('/api/admin/reports', adminReportsRoutes);
    app.use('/api/admin/payments', adminPaymentsRoutes);
    app.use('/api/admin/errors', adminErrorsRoutes);
    app.use('/api/admin', adminRoutes);
    // Admin & Support's user-management view — deliberately a separate /api/staff
    // prefix (not /api/admin/*) so it's structurally impossible for it to collide
    // with admin.routes.js's blanket requireRole('super_admin').
    app.use('/api/staff/users', staffUsersRoutes);
    app.use('/api/users', userAvatarRoutes);

    // Centralized error handler — keeps unexpected DB/JS errors from leaking stack
    // traces and records them to error_log for the Super Admin error report.
    app.use(errorHandler);

    return app;
}

module.exports = { createApp };
