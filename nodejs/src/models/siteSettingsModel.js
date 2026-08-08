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
        // GearShare's own company/registration details (Phase 11) — shown on the
        // right-hand "issued by" block of every generated PDF document, plus its
        // footer. All nullable except companyLegalName (defaults to 'GearShare').
        companyLegalName: row.company_legal_name,
        companyAddressLine1: row.company_address_line1,
        companyAddressLine2: row.company_address_line2,
        companyCity: row.company_city,
        companyState: row.company_state,
        companyPostalCode: row.company_postal_code,
        companyCountry: row.company_country,
        companyVatNumber: row.company_vat_number,
        companyEmail: row.company_email,
        companyPhone: row.company_phone,
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

// Column-name lookup for the company/invoice fields — kept as a plain map (rather than
// hand-rolling each `if` block like the pre-Phase-11 fields below) purely to avoid ~10
// near-identical if-blocks; behavior is identical (only ever sets a column when the
// caller's payload actually includes that key).
const COMPANY_FIELD_COLUMNS = {
    companyLegalName: 'company_legal_name',
    companyAddressLine1: 'company_address_line1',
    companyAddressLine2: 'company_address_line2',
    companyCity: 'company_city',
    companyState: 'company_state',
    companyPostalCode: 'company_postal_code',
    companyCountry: 'company_country',
    companyVatNumber: 'company_vat_number',
    companyEmail: 'company_email',
    companyPhone: 'company_phone',
};

async function updateSettings(
    { platformFeePercent, featuredListingPricePerDay, featuredListingCurrency, ...companyFields },
    updatedById
) {
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
    for (const [field, column] of Object.entries(COMPANY_FIELD_COLUMNS)) {
        if (companyFields[field] !== undefined) {
            params.push(companyFields[field] || null);
            sets.push(`${column} = $${params.length}`);
        }
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
