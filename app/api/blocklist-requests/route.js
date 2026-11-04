import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET(request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const isAdmin = ["ADMIN", "SUPERADMIN"].includes(session.role);

        const where = {};
        if (status) where.status = status;
        if (!isAdmin) where.requestedById = session.id ?? session.userId;

        const requests = await prisma.unblockRequest.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: {
                blockList: { select: { id: true, email: true, domain: true, reason: true, status: true } },
                requestedBy: { select: { id: true, name: true, email: true } },
                reviewedBy: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json({ data: requests });
    } catch (error) {
        console.error("Error fetching unblock requests:", error);
        return NextResponse.json({ error: "Failed to fetch unblock requests" }, { status: 500 });
    }
}