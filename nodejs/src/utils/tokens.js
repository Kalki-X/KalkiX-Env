const crypto = require('crypto');

/**
 * Generates a high-entropy token for one-time links (password reset, etc.).
 * The raw token goes out in the email/link; only its hash is ever persisted,
 * so a database leak alone can't be used to reset anyone's password.
 */
function generateOneTimeToken() {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    return { token, tokenHash };
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { generateOneTimeToken, hashToken };
