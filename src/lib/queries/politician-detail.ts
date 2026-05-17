import { prisma } from "@/lib/db";

export type PoliticianDetail = NonNullable<
  Awaited<ReturnType<typeof getPoliticianByMonaCd>>
>;

export async function getPoliticianByMonaCd(idOrMonaCd: string) {
  // 라우트 [monaCd]는 monaCd(국회의원) 또는 necId(광역단체장·교육감·기초단체장) 둘 다 받는다.
  const politician = await prisma.politician.findFirst({
    where: { OR: [{ monaCd: idOrMonaCd }, { necId: idOrMonaCd }] },
    include: {
      terms: {
        include: {
          term: true,
          district: true,
          party: true,
          pledges: { orderBy: { category: "asc" } },
        },
        orderBy: { electedDate: "desc" },
      },
      assets: { orderBy: { year: "desc" } },
      bills: { orderBy: { proposedAt: "desc" } },
    },
  });
  if (!politician) return null;

  const currentTerm = politician.terms[0] ?? null;
  return { politician, currentTerm, pastTerms: politician.terms.slice(1) };
}
