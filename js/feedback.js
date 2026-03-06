// ─── Worker URL (chatbot.js와 동일하게 유지) ───
const WORKER_URL = 'https://logic-proxy.ldgit99.workers.dev';

// ─── 피드백 분석 프롬프트 생성 ───
function buildFeedbackPrompt(chapterData, messages) {
  const chatLog = messages
    .filter(m => m.role !== 'system')
    .map(m => `[${m.role === 'user' ? '학생' : 'AI 튜터'}]\n${m.content}`)
    .join('\n\n---\n\n');

  return `당신은 디지털 논리회로 과목의 형성평가 분석 전문가입니다.
아래 학생의 형성평가 대화 기록을 분석하여 Hattie & Timperley의 3단계 피드백 모델로 평가 보고서를 생성하세요.

[챕터] ${chapterData.title}
[총 문항] ${chapterData.formativeAssessment.totalQuestions}개
[평가 기준]
${chapterData.formativeAssessment.questions.map((q, i) =>
    `Q${i + 1} [${q.bloomLevel}]: ${q.question}\n  모범답안: ${q.keyAnswer}`
  ).join('\n')}

[대화 기록]
${chatLog}

아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "correctCount": <정답 또는 대체로 올바른 문항 수 (숫자)>,
  "totalCount": ${chapterData.formativeAssessment.totalQuestions},
  "score": <점수 0-100 (숫자)>,
  "weakConcepts": ["<취약 개념 1>", "<취약 개념 2>"],
  "feedUp": "<Feed Up: 이번 챕터 학습목표를 얼마나 달성했는지 평가. 강점을 먼저 언급 (2-3문장)>",
  "feedBack": "<Feed Back: 오답·혼동이 있었던 개념과 그 이유를 구체적으로 설명 (3-4문장)>",
  "feedForward": "<Feed Forward: 취약 개념을 보완하기 위한 구체적인 다음 학습 단계 안내 (2-3문장)>"
}`;
}

// ─── AI 피드백 생성 (non-streaming, JSON) ───
export async function generateFeedback(chapterData, messages) {
  const prompt = buildFeedbackPrompt(chapterData, messages);

  const res = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: '당신은 교육 평가 전문가입니다. 요청된 JSON 형식으로만 응답합니다.' },
        { role: 'user', content: prompt },
      ],
      stream: false,
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Feedback API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty feedback response');

  return JSON.parse(content);
}
