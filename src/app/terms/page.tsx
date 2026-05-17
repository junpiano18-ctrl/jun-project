import Link from "next/link";

export const metadata = {
  title: "이용약관 | 내머슴닷컴",
};

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/"
        className="mb-6 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ← 지도로 돌아가기
      </Link>

      <h1 className="mb-2 text-2xl font-bold tracking-tight">이용약관</h1>
      <p className="mb-8 text-xs text-zinc-500">최종 수정일: 2026년 5월 18일</p>

      <div className="space-y-6 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <Section title="제1조 (목적)">
          <p>
            이 약관은 내머슴닷컴(이하 &quot;서비스&quot;)이 제공하는 공익 정보 조회 서비스를
            이용함에 있어 운영자와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
          </p>
        </Section>

        <Section title="제2조 (서비스의 정의)">
          <p>
            서비스는 대한민국 선출직 정치인의 공개 정보(임기·소속·표결·발의·재산 등)를 지도와
            함께 시각화하여 누구나 무료로 열람할 수 있도록 제공하는 공익 목적의 비영리
            정보서비스입니다.
          </p>
        </Section>

        <Section title="제3조 (데이터의 출처와 책임)">
          <p>
            서비스는 열린국회정보, 중앙선거관리위원회, 공직자윤리위원회 등 공공기관이 공개한
            자료를 가공·표시합니다. 표시되는 모든 사실·수치의 1차 출처는 각 기관이며, 서비스는
            데이터를 변형·가공하지 않고 출처를 함께 표기합니다.
          </p>
          <p className="mt-2">
            데이터의 최신성·정확성은 출처 기관 갱신 시점에 의존하며, 서비스가 이를 보증하지
            않습니다.
          </p>
        </Section>

        <Section title="제4조 (이용자의 의무)">
          <ul className="list-disc space-y-1 pl-5">
            <li>서비스의 데이터를 정치적 비방·혐오·허위사실 유포 목적으로 사용해서는 안 됩니다.</li>
            <li>서비스에 게시된 데이터의 출처를 임의로 제거·왜곡하지 않습니다.</li>
            <li>대량 자동화 수집(스크래핑) 시에는 서버 부하를 고려한 합리적 간격을 유지합니다.</li>
          </ul>
        </Section>

        <Section title="제5조 (금지 행위)">
          <ul className="list-disc space-y-1 pl-5">
            <li>서비스를 통한 명예훼손, 모욕, 사실 왜곡, 선거법 위반 행위</li>
            <li>서비스의 정상 운영을 방해하는 행위(과도한 요청, 우회 접근 등)</li>
            <li>서비스 데이터를 가공해 유료로 재판매하는 행위</li>
          </ul>
        </Section>

        <Section title="제6조 (책임의 제한)">
          <p>
            서비스는 공공 자료를 무료·무보증으로 제공합니다. 표시 정보의 오류·누락·지연으로 인한
            손해에 대해 운영자는 고의 또는 중과실이 없는 한 책임지지 않습니다. 정치적 판단·선거
            결정 등은 전적으로 이용자 본인의 책임입니다.
          </p>
        </Section>

        <Section title="제7조 (지식재산권)">
          <p>
            서비스의 디자인·코드·문구 등 창작물의 저작권은 운영자에게 있습니다. 다만 표시되는
            공공 자료의 저작권은 각 출처 기관 또는 공공누리 표시 조건을 따릅니다.
          </p>
          <p className="mt-2">
            지도: © OpenStreetMap contributors · 선거구 경계: © OhmyNews (MIT) · 행정동 경계: ©
            VW-Lab 김승범 (admdongkor)
          </p>
        </Section>

        <Section title="제8조 (정정·삭제 요청)">
          <p>
            서비스에 표시된 본인 관련 정보의 사실관계 오류 또는 최신성 문제에 대해 정정·삭제를
            요청할 수 있습니다. 운영자는 합리적 기간 내에 검토 후 반영합니다.
          </p>
        </Section>

        <Section title="제9조 (약관의 변경)">
          <p>
            이 약관은 관련 법령 또는 서비스 정책 변경에 따라 개정될 수 있으며, 변경 시 서비스
            화면을 통해 공지합니다.
          </p>
        </Section>

        <Section title="제10조 (문의)">
          <p>
            서비스에 관한 문의·정정 요청은 아래로 연락 주십시오.
          </p>
          <p className="mt-2">
            이메일:{" "}
            <a
              href="mailto:junpiano18@gmail.com"
              className="text-zinc-900 underline hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-zinc-300"
            >
              junpiano18@gmail.com
            </a>
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      {children}
    </section>
  );
}
