const PDFDocument = require('pdfkit');

// Renders a proforma invoice / invoice / credit note to a proper, accounting-standard
// PDF using pdfkit — a pure-JS PDF generator (no native binary, no headless-browser
// dependency), matching the same "no native deps in Docker" precedent set by
// utils/imageDimensions.js. Standard PDF fonts (Helvetica/Helvetica-Bold) are built
// into pdfkit itself, so nothing extra needs to ship in the image.
//
// Layout, per the product brief: company logo centered at the top, lender ("From")
// details automatically on the left, GearShare's own company/registration details on
// the right, a "Bill To" block for the renter, a line-items/totals section, and a
// footer repeated on every page carrying GearShare's company details including its
// email address.

const DOCUMENT_TITLES = {
    proforma_invoice: 'PROFORMA INVOICE',
    invoice: 'INVOICE',
    credit_note: 'CREDIT NOTE',
};

const PAGE_MARGIN = 50;
const FOOTER_HEIGHT = 46; // reserved space at the bottom of every page

function daysBetween(startDate, endDate) {
    const ms = new Date(endDate) - new Date(startDate);
    return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1); // inclusive of both dates
}

function formatMoney(amount, currency) {
    return `${currency} ${Number(amount).toFixed(2)}`;
}

function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Builds a person/company's address as a small array of display lines, silently
// skipping any part that's blank — a lender who's only filled in a city, or a company
// with no VAT number yet, just gets a shorter block rather than an empty/awkward line.
function addressLines({ addressLine1, addressLine2, city, state, postalCode, country } = {}) {
    const lines = [];
    if (addressLine1) lines.push(addressLine1);
    if (addressLine2) lines.push(addressLine2);
    const cityStatePostal = [city, state, postalCode].filter(Boolean).join(', ');
    if (cityStatePostal) lines.push(cityStatePostal);
    if (country) lines.push(country);
    return lines;
}

function fullName(person) {
    if (!person) return '—';
    if (person.name) return person.name;
    return [person.firstName, person.lastName].filter(Boolean).join(' ') || '—';
}

// Draws the repeating footer at the bottom of whatever the current page is, then
// resets the text cursor back to the top margin so it doesn't interfere with the main
// content flow. Registered against pdfkit's 'pageAdded' event (for every page after the
// first) and also called once manually right after construction (for the first page,
// which already exists before any content is drawn and never fires 'pageAdded' itself).
function drawFooter(doc, footerText) {
    const bottom = doc.page.height - doc.page.margins.bottom;
    doc.save();
    doc
        .moveTo(doc.page.margins.left, bottom - FOOTER_HEIGHT + 10)
        .lineTo(doc.page.width - doc.page.margins.right, bottom - FOOTER_HEIGHT + 10)
        .lineWidth(0.5)
        .strokeColor('#cbd5e1')
        .stroke();
    doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor('#64748b')
        .text(footerText, doc.page.margins.left, bottom - FOOTER_HEIGHT + 16, {
            width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
            align: 'center',
        });
    doc.restore();
    // pdfkit doesn't auto-restore the text cursor position — put it back at the top
    // margin so whatever content is drawn next (on this or the following page) starts
    // in the right place instead of continuing from the footer's low y-coordinate.
    doc.x = doc.page.margins.left;
    doc.y = doc.page.margins.top;
    doc.fillColor('#1e293b');
}

function drawTwoColumnBlock(doc, { leftTitle, leftLines, rightTitle, rightLines }) {
    const columnWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right - 20) / 2;
    const startY = doc.y;
    const leftX = doc.page.margins.left;
    const rightX = doc.page.margins.left + columnWidth + 20;

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#5D79BB').text(leftTitle, leftX, startY, { width: columnWidth });
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#5D79BB').text(rightTitle, rightX, startY, { width: columnWidth });

    const afterTitlesY = doc.y;
    doc.font('Helvetica').fontSize(9.5).fillColor('#1e293b').text(leftLines.join('\n') || '—', leftX, afterTitlesY, { width: columnWidth });
    const leftEndY = doc.y;
    doc.font('Helvetica').fontSize(9.5).fillColor('#1e293b').text(rightLines.join('\n') || '—', rightX, afterTitlesY, { width: columnWidth });
    const rightEndY = doc.y;

    doc.y = Math.max(leftEndY, rightEndY);
}

/**
 * Builds a single-page(-or-more) PDF for a proforma invoice, invoice, or credit note.
 * Returns a Promise<Buffer>.
 *
 * @param {object} params
 * @param {object} params.document   - toPublicDocument() shape: type, documentNumber, amount, currency, issuedAt, payload, voided
 * @param {object} params.booking    - { id, startDate, endDate }
 * @param {object} params.item       - { title }
 * @param {object} params.lender     - toPublicUser() shape (the item's owner)
 * @param {object} params.renter     - toPublicUser() shape (who's paying)
 * @param {object} params.company    - toPublicSettings() shape (GearShare's own details)
 * @param {{mimeType: string, data: Buffer} | null} params.logo - site logo bytes, if any
 */
function buildDocumentPdf({ document, booking, item, lender, renter, company, logo }) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN + FOOTER_HEIGHT, left: PAGE_MARGIN, right: PAGE_MARGIN },
                info: { Title: `${document.documentNumber} - GearShare`, Author: company.companyLegalName || 'GearShare' },
            });

            const chunks = [];
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const footerText = [
                company.companyLegalName,
                addressLines(companyAddressFields(company)).join(', '),
                company.companyVatNumber ? `VAT: ${company.companyVatNumber}` : null,
                company.companyEmail,
                company.companyPhone,
            ]
                .filter(Boolean)
                .join('  ·  ');

            // The first page already exists at construction time (pdfkit always starts
            // with one) and never fires 'pageAdded', so it needs its footer drawn
            // explicitly; every subsequent page (if content overflows) is covered by
            // the listener.
            doc.on('pageAdded', () => drawFooter(doc, footerText));
            drawFooter(doc, footerText);

            // ---------- Header: logo (or wordmark fallback) + document title ----------
            const pageContentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
            if (logo && logo.data) {
                try {
                    // Site logos are always uploaded pre-validated at exactly 512x512
                    // (see IMAGE_SPECS.logo) — a fixed square draw size is safe here.
                    const logoSize = 80;
                    doc.image(logo.data, doc.page.margins.left + (pageContentWidth - logoSize) / 2, doc.y, {
                        width: logoSize,
                        height: logoSize,
                    });
                    doc.y += logoSize + 12;
                } catch (_err) {
                    // A corrupt/unsupported image should never take the whole PDF down —
                    // fall back to the text wordmark instead.
                    doc.font('Helvetica-Bold').fontSize(22).fillColor('#2B2E4A').text('GearShare', { align: 'center' });
                }
            } else {
                doc.font('Helvetica-Bold').fontSize(22).fillColor('#2B2E4A').text('GearShare', { align: 'center' });
            }

            doc.moveDown(0.3);
            doc.font('Helvetica-Bold').fontSize(15).fillColor('#1e293b').text(DOCUMENT_TITLES[document.type] || document.type, { align: 'center' });
            doc.font('Helvetica').fontSize(9.5).fillColor('#64748b').text(
                `${document.documentNumber}   ·   Issued ${formatDate(document.issuedAt)}`,
                { align: 'center' }
            );

            if (document.voided) {
                doc.moveDown(0.4);
                doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#dc2626').text(
                    'VOIDED — superseded by a credit note; no longer a valid record for payment or refund purposes.',
                    { align: 'center' }
                );
            }

            doc.moveDown(1.2);
            doc.fillColor('#1e293b');

            // ---------- From (lender) / Issued by (GearShare) ----------
            drawTwoColumnBlock(doc, {
                leftTitle: 'FROM (LENDER)',
                leftLines: [fullName(lender), ...addressLines(lender), lender?.email, lender?.phone].filter(Boolean),
                rightTitle: 'ISSUED BY',
                rightLines: [
                    company.companyLegalName,
                    ...addressLines(companyAddressFields(company)),
                    company.companyVatNumber ? `VAT/Tax No: ${company.companyVatNumber}` : null,
                    company.companyEmail,
                    company.companyPhone,
                ].filter(Boolean),
            });

            doc.moveDown(1);

            // ---------- Bill to (renter) ----------
            doc.font('Helvetica-Bold').fontSize(9).fillColor('#5D79BB').text('BILL TO');
            doc.font('Helvetica').fontSize(9.5).fillColor('#1e293b').text(
                [fullName(renter), renter?.email, renter?.phone].filter(Boolean).join('\n')
            );

            doc.moveDown(1);
            doc
                .moveTo(doc.page.margins.left, doc.y)
                .lineTo(doc.page.width - doc.page.margins.right, doc.y)
                .strokeColor('#cbd5e1')
                .lineWidth(0.5)
                .stroke();
            doc.moveDown(0.8);

            // ---------- Booking reference ----------
            doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(
                `Booking #${booking.id}   ·   ${formatDate(booking.startDate)} to ${formatDate(booking.endDate)}`
            );
            doc.moveDown(0.8);

            // ---------- Line items table ----------
            const tableX = doc.page.margins.left;
            const tableWidth = pageContentWidth;
            const amountColWidth = 110;
            const descColWidth = tableWidth - amountColWidth;

            const drawTableHeader = () => {
                const y = doc.y;
                doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
                doc.rect(tableX, y, tableWidth, 20).fill('#2B2E4A');
                doc.fillColor('#ffffff').text('Description', tableX + 8, y + 6, { width: descColWidth - 16 });
                doc.text('Amount', tableX + descColWidth, y + 6, { width: amountColWidth - 8, align: 'right' });
                doc.y = y + 20;
                doc.fillColor('#1e293b');
            };
            drawTableHeader();

            const days = daysBetween(booking.startDate, booking.endDate);
            let rows;
            if (document.type === 'credit_note') {
                const payload = document.payload || {};
                const descLines = [`Credit for cancelled booking of "${item.title}"`];
                if (payload.reason) descLines.push(`Reason: ${payload.reason}`);
                rows = [{ description: descLines.join('\n'), amount: document.amount }];
            } else {
                rows = [
                    {
                        description: `${item.title} — rental (${days} day${days === 1 ? '' : 's'}, ${formatDate(booking.startDate)} to ${formatDate(booking.endDate)})`,
                        amount: document.amount,
                    },
                ];
            }

            doc.font('Helvetica').fontSize(9.5);
            for (const row of rows) {
                const rowY = doc.y + 8;
                const descHeight = doc.heightOfString(row.description, { width: descColWidth - 16 });
                doc.text(row.description, tableX + 8, rowY, { width: descColWidth - 16 });
                doc.text(formatMoney(row.amount, document.currency), tableX + descColWidth, rowY, {
                    width: amountColWidth - 8,
                    align: 'right',
                });
                doc.y = rowY + descHeight + 8;
                doc
                    .moveTo(tableX, doc.y)
                    .lineTo(tableX + tableWidth, doc.y)
                    .strokeColor('#e2e8f0')
                    .lineWidth(0.5)
                    .stroke();
                doc.moveDown(0.3);
            }

            // Credit-note-specific breakdown (original amount / refund % / fee %), if present.
            if (document.type === 'credit_note') {
                const payload = document.payload || {};
                doc.moveDown(0.3);
                doc.font('Helvetica').fontSize(8.5).fillColor('#64748b');
                if (payload.originalAmount !== undefined) {
                    doc.text(`Original invoice amount: ${formatMoney(payload.originalAmount, document.currency)}`);
                }
                if (payload.refundPercent !== undefined) {
                    doc.text(`Refund percentage applied: ${payload.refundPercent}%`);
                }
                if (payload.cancellationFeePercent) {
                    doc.text(
                        `Cancellation fee: ${payload.cancellationFeePercent}%${
                            payload.cancellationFeeAmount !== undefined
                                ? ` (${formatMoney(payload.cancellationFeeAmount, document.currency)})`
                                : ''
                        }`
                    );
                }
                doc.fillColor('#1e293b');
                doc.moveDown(0.5);
            }

            // ---------- Total ----------
            doc.moveDown(0.4);
            const totalLabel = document.type === 'credit_note' ? 'Credit amount' : 'Total';
            doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e293b').text(
                `${totalLabel}:  ${formatMoney(document.amount, document.currency)}`,
                tableX,
                doc.y,
                { width: tableWidth, align: 'right' }
            );

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

// Small adapter so the two-column/footer helpers above can consume the flat
// `company*` fields returned by siteSettingsModel.toPublicSettings() through the same
// addressLines() helper used for a plain user record.
function companyAddressFields(company) {
    return {
        addressLine1: company.companyAddressLine1,
        addressLine2: company.companyAddressLine2,
        city: company.companyCity,
        state: company.companyState,
        postalCode: company.companyPostalCode,
        country: company.companyCountry,
    };
}

module.exports = { buildDocumentPdf };
