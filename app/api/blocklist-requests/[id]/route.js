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


// PATCH /api/blocklist/:id/unblock-request  { status: "APPROVED" | "REJECTED", note?: string }
// Admin only. Reviews the pending unblock request for this blocklist entry:
//   APPROVED -> request = APPROVED, blocklist entry = UNBLOCKED
//   REJECTED -> request = REJECTED, blocklist entry = BLOCKED
const STATUS_MAP = {
    APPROVE: "APPROVED",
    APPROVED: "APPROVED",
    REJECT: "REJECTED",
    REJECTED: "REJECTED",
};
 
// PATCH /api/unblock-requests/:id  { status: "APPROVED" | "REJECTED", note?: string }
// (also accepts { action: "approve" | "reject" })
// Admin only.
//   APPROVED -> request = APPROVED, blocklist entry = UNBLOCKED
//   REJECTED -> request = REJECTED, blocklist entry = BLOCKED
export async function PATCH(request, { params }) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["ADMIN", "SUPERADMIN"].includes(session.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
 
    const { id } = await params;
    const requestId = Number(id);
    if (!Number.isInteger(requestId)) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
 
    try {
        const body = await request.json().catch(() => ({}));
        const status = STATUS_MAP[String(body.status ?? body.action ?? "").toUpperCase()];
        if (!status) {
            return NextResponse.json({ error: "status must be 'APPROVED' or 'REJECTED'" }, { status: 400 });
        }
        const approved = status === "APPROVED";
        const note = body.note ? String(body.note).slice(0, 1000) : null;
 
        const result = await prisma.$transaction(async (tx) => {
            const existing = await tx.unblockRequest.findUnique({ where: { id: requestId } });
            if (!existing) return { error: "NOT_FOUND" };
 
            // Only a still-PENDING request can be reviewed; guards against two admins at once
            const { count } = await tx.unblockRequest.updateMany({
                where: { id: requestId, status: "PENDING" },
                data: {
                    status,
                    reviewedById: session.id ?? session.userId,
                    reviewNote: note,
                    reviewedAt: new Date(),
                },
            });
            if (count === 0) return { error: "ALREADY_REVIEWED", current: existing.status };
 
            const updatedRequest = await tx.unblockRequest.findUnique({ where: { id: requestId } });
            const blockList = await tx.blockList.delete({
                where: { id: existing.blockListId },
                // data: { status: approved ? "UNBLOCKED" : "BLOCKED" },
            });
            return { request: updatedRequest, blockList };
        });
 
        if (result.error === "NOT_FOUND") {
            return NextResponse.json({ error: "Request not found" }, { status: 404 });
        }
        if (result.error === "ALREADY_REVIEWED") {
            return NextResponse.json({ error: `Request already ${result.current}` }, { status: 409 });
        }
 
        return NextResponse.json({
            message: approved ? "Request approved, entry unblocked" : "Request rejected, entry stays blocked",
            data: result,
        });
    } catch (error) {
        console.error("Error reviewing unblock request:", error);
        return NextResponse.json({ error: "Failed to review unblock request" }, { status: 500 });
    }
}