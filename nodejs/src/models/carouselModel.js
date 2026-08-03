const { pool } = require('../db/pool');

function toPublicSlide(row) {
    if (!row) return null;
    return {
        id: row.id,
        headline: row.headline,
        subtext: row.subtext,
        linkUrl: row.link_url,
        sortOrder: row.sort_order,
        active: row.active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

async function listSlides({ activeOnly = false } = {}) {
    const where = activeOnly ? 'WHERE active = true' : '';
    const { rows } = await pool.query(`SELECT * FROM carousel_slides ${where} ORDER BY sort_order ASC, id ASC`);
    return rows.map(toPublicSlide);
}

async function findSlideById(id) {
    const { rows } = await pool.query('SELECT * FROM carousel_slides WHERE id = $1', [id]);
    return rows[0] || null;
}

async function createSlide({ headline, subtext, linkUrl, sortOrder, mimeType, data }, updatedById) {
    const { rows } = await pool.query(
        `INSERT INTO carousel_slides (image_mime_type, image_data, headline, subtext, link_url, sort_order, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [mimeType, data, headline || null, subtext || null, linkUrl || null, sortOrder ?? 0, updatedById]
    );
    return toPublicSlide(rows[0]);
}

async function updateSlide(id, { headline, subtext, linkUrl, sortOrder, active }, updatedById) {
    const sets = [];
    const params = [];
    if (headline !== undefined) {
        params.push(headline);
        sets.push(`headline = $${params.length}`);
    }
    if (subtext !== undefined) {
        params.push(subtext);
        sets.push(`subtext = $${params.length}`);
    }
    if (linkUrl !== undefined) {
        params.push(linkUrl);
        sets.push(`link_url = $${params.length}`);
    }
    if (sortOrder !== undefined) {
        params.push(sortOrder);
        sets.push(`sort_order = $${params.length}`);
    }
    if (active !== undefined) {
        params.push(active);
        sets.push(`active = $${params.length}`);
    }
    if (sets.length === 0) return toPublicSlide(await findSlideById(id));

    params.push(updatedById);
    sets.push(`updated_by = $${params.length}`);
    sets.push('updated_at = now()');
    params.push(id);
    const { rows } = await pool.query(`UPDATE carousel_slides SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    return toPublicSlide(rows[0]);
}

async function replaceSlideImage(id, { mimeType, data }, updatedById) {
    const { rows } = await pool.query(
        `UPDATE carousel_slides SET image_mime_type = $1, image_data = $2, updated_by = $3, updated_at = now() WHERE id = $4 RETURNING *`,
        [mimeType, data, updatedById, id]
    );
    return toPublicSlide(rows[0]);
}

// Includes the raw bytea — only for the byte-serving route.
async function getSlideImageWithData(id) {
    const { rows } = await pool.query('SELECT image_mime_type, image_data FROM carousel_slides WHERE id = $1', [id]);
    const row = rows[0];
    if (!row) return null;
    return { mimeType: row.image_mime_type, data: row.image_data };
}

async function deleteSlide(id) {
    const { rowCount } = await pool.query('DELETE FROM carousel_slides WHERE id = $1', [id]);
    return rowCount > 0;
}

module.exports = {
    toPublicSlide,
    listSlides,
    findSlideById,
    createSlide,
    updateSlide,
    replaceSlideImage,
    getSlideImageWithData,
    deleteSlide,
};
