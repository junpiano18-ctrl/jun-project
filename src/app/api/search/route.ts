import { NextResponse, type NextRequest } from "next/server";
import {
  searchByRegion,
  searchPoliticiansByName,
} from "@/lib/queries/search";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ politicians: [], regions: [] });

  const [politicians, regions] = await Promise.all([
    searchPoliticiansByName(q),
    searchByRegion(q),
  ]);
  return NextResponse.json({ politicians, regions });
}
