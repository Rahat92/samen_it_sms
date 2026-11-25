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

/**
 * Emails a tenant's daily report (CSV attachment). `to` can be one address or an array.
 * stats = { total, sent, softFail, hardFail, held } for the email body. Throws if the mail can't be sent.
 */
export async function sendDailyReportEmail({ to, tenant, dateLabel, csv, stats }) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  if (!from) throw new Error("MAIL_FROM is not configured");
  const rate = stats.total ? ((stats.sent / stats.total) * 100).toFixed(1) : "0.0";
  const filename = `mail-report-${tenant}-${dateLabel}.csv`;
  // "2026-11-21" -> "21-Nov-2026"
  const [y, m, d] = dateLabel.split("-");
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const subjectDate = `${d}-${MONTHS[Number(m) - 1]}-${y}`;

  const text = [
    `Daily mail report for ${tenant}, ${dateLabel} (Asia/Dhaka)`,
    "",
    `Total messages: ${stats.total}`,
    `Sent:           ${stats.sent}  (${rate}%)`,
    `Soft fail:      ${stats.softFail}`,
    `Hard fail:      ${stats.hardFail}`,
    `Held:           ${stats.held}`,
    "",
    "The full report is attached as a CSV file.",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;line-height:1.5">
      <p>Daily mail report for <strong>${esc(tenant)}</strong>, ${esc(dateLabel)} (Asia/Dhaka)</p>
      <table cellpadding="6" style="border-collapse:collapse;background:#f3f4f6;border-radius:6px">
        <tr><td>Total messages</td><td><strong>${stats.total}</strong></td></tr>
        <tr><td>Sent</td><td><strong>${stats.sent}</strong> (${rate}%)</td></tr>
        <tr><td>Soft fail</td><td>${stats.softFail}</td></tr>
        <tr><td>Hard fail</td><td>${stats.hardFail}</td></tr>
        <tr><td>Held</td><td>${stats.held}</td></tr>
      </table>
      <p style="color:#6b7280">The full report is attached as a CSV file.</p>
    </div>`;

  await getTransporter().sendMail({
    from,
    to,
    subject: `Daily Transactional Mail Report | ${subjectDate}`,
    text,
    html,
    attachments: [{ filename, content: csv, contentType: "text/csv; charset=utf-8" }],
  });
}