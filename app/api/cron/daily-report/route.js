import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getEvents } from "@/lib/queries"; 
import { buildDailyCsv } from "@/lib/report";
import { sendDailyReportEmail } from "@/lib/mailer";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TZ = "Asia/Dhaka";
const NO_LIMIT = 2147483647;
const SKIP_EMPTY_DAYS = true;
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

const yesterdayDhaka = () =>
  new Date(Date.now() - 24 * 3600 * 1000).toLocaleDateString("en-CA", { timeZone: TZ });

async function run(request) {
  if (!authorised(request)) return json({ error: "Unauthorized" }, 401);

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || yesterdayDhaka();
  if (!DATE_RE.test(date)) return json({ error: "date must be YYYY-MM-DD" }, 400);
  const dryRun = searchParams.get("dryRun") === "1";
  const onlyTenant = (searchParams.get("tenant") || "").trim().toLowerCase();
  const testTo = (searchParams.get("to") || "").trim();
  if (testTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo)) return json({ error: "to must be a valid email" }, 400);

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
  for (const [tenant, tenantRecipients] of byDomain) {
    if (onlyTenant && tenant !== onlyTenant) continue;
    const recipients = testTo ? [testTo] : tenantRecipients;
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

      const csv = buildDailyCsv(rows);
      await sendDailyReportEmail({ to: recipients, tenant, dateLabel: date, csv, stats });
      results.push({ tenant, status: "sent", recipients: recipients.length, ...stats });
    } catch (err) {
      console.error(`daily report failed for ${tenant}:`, err);
      results.push({ tenant, status: "failed", error: err.message });
    }
  }

  const failed = results.filter((r) => r.status === "failed").length;
  return json({ date, dryRun, tenants: results.length, failed, results }, failed ? 207 : 200);
}

export const POST = run;
export const GET = run;