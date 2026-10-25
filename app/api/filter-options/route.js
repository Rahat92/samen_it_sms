import { getFilterOptions } from "@/lib/queries";
import { NextResponse } from "next/server";
export async function GET(request) {
    try {
        const filterOption = await getFilterOptions();
        return NextResponse.json(filterOption);
    } catch (error) {
        console.error(error);

        return NextResponse.json(
            { error: "Failed to fetch stats" },
            { status: 500 }
        );
    }
}