const WORKER_URLS = [
  window.location.origin,
  'https://logic-proxy.dongkuklee99.workers.dev/',
  'https://logic.dongkuklee99.workers.dev/',
];

function buildFeedbackPrompt(chapterData, messages) {
  const chatLog = messages
    .filter((m) => m.role !== 'system')
    .map((m) => `[${m.role === 'user' ? '학생' : 'AI 튜터'}]\n${m.content}`)
    .join('\n\n---\n\n');

  return `당신은 디지털 논리회로 과목의 엄격한 평가자입니다.
아래 대화 로그를 분석하여, 칭찬은 짧게 하고 개선점은 매우 비판적이고 구체적으로 작성하세요.

[챕터] ${chapterData.title}
[문항 수] ${chapterData.formativeAssessment.totalQuestions}

[대화 로그]
${chatLog}

[출력 규칙]
1. 반드시 JSON만 출력합니다.
2. feedUp은 "강점 칭찬"만 1-2문장으로 짧게 작성합니다.
3. feedBack은 반드시 매우 비판적으로 작성합니다.
   - 오개념, 논리 비약, 근거 부족, 용어 오용을 구체 사례와 함께 지적
   - 최소 3개 이상의 문제점을 번호 목록 형태(1), 2), 3))로 작성
4. feedForward는 개선 행동을 매우 구체적으로 제시합니다.
   - 각 개선 항목마다 "무엇을/왜/어떻게/검증기준" 포함
   - 최소 3개 이상의 실행 항목을 번호 목록 형태로 작성
5. weakConcepts에는 실제로 취약한 핵심 개념만 넣습니다.
6. score는 엄격하게 채점합니다(관대한 점수 금지).

아래 스키마를 반드시 지키세요:
{
  "correctCount": number,
  "totalCount": ${chapterData.formativeAssessment.totalQuestions},
  "score": number,
  "weakConcepts": ["string"],
  "feedUp": "string",
  "feedBack": "string",
  "feedForward": "string"
}`;
}

export async function generateFeedback(chapterData, messages) {
  const prompt = buildFeedbackPrompt(chapterData, messages);
  let lastError = null;

  for (const url of WORKER_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                '너는 엄격한 교육 평가자다. 칭찬은 짧게, 개선점은 매우 비판적이고 구체적으로 작성한다. 반드시 JSON만 반환한다.',
            },
            { role: 'user', content: prompt },
          ],
          stream: false,
          temperature: 0.2,
          max_tokens: 1400,
          response_format: { type: 'json_object' },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Feedback API error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty feedback response');

      return JSON.parse(content);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Feedback generation failed');
}