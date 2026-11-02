import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request) {
    try {
        const blockList = await prisma.blockList.findMany();
        return NextResponse.json({ data: blockList });
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
