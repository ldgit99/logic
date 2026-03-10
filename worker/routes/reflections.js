/**
 * routes/reflections.js
 * POST /reflections ???숈깮???깆같?쇱?瑜??쒖텧/?섏젙?쒕떎.
 * ?숈깮 Bearer ?좏겙?쇰줈 ?좎썝 ?뺤씤 ??KV?????
 */

import { getSessionByToken } from '../services/studentAuth.js';

export async function handleReflections(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  const result = token ? await getSessionByToken(env, token) : null;
  if (!result?.session) {
    return jsonResp({ error: 'unauthorized' }, 401);
  }

  const { student_id, student_name } = result.session;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResp({ error: 'invalid JSON' }, 400);
  }

  const chapterId = String(body.chapter_id || '').trim();
  const answers = Array.isArray(body.answers) ? body.answers.map(String) : [];

  if (!chapterId) return jsonResp({ error: 'missing chapter_id' }, 400);
  if (answers.length !== 3) return jsonResp({ error: 'answers must have exactly 3 items' }, 400);

  const data = {
    student_id,
    student_name,
    chapter_id: chapterId,
    answers,
    saved_at: new Date().toISOString(),
  };

  const TTL = 60 * 60 * 24 * 180; // 180 days
  await env.SUBMISSIONS.put(
    `reflection:${student_id}:${chapterId}`,
    JSON.stringify(data),
    { expirationTtl: TTL },
  );
  await env.SUBMISSIONS.put(
    `reflectionidx:${chapterId}:${student_id}`,
    `${student_id}:${chapterId}`,
    { expirationTtl: TTL },
  );

  return jsonResp({ ok: true });
}

function jsonResp(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
