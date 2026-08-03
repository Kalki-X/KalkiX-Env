const { pool } = require('../db/pool');

// Singleton row (id pinned to 1) holding sitewide, admin-configurable settings: the
// site logo image, the platform commission percent, and the price of a "featured
// listing" slot. schema.sql inserts this row on migration, but ensureRow() is kept as
// a defensive no-op in case a very old DB somehow doesn't have it yet.
async function ensureRow() {
    await pool.query('INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
}

function toPublicSettings(row) {
    if (!row) return null;
    return {
        hasLogo: !!row.logo_data,
        platformFeePercent: Number(row.platform_fee_percent),
        featuredListingPricePerDay: Number(row.featured_listing_price_per_day),
        featuredListingCurrency: row.featured_listing_currency,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
    };
}

async function getRawSettings() {
    await ensureRow();
    const { rows } = await pool.query('SELECT * FROM site_settings WHERE id = 1');
    return rows[0];
}

// Public/admin-facing shape (no image bytes — those are served separately by the
// dedicated logo-bytes route).
async function getSettings() {
    return toPublicSettings(await getRawSettings());
}

async function updateSettings({ platformFeePercent, featuredListingPricePerDay, featuredListingCurrency }, updatedById) {
    await ensureRow();
    const sets = [];
    const params = [];
    if (platformFeePercent !== undefined) {
        params.push(platformFeePercent);
        sets.push(`platform_fee_percent = $${params.length}`);
    }
    if (featuredListingPricePerDay !== undefined) {
        params.push(featuredListingPricePerDay);
        sets.push(`featured_listing_price_per_day = $${params.length}`);
    }
    if (featuredListingCurrency !== undefined) {
        params.push(featuredListingCurrency);
        sets.push(`featured_listing_currency = $${params.length}`);
    }
    if (sets.length === 0) return getSettings();

    params.push(updatedById);
    sets.push(`updated_by = $${params.length}`);
    sets.push('updated_at = now()');
    await pool.query(`UPDATE site_settings SET ${sets.join(', ')} WHERE id = 1`, params);
    return getSettings();
}

async function setLogo({ mimeType, data }, updatedById) {
    await ensureRow();
    await pool.query(
        `UPDATE site_settings SET logo_mime_type = $1, logo_data = $2, updated_by = $3, updated_at = now() WHERE id = 1`,
        [mimeType, data, updatedById]
    );
    return getSettings();
}

async function clearLogo(updatedById) {
    await ensureRow();
    await pool.query(
        `UPDATE site_settings SET logo_mime_type = NULL, logo_data = NULL, updated_by = $1, updated_at = now() WHERE id = 1`,
        [updatedById]
    );
    return getSettings();
}

// Includes the raw bytea — only for the byte-serving route, never for the settings API.
async function getLogoWithData() {
    await ensureRow();
    const { rows } = await pool.query('SELECT logo_mime_type, logo_data FROM site_settings WHERE id = 1');
    const row = rows[0];
    if (!row || !row.logo_data) return null;
    return { mimeType: row.logo_mime_type, data: row.logo_data };
}

module.exports = {
    getSettings,
    getRawSettings,
    updateSettings,
    setLogo,
    clearLogo,
    getLogoWithData,
};
