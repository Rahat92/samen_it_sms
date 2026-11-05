import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const TZ = "Asia/Dhaka";

// "2026-11-05 12:18:00" in Asia/Dhaka
const fmtDateTime = (v) => (v ? new Date(v).toLocaleString("sv-SE", { timeZone: TZ }) : "");

// Columns shared by CSV and PDF. `width` is the PDF column width in mm (landscape A4, 10mm margins).
const COLUMNS = [
  { header: "Time (Asia/Dhaka)", get: (r) => fmtDateTime(r.occurredAt), width: 30 },
  { header: "Event", get: (r) => r.event, width: 28 },
  { header: "Status", get: (r) => r.status, width: 20 },
  { header: "From", get: (r) => r.fromAddress, width: 46 },
  { header: "To", get: (r) => r.toAddress, width: 46 },
  { header: "Subject", get: (r) => r.subject, width: 50 },
  { header: "Dur. (s)", get: (r) => r.durationSec, width: 14 },
  { header: "Details", get: (r) => r.details, width: 43 },
];

function csvCell(value) {
  if (value == null) return "";
  if (typeof value === "number") return String(value);
  let s = String(value);
  // Stop spreadsheet apps from running cells that start like a formula (CSV injection)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsv(rows) {
  const lines = [COLUMNS.map((c) => csvCell(c.header)).join(",")];
  for (const r of rows) lines.push(COLUMNS.map((c) => csvCell(c.get(r))).join(","));
  // BOM so Excel opens it as UTF-8
  return "﻿" + lines.join("\r\n") + "\r\n";
}

// ---------- PDF ----------

const clip = (v, n) => {
  const s = v == null ? "" : String(v);
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
};

/**
 * @param rows   mail events
 * @param meta   { title, filters: string[], total, truncated }
 * @returns Buffer
 */
export function buildPdf(rows, meta = {}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(meta.title ?? "Mail Report", 10, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90);
  const generated = new Date().toLocaleString("sv-SE", { timeZone: TZ });
  doc.text(`Generated ${generated} (Asia/Dhaka)`, 10, 19);
  if (meta.filters?.length) doc.text(`Filters: ${meta.filters.join("  |  ")}`, 10, 23);

  // Status summary
  const byStatus = {};
  for (const r of rows) byStatus[r.status ?? "unknown"] = (byStatus[r.status ?? "unknown"] ?? 0) + 1;
  const summary =
    `Rows in report: ${rows.length}` +
    (meta.truncated ? ` of ${meta.total} (truncated)` : "") +
    (rows.length ? "   " + Object.entries(byStatus).map(([k, v]) => `${k}: ${v}`).join("   ") : "");
  doc.text(summary, 10, meta.filters?.length ? 27 : 23);
  doc.setTextColor(0);

  const body = rows.map((r) =>
    COLUMNS.map((c) => {
      const v = c.get(r);
      return c.header === "Details" || c.header === "Subject" ? clip(v, 140) : v ?? "";
    })
  );

  autoTable(doc, {
    startY: meta.filters?.length ? 30 : 26,
    head: [COLUMNS.map((c) => c.header)],
    body,
    margin: { left: 10, right: 10, bottom: 12 },
    styles: { font: "helvetica", fontSize: 7, cellPadding: 1.2, overflow: "linebreak", valign: "top" },
    headStyles: { fillColor: [31, 56, 100], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: Object.fromEntries(COLUMNS.map((c, i) => [i, { cellWidth: c.width }])),
    showHead: "everyPage",
    didDrawPage: () => {
      const page = doc.internal.getCurrentPageInfo().pageNumber;
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text(`Page ${page}`, pageW - 10, pageH - 5, { align: "right" });
      doc.setTextColor(0);
    },
  });

  if (!rows.length) {
    doc.setFontSize(10);
    doc.text("No events match these filters.", 10, 40);
  }

  return Buffer.from(doc.output("arraybuffer"));
}