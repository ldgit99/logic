import { buildAssessmentMessages, buildFeedbackMessages, buildLearningMessages } from '../services/promptBuilder.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {}

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {}
  }
  return null;
}

function extractCompletionResult(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return parseJsonObject(content);
  if (Array.isArray(content)) {
    const text = content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item?.type === 'text') return item.text || '';
        return '';
      })
      .join('');
    return parseJsonObject(text);
  }
  return null;
}

async function callOpenAI(env, messages, maxTokens = 900) {
  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      stream: false,
      temperature: 0.25,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages,
    }),
  });

  if (!openaiRes.ok) {
    return json({ error: await openaiRes.text() }, openaiRes.status);
  }

  const data = await openaiRes.json();
  const result = extractCompletionResult(data);
  if (!result) {
    return json({
      error: 'invalid_model_json',
      detail: 'Model response was not valid JSON.',
      raw: data?.choices?.[0]?.message?.content || null,
    }, 502);
  }
  return json({ result, raw: data }, 200);
}

export async function handleChat(request, env, pathname) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }

  if (pathname === '/chat/respond') {
    const mode = String(body.mode || '').trim();
    if (mode === 'learning') {
      return callOpenAI(env, buildLearningMessages(body), 900);
    }
    if (mode === 'assessment') {
      return callOpenAI(env, buildAssessmentMessages(body), 700);
    }
    return json({ error: 'unsupported mode' }, 400);
  }

  if (pathname === '/chat/feedback') {
    return callOpenAI(env, buildFeedbackMessages(body), 1600);
  }

  return json({ error: 'Not Found' }, 404);
}
