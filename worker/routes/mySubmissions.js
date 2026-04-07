/**
 * routes/mySubmissions.js
 * GET /my/submissions — 로그인한 학생 자신의 제출 현황 조회
 *
 * Authorization: Bearer <token>
 *
 * Response:
 * {
 *   student_id, student_name,
 *   assessments: [{ chapter_id, submitted_at, score, messages_count }],
 *   reflections: [{ chapter_id, saved_at, answers }]
 * }
 */

import { getSessionByToken } from '../services/studentAuth.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleMySubmissions(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) return json({ error: 'unauthorized' }, 401);

  const result = await getSessionByToken(env, token);
  if (!result?.session) return json({ error: 'unauthorized' }, 401);

  const { student_id, student_name } = result.session;

  // ── 형성평가/대화 조회 ─────────────────────────────────────────
  // KV prefix: assessment:{student_id}:
  const assessmentList = await env.SUBMISSIONS.list({ prefix: `assessment:${student_id}:` });
  const assessments = [];

  await Promise.all(
    assessmentList.keys.map(async ({ name }) => {
      const raw = await env.SUBMISSIONS.get(name);
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        assessments.push({
          chapter_id: data.chapter_id || '',
          chapter_title: data.chapter_title || '',
          submitted_at: data.submitted_at || data._savedAt || '',
          score: data.score ?? null,
          messages_count: Array.isArray(data.messages)
            ? data.messages.filter((m) => m?.role !== 'system').length
            : 0,
          has_conversation: Array.isArray(data.messages)
            ? data.messages.filter((m) => m?.role !== 'system').length > 0
            : !!(data.chat_metrics?.turn_count || data.chat_metrics?.user_message_count || data.chat_summary),
        });
      } catch {
        // skip malformed
      }
    }),
  );

  // 챕터 ID 기준 정렬, 같은 챕터 중 최신 것만
  const latestByChapter = new Map();
  assessments.forEach((a) => {
    const ch = a.chapter_id;
    const existing = latestByChapter.get(ch);
    if (!existing || a.submitted_at > existing.submitted_at) {
      latestByChapter.set(ch, a);
    }
  });
  const sortedAssessments = [...latestByChapter.values()]
    .sort((a, b) => String(a.chapter_id).localeCompare(String(b.chapter_id), undefined, { numeric: true }));

  // ── 성찰일지 조회 ─────────────────────────────────────────────
  // KV prefix: reflection:{student_id}:
  const reflList = await env.SUBMISSIONS.list({ prefix: `reflection:${student_id}:` });
  const reflections = [];

  await Promise.all(
    reflList.keys.map(async ({ name }) => {
      const raw = await env.SUBMISSIONS.get(name);
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        if (data.is_deleted) return;
        reflections.push({
          chapter_id: data.chapter_id || '',
          saved_at: data.saved_at || '',
          answers: Array.isArray(data.answers) ? data.answers : [],
        });
      } catch {
        // skip
      }
    }),
  );

  reflections.sort((a, b) =>
    String(a.chapter_id).localeCompare(String(b.chapter_id), undefined, { numeric: true }),
  );

  return json({
    ok: true,
    student_id,
    student_name,
    assessments: sortedAssessments,
    reflections,
  });
}
