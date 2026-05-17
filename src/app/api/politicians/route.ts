import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

// 매 요청마다 최신 DB를 보고 싶다. 캐싱하지 않음.
export const dynamic = "force-dynamic";

const VALID_ELECTED = new Set(["CONSTITUENCY", "PROPORTIONAL"]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const party = searchParams.get("party");
  const electedAs = searchParams.get("electedAs");
  const q = searchParams.get("q");

  const rows = await prisma.politicianTerm.findMany({
    where: {
      term: { positionType: "NATIONAL_ASSEMBLY", number: 22 },
      ...(party ? { party: { name: party } } : {}),
      ...(electedAs && VALID_ELECTED.has(electedAs)
        ? { electedAs: electedAs as "CONSTITUENCY" | "PROPORTIONAL" }
        : {}),
      ...(q ? { politician: { name: { contains: q } } } : {}),
    },
    include: {
      politician: true,
      party: true,
      district: true,
    },
    orderBy: { politician: { name: "asc" } },
  });

  return NextResponse.json({
    total: rows.length,
    data: rows.map((r) => ({
      id: r.id,
      politicianId: r.politicianId,
      name: r.politician.name,
      hanjaName: r.politician.hanjaName,
      birthYear: r.politician.birthYear,
      gender: r.politician.gender,
      monaCd: r.politician.monaCd,
      positionTitle: r.positionTitle,
      electedAs: r.electedAs,
      party: r.party
        ? { name: r.party.name, shortName: r.party.shortName, color: r.party.color }
        : null,
      district: {
        id: r.district.id,
        name: r.district.name,
        isProportional: r.district.isProportional,
      },
    })),
  });
}
