import { getSession } from "@/lib/session";
import { buildCsv, buildPdf } from "@/lib/report";
import { getEvents } from "@/lib/queries";
// jsPDF needs the Node runtime (not edge) and the report must never be cached
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// No cap: export every matching message. (2147483647 = the largest value Postgres accepts for LIMIT.)
const NO_LIMIT = 2147483647;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const bad = (message, status = 400) => Response.json({ error: message }, { status });

// GET /api/events/report?format=csv|pdf&status=&event=&q=&tenant=&range=24&from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(request) {
    const session = await getSession();
    if (!session) return bad("Unauthorized", 401);

    try {
        const { searchParams } = new URL(request.url);

        const format = (searchParams.get("format") ?? "csv").toLowerCase();
        if (!["csv", "pdf"].includes(format)) return bad("format must be 'csv' or 'pdf'");

        // Regular users can only export their own tenant; admins can pick any
        const isAdmin = ["ADMIN", "SUPERADMIN"].includes(session.role);
        const tenant = isAdmin
            ? searchParams.get("tenant") || "all"
            : session.domain ?? session.email?.split("@")[1];
        if (!tenant) return bad("Forbidden", 403);

        // Custom date range wins over "last N hours", same as getEvents
        const from = searchParams.get("from");
        const to = searchParams.get("to");
        let range;
        if (from || to) {
            if (!DATE_RE.test(from ?? "") || !DATE_RE.test(to ?? "")) {
                return bad("from and to must both be YYYY-MM-DD");
            }
            range = { from, to };
        } else if (searchParams.get("range")) {
            const hours = Number(searchParams.get("range"));
            if (!Number.isFinite(hours) || hours <= 0) return bad("range must be a positive number of hours");
            range = hours;
        }

        const status = searchParams.get("status") || undefined;
        const event = searchParams.get("event") || undefined;
        const q = searchParams.get("q") || undefined;

                const { rows, total } = await getEvents({
            q, status, event, tenant, range,
            page: 1,
            pageSize: NO_LIMIT,
        });
        const truncated = total > rows.length;

        const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
        const filename = `mail-report-${date}.${format}`;
        const headers = {
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
            "X-Total-Rows": String(total),
            "X-Truncated": String(truncated),
            "Access-Control-Expose-Headers": "Content-Disposition, X-Total-Rows, X-Truncated",
        };

        if (format === "csv") {
            return new Response(buildCsv(rows), {
                headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
            });
        }

        const filters = [
            tenant !== "all" && `Tenant: ${tenant}`,
            status && `Status: ${status}`,
            event && `Event: ${event}`,
            q && `Search: ${q}`,
            range && (typeof range === "number" ? `Last ${range}h` : `${range.from} to ${range.to}`),
        ].filter(Boolean);

        const pdf = buildPdf(rows, { title: "Mail Report", filters, total, truncated });
        return new Response(pdf, {
            headers: { ...headers, "Content-Type": "application/pdf" },
        });
    } catch (error) {
        console.error("Error generating report:", error);
        return bad("Failed to generate report", 500);
    }
}