import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { buildPdf } from "@/lib/report";
import { sendDailyReportEmail } from "@/lib/mailer";
import { getEvents } from "@/lib/queries";
// Called by a scheduler (system cron, see below), never by the browser.
//   POST /api/cron/daily-report                 -> report for yesterday (Asia/Dhaka)
//   POST /api/cron/daily-report?date=2026-11-16 -> report for that day (re-send / catch-up)
//   add &dryRun=1 to see who would get an email without sending anything
// Auth: header  Authorization: Bearer <CRON_SECRET>   (set CRON_SECRET in .env)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TZ = "Asia/Dhaka";
const NO_LIMIT = 2147483647;
const SKIP_EMPTY_DAYS = true; // don't email a tenant that had no messages that day
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const json = (body, status = 200) => Response.json(body, { status });

function authorised(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// The calendar day before "now" in Asia/Dhaka
const yesterdayDhaka = () =>
  new Date(Date.now() - 24 * 3600 * 1000).toLocaleDateString("en-CA", { timeZone: TZ });

async function run(request) {
  if (!authorised(request)) return json({ error: "Unauthorized" }, 401);

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || yesterdayDhaka();
  if (!DATE_RE.test(date)) return json({ error: "date must be YYYY-MM-DD" }, 400);
  const dryRun = searchParams.get("dryRun") === "1";

  // Tenants = active tenant users, grouped by domain; every active user of a domain gets the report
  const users = await prisma.user.findMany({
    where: { role: "USER", isActive: true, domain: { not: null } },
    select: { email: true, domain: true },
  });
  const byDomain = new Map();
  for (const u of users) {
    const d = u.domain.trim().toLowerCase();
    if (!d) continue;
    byDomain.set(d, [...(byDomain.get(d) ?? []), u.email]);
  }

  const results = [];
  for (const [tenant, recipients] of byDomain) {
    try {
      const { rows, total } = await getEvents({
        tenant,
        range: { from: date, to: date },
        page: 1,
        pageSize: NO_LIMIT,
      });

      if (!total && SKIP_EMPTY_DAYS) {
        results.push({ tenant, status: "skipped", reason: "no messages" });
        continue;
      }

      const count = (s) => rows.filter((r) => r.status === s).length;
      const stats = { total: rows.length, sent: count("Sent"), softFail: count("SoftFail"), hardFail: count("HardFail"), held: count("Held") };

      if (dryRun) {
        results.push({ tenant, status: "dry-run", recipients, ...stats });
        continue;
      }

      const pdf = buildPdf(rows, {
        title: `Daily mail report: ${tenant}`,
        filters: [`Tenant: ${tenant}`, `Date: ${date}`],
        total,
        truncated: false,
      });
      await sendDailyReportEmail({ to: recipients, tenant, dateLabel: date, pdf, stats });
      results.push({ tenant, status: "sent", recipients: recipients.length, ...stats });
    } catch (err) {
      // one tenant failing must not stop the others
      console.error(`daily report failed for ${tenant}:`, err);
      results.push({ tenant, status: "failed", error: err.message });
    }
  }

  const failed = results.filter((r) => r.status === "failed").length;
  return json({ date, dryRun, tenants: results.length, failed, results }, failed ? 207 : 200);
}

export const POST = run;
export const GET = run; // so a plain `curl` works too; still needs the secret