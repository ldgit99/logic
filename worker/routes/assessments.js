/**
 * routes/assessments.js
 * POST /assessment — 형성평가 결과 저장 (C2 태스크)
 *
 * KV 키 설계:
 *   assessment:{student_id}:{chapter_id}:{session_id}  → 최신 결과 덮어쓰기
 *   assessmentidx:{submitted_at}:{student_id}:{chapter_id}  → 시간 순 목록
 */

import { validateAssessment } from '../services/storage.js';

export async function handleAssessments(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid JSON' }, 400);
  }

  const error = validateAssessment(body);
  if (error) return jsonResponse({ error }, 400);

  const key = `assessment:${body.student_id}:${body.chapter_id}:${body.session_id}`;
  const value = JSON.stringify({ ...body, _savedAt: new Date().toISOString() });
  await env.SUBMISSIONS.put(key, value, { expirationTtl: 15552000 });

  // 시간 순 인덱스 (전체 목록 조회용)
  const ts = body.submitted_at || new Date().toISOString();
  const idxKey = `assessmentidx:${ts}:${body.student_id}:${body.chapter_id}`;
  await env.SUBMISSIONS.put(idxKey, key, { expirationTtl: 15552000 });

  return jsonResponse({ ok: true }, 201);
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
