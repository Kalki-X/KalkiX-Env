// Shared export helpers for admin data tables. Every admin list page (users, audit
// trail, payments, errors, sales reports) needs the same three export formats applied
// to whatever filters are currently active, so the format-specific logic lives here
// once instead of being copy-pasted into every page.
//
// exceljs and jspdf are both sizeable libraries that most visits never touch (only
// admins who click "Export" need them), so they're dynamically imported inside the
// functions that use them rather than statically at the top of this file — that keeps
// them out of the main app bundle and in their own lazily-loaded chunk.

export interface ExportColumn<T> {
    header: string;
    // Returns the display value for this column for a given row. Keep these plain
    // strings/numbers — no JSX — since the same accessor feeds CSV, Excel, and PDF.
    accessor: (row: T) => string | number | null | undefined;
}

function cell(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return "";
    return String(value);
}

function timestampedFilename(base: string, ext: string): string {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    return `${base}-${stamp}.${ext}`;
}

function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function csvEscape(value: string): string {
    if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

export function exportToCsv<T>(baseName: string, columns: ExportColumn<T>[], rows: T[]) {
    const header = columns.map((c) => csvEscape(c.header)).join(",");
    const lines = rows.map((row) => columns.map((c) => csvEscape(cell(c.accessor(row)))).join(","));
    const csv = [header, ...lines].join("\r\n");
    // Leading BOM so Excel opens UTF-8 CSVs (names, currency symbols, etc.) correctly.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    triggerDownload(blob, timestampedFilename(baseName, "csv"));
}

export async function exportToExcel<T>(baseName: string, columns: ExportColumn<T>[], rows: T[]) {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Export");
    sheet.columns = columns.map((c) => ({ header: c.header, key: c.header, width: Math.max(14, c.header.length + 4) }));
    sheet.getRow(1).font = { bold: true };
    rows.forEach((row) => {
        sheet.addRow(columns.map((c) => cell(c.accessor(row))));
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    triggerDownload(blob, timestampedFilename(baseName, "xlsx"));
}

export async function exportToPdf<T>(baseName: string, title: string, columns: ExportColumn<T>[], rows: T[]) {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const doc = new jsPDF({ orientation: columns.length > 5 ? "landscape" : "portrait" });
    doc.setFontSize(14);
    doc.text(title, 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Exported ${new Date().toLocaleString()} — ${rows.length} record(s)`, 14, 21);

    autoTable(doc, {
        startY: 26,
        head: [columns.map((c) => c.header)],
        body: rows.map((row) => columns.map((c) => cell(c.accessor(row)))),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [43, 46, 74] }, // matches the app's #2B2E4A heading color
    });

    doc.save(timestampedFilename(baseName, "pdf"));
}

export type ExportFormat = "csv" | "excel" | "pdf";

export async function runExport<T>(
    format: ExportFormat,
    baseName: string,
    title: string,
    columns: ExportColumn<T>[],
    rows: T[]
) {
    if (format === "csv") return exportToCsv(baseName, columns, rows);
    if (format === "excel") return exportToExcel(baseName, columns, rows);
    return exportToPdf(baseName, title, columns, rows);
}
