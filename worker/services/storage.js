/**
 * services/storage.js
 * Validation + KV query helpers.
 */

// Schema validation
export function validateEvent(body) {
  const required = ['event_id', 'event_type', 'timestamp', 'chapter_id', 'session_id'];
  for (const field of required) {
    if (!body[field]) return `Missing required field: ${field}`;
  }

  const allowedTypes = [
    'chat_message',
    'hint_used',
    'question_advanced',
    'assessment_completed',
    'pdf_generated',
    'session_started',
    'session_ended',
  ];

  if (!allowedTypes.includes(body.event_type)) {
    return `Unsupported event_type: ${body.event_type}`;
  }

  if (body.event_type === 'chat_message') {
    const payload = body.payload || {};
    if (!payload.role || !payload.content || !payload.mode || !payload.timestamp) {
      return 'chat_message payload missing: role/content/mode/timestamp';
    }
  }

  return null;
}

export function validateAssessment(body) {
  const required = [
    'session_id',
    'student_id',
    'student_name',
    'chapter_id',
    'submitted_at',
    'correct_count',
    'total_count',
    'score',
    'weak_concepts',
  ];

  for (const field of required) {
    if (body[field] === undefined || body[field] === null) {
      return `Missing required field: ${field}`;
    }
  }

  const score = Number(body.score);
  if (Number.isNaN(score) || score < 0 || score > 100) {
    return 'score must be a number between 0 and 100';
  }

  const total = Number(body.total_count);
  if (!Number.isInteger(total) || total < 1) {
    return 'total_count must be an integer >= 1';
  }

  if (!Array.isArray(body.weak_concepts)) {
    return 'weak_concepts must be an array';
  }

  return null;
}

export function validateFeedback(body) {
  const required = ['session_id', 'student_id', 'chapter_id', 'submitted_at', 'feed_up', 'feed_back', 'feed_forward'];
  for (const field of required) {
    if (!body[field]) return `Missing required field: ${field}`;
  }
  return null;
}

// KV queries
const PAGE_LIMIT = 1000;

/**
 * List assessment records with optional filters.
 */
export async function listAssessments(env, filters = {}) {
  const listed = await env.SUBMISSIONS.list({ prefix: 'assessmentidx:', limit: PAGE_LIMIT });
  const keys = listed.keys.map((k) => k.name);

  // assessmentidx:{submitted_at}:{student_id}:{chapter_id}
  const filteredKeys = keys.filter((k) => {
    const withoutPrefix = k.slice('assessmentidx:'.length);
    const lastColon2 = withoutPrefix.lastIndexOf(':');
    const lastColon1 = withoutPrefix.lastIndexOf(':', lastColon2 - 1);
    const ts = withoutPrefix.slice(0, lastColon1);
    const studentId = withoutPrefix.slice(lastColon1 + 1, lastColon2);
    const chapterId = withoutPrefix.slice(lastColon2 + 1);

    if (filters.chapter && chapterId !== filters.chapter) return false;
    if (filters.studentId && !studentId.includes(filters.studentId)) return false;
    if (filters.from && ts < filters.from) return false;
    if (filters.to && ts > `${filters.to}T23:59:59Z`) return false;
    return true;
  });

  const dataKeys = await Promise.all(filteredKeys.map((idxKey) => env.SUBMISSIONS.get(idxKey)));

  const values = await Promise.all(
    dataKeys
      .filter(Boolean)
      .map((dataKey) => env.SUBMISSIONS.get(dataKey)),
  );

  return values
    .filter(Boolean)
    .map((v) => {
      try {
        return JSON.parse(v);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * List events by session id.
 */
export async function listEvents(env, sessionId) {
  const listed = await env.SUBMISSIONS.list({ prefix: `eventidx:${sessionId}:`, limit: PAGE_LIMIT });
  const eventIds = listed.keys.map((k) => k.name.split(':').pop());

  const values = await Promise.all(eventIds.map((id) => env.SUBMISSIONS.get(`event:${id}`)));

  return values
    .filter(Boolean)
    .map((v) => {
      try {
        return JSON.parse(v);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));
}