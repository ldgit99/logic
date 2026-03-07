/**
 * routes/feedbackReports.js
 * POST /feedback-report — 피드백 리포트 저장 (C3 태스크)
 *
 * KV 키 설계:
 *   feedback:{student_id}:{chapter_id}:{session_id}  → 최신 피드백
 */

import { validateFeedback } from '../services/storage.js';

export async function handleFeedbackReports(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid JSON' }, 400);
  }

  const error = validateFeedback(body);
  if (error) return jsonResponse({ error }, 400);

  const key = `feedback:${body.student_id}:${body.chapter_id}:${body.session_id}`;
  const value = JSON.stringify({ ...body, _savedAt: new Date().toISOString() });
  await env.SUBMISSIONS.put(key, value, { expirationTtl: 15552000 });

  return jsonResponse({ ok: true }, 201);
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
