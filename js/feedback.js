// ??? Worker URL (chatbot.js? ?숈씪?섍쾶 ?좎?) ???
const WORKER_URL = 'https://logic.dongkuklee99.workers.dev/';

// ??? ?쇰뱶諛?遺꾩꽍 ?꾨＼?꾪듃 ?앹꽦 ???
function buildFeedbackPrompt(chapterData, messages) {
  const chatLog = messages
    .filter(m => m.role !== 'system')
    .map(m => `[${m.role === 'user' ? '?숈깮' : 'AI ?쒗꽣'}]\n${m.content}`)
    .join('\n\n---\n\n');

  return `?뱀떊? ?붿????쇰━?뚮줈 怨쇰ぉ???뺤꽦?됯? 遺꾩꽍 ?꾨Ц媛?낅땲??
?꾨옒 ?숈깮???뺤꽦?됯? ???湲곕줉??遺꾩꽍?섏뿬 Hattie & Timperley??3?④퀎 ?쇰뱶諛?紐⑤뜽濡??됯? 蹂닿퀬?쒕? ?앹꽦?섏꽭??

[梨뺥꽣] ${chapterData.title}
[珥?臾명빆] ${chapterData.formativeAssessment.totalQuestions}媛?[?됯? 湲곗?]
${chapterData.formativeAssessment.questions.map((q, i) =>
    `Q${i + 1} [${q.bloomLevel}]: ${q.question}\n  紐⑤쾾?듭븞: ${q.keyAnswer}`
  ).join('\n')}

[???湲곕줉]
${chatLog}

?꾨옒 JSON ?뺤떇?쇰줈留??묐떟?섏꽭??(?ㅻⅨ ?띿뒪???놁씠):
{
  "correctCount": <?뺣떟 ?먮뒗 ?泥대줈 ?щ컮瑜?臾명빆 ??(?レ옄)>,
  "totalCount": ${chapterData.formativeAssessment.totalQuestions},
  "score": <?먯닔 0-100 (?レ옄)>,
  "weakConcepts": ["<痍⑥빟 媛쒕뀗 1>", "<痍⑥빟 媛쒕뀗 2>"],
  "feedUp": "<Feed Up: ?대쾲 梨뺥꽣 ?숈뒿紐⑺몴瑜??쇰쭏???ъ꽦?덈뒗吏 ?됯?. 媛뺤젏??癒쇱? ?멸툒 (2-3臾몄옣)>",
  "feedBack": "<Feed Back: ?ㅻ떟쨌?쇰룞???덉뿀??媛쒕뀗怨?洹??댁쑀瑜?援ъ껜?곸쑝濡??ㅻ챸 (3-4臾몄옣)>",
  "feedForward": "<Feed Forward: 痍⑥빟 媛쒕뀗??蹂댁셿?섍린 ?꾪븳 援ъ껜?곸씤 ?ㅼ쓬 ?숈뒿 ?④퀎 ?덈궡 (2-3臾몄옣)>"
}`;
}

// ??? AI ?쇰뱶諛??앹꽦 (non-streaming, JSON) ???
export async function generateFeedback(chapterData, messages) {
  const prompt = buildFeedbackPrompt(chapterData, messages);

  const res = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: '?뱀떊? 援먯쑁 ?됯? ?꾨Ц媛?낅땲?? ?붿껌??JSON ?뺤떇?쇰줈留??묐떟?⑸땲??' },
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

