import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request) {
    try {
        const data = await request.json();
        await prisma.blocklist.create({
            data: {
                email: data.email,
                reason: data.reason ? data.reason : "Manually added to blocklist",
            },
        });
        return NextResponse.json({ message: "Blocklist data received", data });
    } catch (error) {
        console.error("Error adding to blocklist:", error);
        return NextResponse.json({ error: "Failed to add to blocklist" }, { status: 500 });
    }
}