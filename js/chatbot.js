import { sendEvent } from './instrumentation.js?v=20260309e';
import { getStudentProfile } from './auth.js?v=20260311c';

const ORIGIN = window.location.origin.endsWith('/') ? window.location.origin : `${window.location.origin}/`;
const WORKER_URLS = [
  'https://logic-proxy.dongkuklee99.workers.dev/',
  'https://logic.dongkuklee99.workers.dev/',
  ...(window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1') ? [ORIGIN] : []),
];
const VERSION = '20260326b';
const ASSESSMENT_TRIGGER = '형성평가';
const MAX_HINTS = 3;
const INDEX_KEY = 'logic_session_index_v5';
const SESSION_KEY = 'logic_session_v5';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const ChatMode = { LEARNING: 'learning', ASSESSMENT: 'assessment', DONE: 'assessment_complete' };

let chapterRef = null;
let isBusy = false;
let eventsBound = false;
let locksFetched = false;
let chapterLocks = {};
let sessionId = '';
let currentMode = ChatMode.LEARNING;
let assessmentComplete = false;
let assessmentQuestions = [];
let assessmentQIdx = 0;
let assessmentHintCount = 0;
let assessmentTrace = [];
let logMessages = [];
let memorySummary = emptyMemory();
let qualityMetrics = emptyMetrics();
let summaryTimer = null;

function el(id) { return document.getElementById(id); }
function nowIso() { return new Date().toISOString(); }
function trim(text) { return String(text || '').trim(); }
function html(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function student() {
  const profile = getStudentProfile() || {};
  return {
    studentId: profile.studentId || '',
    studentName: profile.studentName || '',
    token: profile.token || '',
  };
}
function emptyMemory() {
  return {
    coveredConcepts: [],
    misconceptions: [],
    pendingQuestions: [],
    lastStudentGoal: '',
    lastAssessmentResult: '',
  };
}
function emptyMetrics() {
  return {
    structured_response_count: 0,
    structured_fallback_count: 0,
    learning_turn_count: 0,
    assessment_turn_count: 0,
    assessment_started_count: 0,
    assessment_evaluation_count: 0,
    assessment_advance_count: 0,
    assessment_partial_count: 0,
    blocked_learning_question_count: 0,
    hint_request_count: 0,
    summary_update_count: 0,
    last_question_type: '',
  };
}
function unique(items, limit = 8) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const value = trim(item);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}
function mergeMemory(update = {}) {
  memorySummary = {
    coveredConcepts: unique([...(memorySummary.coveredConcepts || []), ...(update.coveredConcepts || [])]),
    misconceptions: unique([...(memorySummary.misconceptions || []), ...(update.misconceptions || [])]),
    pendingQuestions: unique([...(memorySummary.pendingQuestions || []), ...(update.pendingQuestions || [])], 6),
    lastStudentGoal: trim(update.lastStudentGoal) || memorySummary.lastStudentGoal || '',
    lastAssessmentResult: trim(update.lastAssessmentResult) || memorySummary.lastAssessmentResult || '',
  };
}
function derivedMetrics() {
  const users = logMessages.filter((m) => m.role === 'user');
  const avgLen = users.length
    ? Math.round(users.reduce((sum, item) => sum + trim(item.content).length, 0) / users.length)
    : 0;
  return { ...qualityMetrics, total_user_messages: users.length, average_user_message_length: avgLen };
}
function scoped(base) { return `${base}_${student().studentId || 'anon'}`; }
function sessionStorageKey(id) { return `${scoped(SESSION_KEY)}_${id}`; }
function loadIndex() {
  try { return JSON.parse(localStorage.getItem(scoped(INDEX_KEY)) || '{}'); } catch { return {}; }
}
function saveIndex(index) {
  try { localStorage.setItem(scoped(INDEX_KEY), JSON.stringify(index)); } catch {}
}
function createSessionId(chapterId) {
  return `${chapterId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
function snapshot() {
  return {
    version: VERSION,
    sessionId,
    chapterId: chapterRef?.id || '',
    currentMode,
    assessmentComplete,
    assessmentQuestions,
    assessmentQIdx,
    assessmentHintCount,
    assessmentTrace,
    logMessages,
    memorySummary,
    qualityMetrics: derivedMetrics(),
    savedAt: Date.now(),
  };
}
function persist() {
  if (!chapterRef?.id || !sessionId) return;
  try {
    localStorage.setItem(sessionStorageKey(sessionId), JSON.stringify(snapshot()));
    const index = loadIndex();
    index[chapterRef.id] = sessionId;
    saveIndex(index);
  } catch {}
}
function loadLocalSession(chapterId) {
  try {
    const id = loadIndex()[chapterId];
    if (!id) return null;
    const raw = localStorage.getItem(sessionStorageKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.chapterId !== chapterId) return null;
    if (Date.now() - Number(parsed.savedAt || 0) > SESSION_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}
function hydrate(parsed) {
  sessionId = parsed.sessionId || createSessionId(chapterRef?.id || '00');
  currentMode = parsed.currentMode || ChatMode.LEARNING;
  assessmentComplete = Boolean(parsed.assessmentComplete);
  assessmentQuestions = Array.isArray(parsed.assessmentQuestions) ? parsed.assessmentQuestions : [];
  assessmentQIdx = typeof parsed.assessmentQIdx === 'number' ? parsed.assessmentQIdx : 0;
  assessmentHintCount = typeof parsed.assessmentHintCount === 'number' ? parsed.assessmentHintCount : 0;
  assessmentTrace = Array.isArray(parsed.assessmentTrace) ? parsed.assessmentTrace : [];
  logMessages = Array.isArray(parsed.logMessages) ? parsed.logMessages : [];
  memorySummary = parsed.memorySummary ? { ...emptyMemory(), ...parsed.memorySummary } : emptyMemory();
  qualityMetrics = parsed.qualityMetrics ? { ...emptyMetrics(), ...parsed.qualityMetrics } : emptyMetrics();
}
function restoreUI() {
  const box = el('chat-messages');
  if (!box) return;
  box.innerHTML = '';
  logMessages
    .filter((m) => m.role !== 'system')
    .forEach((m) => bubble(m.role === 'assistant' ? 'ai' : m.role, m.content));
}
function bubble(role, text, typing = false) {
  const box = el('chat-messages');
  if (!box) return null;
  const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  const node = document.createElement('div');
  node.className = `chat-bubble ${role}`;

  if (role === 'system') {
    node.innerHTML = `<div class="bubble-text">${html(text)}</div>`;
  } else {
    const content = document.createElement('div');
    content.className = 'bubble-content';
    const textEl = document.createElement('div');
    textEl.className = `bubble-text${typing ? ' typing-cursor' : ''}`;
    textEl.textContent = text;
    content.appendChild(textEl);
    content.insertAdjacentHTML('beforeend', `<div class="bubble-time">${time}</div>`);
    node.innerHTML = `<div class="bubble-avatar">${role === 'ai' ? 'AI' : '나'}</div>`;
    node.appendChild(content);
  }

  box.appendChild(node);
  box.scrollTop = box.scrollHeight;
  return node;
}
function pushLog(role, content, mode = currentMode) {
  const msg = {
    role,
    content,
    mode,
    timestamp: nowIso(),
    session_id: sessionId,
    chapter_id: chapterRef?.id || '',
  };
  logMessages.push(msg);
  const s = student();
  if ((role === 'user' || role === 'assistant' || role === 'system') && s.studentId) {
    sendEvent('chat_message', {
      chapterId: msg.chapter_id,
      sessionId: msg.session_id,
      studentId: s.studentId,
      studentName: s.studentName,
      payload: { ...msg },
    });
  }
}
function badge() {
  const node = el('assessment-badge');
  if (!node) return;
  if (currentMode === ChatMode.DONE) {
    node.textContent = '완료';
    node.className = 'badge badge-complete';
    return;
  }
  if (currentMode === ChatMode.ASSESSMENT) {
    node.textContent = `평가 ${assessmentQIdx + 1}/${assessmentQuestions.length || 1}`;
    node.className = 'badge badge-active';
    return;
  }
  node.textContent = '대기 중';
  node.className = 'badge badge-pending';
}
function setSubmit(enabled) {
  const btn = el('btn-submit-pdf');
  if (btn) btn.disabled = !enabled;
}
function setBusy(busy) {
  isBusy = busy;
  const input = el('chat-input');
  const sendBtn = el('chat-send');
  if (input) input.disabled = busy;
  if (sendBtn) sendBtn.disabled = busy;
  if (!busy && input) input.focus();
}
function summaryText() {
  return [
    `이해한 개념: ${(memorySummary.coveredConcepts || []).join(', ') || '없음'}`,
    `오개념: ${(memorySummary.misconceptions || []).join(', ') || '없음'}`,
    `미해결 질문: ${(memorySummary.pendingQuestions || []).join(' | ') || '없음'}`,
    `최근 학습 목표: ${memorySummary.lastStudentGoal || '없음'}`,
    `최근 평가 결과: ${memorySummary.lastAssessmentResult || '없음'}`,
  ].join('\n');
}
function flushSummary(source) {
  qualityMetrics.summary_update_count += 1;
  if (summaryTimer) clearTimeout(summaryTimer);
  summaryTimer = setTimeout(() => {
    const s = student();
    if (!s.studentId) return;
    sendEvent('chat_summary_updated', {
      chapterId: chapterRef?.id || '',
      sessionId,
      studentId: s.studentId,
      studentName: s.studentName,
      payload: { source, summary: memorySummary, quality_metrics: derivedMetrics() },
    });
  }, 1200);
}
function parseJson(text) {
  const raw = trim(text);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch {}
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch {}
  }
  return null;
}
function parseCompletionJson(data) {
  return parseJson(data?.choices?.[0]?.message?.content || '');
}
function recentConversation(limit = 8) {
  return logMessages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-limit)
    .map((m) => ({ role: m.role, content: trim(m.content) }))
    .filter((m) => m.content);
}
async function workerRouteJson(path, body) {
  let lastError = null;
  for (const url of WORKER_URLS) {
    try {
      const base = url.endsWith('/') ? url.slice(0, -1) : url;
      const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error(`All worker endpoints failed for ${path}`);
}
async function apiGet(path, token) {
  let lastError = null;
  for (const base of WORKER_URLS) {
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403 || res.status === 404) return null;
        throw new Error(`restore api error ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError) throw lastError;
  return null;
}
async function fetchQuestions(chapterId) {
  for (const workerUrl of WORKER_URLS) {
    try {
      const base = workerUrl.endsWith('/') ? workerUrl.slice(0, -1) : workerUrl;
      const res = await fetch(`${base}/questions/${chapterId}`);
      if (res.ok) return await res.json();
    } catch {}
  }
  return null;
}
async function fetchLocks() {
  if (locksFetched) return;
  for (const base of WORKER_URLS) {
    try {
      const res = await fetch(`${base}locks`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        chapterLocks = data?.locks || {};
        locksFetched = true;
        return;
      }
    } catch {}
  }
}
function questionText(question, index, total) {
  return `Q${index + 1}/${total}. ${question.question}`;
}
function learningLike(text) {
  const q = trim(text);
  if (!q) return false;
  return q.includes('?') || ['설명', '이해', '정리', '개념', '차이', '무엇'].some((word) => q.includes(word));
}
function parseAssessmentTrigger(text) {
  const value = trim(text);
  if (value === ASSESSMENT_TRIGGER || value === '평가') return 0;
  if (value.includes(ASSESSMENT_TRIGGER)) {
    const match = value.match(/(\d+)\s*번/);
    if (match) return Math.max(0, Number.parseInt(match[1], 10) - 1);
    return 0;
  }
  return null;
}
function trackHint() {
  qualityMetrics.hint_request_count += 1;
  const s = student();
  if (!s.studentId) return;
  sendEvent('hint_used', {
    chapterId: chapterRef?.id || '',
    sessionId,
    studentId: s.studentId,
    studentName: s.studentName,
    payload: { question_index: assessmentQIdx, hint_index: assessmentHintCount, timestamp: nowIso() },
  });
}
async function respondLearning(userText) {
  let result = null;
  try {
    const data = await workerRouteJson('/chat/respond', {
      mode: 'learning',
      chapter: chapterRef,
      user_input: userText,
      memorySummary,
      transcript: recentConversation(8),
    });
    result = parseCompletionJson(data);
    if (!result) throw new Error('Invalid learning JSON');
    qualityMetrics.structured_response_count += 1;
  } catch (err) {
    console.error('learning route failed:', err);
    qualityMetrics.structured_fallback_count += 1;
    result = {
      answer: '응답을 생성하지 못했습니다. 질문을 조금 더 구체적으로 바꿔서 다시 시도해 주세요.',
      question_type: 'other',
      memory_update: { pendingQuestions: [userText], lastStudentGoal: userText },
    };
  }

  qualityMetrics.learning_turn_count += 1;
  qualityMetrics.last_question_type = trim(result.question_type) || 'other';
  mergeMemory(result.memory_update || {});
  flushSummary('learning');

  const answer = trim(result.answer) || '응답을 생성하지 못했습니다.';
  bubble('ai', answer);
  pushLog('assistant', answer, ChatMode.LEARNING);
  persist();
}
async function respondAssessment(userText) {
  const question = assessmentQuestions[assessmentQIdx];
  if (!question) return;
  const isLast = assessmentQIdx === assessmentQuestions.length - 1;
  let result = null;

  try {
    const data = await workerRouteJson('/chat/respond', {
      mode: 'assessment',
      chapter: chapterRef,
      question,
      user_input: userText,
      memorySummary,
      remaining_hints: Math.max(0, MAX_HINTS - assessmentHintCount),
      is_last_question: isLast,
    });
    result = parseCompletionJson(data);
    if (!result) throw new Error('Invalid assessment JSON');
    qualityMetrics.structured_response_count += 1;
  } catch (err) {
    console.error('assessment route failed:', err);
    qualityMetrics.structured_fallback_count += 1;
    result = {
      judgment: 'incorrect',
      confidence: 'low',
      feedback: '답안을 판정하는 중 오류가 발생했습니다. 핵심 개념을 다시 정리한 뒤 재시도해 주세요.',
      hint: question?.hints?.[assessmentHintCount] || '',
      model_answer: question?.keyAnswer || question?.answer || '',
      weak_concept: question?.concept || '',
      advance: false,
      next_action: 'retry_same_question',
      memory_update: { pendingQuestions: [question.question || '현재 문항'] },
    };
  }

  qualityMetrics.assessment_turn_count += 1;
  qualityMetrics.assessment_evaluation_count += 1;
  if (result.judgment === 'partial') qualityMetrics.assessment_partial_count += 1;
  mergeMemory(result.memory_update || {});
  flushSummary('assessment');

  assessmentTrace.push({
    question_id: question.id || `Q${assessmentQIdx + 1}`,
    question_index: assessmentQIdx,
    concept: trim(question.concept || ''),
    judgment: trim(result.judgment) || 'incorrect',
    confidence: trim(result.confidence) || 'medium',
    hint_count: assessmentHintCount,
    advance: Boolean(result.advance),
    weak_concept: trim(result.weak_concept),
    timestamp: nowIso(),
  });

  const s = student();
  if (s.studentId) {
    sendEvent('assessment_judged', {
      chapterId: chapterRef?.id || '',
      sessionId,
      studentId: s.studentId,
      studentName: s.studentName,
      payload: {
        question_index: assessmentQIdx,
        judgment: result.judgment || 'incorrect',
        confidence: trim(result.confidence) || 'medium',
        weak_concept: trim(result.weak_concept),
        hint_count: assessmentHintCount,
        advance: Boolean(result.advance),
      },
    });
  }

  let text = trim(result.feedback) || '답안을 평가했습니다.';

  if (result.judgment === 'incorrect' && !result.advance) {
    const hint = trim(result.hint) || question?.hints?.[assessmentHintCount] || '';
    assessmentHintCount += 1;
    if (hint) {
      trackHint();
      text = `${text}\n\n힌트 ${assessmentHintCount}: ${hint}`;
    }
    bubble('ai', text);
    pushLog('assistant', text, ChatMode.ASSESSMENT);
    persist();
    return;
  }

  if (result.judgment === 'incorrect' && result.advance && trim(result.model_answer)) {
    text = `${text}\n\n모범답안: ${trim(result.model_answer)}`;
  }

  bubble('ai', text);
  pushLog('assistant', text, ChatMode.ASSESSMENT);
  qualityMetrics.assessment_advance_count += 1;

  if (result.next_action === 'finish_assessment' || isLast) {
    finishAssessment();
    persist();
    return;
  }

  assessmentQIdx += 1;
  assessmentHintCount = 0;
  badge();
  const next = questionText(assessmentQuestions[assessmentQIdx], assessmentQIdx, assessmentQuestions.length);
  bubble('ai', next);
  pushLog('assistant', next, ChatMode.ASSESSMENT);
  persist();
}
function finishAssessment() {
  currentMode = ChatMode.DONE;
  assessmentComplete = true;
  memorySummary.lastAssessmentResult = `총 ${assessmentQuestions.length}문항 평가 완료`;
  badge();
  setSubmit(true);
  bubble('system', '형성평가가 완료되었습니다. 이제 PDF 제출 버튼으로 결과를 저장할 수 있습니다.');
  pushLog('system', '형성평가 완료', ChatMode.DONE);
  const s = student();
  if (s.studentId) {
    sendEvent('assessment_completed', {
      chapterId: chapterRef?.id || '',
      sessionId,
      studentId: s.studentId,
      studentName: s.studentName,
      payload: { total_questions: assessmentQuestions.length, quality_metrics: derivedMetrics() },
    });
  }
}
async function sendToAI(text, opts = {}) {
  const input = trim(text);
  if (!input || isBusy) return;

  if (!opts.force && currentMode === ChatMode.ASSESSMENT && !assessmentComplete && learningLike(input)) {
    qualityMetrics.blocked_learning_question_count += 1;
    const msg = '형성평가 진행 중입니다. 현재 문항에 대한 답을 먼저 제출해 주세요.';
    bubble('system', msg);
    pushLog('system', msg, currentMode);
    persist();
    return;
  }

  setBusy(true);
  bubble('user', input);
  pushLog('user', input, currentMode);
  persist();

  try {
    if (currentMode === ChatMode.ASSESSMENT && !assessmentComplete) await respondAssessment(input);
    else await respondLearning(input);
  } catch (err) {
    console.error('sendToAI failed:', err);
    bubble('system', '응답 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  } finally {
    setBusy(false);
  }
}
async function startAssessment(startIdx = 0) {
  setBusy(true);
  setSubmit(false);
  const loading = bubble('system', '형성평가 문항을 불러오는 중입니다...');
  let questions = null;

  try {
    const result = await Promise.race([
      fetchQuestions(chapterRef.id),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
    if (result?.questions?.questions?.length > 0) questions = result.questions.questions;
  } catch {}

  loading?.remove();
  setBusy(false);

  if (!questions && Array.isArray(chapterRef?.formativeAssessment?.questions)) {
    questions = chapterRef.formativeAssessment.questions;
  }
  if (!questions || startIdx >= questions.length) {
    const msg = '형성평가 문항을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
    bubble('system', msg);
    pushLog('system', msg, currentMode);
    return;
  }

  currentMode = ChatMode.ASSESSMENT;
  assessmentComplete = false;
  assessmentQuestions = questions;
  assessmentQIdx = startIdx;
  assessmentHintCount = 0;
  assessmentTrace = [];
  qualityMetrics.assessment_started_count += 1;
  badge();

  const s = student();
  if (s.studentId) {
    sendEvent('assessment_started', {
      chapterId: chapterRef?.id || '',
      sessionId,
      studentId: s.studentId,
      studentName: s.studentName,
      payload: { total_questions: assessmentQuestions.length, start_index: startIdx, version: VERSION },
    });
  }

  const notice = startIdx === 0
    ? `형성평가를 시작합니다. 총 ${assessmentQuestions.length}문항입니다.`
    : `${startIdx + 1}번 문항부터 형성평가를 시작합니다.`;
  bubble('system', notice);
  pushLog('system', notice, currentMode);

  const first = questionText(assessmentQuestions[startIdx], startIdx, assessmentQuestions.length);
  bubble('ai', first);
  pushLog('assistant', first, currentMode);
  persist();
}
function handleSend() {
  const input = el('chat-input');
  if (!input || isBusy) return;
  const text = trim(input.value);
  if (!text) return;
  input.value = '';
  input.style.height = 'auto';

  const trigger = parseAssessmentTrigger(text);
  if (trigger !== null) {
    startAssessment(trigger);
    return;
  }

  if (currentMode === ChatMode.DONE) {
    const msg = '형성평가는 이미 완료되었습니다. 다시 시작하려면 "형성평가"를 입력해 주세요.';
    bubble('system', msg);
    pushLog('system', msg, currentMode);
    persist();
    return;
  }

  sendToAI(text);
}
function bindEvents() {
  if (eventsBound) return;
  eventsBound = true;

  el('chat-send')?.addEventListener('click', handleSend);
  const input = el('chat-input');
  if (!input) return;
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  });
  input.addEventListener('input', function onInput() {
    this.style.height = 'auto';
    this.style.height = `${Math.min(this.scrollHeight, 120)}px`;
  });
}
function newLearningSession() {
  sessionId = createSessionId(chapterRef?.id || '00');
  currentMode = ChatMode.LEARNING;
  assessmentComplete = false;
  assessmentQuestions = [];
  assessmentQIdx = 0;
  assessmentHintCount = 0;
  assessmentTrace = [];
  logMessages = [];
  memorySummary = emptyMemory();
  qualityMetrics = emptyMetrics();
  badge();
  setSubmit(false);

  const msg = `안녕하세요. ${chapterRef?.title || '현재 챕터'} 학습을 도와드리겠습니다. 개념 설명, 비교, 예시, 계산 과정 등을 질문하시면 챕터 문맥에 맞춰 답변하겠습니다. 형성평가를 시작하려면 "형성평가"를 입력해 주세요.`;
  bubble('ai', msg);
  pushLog('assistant', msg, currentMode);
  persist();

  const s = student();
  if (s.studentId) {
    sendEvent('session_started', {
      chapterId: chapterRef?.id || '',
      sessionId,
      studentId: s.studentId,
      studentName: s.studentName,
      payload: { mode: currentMode, version: VERSION },
    });
  }
}
async function restoreServer(chapterData) {
  const token = trim(student().token);
  if (!token || token.startsWith('local:')) return false;

  const latest = (await apiGet(`/sessions/latest?chapter_id=${encodeURIComponent(chapterData.id)}`, token))?.session;
  if (!latest?.session_id) return false;
  const messages = (await apiGet(`/sessions/${encodeURIComponent(latest.session_id)}/messages`, token))?.messages;
  if (!Array.isArray(messages) || messages.length === 0) return false;

  sessionId = String(latest.session_id);
  currentMode = ChatMode.LEARNING;
  assessmentComplete = false;
  assessmentQuestions = [];
  assessmentQIdx = 0;
  assessmentHintCount = 0;
  assessmentTrace = [];
  logMessages = messages.map((m) => ({
    role: String(m.role || ''),
    content: String(m.content || ''),
    mode: String(m.mode || ChatMode.LEARNING),
    timestamp: String(m.timestamp || nowIso()),
    session_id: String(m.session_id || sessionId),
    chapter_id: String(m.chapter_id || chapterData.id),
  }));
  memorySummary = emptyMemory();
  qualityMetrics = emptyMetrics();
  restoreUI();
  badge();
  setSubmit(currentMode === ChatMode.DONE || assessmentComplete);
  bubble('system', '이전 세션을 서버에서 복원했습니다. 이어서 진행해 주세요.');
  pushLog('system', '세션 복원(server)', currentMode);
  persist();
  return true;
}

export function getConversationMessages() { return logMessages; }
export function getChapterRef() { return chapterRef; }
export function getSessionId() { return sessionId; }
export function getChatSessionSnapshot() {
  return {
    sessionId,
    chapterId: chapterRef?.id || '',
    currentMode,
    assessmentComplete,
    assessmentQIdx,
    assessmentQuestions: assessmentQuestions.map((q, i) => ({
      id: q.id || `Q${i + 1}`,
      concept: q.concept || '',
      question: q.question || '',
    })),
    assessmentTrace: Array.isArray(assessmentTrace) ? [...assessmentTrace] : [],
    memorySummary: { ...memorySummary },
    qualityMetrics: derivedMetrics(),
  };
}
export function resetChatSession() {
  if (!chapterRef) return;
  try {
    if (sessionId) localStorage.removeItem(sessionStorageKey(sessionId));
  } catch {}
  const index = loadIndex();
  delete index[chapterRef.id];
  saveIndex(index);
  const box = el('chat-messages');
  if (box) box.innerHTML = '';
  newLearningSession();
}
export async function initChatbot(chapterData) {
  chapterRef = chapterData;
  bindEvents();

  fetchLocks().then(() => {
    if (!chapterLocks[chapterData.id]) return;
    const box = el('chat-messages');
    if (box) box.innerHTML = '';
    bubble('system', '이 챕터는 현재 잠겨 있습니다. 다음에 다시 이용해 주세요.');
    const input = el('chat-input');
    const sendBtn = el('chat-send');
    if (input) input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
  });

  try {
    if (await restoreServer(chapterData)) return;
  } catch (err) {
    console.error('server restore failed:', err);
  }

  const local = loadLocalSession(chapterData.id);
  if (local) {
    hydrate(local);
    restoreUI();
    badge();
    setSubmit(currentMode === ChatMode.DONE || assessmentComplete);
    bubble('system', '이전 세션을 복원했습니다. 이어서 진행해 주세요.');
    pushLog('system', '세션 복원(local)', currentMode);
    persist();
    return;
  }

  const box = el('chat-messages');
  if (box) box.innerHTML = '';
  newLearningSession();
}
