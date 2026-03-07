/**
 * services/storage.js
 * KV ??μ냼 ?묎렐 怨꾩링 + ?ㅽ궎留?寃利?(C5 ?쒖뒪??
 * ?쇱슦???뚯씪?먯꽌 env.SUBMISSIONS.get/put??吏곸젒 ?몄텧?섏? ?딅뒗??
 */

// ?? ?ㅽ궎留?寃利????????????????????????????????????????????????????

export function validateEvent(body) {
  const required = ['event_id', 'event_type', 'timestamp', 'chapter_id', 'session_id'];
  for (const field of required) {
    if (!body[field]) return `Missing required field: ${field}`;
  }

  const allowedTypes = ['chat_message', 'hint_used', 'question_advanced', 'assessment_completed', 'pdf_generated', 'session_started', 'session_ended'];
  if (!allowedTypes.includes(body.event_type)) return `Unsupported event_type: ${body.event_type}`;

  if (body.event_type === 'chat_message') {
    const payload = body.payload || {};
    if (!payload.role || !payload.content || !payload.mode || !payload.timestamp) {
      return 'chat_message payload missing: role/content/mode/timestamp';
    }
  }

  return null;
}

export function validateAssessment(body) {
  const required = ['session_id', 'student_id', 'student_name', 'chapter_id', 'submitted_at', 'correct_count', 'total_count', 'score', 'weak_concepts'];
  for (const field of required) {
    if (body[field] === undefined || body[field] === null) return `?꾩닔 ?꾨뱶 ?꾨씫: ${field}`;
  }
  const score = Number(body.score);
  if (isNaN(score) || score < 0 || score > 100) return 'score??0~100 ?ъ씠 ?レ옄?ъ빞 ?⑸땲??;
  const total = Number(body.total_count);
  if (!Number.isInteger(total) || total < 1) return 'total_count??1 ?댁긽???뺤닔?ъ빞 ?⑸땲??;
  if (!Array.isArray(body.weak_concepts)) return 'weak_concepts??諛곗뿴?댁뼱???⑸땲??;
  return null;
}

export function validateFeedback(body) {
  const required = ['session_id', 'student_id', 'chapter_id', 'submitted_at', 'feed_up', 'feed_back', 'feed_forward'];
  for (const field of required) {
    if (!body[field]) return `?꾩닔 ?꾨뱶 ?꾨씫: ${field}`;
  }
  return null;
}

// ?? KV 議고쉶 ???????????????????????????????????????????????????????

const PAGE_LIMIT = 1000; // KV list 理쒕? ????

/**
 * ?됯? 寃곌낵 紐⑸줉??議고쉶?쒕떎.
 * @param {object} env
 * @param {{ chapter?: string, from?: string, to?: string, studentId?: string }} filters
 * @returns {Promise<object[]>}
 */
export async function listAssessments(env, filters = {}) {
  const listed = await env.SUBMISSIONS.list({ prefix: 'assessmentidx:', limit: PAGE_LIMIT });
  const keys = listed.keys.map((k) => k.name);

  // ?꾪꽣留? assessmentidx:{submitted_at}:{student_id}:{chapter_id}
  // submitted_at? ISO ?뺤떇(HH:MM:SS)??肄쒕줎???ы븿?섎?濡??ㅼ뿉?쒕????뚯떛?쒕떎.
  const filteredKeys = keys.filter((k) => {
    // k = "assessmentidx:2026-03-07T23:45:00.000Z:251010:02"
    const withoutPrefix = k.slice('assessmentidx:'.length); // "2026-03-07T23:45:00.000Z:251010:02"
    const lastColon2 = withoutPrefix.lastIndexOf(':');       // ?꾩튂: 02 ??
    const lastColon1 = withoutPrefix.lastIndexOf(':', lastColon2 - 1); // ?꾩튂: student_id ??
    const ts = withoutPrefix.slice(0, lastColon1);           // "2026-03-07T23:45:00.000Z"
    const studentId = withoutPrefix.slice(lastColon1 + 1, lastColon2); // "251010"
    const chapterId = withoutPrefix.slice(lastColon2 + 1);             // "02"

    if (filters.chapter && chapterId !== filters.chapter) return false;
    if (filters.studentId && !studentId.includes(filters.studentId)) return false;
    if (filters.from && ts < filters.from) return false;
    if (filters.to && ts > filters.to + 'T23:59:59Z') return false;
    return true;
  });

  // ?몃뜳???????ㅼ젣 ?곗씠??????媛?蹂묐젹 議고쉶
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
 * ?대깽??紐⑸줉 議고쉶 (session_id 湲곗?)
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


