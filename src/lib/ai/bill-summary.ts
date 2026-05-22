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
  usage: { inputTokens: number; outputTokens: number };
};

export async function summarizeBill(
  billName: string,
  modelOverride?: string,
): Promise<SummaryResult> {
  const model = modelOverride ?? DEFAULT_MODEL;
  const res = await client().messages.create({
    model,
    max_tokens: 200,
    system:
      "당신은 국회에 발의된 법안 이름을 중학교 2학년 학생도 이해할 수 있게 풀어 설명하는 도우미입니다.\n" +
      "법안명만 주어졌을 때, 그 법이 무엇을 바꾸려고 하는지 단 한 문장(50~100자)으로만 답하세요.\n\n" +
      "규칙:\n" +
      "- 마크다운 사용 금지 (#, *, **, 목록, 헤딩, bold 절대 사용 금지). 평문 한 문장만.\n" +
      "- 응답에 법안명을 다시 적지 마세요.\n" +
      "- 사용자에게 다시 묻는 말이나 사족 금지. 예시 금지 표현: '구체적으로 알려주시면', '자세한 내용은', '~를 봐야 알 수 있습니다', '더 자세히 알려면'.\n" +
      "- 조항 번호·외래어·법률 용어는 쉬운 말로 풀어 쓰세요. 단, 풀어 쓴 설명은 1~2개 단어만 괄호로 짧게.\n" +
      "- 추측이 필요하면 '~로 보입니다' 정도만, 단정 짓지 마세요.\n" +
      "- 출처에 없는 내용을 지어내지 마세요.",
    messages: [{ role: "user", content: `법안명: ${billName}` }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return {
    summary: text,
    model,
    usage: {
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
    },
  };
}
