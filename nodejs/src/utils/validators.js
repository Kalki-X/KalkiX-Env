// Shared, dependency-free input validation. Kept centralized so every route
// (self-registration, admin-provisioned accounts, etc.) enforces the same rules.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function isValidEmail(email) {
    return typeof email === 'string' && EMAIL_RE.test(email);
}

function isValidPassword(password) {
    return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH;
}

module.exports = { isValidEmail, isValidPassword, MIN_PASSWORD_LENGTH };
