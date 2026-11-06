import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

// Always compute fresh so counts don't go stale
export const dynamic = "force-dynamic";

// GET /api/blocklist/count
// Admins: all entries. Regular users: only entries in their own domain.
export async function GET() {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const isAdmin = ["ADMIN", "SUPERADMIN"].includes(session.role);

        const groups = await prisma.blockList.groupBy({
            by: ["status"],
            where: isAdmin ? {status:{
                not:'UNBLOCKED'
            }} : { domain: session.domain },
            _count: { _all: true },
        });

        const byStatus = Object.fromEntries(groups.map((g) => [g.status, g._count._all]));
        const blocked = byStatus.BLOCKED ?? 0;
        const unblockRequested = byStatus.UNBLOCK_REQUESTED ?? 0;
        const unblocked = byStatus.UNBLOCKED ?? 0;

        return NextResponse.json({
            total: blocked + unblockRequested + unblocked,
            blocked,
            unblockRequested,
            unblocked,
        });
    } catch (error) {
        console.error("Error counting blocklist:", error);
        return NextResponse.json({ error: "Failed to fetch blocklist count" }, { status: 500 });
    }
}