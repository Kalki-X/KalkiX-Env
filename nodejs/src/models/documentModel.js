const { pool } = require('../db/pool');

const PREFIX = {
    proforma_invoice: 'PI',
    invoice: 'INV',
    credit_note: 'CN',
};

function toPublicDocument(row) {
    if (!row) return null;
    return {
        id: row.id,
        bookingId: row.booking_id,
        type: row.type,
        documentNumber: row.document_number,
        amount: Number(row.amount),
        currency: row.currency,
        payload: row.payload,
        issuedAt: row.issued_at,
    };
}

/**
 * Creates a proforma invoice, invoice, or credit note tied to a booking.
 * Numbering uses one shared Postgres sequence so numbers are always unique and gapless-ish.
 * `payload` is a JSON snapshot (line items, party details) — this is a Phase 1 placeholder;
 * rendering these to an actual PDF is follow-up work.
 */
async function createDocument({ bookingId, type, amount, currency = 'USD', payload = {} }) {
    if (!PREFIX[type]) throw new Error(`Unknown document type: ${type}`);

    const { rows: seqRows } = await pool.query("SELECT nextval('document_number_seq') AS n");
    const documentNumber = `${PREFIX[type]}-${String(seqRows[0].n).padStart(6, '0')}`;

    const { rows } = await pool.query(
        `INSERT INTO documents (booking_id, type, document_number, amount, currency, payload)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [bookingId, type, documentNumber, amount, currency, payload]
    );
    return toPublicDocument(rows[0]);
}

async function listDocumentsForBooking(bookingId) {
    const { rows } = await pool.query(
        'SELECT * FROM documents WHERE booking_id = $1 ORDER BY issued_at ASC',
        [bookingId]
    );
    return rows.map(toPublicDocument);
}

module.exports = { createDocument, listDocumentsForBooking, toPublicDocument };
