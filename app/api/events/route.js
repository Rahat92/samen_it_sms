import { getEvents } from "@/lib/queries";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenant = searchParams.get("tenant");
    const status = searchParams.get("status");
    const event = searchParams.get("event");
    const q = searchParams.get("q");

    // Custom / Today window: ?from=<ms>&to=<ms>
    // Rolling window:        ?timeFrom=<hours>   (default 24)
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const range =searchParams.get("timeFrom") || 24;
    let dateRange = null;
    if(fromParam && toParam){
      dateRange = {
        from:fromParam,
        to:toParam,
      }
    }
    console.log('haha', fromParam, toParam, dateRange)
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 10));

    const events = await getEvents({ tenant, range, dateRange, page, pageSize, status, event, q });
    return NextResponse.json(events);
  } catch (error) {
    console.error(error);

    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}