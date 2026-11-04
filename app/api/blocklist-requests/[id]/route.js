import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";


export async function POST(request, { params }) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    console.log("Received unblock request for blocklist ID:", id);
    const blockListId = Number(id);
    if (!Number.isInteger(blockListId)) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const userId = session.id ?? session.userId;

    try {
        const { message } = await request.json().catch(() => ({}));

        const entry = await prisma.blockList.findUnique({ where: { id: blockListId } });
        if (!entry) {
            return NextResponse.json({ error: "Blocklist entry not found" }, { status: 404 });
        }

        const admin = ["ADMIN", "SUPERADMIN"].includes(session.role);
        if (!admin && entry.domain !== session.domain) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (entry.status !== "BLOCKED") {
            return NextResponse.json(
                { error: `Entry is already ${entry.status}` },
                { status: 409 }
            );
        }

        const [unblockRequest] = await prisma.$transaction([
            prisma.unblockRequest.create({
                data: {
                    blockListId,
                    requestedById: userId,
                    message: message ? String(message).slice(0, 1000) : null,
                },
            }),
            prisma.blockList.update({
                where: { id: blockListId },
                data: { status: "UNBLOCK_REQUESTED" },
            }),
        ]);

        return NextResponse.json({ message: "Unblock request submitted", data: unblockRequest }, { status: 201 });
    } catch (error) {
        console.error("Error creating unblock request:", error);
        return NextResponse.json({ error: "Failed to submit unblock request" }, { status: 500 });
    }
}