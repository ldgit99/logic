/**
 * instrumentation.js
 * 학생 앱 이벤트 전송 유틸리티 (D 태스크)
 *
 * 기능:
 *  - Worker /events, /assessment, /feedback-report 엔드포인트로 전송
 *  - 전송 실패 시 localStorage 큐에 저장 → 재시도 (지수 백오프)
 *  - 멱등키(event_id) 생성으로 중복 저장 방지
 */

const WORKER_URLS = [
  'https://logic-proxy.dongkuklee99.workers.dev',
  'https://logic-proxy.ldgit99.workers.dev',
];

const QUEUE_KEY = 'logic_event_queue';
const MAX_RETRIES = 4;
const BACKOFF_BASE_MS = 2000;

// ── UUID 생성 ─────────────────────────────────────────────────────

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── 이벤트 전송 ───────────────────────────────────────────────────

/**
 * 학생 앱 이벤트를 전송한다.
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
 * 형성평가 결과를 전송한다.
 * @param {object} assessmentData
 */
export function sendAssessment(assessmentData) {
  postWithFallback('/assessment', assessmentData);
}

/**
 * 피드백 리포트를 전송한다.
 * @param {object} feedbackData
 */
export function sendFeedbackReport(feedbackData) {
  postWithFallback('/feedback-report', feedbackData);
}

// ── 전송 + 실패 큐 ────────────────────────────────────────────────

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
        keepalive: true, // 페이지 종료 직전에도 전송 시도
      });
      if (res.ok || res.status === 201 || res.status === 200) return true;
    } catch {
      // 다음 URL 시도
    }
  }
  return false;
}

// ── 로컬 큐 ──────────────────────────────────────────────────────

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
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-200))); // 최대 200개
  } catch {
    // localStorage 용량 초과 시 무시
  }
}

// ── 재시도 (지수 백오프) ──────────────────────────────────────────

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
    if (ok) continue; // 성공: 큐에서 제거

    if (item.retries >= MAX_RETRIES) continue; // 최대 재시도 초과: 버림

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

// 페이지 로드 시 큐에 남은 항목 재전송 시도
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const queue = loadQueue();
    if (queue.length > 0) scheduleFlush();
  });
}
