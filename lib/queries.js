import { prisma } from "@/lib/prisma";

export async function getStats(tenant, timeFrom = 24) {
  const occurredAt = occurredAtFilter(timeFrom);
  const where = {
    ...(occurredAt && { occurredAt }),
    // Skip the tenant filter for "all" / empty (admin view)
    ...(tenant && tenant !== "all" && {
      fromAddress: { contains: tenant, mode: "insensitive" },
    }),
  };
 
  // One query instead of five: counts per status
  const groups = await prisma.mailEvent.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });
 
  const count = (s) => groups.find((g) => g.status === s)?._count._all ?? 0;
  const total = groups.reduce((sum, g) => sum + g._count._all, 0);
  const sent = count("Sent");
  const softFail = count("SoftFail");
  const hardFail = count("HardFail");
 
  return {
    total,
    last24h: total, // kept for compatibility: same window as total, as before
    sent,
    softFail,
    hardFail,
    other: total - sent - softFail - hardFail,
    rate: total > 0 ? (sent / total) * 100 : 0, // no NaN when there are no events
  };
}
export async function getDaily() {
  const rows = await prisma.$queryRaw`
    SELECT
      to_char(d, 'DD Mon') AS day,
      COUNT(*) FILTER (WHERE status = 'Sent') AS sent,
      COUNT(*) FILTER (WHERE status IS DISTINCT FROM 'Sent') AS other
    FROM (
      SELECT ("occurredAt" AT TIME ZONE 'Asia/Dhaka')::date AS d, status
      FROM "MailEvent"
      WHERE "occurredAt" > NOW() - INTERVAL '14 days'
    ) t
    GROUP BY d
    ORDER BY d
  `;
  // COUNT returns BigInt in raw queries, so convert for JSON/props
  return rows.map((r) => ({
    day: r.day,
    sent: Number(r.sent),
    other: Number(r.other),
  }));
}

export async function getFilterOptions() {
  const [s, e] = await Promise.all([
    prisma.mailEvent.findMany({
      where: { status: { not: null } },
      distinct: ["status"],
      select: { status: true },
      orderBy: { status: "asc" },
    }),
    prisma.mailEvent.findMany({
      distinct: ["event"],
      select: { event: true },
      orderBy: { event: "asc" },
    }),
  ]);
  return {
    statuses: s.map((r) => r.status),
    events: e.map((r) => r.event),
  };
}

const HOUR = 3600 * 1000;
const MAX_LOOKBACK = 31 * 24 * HOUR; // server-side cap for the "last 30 days" rule
 
/**
 * Turns `range` into a Prisma `occurredAt` filter.
 * Accepts:
 *   - hours as a number or numeric string  -> { gte: now - hours }
 *   - { from, to } in ms (object, or a JSON string of it) -> { gte, lte }
 * Returns undefined when there is no usable range.
 */
// Keep your existing imports (prisma, etc.) at the top of the file.

// Converts a date value to epoch ms.
// 'YYYY-MM-DD' becomes the start/end of that calendar day in Asia/Dhaka (UTC+6, no DST).
const toMs = (v, edge) => {
  if (v === null || v === undefined || v === "") return NaN;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const time = edge === "start" ? "00:00:00" : "23:59:59.999";
    return new Date(`${s}T${time}+06:00`).getTime();
  }
  if (/^\d+$/.test(s)) return Number(s); // epoch ms as a string
  return Date.parse(s); // other ISO strings
};

/**
 * Turns a range into a Prisma `occurredAt` filter.
 * Accepts:
 *   - hours as a number or numeric string                -> { gte: now - hours }
 *   - { from, to } (ms, Date, ISO, or 'YYYY-MM-DD'), or a JSON string of it -> { gte, lte }
 * Returns undefined when there is no usable range.
 */

function occurredAtFilter(range) {
  if (range === undefined || range === null || range === "") return undefined;
  const now = Date.now();
  let from;
  let to = null;

  let r = range;
  if (typeof r === "string" && r.trim().startsWith("{")) {
    try {
      r = JSON.parse(r);
    } catch {
      return undefined;
    }
  }

  if (typeof r === "object") {
    from = toMs(r.from, "start");
    to = toMs(r.to, "end");
    if (!Number.isFinite(from) || !Number.isFinite(to)) return undefined;
  } else {
    const hours = Number(r);
    if (!Number.isFinite(hours) || hours <= 0) return undefined;
    from = now - hours * HOUR;
  }

  // Never look further back than 30 days (or into the future)
  from = Math.max(from, now - MAX_LOOKBACK);
  if (to !== null) to = Math.min(to, now);

  // Window entirely outside the allowed period: match nothing (don't fall back to "all")
  if (to !== null && from > to) return { gte: new Date(0), lt: new Date(0) };

  return to === null
    ? { gte: new Date(from) }
    : { gte: new Date(from), lte: new Date(to) };
}

export async function getEvents({ q, status, event, tenant, page, pageSize, range }) {
  // dateRange ({ from, to }) wins; otherwise fall back to the hours in `range`
  console.log('tes ', range)
  const occurredAt = occurredAtFilter(range);
  console.log('occuredAt', occurredAt)
  const where = {
    ...(status && { status }),
    ...(occurredAt && { occurredAt }),
    ...(event && { event }),
    ...(tenant && tenant !== "all" && {
      fromAddress: { contains: tenant, mode: "insensitive" },
    }),
    ...(q && {
      OR: [
        { toAddress: { contains: q, mode: "insensitive" } },
        { fromAddress: { contains: q, mode: "insensitive" } },
        { subject: { contains: q, mode: "insensitive" } },
      ],
    }),
  };

  const [rows, total] = await Promise.all([
    prisma.mailEvent.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * Number(pageSize),
      take: Number(pageSize),
    }),
    prisma.mailEvent.count({ where }),
  ]);

  return { rows, total };
}

export async function getGraphEvents({ q, status, event, tenant, page, pageSize, range = 24, dateRange }) {
  const occurredAt = occurredAtFilter(dateRange ?? range);
  const where = {
    ...(status && { status }),
    ...(occurredAt && { occurredAt }),
    ...(event && { event }),
    ...(tenant && tenant !== "all" && {
      fromAddress: { contains: tenant, mode: "insensitive" },
    }),
    // ...(q && {
    //   OR: [
    //     { toAddress: { contains: q, mode: "insensitive" } },
    //     { fromAddress: { contains: tenant, mode: "insensitive" } },
    //     { subject: { contains: q, mode: "insensitive" } },
    //   ],
    // }),
  };

  const [rows, total] = await Promise.all([
    prisma.mailEvent.findMany({
      where,
      select: {
        // id: true,
        status: true,
        occurredAt: true,
      },
      orderBy: { occurredAt: "desc" },
    }),
    prisma.mailEvent.count({ where }),
  ]);

  return { rows, total };
}