import Anthropic from "@anthropic-ai/sdk";

// Claude로 법안을 중학생 눈높이로 요약한다.
// 입력: 법안명(짧음). 본문이 없으므로 법안명만으로 무엇을 바꾸려는 법인지 풀어 설명.
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

export async function summarizeBill(billName: string): Promise<SummaryResult> {
  const model = DEFAULT_MODEL;
  const res = await client().messages.create({
    model,
    max_tokens: 300,
    system:
      "당신은 국회에 발의된 법안 이름을 중학교 2학년 학생도 이해할 수 있게 풀어 설명하는 도우미입니다. " +
      "법안명만 주어졌을 때, 그 법이 무엇을 바꾸려고 하는지 한 문장(짧게 1~2문장)으로만 쉽게 설명하세요. " +
      "조항 번호·외래어·법률 용어는 쉬운 말로. 추측이 필요하면 '~로 보입니다' 같이 단정하지 마세요. " +
      "출처에 없는 내용을 지어내지 마세요.",
    messages: [{ role: "user", content: `법안명: ${billName}` }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return { summary: text, model };
}
