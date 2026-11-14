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

// ---------- CSV ----------

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

// ---------- PDF (statistics only) ----------

// Same order and labels as the dashboard. Anything else is grouped under "Other".
const STATUS_ROWS = [
  { key: "Sent", label: "Sent", color: [22, 163, 74] },
  { key: "SoftFail", label: "Soft fail", color: [217, 119, 6] },
  { key: "HardFail", label: "Hard fail", color: [220, 38, 38] },
  { key: "Held", label: "Held", color: [107, 114, 128] },
];

const pct = (n, d) => (d > 0 ? ((n / d) * 100).toFixed(1) : "0.0") + "%";

/**
 * The PDF contains the statistics only (no event rows; use the CSV for those).
 * `rows` are the report's messages (getEvents already gives one row per message with its final
 * status), so these counts match the dashboard's cards.
 * @param rows   messages from getEvents
 * @param meta   { title, filters: string[], total, truncated }
 * @returns Buffer
 */
export function buildPdf(rows, meta = {}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 15;

  // ---- numbers ----
  const counts = {};
  for (const r of rows) counts[r.status ?? "unknown"] = (counts[r.status ?? "unknown"] ?? 0) + 1;
  const total = rows.length;
  const known = STATUS_ROWS.reduce((a, s) => a + (counts[s.key] ?? 0), 0);
  const lines = STATUS_ROWS.map((s) => ({ ...s, n: counts[s.key] ?? 0 }));
  if (total - known > 0) lines.push({ key: "other", label: "Other", color: [156, 163, 175], n: total - known });
  const sent = counts.Sent ?? 0;

  // ---- header ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(meta.title ?? "Mail Report", M, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(`Generated ${new Date().toLocaleString("sv-SE", { timeZone: TZ })} (Asia/Dhaka)`, M, 24);
  let y = 24;
  if (meta.filters?.length) {
    y += 5;
    doc.text(doc.splitTextToSize(`Filters: ${meta.filters.join("  |  ")}`, pageW - 2 * M), M, y);
    y += 5 * (doc.splitTextToSize(`Filters: ${meta.filters.join("  |  ")}`, pageW - 2 * M).length - 1);
  }
  doc.setTextColor(0);

  // ---- headline cards ----
  y += 10;
  const cards = [
    { label: "Total messages", value: total.toLocaleString() },
    { label: "Sent", value: sent.toLocaleString() },
    { label: "Delivery rate", value: pct(sent, total) },
  ];
  const gap = 5;
  const cw = (pageW - 2 * M - gap * (cards.length - 1)) / cards.length;
  cards.forEach((c, i) => {
    const x = M + i * (cw + gap);
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(x, y, cw, 22, 2, 2, "F");
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(c.label.toUpperCase(), x + 4, y + 7);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(17, 24, 39);
    doc.text(c.value, x + 4, y + 17);
    doc.setFont("helvetica", "normal");
  });
  doc.setTextColor(0);
  y += 22 + 10;

  // ---- breakdown by status, with a share bar ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Breakdown by status", M, y);
  doc.setFont("helvetica", "normal");

  const barCol = 3;
  autoTable(doc, {
    startY: y + 3,
    margin: { left: M, right: M },
    head: [["Status", { content: "Messages", styles: { halign: "right" } }, { content: "Share", styles: { halign: "right" } }, ""]],
    body: [
      ...lines.map((l) => [l.label, l.n.toLocaleString(), pct(l.n, total), ""]),
      [
        { content: "Total", styles: { fontStyle: "bold" } },
        { content: total.toLocaleString(), styles: { fontStyle: "bold" } },
        { content: total ? "100.0%" : "0.0%", styles: { fontStyle: "bold" } },
        "",
      ],
    ],
    styles: { font: "helvetica", fontSize: 10, cellPadding: 3, minCellHeight: 9 },
    headStyles: { fillColor: [31, 56, 100], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 35, halign: "right" },
      2: { cellWidth: 30, halign: "right" },
      [barCol]: { cellWidth: "auto" },
    },
    didDrawCell: (d) => {
      if (d.section !== "body" || d.column.index !== barCol || d.row.index >= lines.length || !total) return;
      const l = lines[d.row.index];
      const maxW = d.cell.width - 6;
      const w = Math.max(l.n ? 0.6 : 0, (l.n / total) * maxW);
      doc.setFillColor(...l.color);
      doc.rect(d.cell.x + 3, d.cell.y + d.cell.height / 2 - 1.5, w, 3, "F");
    },
  });

  // ---- notes ----
  let ny = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  const notes = [
    "Each message is one messageId sent to one recipient, however many delivery attempts it had.",
    "Status per message: Sent if any attempt was sent; otherwise Soft fail if any soft-failed; otherwise Hard fail.",
  ];
  if (meta.truncated)
    notes.unshift(`Only the most recent ${total.toLocaleString()} of ${Number(meta.total).toLocaleString()} messages are counted here. Narrow the period or tenant for exact figures.`);
  for (const n of notes) {
    const wrapped = doc.splitTextToSize(n, pageW - 2 * M);
    doc.text(wrapped, M, ny);
    ny += 4 * wrapped.length + 1;
  }
  if (!total) {
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text("No events match these filters.", M, ny + 4);
  }

  // footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(`Page ${i} of ${pages}`, pageW - M, pageH - 6, { align: "right" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}