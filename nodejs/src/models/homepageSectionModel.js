const { pool } = require('../db/pool');

// Freeform homepage content sections (Phase 12) — each is a title + optional body text
// + optional image OR external video embed URL, rendered on the public homepage below
// the existing curated areas, in sort_order. Mirrors carouselModel.js's shape closely
// (same admin-manageable-list pattern), with `hasImage` (not raw bytes) exposed here —
// the image itself is served separately via a dedicated streaming route, same as every
// other image in this app.

function toPublicSection(row) {
    if (!row) return null;
    return {
        id: row.id,
        title: row.title,
        body: row.body,
        hasImage: !!row.image_data,
        videoUrl: row.video_url,
        sortOrder: row.sort_order,
        active: row.active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

async function listSections({ activeOnly = false } = {}) {
    const where = activeOnly ? 'WHERE active = true' : '';
    const { rows } = await pool.query(`SELECT * FROM homepage_sections ${where} ORDER BY sort_order ASC, id ASC`);
    return rows.map(toPublicSection);
}

async function findSectionById(id) {
    const { rows } = await pool.query('SELECT * FROM homepage_sections WHERE id = $1', [id]);
    return rows[0] || null;
}

async function createSection({ title, body, videoUrl, sortOrder }, updatedById) {
    const { rows } = await pool.query(
        `INSERT INTO homepage_sections (title, body, video_url, sort_order, updated_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [title, body || null, videoUrl || null, sortOrder ?? 0, updatedById]
    );
    return toPublicSection(rows[0]);
}

async function updateSection(id, { title, body, videoUrl, sortOrder, active }, updatedById) {
    const sets = [];
    const params = [];
    if (title !== undefined) {
        params.push(title);
        sets.push(`title = $${params.length}`);
    }
    if (body !== undefined) {
        params.push(body || null);
        sets.push(`body = $${params.length}`);
    }
    if (videoUrl !== undefined) {
        params.push(videoUrl || null);
        sets.push(`video_url = $${params.length}`);
    }
    if (sortOrder !== undefined) {
        params.push(sortOrder);
        sets.push(`sort_order = $${params.length}`);
    }
    if (active !== undefined) {
        params.push(active);
        sets.push(`active = $${params.length}`);
    }
    if (sets.length === 0) return toPublicSection(await findSectionById(id));

    params.push(updatedById);
    sets.push(`updated_by = $${params.length}`);
    sets.push('updated_at = now()');
    params.push(id);
    const { rows } = await pool.query(`UPDATE homepage_sections SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    return toPublicSection(rows[0]);
}

async function setSectionImage(id, { mimeType, data }, updatedById) {
    const { rows } = await pool.query(
        `UPDATE homepage_sections SET image_mime_type = $1, image_data = $2, updated_by = $3, updated_at = now() WHERE id = $4 RETURNING *`,
        [mimeType, data, updatedById, id]
    );
    return toPublicSection(rows[0]);
}

async function clearSectionImage(id, updatedById) {
    const { rows } = await pool.query(
        `UPDATE homepage_sections SET image_mime_type = NULL, image_data = NULL, updated_by = $1, updated_at = now() WHERE id = $2 RETURNING *`,
        [updatedById, id]
    );
    return toPublicSection(rows[0]);
}

// Includes the raw bytea — only for the byte-serving route, never for the JSON API.
async function getSectionImageWithData(id) {
    const { rows } = await pool.query('SELECT image_mime_type, image_data FROM homepage_sections WHERE id = $1', [id]);
    const row = rows[0];
    if (!row || !row.image_data) return null;
    return { mimeType: row.image_mime_type, data: row.image_data };
}

async function deleteSection(id) {
    const { rowCount } = await pool.query('DELETE FROM homepage_sections WHERE id = $1', [id]);
    return rowCount > 0;
}

module.exports = {
    toPublicSection,
    listSections,
    findSectionById,
    createSection,
    updateSection,
    setSectionImage,
    clearSectionImage,
    getSectionImageWithData,
    deleteSection,
};
