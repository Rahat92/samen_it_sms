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