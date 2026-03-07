/**
 * routes/events.js
 * POST /events — 학생 앱 이벤트 수집 (C1 태스크)
 *
 * KV 키 설계:
 *   event:{event_id}  → 멱등 저장 (중복 방지)
 *   eventidx:{session_id}:{timestamp}:{event_id}  → 목록 인덱싱
 */

import { validateEvent } from '../services/storage.js';

export async function handleEvents(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid JSON' }, 400);
  }

  const error = validateEvent(body);
  if (error) return jsonResponse({ error }, 400);

  const key = `event:${body.event_id}`;

  // 멱등 저장: 이미 존재하면 200 OK 반환 (재전송 허용)
  const existing = await env.SUBMISSIONS.get(key);
  if (existing) {
    return jsonResponse({ ok: true, duplicate: true }, 200);
  }

  const value = JSON.stringify({ ...body, _savedAt: new Date().toISOString() });
  await env.SUBMISSIONS.put(key, value, { expirationTtl: 15552000 }); // 180일

  // 인덱스 키 (목록 조회용)
  const idxKey = `eventidx:${body.session_id}:${body.timestamp}:${body.event_id}`;
  await env.SUBMISSIONS.put(idxKey, body.event_id, { expirationTtl: 15552000 });

  return jsonResponse({ ok: true }, 201);
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
