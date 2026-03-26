/**
 * routes/events.js
 * POST /events student event ingestion
 *
 * KV keys:
 *   event:{event_id}
 *   eventidx:{session_id}:{timestamp}:{event_id}
 *   sessionmeta:{student_id}:{chapter_id}:{session_id}
 *   sessionlatest:{student_id}:{chapter_id}
 */

import { validateEvent, upsertSessionIndexes } from '../services/storage.js';

const EVENTS_TTL_SECONDS = 15552000; // 180 days

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

  // Idempotent write
  const existing = await env.SUBMISSIONS.get(key);
  if (existing) {
    return jsonResponse({ ok: true, duplicate: true }, 200);
  }

  const value = JSON.stringify({ ...body, _savedAt: new Date().toISOString() });
  await env.SUBMISSIONS.put(key, value, { expirationTtl: EVENTS_TTL_SECONDS });

  const idxKey = `eventidx:${body.session_id}:${body.timestamp}:${body.event_id}`;
  await env.SUBMISSIONS.put(idxKey, body.event_id, { expirationTtl: EVENTS_TTL_SECONDS });

  if (
    body.student_id && body.chapter_id && body.session_id &&
    (body.event_type === 'chat_message' ||
      body.event_type === 'session_started' ||
      body.event_type === 'assessment_started' ||
      body.event_type === 'assessment_judged' ||
      body.event_type === 'assessment_completed' ||
      body.event_type === 'chat_summary_updated' ||
      body.event_type === 'session_ended')
  ) {
    await upsertSessionIndexes(env, {
      studentId: body.student_id,
      chapterId: body.chapter_id,
      sessionId: body.session_id,
      timestamp: body.payload?.timestamp || body.timestamp,
      mode: body.payload?.mode || '',
      incrementMessageCount: body.event_type === 'chat_message',
      state: body.payload?.session_state || null,
    });
  }

  return jsonResponse({ ok: true }, 201);
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
