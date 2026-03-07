/**
 * instrumentation.js
 * ?숈깮 ???대깽???꾩넚 ?좏떥由ы떚 (D ?쒖뒪??
 *
 * 湲곕뒫:
 *  - Worker /events, /assessment, /feedback-report ?붾뱶?ъ씤?몃줈 ?꾩넚
 *  - ?꾩넚 ?ㅽ뙣 ??localStorage ?먯뿉 ??????ъ떆??(吏??諛깆삤??
 *  - 硫깅벑??event_id) ?앹꽦?쇰줈 以묐났 ???諛⑹?
 */

const WORKER_URLS = [
  window.location.origin,
  'https://logic-proxy.dongkuklee99.workers.dev',
  'https://logic.dongkuklee99.workers.dev',
];

const QUEUE_KEY = 'logic_event_queue';
const MAX_RETRIES = 4;
const BACKOFF_BASE_MS = 2000;

// ?? UUID ?앹꽦 ?????????????????????????????????????????????????????

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ?? ?대깽???꾩넚 ???????????????????????????????????????????????????

/**
 * ?숈깮 ???대깽?몃? ?꾩넚?쒕떎.
 * @param {'chat_message'|'hint_used'|'question_advanced'|'assessment_completed'|'pdf_generated'|'session_started'|'session_ended'} eventType
 * @param {{ chapterId?: string, sessionId?: string, studentId?: string, studentName?: string, payload?: object }} meta
 */
export function sendEvent(eventType, meta = {}) {
  const event = {
    event_id: uuid(),
    event_type: eventType,
    timestamp: new Date().toISOString(),
    chapter_id: meta.chapterId || '',
    session_id: meta.sessionId || '',
    student_id: meta.studentId || '',
    student_name: meta.studentName || '',
    payload: meta.payload || {},
  };

  postWithFallback('/events', event);
}

/**
 * ?뺤꽦?됯? 寃곌낵瑜??꾩넚?쒕떎.
 * @param {object} assessmentData
 */
export function sendAssessment(assessmentData) {
  postWithFallback('/assessment', assessmentData);
}

/**
 * ?쇰뱶諛?由ы룷?몃? ?꾩넚?쒕떎.
 * @param {object} feedbackData
 */
export function sendFeedbackReport(feedbackData) {
  postWithFallback('/feedback-report', feedbackData);
}

// ?? ?꾩넚 + ?ㅽ뙣 ??????????????????????????????????????????????????

async function postWithFallback(path, body) {
  const ok = await tryPost(path, body);
  if (!ok) {
    enqueue({ path, body, retries: 0, nextRetryAt: Date.now() + BACKOFF_BASE_MS });
    scheduleFlush();
  }
}

async function tryPost(path, body) {
  for (const base of WORKER_URLS) {
    try {
      const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true, // ?섏씠吏 醫낅즺 吏곸쟾?먮룄 ?꾩넚 ?쒕룄
      });
      if (res.ok || res.status === 201 || res.status === 200) return true;
    } catch {
      // ?ㅼ쓬 URL ?쒕룄
    }
  }
  return false;
}

// ?? 濡쒖뺄 ????????????????????????????????????????????????????????

function enqueue(item) {
  const queue = loadQueue();
  queue.push(item);
  saveQueue(queue);
}

function loadQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-200))); // 理쒕? 200媛?
  } catch {
    // localStorage ?⑸웾 珥덇낵 ??臾댁떆
  }
}

// ?? ?ъ떆??(吏??諛깆삤?? ??????????????????????????????????????????

let flushTimer = null;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(flushQueue, BACKOFF_BASE_MS);
}

async function flushQueue() {
  flushTimer = null;
  const queue = loadQueue();
  if (queue.length === 0) return;

  const now = Date.now();
  const remaining = [];

  for (const item of queue) {
    if (item.nextRetryAt > now) {
      remaining.push(item);
      continue;
    }

    const ok = await tryPost(item.path, item.body);
    if (ok) continue; // ?깃났: ?먯뿉???쒓굅

    if (item.retries >= MAX_RETRIES) continue; // 理쒕? ?ъ떆??珥덇낵: 踰꾨┝

    remaining.push({
      ...item,
      retries: item.retries + 1,
      nextRetryAt: now + BACKOFF_BASE_MS * Math.pow(2, item.retries),
    });
  }

  saveQueue(remaining);

  if (remaining.length > 0) {
    const nextRetry = Math.min(...remaining.map((i) => i.nextRetryAt));
    flushTimer = setTimeout(flushQueue, Math.max(0, nextRetry - Date.now()));
  }
}

// ?섏씠吏 濡쒕뱶 ???먯뿉 ?⑥? ??ぉ ?ъ쟾???쒕룄
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const queue = loadQueue();
    if (queue.length > 0) scheduleFlush();
  });
}
