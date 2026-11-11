import { prisma } from "@/lib/prisma";
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

const MULTI_HARDFAIL_COUNTS_AS = "SoftFail";
 
// "Name <A@X.com>" and "a@x.com" are the same recipient
const normalizeRecipient = (v) => {
  const s = String(v ?? "").trim().toLowerCase();
  return (s.match(/<([^>]+)>/)?.[1] ?? s).trim();
};
 
const PRIORITY = { Sent: 0, SoftFail: 1, HardFail: 2, Held: 3 }; // lower = wins (used for rule 5)
const rank = (s) => PRIORITY[s] ?? 99;
 
// c = { [status]: number of events with that status } for ONE message
function resolveStatus(c) {
  if (c.Sent) return "Sent";
  if (c.SoftFail) return "SoftFail";
  if (c.HardFail === 1) return "HardFail";
  if (c.HardFail > 1) return MULTI_HARDFAIL_COUNTS_AS;
  return Object.keys(c).sort((a, b) => rank(a) - rank(b) || String(a).localeCompare(String(b)))[0];
}
 
export async function getStats(tenant, range) {
  const occurredAt = occurredAtFilter(range);
  const where = {
    ...(occurredAt && { occurredAt }),
    ...(tenant && tenant !== "all" && {
      fromAddress: { contains: "@" + tenant, mode: "insensitive" },
    }),
  };
 
  // One row per (messageId, recipient, status), with how many events it has
  const rows = await prisma.mailEvent.groupBy({
    by: ["messageId", "toAddress", "token", "status"],
    where,
    _count: { _all: true },
  });
 
  const counts = {}; // final status -> number of messages
  const bump = (status, n = 1) => { counts[status] = (counts[status] ?? 0) + n; };
 
  const perMessage = new Map(); // message key -> { status: eventCount }
  for (const { messageId, toAddress, token, status, _count } of rows) {
    const key = messageId
      ? `m:${messageId}\u0000${normalizeRecipient(toAddress)}`
      : token
        ? `t:${token}`
        : null;
 
    if (key === null) {
      // no way to tell which events belong together: every event counts as its own message
      bump(status, _count._all);
      continue;
    }
    const c = perMessage.get(key) ?? {};
    c[status] = (c[status] ?? 0) + _count._all;
    perMessage.set(key, c);
  }
  for (const c of perMessage.values()) bump(resolveStatus(c));
 
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const sent = counts.Sent ?? 0;
  const softFail = counts.SoftFail ?? 0;
  const hardFail = counts.HardFail ?? 0;
  const held = counts.Held ?? 0;
 
  return {
    total,
    last24h: total,
    sent,
    softFail,
    hardFail,
    held,
    other: total - sent - softFail - hardFail - held,
    rate: total > 0 ? (sent / total) * 100 : 0,
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


const MULTI_HARDFAIL_STATUS = "SoftFail";
 
const escapeLike = (v) => String(v).replace(/[\\%_]/g, "\\$&"); // match %, _ and \ literally
 
// Same grouping key as getStats: messageId + recipient, else Postal token, else the event on its own
const MESSAGE_KEY_SQL = `COALESCE(
  'm:' || NULLIF("messageId", '') || chr(1) || lower(btrim(COALESCE(substring("toAddress" from '<([^>]+)>'), "toAddress", ''))),
  't:' || NULLIF("token", ''),
  'e:' || "id"::text
)`;
 
export async function getEvents({ q, status, event, tenant, page = 1, pageSize = 20, range }) {
  const size = Math.max(1, Number(pageSize) || 20);
  const pageNo = Math.max(1, Number(page) || 1);
 
  // ---- filters on the raw events (parameterised, never concatenated) ----
  const params = [];
  const conds = [];
  const add = (sql, value) => {
    params.push(value);
    conds.push(sql.replaceAll("?", `$${params.length}`));
  };
 
  const occurredAt = occurredAtFilter(range);
  if (occurredAt) {
    const ops = { gte: ">=", gt: ">", lte: "<=", lt: "<" };
    for (const [key, op] of Object.entries(ops)) {
      if (occurredAt[key] != null) add(`"occurredAt" ${op} ?`, new Date(occurredAt[key]));
    }
  }
  if (event) add(`"event" = ?`, event);
  if (tenant && tenant !== "all") add(`"fromAddress" ILIKE ?`, `%@${escapeLike(tenant)}%`);
  if (q) {
    add(
      `("toAddress" ILIKE ? OR "fromAddress" ILIKE ? OR "subject" ILIKE ? OR "messageId" ILIKE ?)`,
      `%${escapeLike(q)}%`
    );
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
 
  // ---- status filter applies to the FINAL status of the message ----
  const wantedStatus = status && status !== "All" ? status : null;
  let statusWhere = "";
  if (wantedStatus) {
    params.push(wantedStatus);
    statusWhere = `WHERE final_status = $${params.length}`;
  }
 
  const cte = `
    WITH base AS (
      SELECT e.*, ${MESSAGE_KEY_SQL} AS mkey
        FROM "MailEvent" e
        ${where}
    ),
    agg AS (
      SELECT base.*,
             bool_or("status" = 'Sent')     OVER w AS has_sent,
             bool_or("status" = 'SoftFail') OVER w AS has_soft,
             bool_or("status" = 'Held')     OVER w AS has_held,
             (count(*) FILTER (WHERE "status" = 'HardFail') OVER w)::int AS hard_n,
             (count(*) OVER w)::int AS event_count,
             min("status") OVER w AS min_status
        FROM base
      WINDOW w AS (PARTITION BY mkey)
    ),
    resolved AS (
      SELECT agg.*,
             CASE
               WHEN has_sent THEN 'Sent'
               WHEN has_soft THEN 'SoftFail'
               WHEN hard_n = 1 THEN 'HardFail'
               WHEN hard_n > 1 THEN '${MULTI_HARDFAIL_STATUS}'
               WHEN has_held THEN 'Held'
               ELSE min_status
             END AS final_status
        FROM agg
    ),
    picked AS (
      -- the message's representative event: the latest one that has the final status
      SELECT DISTINCT ON (mkey) *
        FROM resolved
       ORDER BY mkey, ("status" IS NOT DISTINCT FROM final_status) DESC, "occurredAt" DESC, "id" DESC
    )`;
 
  const pageParams = [...params, size, (pageNo - 1) * size];
  const result = await prisma.$queryRawUnsafe(
    `${cte}
     SELECT picked.*, (count(*) OVER())::int AS total_count
       FROM picked
       ${statusWhere}
      ORDER BY "occurredAt" DESC, "id" DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    ...pageParams
  );
 
  const rows = result.map(
    ({ mkey, has_sent, has_soft, has_held, hard_n, min_status, total_count, event_count, final_status, ...row }) => ({
      ...row,
      status: final_status, // the message's final status, not the representative event's
      eventCount: Number(event_count), // how many events (attempts) this message has
    })
  );
 
  let total = result.length ? Number(result[0].total_count) : 0;
  if (!result.length && pageNo > 1) {
    // asked for a page past the end: still report the real total
    const [{ n }] = await prisma.$queryRawUnsafe(
      `${cte} SELECT count(*)::int AS n FROM picked ${statusWhere}`,
      ...params
    );
    total = Number(n);
  }
 
  return { rows, total };
}

export async function getGraphEvents({ q, status, event, tenant, page, pageSize, range = 24 }) {
  const occurredAt = occurredAtFilter(range);
  const where = {
    ...(status && { status }),
    ...(occurredAt && { occurredAt }),
    ...(event && { event }),
    ...(tenant && tenant !== "all" && {
      fromAddress: { contains:"@"+ tenant, mode: "insensitive" },
    }),
    // ...(q && {
    //   OR: [
    //     { toAddress: { contains: q, mode: "insensitive" } },
    //     { fromAddress: { contains:"@"+ tenant, mode: "insensitive" } },
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