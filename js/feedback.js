const WORKER_URLS = [
  'https://logic-proxy.dongkuklee99.workers.dev/',
  'https://logic-proxy.ldgit99.workers.dev/',
];

function buildFeedbackPrompt(chapterData, messages) {
  const chatLog = messages
    .filter((m) => m.role !== 'system')
    .map((m) => `[${m.role === 'user' ? '학생' : 'AI 튜터'}]\n${m.content}`)
    .join('\n\n---\n\n');

  return `당신은 디지털 논리회로 형성평가 분석 전문가입니다.
아래 대화 기록을 바탕으로 학습 피드백을 JSON 형식으로 작성하세요.

[챕터] ${chapterData.title}
[문항 수] ${chapterData.formativeAssessment.totalQuestions}

[대화 기록]
${chatLog}

반드시 아래 JSON 키를 포함하세요:
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
            { role: 'system', content: 'JSON만 반환하세요.' },
            { role: 'user', content: prompt },
          ],
          stream: false,
          temperature: 0.3,
          max_tokens: 1200,
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