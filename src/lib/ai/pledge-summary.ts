import Anthropic from "@anthropic-ai/sdk";

// Claude로 공약을 중학생 눈높이로 요약한다.
// Haiku 4.5 — 1,248건 일괄 처리 시 비용 ~$1.44, 중학생 눈높이 요약에 충분.
const DEFAULT_MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT = [
  "당신은 정치 공약을 중학교 2학년 학생도 이해할 수 있게 풀어 설명하는 도우미입니다.",
  "어려운 행정 용어·외래어는 쉬운 말로 바꾸고, 무엇을 누구에게 해주겠다는 약속인지 한 문단(2~4문장)으로 요약하세요.",
  "출처에 없는 내용을 지어내지 마세요.",
  "",
  "출력 형식 규칙 (반드시 지킬 것):",
  "- 마크다운 사용 금지: #, ##, ###, **, *, - 등 어떤 마크다운 기호도 쓰지 마세요.",
  "- 헤더·소제목·목록·강조 없이 평문 한 문단만 출력.",
  "- '쉽게 말하면:', '요약:', '안녕하세요' 같은 접두어 없이 곧바로 본문 시작.",
  "- 한 문단 2~4문장, 총 200자 내외.",
].join("\n");

let _client: Anthropic | null = null;
function client() {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  // 일괄 처리 시 50 RPM tier 한도에 밀려 429가 나는 경우가 있어 SDK 자동 재시도를 늘림.
  // SDK는 429/5xx에 대해 retry-after 헤더 기반 지수 백오프 사용.
  _client = new Anthropic({ apiKey, maxRetries: 6 });
  return _client;
}

export type SummaryResult = {
  summary: string;
  model: string;
};

export async function summarizePledge(originalText: string): Promise<SummaryResult> {
  const model = DEFAULT_MODEL;
  // 시스템 프롬프트에 prompt caching(ephemeral, 5분 TTL) 적용 — 1248회 호출에서 input 토큰 ~30% 절감.
  // 같은 시스템 메시지가 연속으로 들어오는 동안 cache hit.
  // max_tokens는 rate-limit pre-check에 그대로 잡힘 (실제 출력량 아님).
  // 본 요약은 200자 내외(=~150 tok)이므로 250이면 충분 + OPM 한도(10k/분) 여유 확보.
  const res = await client().messages.create({
    model,
    max_tokens: 250,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: originalText }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return { summary: text, model };
}
