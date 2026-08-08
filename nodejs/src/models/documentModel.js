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
        voided: row.voided,
        voidedAt: row.voided_at,
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

// `includeVoided` is only ever true for staff (Admin/Super Admin/Finance) — a renter or
// lender should never see a proforma invoice or invoice that was voided when their
// booking got cancelled after payment; they get the credit note instead (see
// voidDocumentsForBooking below).
async function listDocumentsForBooking(bookingId, { includeVoided = false } = {}) {
    const where = includeVoided ? 'booking_id = $1' : 'booking_id = $1 AND voided = false';
    const { rows } = await pool.query(
        `SELECT * FROM documents WHERE ${where} ORDER BY issued_at ASC`,
        [bookingId]
    );
    return rows.map(toPublicDocument);
}

// Marks every document of the given type(s) for a booking as voided — used when a paid
// booking is cancelled, so the now-invalid proforma invoice and invoice stop being
// downloadable/visible to the renter/lender (the credit note is their record instead)
// while staff retain full visibility via Document Lookup for audit/compliance purposes.
// Nothing is ever deleted.
async function voidDocumentsForBooking(bookingId, types) {
    const { rows } = await pool.query(
        `UPDATE documents SET voided = true, voided_at = now()
         WHERE booking_id = $1 AND type = ANY($2::text[]) AND voided = false
         RETURNING *`,
        [bookingId, types]
    );
    return rows.map(toPublicDocument);
}

// Single-document lookup by primary key — powers the PDF-download route, which already
// has a booking (and therefore a document id) in hand rather than a human-typed
// document number. Returns the same shape as everything else here (including `voided`),
// so callers must apply their own visibility rule for voided documents same as
// listDocumentsForBooking does.
async function findDocumentById(id) {
    const { rows } = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
    return toPublicDocument(rows[0]);
}

// Powers the Super Admin "look up any document by reference number" screen. Pulls in
// the booking, item, and renter so the result is self-contained — no follow-up calls.
async function findByDocumentNumberWithContext(documentNumber) {
    const { rows } = await pool.query(
        `SELECT
            d.*,
            b.id AS booking_id_full, b.start_date, b.end_date, b.status AS booking_status,
            b.total_amount AS booking_total_amount,
            i.id AS item_id, i.title AS item_title,
            renter.id AS renter_id, renter.first_name AS renter_first_name,
            renter.last_name AS renter_last_name, renter.email AS renter_email,
            owner.id AS owner_id, owner.first_name AS owner_first_name,
            owner.last_name AS owner_last_name, owner.email AS owner_email
         FROM documents d
         JOIN bookings b ON b.id = d.booking_id
         JOIN items i ON i.id = b.item_id
         JOIN users renter ON renter.id = b.renter_id
         JOIN users owner ON owner.id = i.owner_id
         WHERE UPPER(d.document_number) = UPPER($1)`,
        [documentNumber]
    );
    const row = rows[0];
    if (!row) return null;

    return {
        ...toPublicDocument(row),
        booking: {
            id: row.booking_id_full,
            startDate: row.start_date,
            endDate: row.end_date,
            status: row.booking_status,
            totalAmount: Number(row.booking_total_amount),
        },
        item: { id: row.item_id, title: row.item_title },
        renter: {
            id: row.renter_id,
            name: `${row.renter_first_name} ${row.renter_last_name}`,
            email: row.renter_email,
        },
        owner: {
            id: row.owner_id,
            name: `${row.owner_first_name} ${row.owner_last_name}`,
            email: row.owner_email,
        },
    };
}

module.exports = {
    createDocument,
    listDocumentsForBooking,
    voidDocumentsForBooking,
    findDocumentById,
    findByDocumentNumberWithContext,
    toPublicDocument,
};
