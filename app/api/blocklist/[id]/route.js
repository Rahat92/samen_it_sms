import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ALLOWED_STATUSES = ["PENDING", "APPROVED", "REJECTED"];

async function updateStatus(request, { params }) {
  try {
    const { id } = await params;
    const blockId = Number(id);

    if (!Number.isInteger(blockId) || blockId <= 0) {
      return NextResponse.json({ error: "Invalid blocklist ID" }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }

    if (!ALLOWED_STATUSES.includes(body?.status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${ALLOWED_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const updatedBlock = await prisma.blockList.update({
      where: { id: blockId },
      data: { status: body.status },
    });

    return NextResponse.json({ message: "Blocklist entry updated", data: updatedBlock });
  } catch (error) {
    // Prisma: record to update was not found
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Blocklist entry not found" }, { status: 404 });
    }

    console.error("Failed to update blocklist entry:", error);
    return NextResponse.json({ error: "Failed to update blocklist entry" }, { status: 500 });
  }
}

export const PUT = updateStatus;
export const PATCH = updateStatus;