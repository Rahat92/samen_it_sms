import { prisma } from "@/lib/prisma";

/* ───────────────────────── Constants ───────────────────────── */

const HOUR = 3600 * 1000;
const MAX_LOOKBACK = 31 * 24 * HOUR; // server-side cap for the "last 30 days" rule
const TZ_OFFSET_S = 6 * 3600; // Asia/Dhaka (UTC+6, no DST)

// A message with more than one HardFail event is reported as this status
const MULTI_HARDFAIL_STATUS = "SoftFail";

/* ───────────────────────── Helpers ───────────────────────── */

// Converts a date value to epoch ms.
// 'YYYY-MM-DD' becomes the start/end of that calendar day in Asia/Dhaka.
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

const escapeLike = (v) => String(v).replace(/[\\%_]/g, "\\$&"); // match %, _ and \ literally

// Same grouping key everywhere: messageId + recipient, else Postal token, else the event on its own
const MESSAGE_KEY_SQL = `COALESCE(
  'm:' || NULLIF("messageId", '') || chr(1) || lower(btrim(COALESCE(substring("toAddress" from '<([^>]+)>'), "toAddress", ''))),
  't:' || NULLIF("token", ''),
  'e:' || "id"::text
)`;

// Shared WHERE builder for the aggregate queries (parameterised, never concatenated)
function buildEventFilters({ range, tenant }) {
  const params = [];
  const conds = [];

  const occurredAt = occurredAtFilter(range);
  if (occurredAt) {
    const ops = { gte: ">=", gt: ">", lte: "<=", lt: "<" };
    for (const [key, op] of Object.entries(ops)) {
      if (occurredAt[key] != null) {
        params.push(new Date(occurredAt[key]));
        conds.push(`"occurredAt" ${op} $${params.length}`);
      }
    }
  }
  if (tenant && tenant !== "all") {
    params.push(`%@${escapeLike(tenant)}%`);
    conds.push(`"fromAddress" ILIKE $${params.length}`);
  }

  return { where: conds.length ? `WHERE ${conds.join(" AND ")}` : "", params };
}

/* ───────────────────────── Stats (tiles) ───────────────────────── */

/**
 * One final status per message, computed in SQL.
 * Returns ~5 rows from the database instead of every (message, recipient, status) group.
 *
 * Rules: any Sent -> Sent; else any SoftFail -> SoftFail; else exactly one HardFail -> HardFail;
 * several HardFails -> MULTI_HARDFAIL_STATUS; else Held; else the alphabetically first status.
 */
export async function getStats(tenant, range) {
  const { where, params } = buildEventFilters({ range, tenant });

  const rows = await prisma.$queryRawUnsafe(
    `WITH base AS (
       SELECT "status", ${MESSAGE_KEY_SQL} AS mkey
         FROM "MailEvent"
         ${where}
     ),
     per_msg AS (
       SELECT mkey,
              bool_or("status" = 'Sent')     AS has_sent,
              bool_or("status" = 'SoftFail') AS has_soft,
              bool_or("status" = 'Held')     AS has_held,
              count(*) FILTER (WHERE "status" = 'HardFail') AS hard_n,
              min("status") AS min_status
         FROM base
        GROUP BY mkey
     )
     SELECT CASE
              WHEN has_sent THEN 'Sent'
              WHEN has_soft THEN 'SoftFail'
              WHEN hard_n = 1 THEN 'HardFail'
              WHEN hard_n > 1 THEN '${MULTI_HARDFAIL_STATUS}'
              WHEN has_held THEN 'Held'
              ELSE min_status
            END AS status,
            count(*)::int AS n
       FROM per_msg
      GROUP BY 1`,
    ...params
  );

  const counts = {};
  for (const r of rows) counts[r.status] = Number(r.n);

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

/* ───────────────────────── Chart data ───────────────────────── */

/**
 * Chart data, bucketed in SQL: hourly up to 48h, daily (Dhaka midnight) beyond.
 * Returns { buckets: [{ t, sent, other }], bucketMs } where t = bucket start in epoch ms.
 *
 * NOTE: like the old version this counts raw events (retries included),
 * not de-duplicated messages, so it can differ slightly from the tiles.
 */
export async function getGraphBuckets({ tenant, range = 24 }) {
  const { where, params } = buildEventFilters({ range, tenant });

  const f = occurredAtFilter(range);
  const spanMs = f ? (f.lte ? +f.lte : Date.now()) - +f.gte : 24 * HOUR;
  const size = spanMs <= 48 * HOUR ? 3600 : 86400; // seconds, a trusted constant

  // epoch math works whether the column is `timestamp` (stored as UTC by Prisma) or `timestamptz`
  const rows = await prisma.$queryRawUnsafe(
    `SELECT (floor((extract(epoch FROM "occurredAt") + ${TZ_OFFSET_S}) / ${size}) * ${size} - ${TZ_OFFSET_S})::bigint AS bucket_s,
            count(*) FILTER (WHERE "status" = 'Sent')::int AS sent,
            count(*) FILTER (WHERE "status" IS DISTINCT FROM 'Sent')::int AS other
       FROM "MailEvent"
       ${where}
      GROUP BY 1
      ORDER BY 1`,
    ...params
  );

  return {
    buckets: rows.map((r) => ({
      t: Number(r.bucket_s) * 1000,
      sent: Number(r.sent),
      other: Number(r.other),
    })),
    bucketMs: size * 1000,
  };
}

/**
 * @deprecated Ships every event row to the browser. Use getGraphBuckets for the dashboard chart.
 * Kept only so other callers don't break while you migrate them.
 */
export async function getGraphEvents({ status, event, tenant, range = 24 }) {
  const occurredAt = occurredAtFilter(range);
  const where = {
    ...(status && { status }),
    ...(occurredAt && { occurredAt }),
    ...(event && { event }),
    ...(tenant && tenant !== "all" && {
      fromAddress: { contains: "@" + tenant, mode: "insensitive" },
    }),
  };

  const rows = await prisma.mailEvent.findMany({
    where,
    select: { status: true, occurredAt: true },
    orderBy: { occurredAt: "desc" },
  });

  return { rows, total: rows.length };
}

/* ───────────────────────── Daily series ───────────────────────── */

export async function getDaily() {
  // to_timestamp(extract(epoch ...)) gives the true instant for both `timestamp` (UTC) and
  // `timestamptz` columns, so the Dhaka day boundary is correct either way.
  const rows = await prisma.$queryRaw`
    SELECT
      to_char(d, 'DD Mon') AS day,
      COUNT(*) FILTER (WHERE status = 'Sent') AS sent,
      COUNT(*) FILTER (WHERE status IS DISTINCT FROM 'Sent') AS other
    FROM (
      SELECT (to_timestamp(extract(epoch FROM "occurredAt")) AT TIME ZONE 'Asia/Dhaka')::date AS d, status
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

/* ───────────────────────── Filter options ───────────────────────── */

// DISTINCT over the whole table is a full scan, so cache the result for a few minutes.
const OPTIONS_TTL_MS = 5 * 60 * 1000;
let optionsCache = { at: 0, value: null };

export async function getFilterOptions() {
  if (optionsCache.value && Date.now() - optionsCache.at < OPTIONS_TTL_MS) {
    return optionsCache.value;
  }

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

  const value = {
    statuses: s.map((r) => r.status),
    events: e.map((r) => r.event),
  };
  optionsCache = { at: Date.now(), value };
  return value;
}

/* ───────────────────────── Transactions list ───────────────────────── */

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
      -- the message's representative event: the FIRST (earliest) one that has the final status
      SELECT DISTINCT ON (mkey) *
        FROM resolved
       ORDER BY mkey, ("status" IS NOT DISTINCT FROM final_status) DESC, "occurredAt" ASC, "id" ASC
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