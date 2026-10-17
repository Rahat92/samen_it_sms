import { getStats } from "@/lib/queries";
import { NextResponse } from "next/server";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const tenant = searchParams.get("tenant");
        const timeFrom = searchParams.get("timeFrom") || 24 ;
        const stats = await getStats(tenant, timeFrom);
        return NextResponse.json(stats);
    } catch (error) {
        console.error(error);

        return NextResponse.json(
            { error: "Failed to fetch stats" },
            { status: 500 }
        );
    }
}