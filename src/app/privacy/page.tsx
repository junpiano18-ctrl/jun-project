import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "개인정보처리방침 | 내머슴닷컴",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/map"
        className="mb-6 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ← 지도로 돌아가기
      </Link>

      <h1 className="mb-2 text-2xl font-bold tracking-tight">개인정보처리방침</h1>
      <p className="mb-8 text-xs text-zinc-500">최종 수정일: 2026년 5월 18일</p>

      <div className="space-y-6 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <Section title="1. 수집하는 개인정보 항목">
          <p>
            내머슴닷컴(이하 &quot;서비스&quot;)은 회원가입·로그인 기능을 제공하지 않으며, 별도의
            개인정보를 수집하지 않습니다. 다음 정보는 서비스 운영 과정에서 자동으로 생성·수집될
            수 있습니다.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>접속 로그, IP 주소, 브라우저 종류 및 OS</li>
            <li>방문 일시, 요청 페이지 URL</li>
            <li>쿠키(필수 기능 유지를 위한 최소한의 세션 정보)</li>
          </ul>
        </Section>

        <Section title="2. 개인정보 수집 및 이용 목적">
          <p>자동 수집된 정보는 다음 목적으로만 사용합니다.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>서비스 운영 및 안정성 유지</li>
            <li>이용 통계 분석 및 서비스 개선</li>
            <li>장애·보안 사고 대응 및 부정 이용 방지</li>
          </ul>
        </Section>

        <Section title="3. 개인정보 보유 및 이용 기간">
          <p>
            접속 로그는 통신비밀보호법 등 관계 법령에 따라 일정 기간 보관 후 안전하게 파기합니다.
            그 외 자동 수집 정보는 목적 달성 즉시 또는 최대 3개월 이내 파기합니다.
          </p>
        </Section>

        <Section title="4. 제3자 제공">
          <p>
            서비스는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 법령에 따라 수사기관
            등으로부터 적법한 절차에 의한 요청이 있는 경우 협조할 수 있습니다.
          </p>
        </Section>

        <Section title="5. 외부 데이터 출처">
          <p>서비스에서 표시되는 정치인 관련 정보는 다음 공공 출처에서 제공받습니다.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>열린국회정보 (open.assembly.go.kr)</li>
            <li>중앙선거관리위원회 (nec.go.kr)</li>
            <li>공직자윤리위원회 / 국회공보 재산공개 자료</li>
            <li>OpenStreetMap (© OpenStreetMap contributors)</li>
            <li>위키미디어 공용 (사진)</li>
          </ul>
          <p className="mt-2">
            서비스는 위 출처의 데이터를 변경 없이 표시하며, 데이터의 정확성에 대해서는 각 출처
            기관에 1차 책임이 있습니다.
          </p>
        </Section>

        <Section title="6. 이용자 권리">
          <p>
            서비스는 회원 정보를 수집하지 않아 별도의 정정·삭제 절차가 필요하지 않습니다. 다만
            서비스에 표시된 정보 중 오류·이의가 있을 경우 아래 연락처로 알려주시면 검토 후
            반영합니다.
          </p>
        </Section>

        <Section title="7. 정보주체의 권리에 관한 사항">
          <p>
            서비스에 표시되는 정치인은 공직선거법상 공인이며, 표시 정보는 공공기관이 공개한
            자료에 한정됩니다. 다만 본인이 표시된 정치인은 사실관계 오류·최신성 문제에 대해 정정
            요청을 할 수 있습니다.
          </p>
        </Section>

        <Section title="8. 문의처">
          <p>개인정보 관련 문의는 다음으로 연락 주시기 바랍니다.</p>
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

        <Section title="9. 정책 변경">
          <p>
            이 처리방침은 법령·정책 또는 서비스 변경에 따라 개정될 수 있으며, 변경 시 서비스
            화면을 통해 공지합니다.
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
