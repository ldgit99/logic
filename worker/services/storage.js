/**
 * services/storage.js
 * KV 저장소 접근 계층 + 스키마 검증 (C5 태스크)
 * 라우트 파일에서 env.SUBMISSIONS.get/put을 직접 호출하지 않는다.
 */

// ── 스키마 검증 ───────────────────────────────────────────────────

export function validateEvent(body) {
  const required = ['event_id', 'event_type', 'timestamp', 'chapter_id', 'session_id', 'student_id', 'student_name'];
  for (const field of required) {
    if (!body[field]) return `필수 필드 누락: ${field}`;
  }
  const allowedTypes = ['chat_message', 'hint_used', 'question_advanced', 'assessment_completed', 'pdf_generated', 'session_started', 'session_ended'];
  if (!allowedTypes.includes(body.event_type)) return `허용되지 않는 event_type: ${body.event_type}`;
  return null;
}

export function validateAssessment(body) {
  const required = ['session_id', 'student_id', 'student_name', 'chapter_id', 'submitted_at', 'correct_count', 'total_count', 'score', 'weak_concepts'];
  for (const field of required) {
    if (body[field] === undefined || body[field] === null) return `필수 필드 누락: ${field}`;
  }
  const score = Number(body.score);
  if (isNaN(score) || score < 0 || score > 100) return 'score는 0~100 사이 숫자여야 합니다';
  const total = Number(body.total_count);
  if (!Number.isInteger(total) || total < 1) return 'total_count는 1 이상의 정수여야 합니다';
  if (!Array.isArray(body.weak_concepts)) return 'weak_concepts는 배열이어야 합니다';
  return null;
}

export function validateFeedback(body) {
  const required = ['session_id', 'student_id', 'chapter_id', 'submitted_at', 'feed_up', 'feed_back', 'feed_forward'];
  for (const field of required) {
    if (!body[field]) return `필수 필드 누락: ${field}`;
  }
  return null;
}

// ── KV 조회 ───────────────────────────────────────────────────────

const PAGE_LIMIT = 1000; // KV list 최대 키 수

/**
 * 평가 결과 목록을 조회한다.
 * @param {object} env
 * @param {{ chapter?: string, from?: string, to?: string, studentId?: string }} filters
 * @returns {Promise<object[]>}
 */
export async function listAssessments(env, filters = {}) {
  const listed = await env.SUBMISSIONS.list({ prefix: 'assessmentidx:', limit: PAGE_LIMIT });
  const keys = listed.keys.map((k) => k.name);

  // 필터링: assessmentidx:{submitted_at}:{student_id}:{chapter_id}
  const filteredKeys = keys.filter((k) => {
    const parts = k.split(':');
    const ts = parts[1] || '';
    const studentId = parts[2] || '';
    const chapterId = parts[3] || '';

    if (filters.chapter && chapterId !== filters.chapter) return false;
    if (filters.studentId && !studentId.includes(filters.studentId)) return false;
    if (filters.from && ts < filters.from) return false;
    if (filters.to && ts > filters.to + 'T23:59:59Z') return false;
    return true;
  });

  // 인덱스 키 → 실제 데이터 키 → 값 병렬 조회
  const dataKeys = await Promise.all(
    filteredKeys.map((idxKey) => env.SUBMISSIONS.get(idxKey))
  );

  const values = await Promise.all(
    dataKeys
      .filter(Boolean)
      .map((dataKey) => env.SUBMISSIONS.get(dataKey))
  );

  return values
    .filter(Boolean)
    .map((v) => { try { return JSON.parse(v); } catch { return null; } })
    .filter(Boolean);
}

/**
 * 이벤트 목록 조회 (session_id 기준)
 */
export async function listEvents(env, sessionId) {
  const listed = await env.SUBMISSIONS.list({ prefix: `eventidx:${sessionId}:`, limit: PAGE_LIMIT });
  const eventIds = listed.keys.map((k) => k.name.split(':').pop());

  const values = await Promise.all(
    eventIds.map((id) => env.SUBMISSIONS.get(`event:${id}`))
  );

  return values
    .filter(Boolean)
    .map((v) => { try { return JSON.parse(v); } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));
}
