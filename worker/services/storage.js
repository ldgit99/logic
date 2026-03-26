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
    'assessment_started',
    'assessment_judged',
    'chat_summary_updated',
    'pdf_generated',
    'session_started',
    'session_ended',
  ];

  if (!allowedTypes.includes(body.event_type)) {
    return `Unsupported event_type: ${body.event_type}`;
  }

  if (body.event_type === 'chat_message') {
    if (!body.student_id) return 'chat_message missing: student_id';
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
const EVENTS_TTL_SECONDS = 15552000; // 180 days

async function listAllKeys(env, prefix) {
  const out = [];
  let cursor;
  do {
    const listed = await env.SUBMISSIONS.list({ prefix, limit: PAGE_LIMIT, cursor });
    out.push(...(listed.keys || []));
    cursor = listed.list_complete ? undefined : listed.cursor;
  } while (cursor);
  return out;
}

/**
 * List assessment records with optional filters.
 */
export async function listAssessments(env, filters = {}) {
  const keys = await listAllKeys(env, 'assessmentidx:');

  // assessmentidx:{submitted_at}:{student_id}:{chapter_id}
  const filteredKeys = keys.map((k) => k.name).filter((k) => {
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
 * List all registered students (auth:user:* keys).
 */
export async function listRoster(env) {
  const listed = await env.SUBMISSIONS.list({ prefix: 'auth:user:', limit: PAGE_LIMIT });
  const values = await Promise.all(listed.keys.map((k) => env.SUBMISSIONS.get(k.name)));
  return values
    .filter(Boolean)
    .map((v) => {
      try {
        const u = JSON.parse(v);
        return {
          student_id: u.student_id || '',
          student_name: u.student_name || '',
          email: u.email || '',
          created_at: u.created_at || '',
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.student_id.localeCompare(b.student_id));
}

/**
 * List events by session id.
 */
export async function listEvents(env, sessionId) {
  const keys = await listAllKeys(env, `eventidx:${sessionId}:`);
  const eventIds = keys.map((k) => k.name.split(':').pop());

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

function toIsoOrNow(value) {
  const text = String(value || '');
  const ms = Date.parse(text);
  if (Number.isNaN(ms)) return new Date().toISOString();
  return new Date(ms).toISOString();
}

function sessionMetaKey(studentId, chapterId, sessionId) {
  return `sessionmeta:${studentId}:${chapterId}:${sessionId}`;
}

function sessionLatestKey(studentId, chapterId) {
  return `sessionlatest:${studentId}:${chapterId}`;
}

function sessionScopeKey(sessionId) {
  return `sessionscope:${sessionId}`;
}

export async function upsertSessionIndexes(env, args) {
  const studentId = String(args.studentId || '').trim();
  const chapterId = String(args.chapterId || '').trim();
  const sessionId = String(args.sessionId || '').trim();
  if (!studentId || !chapterId || !sessionId) return;

  const mode = String(args.mode || '');
  const lastUpdated = toIsoOrNow(args.timestamp);
  const incrementMessageCount = Boolean(args.incrementMessageCount);
  const nextState = args.state && typeof args.state === 'object' ? args.state : null;

  const metaK = sessionMetaKey(studentId, chapterId, sessionId);
  let current = null;
  try {
    const raw = await env.SUBMISSIONS.get(metaK);
    current = raw ? JSON.parse(raw) : null;
  } catch {
    current = null;
  }

  const next = {
    student_id: studentId,
    chapter_id: chapterId,
    session_id: sessionId,
    mode: mode || current?.mode || 'learning',
    message_count: Number(current?.message_count || 0) + (incrementMessageCount ? 1 : 0),
    last_updated: lastUpdated,
    created_at: current?.created_at || lastUpdated,
    state: nextState || current?.state || null,
  };

  await env.SUBMISSIONS.put(metaK, JSON.stringify(next), { expirationTtl: EVENTS_TTL_SECONDS });
  await env.SUBMISSIONS.put(
    sessionLatestKey(studentId, chapterId),
    JSON.stringify({ session_id: sessionId, chapter_id: chapterId, updated_at: lastUpdated }),
    { expirationTtl: EVENTS_TTL_SECONDS },
  );
  await env.SUBMISSIONS.put(
    sessionScopeKey(sessionId),
    JSON.stringify({ student_id: studentId, chapter_id: chapterId, updated_at: lastUpdated }),
    { expirationTtl: EVENTS_TTL_SECONDS },
  );
}

export async function getLatestSessionForStudentChapter(env, studentId, chapterId) {
  const student = String(studentId || '').trim();
  const chapter = String(chapterId || '').trim();
  if (!student || !chapter) return null;
  const raw = await env.SUBMISSIONS.get(sessionLatestKey(student, chapter));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.session_id) return null;
    return {
      session_id: parsed.session_id,
      chapter_id: parsed.chapter_id || chapter,
      updated_at: parsed.updated_at || '',
      mode: parsed.mode || '',
      message_count: Number(parsed.message_count || 0),
      state: parsed.state || null,
    };
  } catch {
    return null;
  }
}

export async function getSessionScope(env, sessionId) {
  const sid = String(sessionId || '').trim();
  if (!sid) return null;
  const raw = await env.SUBMISSIONS.get(sessionScopeKey(sid));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.student_id || !parsed?.chapter_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function listSessionMessages(env, sessionId) {
  const events = await listEvents(env, sessionId);
  return events
    .filter((e) => e?.event_type === 'chat_message')
    .map((e) => {
      const payload = e.payload || {};
      return {
        role: String(payload.role || ''),
        content: String(payload.content || ''),
        mode: String(payload.mode || 'learning'),
        timestamp: String(payload.timestamp || e.timestamp || ''),
        session_id: String(e.session_id || sessionId),
        chapter_id: String(e.chapter_id || payload.chapter_id || ''),
      };
    })
    .filter((m) => m.role && m.content)
    .sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));
}
