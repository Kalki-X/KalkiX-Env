const nodemailer = require('nodemailer');
const { logAudit } = require('./audit');

// Read fresh from process.env on every call rather than caching at module-load time —
// createTransport() is cheap (it doesn't open a connection, just builds a config
// object), and reading live means this also works correctly for tests that toggle
// SMTP_HOST after this module has already been required.
function getTransporter() {
    const host = process.env.SMTP_HOST;
    if (!host) return null; // not configured
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const password = process.env.SMTP_PASSWORD;
    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: user ? { user, pass: password } : undefined,
    });
}

/**
 * Sends an email if SMTP_HOST is configured; otherwise logs it to the console.
 * This keeps every email-dependent flow (forgot password, booking notifications, etc.)
 * usable in local/dev without requiring real SMTP credentials up front.
 *
 * Every call — success or failure — writes an `email.sent`/`email.failed` row to the
 * audit trail. This is deliberately built into sendMail itself rather than left to each
 * call site to remember: if outbound mail gets stuck (bad SMTP creds, provider outage,
 * whatever), that's exactly the kind of silent, process-blocking failure an admin needs
 * to be able to see in the audit log — not something that only shows up as a missing
 * email the recipient never mentions. `auditContext` is optional so existing callers
 * that don't pass one still get a (less detailed) audit row rather than none at all.
 */
async function sendMail({ to, subject, text, html, auditContext = {} }) {
    const { userId = null, entityType = 'email', entityId = null, ip = null } = auditContext;
    const t = getTransporter();

    try {
        let result;
        if (!t) {
            console.log('✉️  [dev mailer — SMTP not configured] Would send email:');
            console.log(`    To: ${to}\n    Subject: ${subject}\n    ${text}`);
            result = { delivered: false, dev: true };
        } else {
            const mailFrom = process.env.MAIL_FROM || 'GearShare <no-reply@gearshare.local>';
            await t.sendMail({ from: mailFrom, to, subject, text, html });
            result = { delivered: true, dev: false };
        }

        await logAudit({
            userId,
            action: 'email.sent',
            entityType,
            entityId,
            metadata: { to, subject, delivered: result.delivered, dev: result.dev },
            ip,
        });
        return result;
    } catch (err) {
        await logAudit({
            userId,
            action: 'email.failed',
            entityType,
            entityId,
            metadata: { to, subject, error: err.message },
            ip,
        });
        throw err;
    }
}

module.exports = { sendMail };
