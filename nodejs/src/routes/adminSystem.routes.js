const express = require('express');
const os = require('os');
const { attachUser, requireAuth, requireRole } = require('../middleware/auth');
const { pool, POSTGRES_URL } = require('../db/pool');
const { logAudit, clientIp } = require('../utils/audit');

const router = express.Router();

// Infrastructure/system diagnostics screen. Super Admin only — deliberately never
// relaxed to Admin (unlike site branding, email templates, etc.), since this surfaces
// database host/port/name even though the password itself never leaves the server.
//
// Security note: the DB password is NEVER sent to the browser or included in any
// response here. It lives only in the server's own POSTGRES_URL environment variable,
// exactly as it does today. "Test Connection" proves the app can reach the database
// using the credential the server already has — it doesn't need to (and doesn't) show
// what that credential is. Only host/port/database name and a masked username are
// exposed, purely for "is this pointed at the DB I think it's pointed at" sanity checks.
router.use(attachUser, requireAuth, requireRole('super_admin'));

// e.g. "gearshare" -> "g•••••e". Usernames of length <= 2 are fully masked rather than
// showing anything meaningful.
function maskUsername(username) {
    if (!username) return null;
    if (username.length <= 2) return '•'.repeat(username.length);
    return `${username[0]}${'•'.repeat(Math.max(username.length - 2, 1))}${username[username.length - 1]}`;
}

function parseConnectionInfo(connectionString) {
    try {
        const url = new URL(connectionString);
        return {
            host: url.hostname || null,
            port: url.port ? Number(url.port) : 5432,
            database: url.pathname ? decodeURIComponent(url.pathname.replace(/^\//, '')) : null,
            username: maskUsername(decodeURIComponent(url.username || '')),
            ssl: url.searchParams.get('sslmode') === 'require' || url.searchParams.get('ssl') === 'true',
        };
    } catch (_err) {
        // Never let a malformed connection string 500 this page — just report that it
        // couldn't be parsed instead of leaking the raw string in an error message.
        return { host: null, port: null, database: null, username: null, ssl: false, parseError: true };
    }
}

router.get('/info', (_req, res) => {
    res.json({
        ok: true,
        system: {
            database: parseConnectionInfo(POSTGRES_URL),
            // pg.Pool tracks these counters itself — a live, zero-cost snapshot of
            // connection-pool health (no query needed).
            pool: {
                totalCount: pool.totalCount,
                idleCount: pool.idleCount,
                waitingCount: pool.waitingCount,
            },
            server: {
                nodeVersion: process.version,
                platform: `${os.platform()} ${os.arch()}`,
                environment: process.env.NODE_ENV || 'development',
                uptimeSeconds: Math.round(process.uptime()),
            },
        },
    });
});

// Runs a trivial real query against the live pool and times it — a genuine
// connectivity + latency check, not a canned "OK". Always resolves 200 (success or
// failure both come back as normal JSON) so the frontend can show a clear pass/fail
// without treating a DB hiccup as an unhandled 500.
router.post('/test-connection', async (req, res) => {
    const startedAt = Date.now();
    try {
        await pool.query('SELECT 1');
        const latencyMs = Date.now() - startedAt;
        await logAudit({
            userId: req.user.id,
            action: 'system.db_connection_tested',
            entityType: 'system',
            metadata: { ok: true, latencyMs },
            ip: clientIp(req),
        });
        res.json({ ok: true, latencyMs });
    } catch (err) {
        const latencyMs = Date.now() - startedAt;
        await logAudit({
            userId: req.user.id,
            action: 'system.db_connection_tested',
            entityType: 'system',
            metadata: { ok: false, latencyMs, error: err.message },
            ip: clientIp(req),
        });
        res.json({ ok: false, latencyMs, error: err.message });
    }
});

module.exports = router;
