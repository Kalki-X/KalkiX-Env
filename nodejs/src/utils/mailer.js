const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const MAIL_FROM = process.env.MAIL_FROM || 'GearShare <no-reply@gearshare.local>';

let transporter = null;
function getTransporter() {
    if (!SMTP_HOST) return null; // not configured
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_PORT === 465,
            auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
        });
    }
    return transporter;
}

/**
 * Sends an email if SMTP_HOST is configured; otherwise logs it to the console.
 * This keeps every email-dependent flow (forgot password, future notifications)
 * usable in local/dev without requiring real SMTP credentials up front.
 */
async function sendMail({ to, subject, text, html }) {
    const t = getTransporter();
    if (!t) {
        console.log('✉️  [dev mailer — SMTP not configured] Would send email:');
        console.log(`    To: ${to}\n    Subject: ${subject}\n    ${text}`);
        return { delivered: false, dev: true };
    }
    await t.sendMail({ from: MAIL_FROM, to, subject, text, html });
    return { delivered: true, dev: false };
}

module.exports = { sendMail };
