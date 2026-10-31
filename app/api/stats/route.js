import { getStats } from "@/lib/queries";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenant = searchParams.get("tenant");

    // Custom / Today window: ?from=<ms>&to=<ms>
    // Rolling window:        ?timeFrom=<hours>   (default 24)
    const hours = searchParams.get("timeFrom");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const range = hours ? Number(hours) : { from: fromParam, to: toParam };


    const stats = await getStats(tenant, range);
    return NextResponse.json(stats);
  } catch (error) {
    console.error(error);

    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}