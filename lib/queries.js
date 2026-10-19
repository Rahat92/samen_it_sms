import { prisma } from "@/lib/prisma";

export async function getStats(tenant, timeFrom = 24) {
  const since = new Date(Date.now() - Number(timeFrom) * 60 * 60 * 1000);
  const [total, last24h, sent, softFail, hardFail] = await Promise.all([
    prisma.mailEvent.count({where:{occurredAt: { gte: since }, fromAddress: {
      contains: tenant,
      mode: "insensitive",
    }}}),
    prisma.mailEvent.count({ where: { occurredAt: { gte: since }, fromAddress: {
      contains: tenant,
      mode: "insensitive",
    } } }),
    prisma.mailEvent.count({ where: { occurredAt: { gte: since },status: "Sent", fromAddress: {
      contains: tenant,
      mode: "insensitive",
    }, } }),
    prisma.mailEvent.count({ where: { occurredAt: { gte: since },status: "SoftFail", fromAddress: {
      contains: tenant,
      mode: "insensitive",
    } } }),
    prisma.mailEvent.count({ where: { occurredAt: { gte: since },status: "HardFail", fromAddress: {
      contains: tenant,
      mode: "insensitive",
    } } }),

  ]);
  return { total, last24h, sent, softFail, hardFail, other: total - sent - softFail - hardFail, rate: sent/total * 100 };
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

export async function getEvents({ q, status, event, tenant, page, pageSize, range }) {
  const since = new Date(Date.now() - Number(range) * 60 * 60 * 1000);
  const where = {
    ...(status && { status }),
    ...(range && { occurredAt: {gte:since} }),
    ...(event && { event }),
    ...(tenant && { fromAddress: { contains: tenant, mode: "insensitive" } }),
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
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * Number(pageSize),
      take: Number(pageSize),
    }),
    prisma.mailEvent.count({ where }),
  ]);

  return { rows, total };
}