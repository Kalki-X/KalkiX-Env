const { pool } = require('../db/pool');

// Every predefined email in the system, its display metadata for the admin UI, the
// placeholders it supports, and (for the ones tied to a booking) whether the system
// appends an action button after the admin-edited body. Keeping this list in one place
// means adding a new templated email later is: add a row here + a default in
// db/schema.sql's seed INSERT + call renderTemplate() at the send site — nothing else
// needs to change.
const TEMPLATE_METADATA = {
    password_reset: {
        label: 'Password reset',
        description: 'Sent when someone requests a password reset link.',
        placeholders: ['firstName'],
        hasActionButton: true,
        defaultButtonLabel: 'Reset password',
        // Kept in sync with the seed row in db/schema.sql — used by "reset to default".
        default: {
            subject: 'Reset your GearShare password',
            body: "Hi {{firstName}},\n\nWe received a request to reset your GearShare password. This link expires in 1 hour.\n\nIf you didn't request this, you can safely ignore this email.",
        },
        sampleVars: { firstName: 'Jamie' },
        sampleActionUrl: 'https://gearshare.example/reset-password?token=sample-token',
    },
    welcome: {
        label: 'Welcome email',
        description: 'Sent right after someone registers a new GearShare account.',
        placeholders: ['firstName', 'lastName'],
        hasActionButton: true,
        defaultButtonLabel: 'Go to GearShare',
        default: {
            subject: 'Welcome to GearShare, {{firstName}}!',
            body: "Hi {{firstName}},\n\nThanks for joining GearShare — you're all set to start renting gear from others or listing your own items for rent.\n\nIf you ever have questions, just reply to this email.",
        },
        sampleVars: { firstName: 'Jamie', lastName: 'Rivera' },
        sampleActionUrl: 'https://gearshare.example/',
    },
    staff_credentials: {
        label: 'Staff account credentials',
        description: 'Sent when Super Admin creates an Admin/Support/Finance account without setting a password directly — gives the new staff member a secure link to set their own.',
        placeholders: ['firstName', 'email', 'role'],
        hasActionButton: true,
        defaultButtonLabel: 'Set your password',
        default: {
            subject: 'Your GearShare staff account is ready',
            body: 'Hi {{firstName}},\n\nAn account has been created for you on GearShare as {{role}} ({{email}}).\n\nUse the link below to set your password and sign in. This link expires in 1 hour.',
        },
        sampleVars: { firstName: 'Jamie', email: 'jamie@example.com', role: 'support' },
        sampleActionUrl: 'https://gearshare.example/reset-password?token=sample-token',
    },
    booking_requested: {
        label: 'Booking request received',
        description: 'Sent to the lender when a renter requests a booking.',
        placeholders: ['renterName', 'itemTitle', 'startDate', 'endDate', 'currency', 'amount', 'noteLine'],
        hasActionButton: true,
        defaultButtonLabel: 'View & Decide',
        default: {
            subject: 'New booking request for "{{itemTitle}}"',
            body: '{{renterName}} requested to rent "{{itemTitle}}" from {{startDate}} to {{endDate}} ({{currency}} {{amount}}).\n\n{{noteLine}}Approve or reject this request from your GearShare dashboard.',
        },
        sampleVars: {
            renterName: 'Jamie Rivera',
            itemTitle: 'Cordless Drill',
            startDate: '2026-09-10',
            endDate: '2026-09-12',
            currency: 'USD',
            amount: '60.00',
            noteLine: 'Their note: "Need it for the weekend."\n\n',
        },
        sampleActionUrl: 'https://gearshare.example/lender/bookings/1',
    },
    booking_approved: {
        label: 'Booking approved',
        description: 'Sent to the renter when the lender approves their request.',
        placeholders: ['itemTitle', 'startDate', 'endDate', 'currency', 'amount', 'documentNumber'],
        hasActionButton: true,
        defaultButtonLabel: 'View & Pay',
        default: {
            subject: 'Your booking request for "{{itemTitle}}" was approved',
            body: 'Good news — the lender approved your request for "{{itemTitle}}" ({{startDate}} to {{endDate}}).\n\nA proforma invoice ({{documentNumber}}) for {{currency}} {{amount}} is ready.',
        },
        sampleVars: {
            itemTitle: 'Cordless Drill',
            startDate: '2026-09-10',
            endDate: '2026-09-12',
            currency: 'USD',
            amount: '60.00',
            documentNumber: 'PI-000001',
        },
        sampleActionUrl: 'https://gearshare.example/renter/bookings/1',
    },
    booking_rejected: {
        label: 'Booking rejected',
        description: 'Sent to the renter when the lender declines their request. Always includes the mandatory reason.',
        placeholders: ['itemTitle', 'startDate', 'endDate', 'reason'],
        hasActionButton: true,
        defaultButtonLabel: 'View Details',
        default: {
            subject: 'Your booking request for "{{itemTitle}}" was declined',
            body: 'The lender declined your request for "{{itemTitle}}" ({{startDate}} to {{endDate}}).\n\nReason: {{reason}}\n\nNo payment was taken and no documents were issued for this request.',
        },
        sampleVars: {
            itemTitle: 'Cordless Drill',
            startDate: '2026-09-10',
            endDate: '2026-09-12',
            reason: 'Item needs servicing that week.',
        },
        sampleActionUrl: 'https://gearshare.example/renter/bookings/1',
    },
    booking_cancelled: {
        label: 'Booking cancelled',
        description: 'Sent to whichever side did not initiate the cancellation.',
        placeholders: ['itemTitle', 'startDate', 'endDate', 'creditNoteLine'],
        hasActionButton: true,
        defaultButtonLabel: 'View Details',
        default: {
            subject: 'Booking for "{{itemTitle}}" was cancelled',
            body: 'The booking for "{{itemTitle}}" ({{startDate}} to {{endDate}}) was cancelled.\n\n{{creditNoteLine}}',
        },
        sampleVars: {
            itemTitle: 'Cordless Drill',
            startDate: '2026-09-10',
            endDate: '2026-09-12',
            creditNoteLine: 'A credit note (CN-000001) for USD 60.00 was issued.',
        },
        sampleActionUrl: 'https://gearshare.example/lender/bookings/1',
    },
};

const TEMPLATE_TYPES = Object.keys(TEMPLATE_METADATA);

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// {{token}} substitution — deliberately simple (no conditionals/loops) since these are
// short transactional emails, not a general templating language. Any token in the body
// that has no matching value is left as literal text rather than silently dropped, so a
// typo'd placeholder is obvious in a preview rather than vanishing.
function substitute(str, vars) {
    return str.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => (Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key] ?? '') : match));
}

function toPublicTemplate(row) {
    if (!row) return null;
    const meta = TEMPLATE_METADATA[row.type] || {};
    return {
        type: row.type,
        label: meta.label || row.type,
        description: meta.description || '',
        placeholders: meta.placeholders || [],
        subject: row.subject,
        body: row.body,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
        isDefault: !!meta.default && meta.default.subject === row.subject && meta.default.body === row.body,
    };
}

async function listTemplates() {
    const { rows } = await pool.query('SELECT * FROM email_templates ORDER BY type ASC');
    return rows.map(toPublicTemplate);
}

async function getTemplate(type) {
    if (!TEMPLATE_TYPES.includes(type)) return null;
    const { rows } = await pool.query('SELECT * FROM email_templates WHERE type = $1', [type]);
    return toPublicTemplate(rows[0]);
}

async function updateTemplate(type, { subject, body }, updatedById) {
    if (!TEMPLATE_TYPES.includes(type)) return null;
    const { rows } = await pool.query(
        `UPDATE email_templates SET subject = $1, body = $2, updated_by = $3, updated_at = now() WHERE type = $4 RETURNING *`,
        [subject, body, updatedById, type]
    );
    return toPublicTemplate(rows[0]);
}

async function resetTemplateToDefault(type, updatedById) {
    const meta = TEMPLATE_METADATA[type];
    if (!meta) return null;
    return updateTemplate(type, meta.default, updatedById);
}

// Renders a template with the given variables into a ready-to-send {subject, text, html}.
// `actionUrl` (if the type has a button) is appended by the system after the admin's own
// body text — the button/link is never something an admin edit can accidentally break or
// remove. `text`/`html` are both generated from the same rendered body so plain-text
// mail clients (and the dev-mode console logger) still get a usable link.
async function renderTemplate(type, vars = {}, { actionUrl } = {}) {
    const meta = TEMPLATE_METADATA[type];
    if (!meta) throw new Error(`Unknown email template type: ${type}`);

    const row = await getTemplate(type);
    if (!row) throw new Error(`Email template not found in database: ${type}`);

    const subject = substitute(row.subject, vars);
    const body = substitute(row.body, vars);

    const textParts = [body];
    if (actionUrl && meta.hasActionButton) {
        textParts.push('', `${meta.defaultButtonLabel}: ${actionUrl}`);
    }
    const text = textParts.join('\n');

    const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#2B2E4A; line-height:1.6; max-width:480px;">
            ${body
                .split('\n')
                .map((line) => (line ? `<p style="margin:4px 0; color:#334155;">${escapeHtml(line)}</p>` : '<br/>'))
                .join('')}
            ${
                actionUrl && meta.hasActionButton
                    ? `
            <p style="margin:24px 0;">
                <a href="${actionUrl}" style="background:#2B2E4A;color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">${escapeHtml(
                          meta.defaultButtonLabel
                      )}</a>
            </p>
            <p style="color:#94a3b8;font-size:12px;">Or paste this link into your browser: ${actionUrl}</p>
            `
                    : ''
            }
        </div>
    `;

    return { subject, text, html };
}

// Renders sample/dummy data through either the *saved* template or an in-progress
// (not-yet-saved) subject/body the admin is currently editing — powers the "Preview"
// button in the admin UI so they can see the result before committing a change.
async function previewTemplate(type, override = {}) {
    const meta = TEMPLATE_METADATA[type];
    if (!meta) throw new Error(`Unknown email template type: ${type}`);

    let subject = override.subject;
    let body = override.body;
    if (subject === undefined || body === undefined) {
        const saved = await getTemplate(type);
        if (!saved) throw new Error(`Email template not found in database: ${type}`);
        subject = subject ?? saved.subject;
        body = body ?? saved.body;
    }

    const rendered = substitute(subject, meta.sampleVars || {});
    const renderedBody = substitute(body, meta.sampleVars || {});
    const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#2B2E4A; line-height:1.6; max-width:480px;">
            ${renderedBody
                .split('\n')
                .map((line) => (line ? `<p style="margin:4px 0; color:#334155;">${escapeHtml(line)}</p>` : '<br/>'))
                .join('')}
            ${
                meta.hasActionButton
                    ? `
            <p style="margin:24px 0;">
                <a href="${meta.sampleActionUrl}" style="background:#2B2E4A;color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">${escapeHtml(
                          meta.defaultButtonLabel
                      )}</a>
            </p>
            <p style="color:#94a3b8;font-size:12px;">Or paste this link into your browser: ${meta.sampleActionUrl}</p>
            `
                    : ''
            }
        </div>
    `;

    return { subject: rendered, html };
}

module.exports = {
    TEMPLATE_TYPES,
    TEMPLATE_METADATA,
    listTemplates,
    getTemplate,
    updateTemplate,
    resetTemplateToDefault,
    renderTemplate,
    previewTemplate,
};
