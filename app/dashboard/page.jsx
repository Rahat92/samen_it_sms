import Link from "next/link";
import EventsChart from "@/components/EventsChart";
import {
  getStats,
  getDaily,
  getFilterOptions,
  getEvents,
} from "@/lib/queries";

const PAGE_SIZE = 20;

const one = (v) => (Array.isArray(v) ? v[0] : v) ?? "";

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const ok = status === "Sent";
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        ok ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {status ?? "—"}
    </span>
  );
}

function fmt(date) {
  return new Date(date).toLocaleString("en-GB", {
    timeZone: "Asia/Dhaka",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function DashboardPage({ searchParams }) {
  const sp = await searchParams; // async in Next 15+/16

  const q = one(sp.q).trim();
  const status = one(sp.status);
  const event = one(sp.event);
  const page = Math.max(1, parseInt(one(sp.page), 10) || 1);

  const [stats, daily, options, { rows, total }] = await Promise.all([
    getStats(),
    getDaily(),
    getFilterOptions(),
    getEvents({ q, status, event, page, pageSize: PAGE_SIZE }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = (p) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (event) params.set("event", event);
    params.set("page", String(p));
    return `/dashboard?${params.toString()}`;
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Mail events</h1>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total events" value={stats.total} />
        <StatCard label="Last 24 hours" value={stats.last_24h} />
        <StatCard label="Sent" value={stats.sent} />
        <StatCard label="Other statuses" value={stats.other} />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold">Last 14 days</h2>
        <EventsChart data={daily} />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <form className="mb-4 flex flex-wrap gap-2" method="GET">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search recipient, sender, subject"
            className="min-w-64 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            name="status"
            defaultValue={status}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {options.statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            name="event"
            defaultValue={event}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All events</option>
            {options.events.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <button className="rounded-lg bg-black px-4 py-2 text-sm text-white">
            Filter
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
          >
            Reset
          </Link>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-gray-500">
              <tr>
                <th className="py-2 pr-4">Time (Dhaka)</th>
                <th className="py-2 pr-4">Event</th>
                <th className="py-2 pr-4">To</th>
                <th className="py-2 pr-4">Subject</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    No events found.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b align-top last:border-0">
                  <td className="whitespace-nowrap py-2 pr-4">
                    {fmt(r.occurred_at)}
                  </td>
                  <td className="py-2 pr-4">{r.event}</td>
                  <td className="py-2 pr-4">{r.to_address ?? "—"}</td>
                  <td className="max-w-xs truncate py-2 pr-4">
                    {r.subject ?? "—"}
                  </td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="py-2">
                    <details>
                      <summary className="cursor-pointer text-blue-600">
                        View
                      </summary>
                      <p className="mt-2 text-xs text-gray-600">{r.details}</p>
                      <pre className="mt-2 max-h-64 max-w-md overflow-auto rounded bg-gray-50 p-2 text-xs">
                        {JSON.stringify(r.payload, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-gray-500">
            {total} events · page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={pageHref(page - 1)}
                className="rounded-lg border border-gray-300 px-3 py-1"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={pageHref(page + 1)}
                className="rounded-lg border border-gray-300 px-3 py-1"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}