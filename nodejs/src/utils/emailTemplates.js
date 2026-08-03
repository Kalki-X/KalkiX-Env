// Shared HTML+text template for booking-lifecycle notification emails. Every one of
// these is "here's what happened, here's a button straight to the page where you act on
// it" — a plain-text-only email with no link was the exact "too plain" complaint this
// replaces. Text and HTML are both generated together so mail clients that only render
// text (or the dev-mode console logger, which only ever prints `text`) still get a
// usable link.
function bookingActionEmail({ intro, lines = [], buttonUrl, buttonLabel }) {
    const textParts = [intro, ...lines];
    if (buttonUrl) {
        textParts.push('', `${buttonLabel || 'View'}: ${buttonUrl}`);
    }
    const text = textParts.join('\n');

    const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#2B2E4A; line-height:1.6; max-width:480px;">
            <p style="margin:0 0 12px;">${escapeHtml(intro)}</p>
            ${lines.map((l) => `<p style="margin:4px 0; color:#334155;">${escapeHtml(l)}</p>`).join('')}
            ${
                buttonUrl
                    ? `
            <p style="margin:24px 0;">
                <a href="${buttonUrl}" style="background:#2B2E4A;color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">${escapeHtml(
                          buttonLabel || 'View'
                      )}</a>
            </p>
            <p style="color:#94a3b8;font-size:12px;">Or paste this link into your browser: ${buttonUrl}</p>
            `
                    : ''
            }
        </div>
    `;

    return { text, html };
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = { bookingActionEmail };
