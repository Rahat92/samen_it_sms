import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

// Always compute fresh so the navbar badge doesn't go stale
export const dynamic = "force-dynamic";

// GET /api/unblock-requests/pending-count
// Admins: all PENDING requests. Regular users: only their own PENDING requests.
export async function GET() {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const isAdmin = ["ADMIN", "SUPERADMIN"].includes(session.role);

        const count = await prisma.unblockRequest.count({
            where: {
                status: "PENDING",
                ...(isAdmin ? {} : { requestedById: session.id ?? session.userId }),
            },
        });

        return NextResponse.json({ count });
    } catch (error) {
        console.error("Error counting pending unblock requests:", error);
        return NextResponse.json({ error: "Failed to fetch pending count" }, { status: 500 });
    }
}