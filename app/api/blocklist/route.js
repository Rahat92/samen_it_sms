import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAILS = 100; // keep in sync with the form

export async function GET(request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const isAdmin = ["ADMIN", "SUPERADMIN"].includes(session.role);

        const entries = await prisma.blockList.findMany({
            where: isAdmin ? {status:{
                not:'UNBLOCKED'
            }} : { domain: session.domain, status:{
                not:'UNBLOCKED'
            } },
            orderBy: { createdAt: "desc" },
            include: {
                // latest unblock request only
                unblockRequests: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: {
                        id: true,
                        status: true,      // PENDING | APPROVED | REJECTED
                        message: true,
                        reviewNote: true,
                        reviewedAt: true,
                        createdAt: true,
                        requestedBy: { select: { id: true, name: true, email: true } },
                    },
                },
            },
        });

        // Flatten: replace the array with a single `unblockRequest` (or null)
        const data = entries.map(({ unblockRequests, ...entry }) => ({
            ...entry,
            unblockRequest: unblockRequests[0] ?? null,
        }));

        return NextResponse.json({ data });
    } catch (error) {
        console.error("Error fetching blocklist:", error);
        return NextResponse.json({ error: "Failed to fetch blocklist" }, { status: 500 });
    }
}

// Accepts { emails: string[], reason, domain }. A single { email } still works.
export async function POST(request) {
    try {
        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
        }

        const raw = Array.isArray(body?.emails) ? body.emails : body?.email ? [body.email] : [];
        const emails = [
            ...new Set(
                raw
                    .filter((e) => typeof e === "string")
                    .map((e) => e.trim().toLowerCase())
                    .filter(Boolean)
            ),
        ];

        if (!emails.length) {
            return NextResponse.json({ error: "At least one email address is required" }, { status: 400 });
        }
        if (emails.length > MAX_EMAILS) {
            return NextResponse.json(
                { error: `You can block up to ${MAX_EMAILS} addresses at a time` },
                { status: 400 }
            );
        }
        const invalid = emails.filter((e) => !EMAIL.test(e));
        if (invalid.length) {
            return NextResponse.json(
                { error: `Invalid email address: ${invalid.slice(0, 3).join(", ")}`, invalid },
                { status: 400 }
            );
        }

        const reason =
            typeof body.reason === "string" && body.reason.trim()
                ? body.reason.trim().slice(0, 100)
                : "Manually added to blocklist";
        const domain = typeof body.domain === "string" && body.domain.trim() ? body.domain.trim() : null;

        // Skip addresses that are already on the list instead of failing the whole batch.
        const existing = await prisma.blockList.findMany({
            where: { email: { in: emails } },
            select: { email: true },
        });
        const existingSet = new Set(existing.map((e) => e.email.toLowerCase()));
        const toCreate = emails.filter((e) => !existingSet.has(e));
        const skipped = emails.filter((e) => existingSet.has(e));

        if (!toCreate.length) {
            return NextResponse.json(
                {
                    error: emails.length > 1
                        ? "All of these addresses are already on the blocklist."
                        : "That address is already on the blocklist.",
                    skipped,
                },
                { status: 409 }
            );
        }

        const result = await prisma.blockList.createMany({
            data: toCreate.map((email) => ({ email, reason, domain })),
        });

        // createMany doesn't return rows, so load them for the client to show right away.
        const rows = await prisma.blockList.findMany({
            where: { email: { in: toCreate } },
            orderBy: { createdAt: "desc" },
            take: toCreate.length,
        });
        const data = rows.map((row) => ({ ...row, unblockRequest: null })); // same shape as GET

        return NextResponse.json(
            { message: "Blocklist updated", created: result.count, skipped, data },
            { status: 201 }
        );
    } catch (error) {
        console.error("Error adding to blocklist:", error);
        return NextResponse.json({ error: "Failed to add to blocklist" }, { status: 500 });
    }
}