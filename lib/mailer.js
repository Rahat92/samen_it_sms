import nodemailer from "nodemailer";

// .env
//   SMTP_HOST=mail.example.com
//   SMTP_PORT=587            (465 = implicit TLS)
//   SMTP_USER=...            (optional)
//   SMTP_PASS=...            (optional)
//   MAIL_FROM="Mail Dashboard <no-reply@example.com>"
//   APP_URL=https://dashboard.example.com   (used for the sign-in link)

let transporter;

function getTransporter() {
  if (!transporter) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST) throw new Error("SMTP_HOST is not configured");
    const port = Number(SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Emails a new tenant their sign-in details. Throws if the mail can't be sent. */
export async function sendTenantWelcomeEmail({ to, name, password }) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  if (!from) throw new Error("MAIL_FROM is not configured");
  const loginUrl = process.env.APP_URL ? `${process.env.APP_URL.replace(/\/$/, "")}/login` : "";

  const text = [
    `Hello ${name},`,
    "",
    "An account has been created for you on the Mail Dashboard.",
    "",
    `Email:    ${to}`,
    `Password: ${password}`,
    loginUrl ? `Sign in:  ${loginUrl}` : "",
    "",
    "Please keep this password private and change it after your first sign-in.",
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;line-height:1.5">
      <p>Hello ${esc(name)},</p>
      <p>An account has been created for you on the Mail Dashboard.</p>
      <table cellpadding="6" style="border-collapse:collapse;background:#f3f4f6;border-radius:6px">
        <tr><td><strong>Email</strong></td><td>${esc(to)}</td></tr>
        <tr><td><strong>Password</strong></td><td style="font-family:Consolas,monospace">${esc(password)}</td></tr>
      </table>
      ${loginUrl ? `<p><a href="${esc(loginUrl)}">Sign in to the dashboard</a></p>` : ""}
      <p style="color:#6b7280">Please keep this password private and change it after your first sign-in.</p>
    </div>`;

  await getTransporter().sendMail({
    from,
    to,
    subject: "Your Mail Dashboard account",
    text,
    html,
  });
}

/** Emails a user their new password after an admin changed it. Throws if the mail can't be sent. */
export async function sendPasswordResetEmail({ to, name, password }) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  if (!from) throw new Error("MAIL_FROM is not configured");
  const loginUrl = process.env.APP_URL ? `${process.env.APP_URL.replace(/\/$/, "")}/login` : "";

  const text = [
    `Hello ${name},`,
    "",
    "An administrator has changed the password for your Mail Dashboard account.",
    "",
    `Email:        ${to}`,
    `New password: ${password}`,
    loginUrl ? `Sign in:      ${loginUrl}` : "",
    "",
    "Please keep this password private. If you weren't expecting this change, contact your administrator.",
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;line-height:1.5">
      <p>Hello ${esc(name)},</p>
      <p>An administrator has changed the password for your Mail Dashboard account.</p>
      <table cellpadding="6" style="border-collapse:collapse;background:#f3f4f6;border-radius:6px">
        <tr><td><strong>Email</strong></td><td>${esc(to)}</td></tr>
        <tr><td><strong>New password</strong></td><td style="font-family:Consolas,monospace">${esc(password)}</td></tr>
      </table>
      ${loginUrl ? `<p><a href="${esc(loginUrl)}">Sign in to the dashboard</a></p>` : ""}
      <p style="color:#6b7280">Please keep this password private. If you weren't expecting this change, contact your administrator.</p>
    </div>`;

  await getTransporter().sendMail({
    from,
    to,
    subject: "Your Mail Dashboard password was changed",
    text,
    html,
  });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const n0 = (n) => Number(n).toLocaleString("en-US");
const pct = (n, d) => (d > 0 ? ((n / d) * 100).toFixed(1) : "0.0") + "%";

/**
 * Emails a tenant's daily report: the statistics shown in the email body (same look as the
 * PDF report) plus the events as a CSV attachment. `to` can be one address or an array.
 * stats = { total, sent, softFail, hardFail, held }. Throws if the mail can't be sent.
 */
export async function sendDailyReportEmail({ to, tenant, dateLabel, csv, stats }) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  if (!from) throw new Error("MAIL_FROM is not configured");

  const filename = `mail-report-${tenant}-${dateLabel}.csv`;
  // "2026-11-21" -> "21-Nov-2026"
  const [y, m, d] = dateLabel.split("-");
  const subjectDate = `${d}-${MONTHS[Number(m) - 1]}-${y}`;
  const generated = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Dhaka" });
  const filters = `Tenant: ${tenant}  |  Date: ${dateLabel}`;

  const total = stats.total;
  const other = Math.max(0, total - stats.sent - stats.softFail - stats.hardFail - stats.held);
  const lines = [
    { label: "Sent", n: stats.sent, color: "#16a34a" },
    { label: "Soft fail", n: stats.softFail, color: "#d97706" },
    { label: "Hard fail", n: stats.hardFail, color: "#dc2626" },
    { label: "Held", n: stats.held, color: "#6b7280" },
    ...(other ? [{ label: "Other", n: other, color: "#9ca3af" }] : []),
  ];

  const text = [
    "Mail Report",
    `Generated ${generated} (Asia/Dhaka)`,
    `Filters: ${filters}`,
    "",
    `Total messages: ${n0(total)}`,
    `Sent:           ${n0(stats.sent)}`,
    `Delivery rate:  ${pct(stats.sent, total)}`,
    "",
    "Breakdown by status",
    ...lines.map((l) => `${l.label.padEnd(10)} ${String(n0(l.n)).padStart(8)}  ${pct(l.n, total).padStart(6)}`),
    `${"Total".padEnd(10)} ${String(n0(total)).padStart(8)}  ${(total ? "100.0%" : "0.0%").padStart(6)}`,
    "",
    "Each message is one messageId sent to one recipient, however many delivery attempts it had.",
    "Status per message: Sent if any attempt was sent; otherwise Soft fail if any soft-failed; otherwise Hard fail.",
    "",
    "The full report is attached as a CSV file.",
  ].join("\n");

  // Email clients ignore most modern CSS, so this is built from tables with inline styles
  const card = (label, value) => `
        <td width="33%" valign="top" style="padding:0 5px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f3f5;border-radius:8px">
            <tr><td style="padding:14px 16px">
              <div style="font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#6b7280">${esc(label)}</div>
              <div style="font-size:26px;font-weight:bold;color:#111827;margin-top:6px">${esc(value)}</div>
            </td></tr>
          </table>
        </td>`;

  const bar = (l) => {
    const w = !total || !l.n ? 0 : Math.max(1, Math.round((l.n / total) * 100));
    if (!w) return "&nbsp;";
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td width="${w}%" height="8" bgcolor="${l.color}" style="background:${l.color};height:8px;line-height:8px;font-size:1px">&nbsp;</td>
              <td style="font-size:1px;line-height:8px">&nbsp;</td></tr></table>`;
  };

  const rows = lines
    .map(
      (l, i) => `
        <tr style="background:${i % 2 === 0 ? "#f5f7fa" : "#ffffff"}">
          <td style="padding:12px 14px;color:#374151;white-space:nowrap">${esc(l.label)}</td>
          <td align="right" style="padding:12px 14px;color:#374151">${n0(l.n)}</td>
          <td align="right" style="padding:12px 14px;color:#374151">${pct(l.n, total)}</td>
          <td width="45%" style="padding:12px 14px">${bar(l)}</td>
        </tr>`
    )
    .join("");

  const th = (label, align = "left") =>
    `<th align="${align}" style="padding:11px 14px;color:#ffffff;font-size:13px">${label}</th>`;

  const html = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff">
<tr><td align="center" style="padding:24px 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;line-height:1.45">
  <table role="presentation" align="center" width="680" cellpadding="0" cellspacing="0" style="width:100%;max-width:680px;margin:0 auto;text-align:left">
    <tr><td style="padding:8px 4px 0">
      <div style="font-size:26px;font-weight:bold;color:#000000">Mail Report</div>
      <div style="font-size:12px;color:#5a6270;margin-top:6px">Generated ${esc(generated)} (Asia/Dhaka)</div>
      <div style="font-size:12px;color:#5a6270;margin-top:2px">Filters: ${esc(filters)}</div>
    </td></tr>

    <tr><td style="padding:22px 0 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        ${card("Total messages", n0(total))}
        ${card("Sent", n0(stats.sent))}
        ${card("Delivery rate", pct(stats.sent, total))}
      </tr></table>
    </td></tr>

    <tr><td style="padding:26px 4px 8px;font-size:15px;font-weight:bold;color:#111827">Breakdown by status</td></tr>
    <tr><td style="padding:0 4px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <tr style="background:#1f3864">
          ${th("Status")}${th("Messages", "right")}${th("Share", "right")}${th("&nbsp;")}
        </tr>${rows}
        <tr style="background:#f5f7fa">
          <td style="padding:12px 14px;font-weight:bold;color:#374151">Total</td>
          <td align="right" style="padding:12px 14px;font-weight:bold;color:#374151">${n0(total)}</td>
          <td align="right" style="padding:12px 14px;font-weight:bold;color:#374151">${total ? "100.0%" : "0.0%"}</td>
          <td>&nbsp;</td>
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding:14px 4px 0;font-size:12px;color:#6b7280">The full list of messages is attached as a CSV file.</td></tr>
  </table>
</td></tr>
</table>`;

  await getTransporter().sendMail({
    from,
    to,
    subject: `Daily Transactional Mail Report | ${subjectDate}`,
    text,
    html,
    attachments: [{ filename, content: csv, contentType: "text/csv; charset=utf-8" }],
  });
}