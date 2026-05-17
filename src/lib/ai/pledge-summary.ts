import Anthropic from "@anthropic-ai/sdk";

// Claude로 공약을 중학생 눈높이로 요약한다.
// 첫 호출 시 모델 ID는 sonnet-4-6을 기본으로 — 비용/품질 균형.
const DEFAULT_MODEL = "claude-sonnet-4-6";

let _client: Anthropic | null = null;
function client() {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  _client = new Anthropic({ apiKey });
  return _client;
}

export type SummaryResult = {
  summary: string;
  model: string;
};

export async function summarizePledge(originalText: string): Promise<SummaryResult> {
  const model = DEFAULT_MODEL;
  const res = await client().messages.create({
    model,
    max_tokens: 400,
    system:
      "당신은 정치 공약을 중학교 2학년 학생도 이해할 수 있게 풀어 설명하는 도우미입니다. " +
      "어려운 행정 용어·외래어는 쉬운 말로 바꾸고, 무엇을 누구에게 해주겠다는 약속인지 " +
      "한 문단(2~4문장)으로 요약하세요. 출처에 없는 내용을 지어내지 마세요.",
    messages: [{ role: "user", content: originalText }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return { summary: text, model };
}
