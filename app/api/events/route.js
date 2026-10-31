import { getEvents } from "@/lib/queries";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenant = searchParams.get("tenant");
    const status = searchParams.get("status");
    const event = searchParams.get("event");
    const q = searchParams.get("q");
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 10));
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const hours = searchParams.get("timeFrom");
    const range = hours?Number(hours):{ from: fromParam, to: toParam };


    const events = await getEvents({ tenant, range, page, pageSize, status, event, q });
    return NextResponse.json(events);
  } catch (error) {
    console.error(error);

    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}