import { getEvents } from "@/lib/queries";
import { NextResponse } from "next/server";
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const tenant = searchParams.get("tenant");
        const status = searchParams.get("status");
        const q = searchParams.get("q");
        const timeFrom = searchParams.get("timeFrom") || 24 ;
        const page = searchParams.get("page") || 1 ;
        const pageSize = searchParams.get("limit") || 10 ;
        const events = await getEvents({tenant, range:timeFrom, page, pageSize, status, q});
        return NextResponse.json(events);
    } catch (error) {
        console.error(error);

        return NextResponse.json(
            { error: "Failed to fetch stats" },
            { status: 500 }
        );
    }
}