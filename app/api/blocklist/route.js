import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET(request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const isAdmin = ["ADMIN", "SUPERADMIN"].includes(session.role);

        const entries = await prisma.blockList.findMany({
            where: isAdmin ? {} : { domain: session.domain },
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
export async function POST(request) {
    try {
        const data = await request.json();
        await prisma.blockList.create({
            data: {
                email: data.email,
                reason: data.reason ? data.reason : "Manually added to blocklist",
                domain: data.domain? data.domain : null
            },
        });
        return NextResponse.json({ message: "Blocklist data received", data });
    } catch (error) {
        console.error("Error adding to blocklist:", error);
        return NextResponse.json({ error: "Failed to add to blocklist" }, { status: 500 });
    }
}

// DELETE A BLOCKLIST ENTRY
// export async function DELETE(request) {
//     await prisma.blockList.deleteMany({});
//     return NextResponse.json({ message: "All blocklist entries deleted" });
// }
