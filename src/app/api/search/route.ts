import { NextResponse, type NextRequest } from "next/server";
import {
  searchBillsByKeyword,
  searchByRegion,
  searchPoliticiansByName,
} from "@/lib/queries/search";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ politicians: [], regions: [], bills: [] });

  const [politicians, regions, bills] = await Promise.all([
    searchPoliticiansByName(q),
    searchByRegion(q),
    searchBillsByKeyword(q),
  ]);
  return NextResponse.json({ politicians, regions, bills });
}
