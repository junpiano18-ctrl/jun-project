import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/bills/[billId]/voters?voteResult=AGREE|DISAGREE|ABSTAIN|ABSENT&partyId=...
// 표결 결과 드릴다운용 — 특정 billId의 특정 결과(+선택적 정당) 의원 목록.

export const dynamic = "force-dynamic";

type VoteResult = "AGREE" | "DISAGREE" | "ABSTAIN" | "ABSENT";
const VOTE_RESULTS: VoteResult[] = ["AGREE", "DISAGREE", "ABSTAIN", "ABSENT"];

export type Voter = {
  name: string;
  monaCd: string | null;
  partyName: string | null;
  partyColor: string | null;
  districtName: string;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ billId: string }> },
) {
  const { billId } = await params;
  const sp = req.nextUrl.searchParams;
  const voteResult = sp.get("voteResult");
  const partyId = sp.get("partyId");

  if (!voteResult || !VOTE_RESULTS.includes(voteResult as VoteResult)) {
    return NextResponse.json(
      { error: "voteResult must be AGREE|DISAGREE|ABSTAIN|ABSENT" },
      { status: 400 },
    );
  }

  // VoteRecord 단위 fetch — politician + 22대 NA term(district/party)만.
  // partyId 필터는 22대 NA term의 partyId 매칭.
  const records = await prisma.voteRecord.findMany({
    where: {
      billId,
      result: voteResult as VoteResult,
      politician: {
        terms: {
          some: {
            term: { positionType: "NATIONAL_ASSEMBLY", number: 22 },
            ...(partyId ? { partyId } : {}),
          },
        },
      },
    },
    include: {
      politician: {
        include: {
          terms: {
            where: { term: { positionType: "NATIONAL_ASSEMBLY", number: 22 } },
            include: { party: true, district: true },
            take: 1,
          },
        },
      },
    },
    orderBy: { politician: { name: "asc" } },
  });

  const voters: Voter[] = records.map((r) => {
    const term = r.politician.terms[0];
    return {
      name: r.politician.name,
      monaCd: r.politician.monaCd,
      partyName: term?.party?.name ?? null,
      partyColor: term?.party?.color ?? null,
      districtName: term?.district.name ?? "",
    };
  });

  return NextResponse.json({ voters });
}
