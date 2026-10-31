import { getGraphEvents } from "@/lib/queries";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenant = searchParams.get("tenant");
    const status = searchParams.get("status");
    const hours = searchParams.get("timeFrom");

    // Custom / Today window: ?from=<ms>&to=<ms>
    // Rolling window:        ?timeFrom=<hours>   (default 24)
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const range = hours ? Number(hours) : { from: fromParam, to: toParam };

    const events = await getGraphEvents({ tenant, range, status });
    return NextResponse.json(events);
  } catch (error) {
    console.error(error);

    return NextResponse.json({ error: "Failed to fetch graph events" }, { status: 500 });
  }
}