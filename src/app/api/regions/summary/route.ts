import { NextResponse } from "next/server";
import { getRegionSummary } from "@/lib/queries/region-summary";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getRegionSummary();
  return NextResponse.json(data);
}
