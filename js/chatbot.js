import { showToast } from './main.js';
import { sendEvent } from './instrumentation.js?v=20260308o';
import { getStudentProfile } from './auth.js?v=20260308o';

const LOCAL_ORIGIN_WITH_SLASH = window.location.origin.endsWith('/') ? window.location.origin : (window.location.origin + '/');

const WORKER_URLS = [
  'https://logic-proxy.dongkuklee99.workers.dev/',
  'https://logic.dongkuklee99.workers.dev/',
  ...(window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1') ? [LOCAL_ORIGIN_WITH_SLASH] : []),
];

const COMPLETION_MARKER = '===형성평가완료===';
const ASSESSMENT_TRIGGER = '형성평가';
const SESSION_INDEX_KEY = 'logic_session_index_v2';
const SESSION_PREFIX = 'logic_session_v2';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

const ChatMode = {
  LEARNING: 'learning',
  ASSESSMENT: 'assessment',
  ASSESSMENT_COMPLETE: 'assessment_complete',
};

let chapterRef = null;
let isStreaming = false;
let assessmentComplete = false;
let eventsBound = false;
let currentMode = ChatMode.LEARNING;
let sessionId = '';
let logMessages = [];
let modelMessages = [];

function getEl(id) {
  return document.getElementById(id);
}

function getStudentMeta() {
  const profile = getStudentProfile() || {};
  return { studentId: profile.studentId || '', studentName: profile.studentName || '' };
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeInput(text) {
  return String(text || '').trim();
}

function getSessionStorageKey(id) {
  return `${SESSION_PREFIX}_${id}`;
}

function loadSessionIndex() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_INDEX_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveSessionIndex(index) {
  try {
    localStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(index));
  } catch {
    // ignore quota error
  }
}

function createSessionId(chapterId) {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${chapterId}_${Date.now()}_${rand}`;
}

function buildLearningPrompt(data) {
  const { title, objectives } = data;
  const keyConcepts = data.keyConcepts || [];
  return [
    `당신은 "${title}"의 AI 학습 튜터입니다.`,
    '',
    '[역할]',
    '- 현재 챕터의 학습 내용 질문에 정확하고 이해하기 쉽게 답변합니다.',
    '- 예시, 비유, 단계별 설명을 사용해 학습을 돕습니다.',
    '- 형성평가를 시작하려면 사용자가 정확히 "형성평가"라고 입력해야 한다고 안내합니다.',
    '',
    '[학습목표]',
    ...objectives.map((o, i) => `${i + 1}. ${o}`),
    '',
    '[핵심 개념]',
    keyConcepts.length ? keyConcepts.join(', ') : '챕터 내용 참조',
    '',
    '[응답 규칙]',
    '- 반드시 한국어로 답변합니다.',
    '- 사실과 추론을 구분해 설명합니다.',
    '- 불필요한 장문 대신 핵심부터 명확히 답변합니다.',
  ].join('\n');
}

function buildAssessmentPrompt(data) {
  const { title, objectives, formativeAssessment } = data;
  const keyConcepts = data.keyConcepts || [];
  const questions = formativeAssessment?.questions || [];
  const totalQuestions = formativeAssessment?.totalQuestions ?? questions.length ?? 5;

  const questionsText = questions.map((q, i) => {
    const bloom = q.bloomLevel || q.bloom || '';
    const concept = q.concept || '';
    const keyAnswer = q.keyAnswer || q.answer || '';
    const hints = (q.hints || []).map((h, j) => `  힌트${j + 1}: ${h}`).join('\n');
    return `Q${i + 1} [Bloom: ${bloom}] 핵심 개념: ${concept}\n  질문: ${q.question}\n  모범 답안: ${keyAnswer}${hints ? `\n${hints}` : ''}`;
  }).join('\n\n');

  return [
    `당신은 "디지털 논리회로" 과목의 AI 튜터입니다. 형성평가를 진행합니다.`,
    '',
    '[현재 챕터]',
    title,
    '',
    '[학습목표]',
    ...objectives.map((o, i) => `${i + 1}. ${o}`),
    '',
    '[핵심 개념]',
    keyConcepts.length ? keyConcepts.join(', ') : '챕터 내용 참조',
    '',
    `[형성평가 문항 (총 ${totalQuestions}개)]`,
    questionsText,
    '',
    '[형성평가 진행 규칙]',
    '1. Q1부터 순서대로 질문합니다.',
    '2. 오답/불충분 답변에는 단계형 힌트를 제공합니다.',
    '3. 힌트 최대 3단계 후에도 오답이면 정답 제시 후 다음 문항으로 이동합니다.',
    '4. 모든 문항 종료 후 결과를 요약합니다.',
    `5. 최종 응답에 반드시 ${COMPLETION_MARKER} 문자열을 포함합니다.`,
    '',
    '[응답 규칙]',
    '- 반드시 한국어로 답변합니다.',
    '- 한 번에 하나의 질문만 진행합니다.',
  ].join('\n');
}

function appendBubble(role, text, isStreaming = false) {
  const container = getEl('chat-messages');
  if (!container) return null;

  const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;

  const avatarText = role === 'ai' ? '🤖' : role === 'user' ? '👤' : '';

  if (role === 'system') {
    bubble.innerHTML = `<div class="bubble-text">${escapeHtml(text)}</div>`;
  } else {
    const textEl = document.createElement('div');
    textEl.className = `bubble-text${isStreaming ? ' typing-cursor' : ''}`;
    textEl.textContent = text;

    bubble.innerHTML = `<div class="bubble-avatar">${avatarText}</div>`;
    const content = document.createElement('div');
    content.className = 'bubble-content';
    content.appendChild(textEl);
    content.insertAdjacentHTML('beforeend', `<div class="bubble-time">${time}</div>`);
    bubble.appendChild(content);
  }

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  return bubble;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function updateBadge() {
  const badge = getEl('assessment-badge');
  if (!badge) return;

  if (currentMode === ChatMode.ASSESSMENT_COMPLETE) {
    badge.textContent = '완료';
    badge.className = 'badge badge-complete';
  } else if (currentMode === ChatMode.ASSESSMENT) {
    badge.textContent = '진행 중';
    badge.className = 'badge badge-active';
  } else {
    badge.textContent = '학습 중';
    badge.className = 'badge badge-pending';
  }
}

function setSubmitEnabled(enabled) {
  const btn = getEl('btn-submit-pdf');
  if (btn) btn.disabled = !enabled;
}

function pushLogMessage(role, content, mode = currentMode) {
  const msg = {
    role,
    content,
    mode,
    timestamp: nowIso(),
    session_id: sessionId,
    chapter_id: chapterRef?.id || '',
  };
  logMessages.push(msg);

  if (role === 'user' || role === 'assistant') {
    sendEvent('chat_message', {
      chapterId: msg.chapter_id,
      sessionId: msg.session_id,
      studentId: getStudentMeta().studentId,
      studentName: getStudentMeta().studentName,
      payload: {
        role,
        content,
        mode,
        timestamp: msg.timestamp,
        chapter_id: msg.chapter_id,
      },
    });
  }
}

function persistSession() {
  if (!chapterRef?.id || !sessionId) return;

  const payload = {
    sessionId,
    chapterId: chapterRef.id,
    currentMode,
    assessmentComplete,
    logMessages,
    modelMessages,
    savedAt: Date.now(),
  };

  try {
    localStorage.setItem(getSessionStorageKey(sessionId), JSON.stringify(payload));
    const index = loadSessionIndex();
    index[chapterRef.id] = sessionId;
    saveSessionIndex(index);
  } catch {
    // ignore quota error
  }
}

function loadSessionForChapter(chapterId) {
  try {
    const index = loadSessionIndex();
    const id = index[chapterId];
    if (!id) return null;

    const raw = localStorage.getItem(getSessionStorageKey(id));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (parsed.chapterId !== chapterId) return null;
    if (Date.now() - Number(parsed.savedAt || 0) > SESSION_TTL_MS) return null;

    return parsed;
  } catch {
    return null;
  }
}

function restoreUIFromLogs() {
  const container = getEl('chat-messages');
  if (!container) return;
  container.innerHTML = '';

  logMessages
    .filter((m) => m.role !== 'system')
    .forEach((m) => appendBubble(m.role === 'assistant' ? 'ai' : m.role, m.content));
}

function isLikelyLearningQuestion(input) {
  const text = normalizeInput(input);
  if (!text) return false;
  const patterns = ['설명', '왜', '무엇', '뭐야', '원리', '개념', '학습'];
  const hasQuestionMark = text.includes('?');
  return hasQuestionMark || patterns.some((p) => text.includes(p));
}

function getAssessmentQuestionCount() {
  const total = Number(chapterRef?.formativeAssessment?.totalQuestions);
  return Number.isInteger(total) && total > 0 ? total : 5;
}

async function streamFromWorker(messages) {
  let lastError = null;

  for (const url of WORKER_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          stream: true,
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Worker error ${res.status}: ${errText}`);
      }

      return res.body;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('All worker endpoints failed');
}

function handleAssessmentComplete() {
  assessmentComplete = true;
  currentMode = ChatMode.ASSESSMENT_COMPLETE;
  updateBadge();
  setSubmitEnabled(true);

  appendBubble('system', '형성평가가 완료되었습니다. 아래 "형성평가 제출 (PDF)" 버튼으로 제출하세요.');
  pushLogMessage('system', '형성평가 완료', ChatMode.ASSESSMENT_COMPLETE);

  sendEvent('assessment_completed', {
    chapterId: chapterRef?.id || '',
    sessionId,
      studentId: getStudentMeta().studentId,
      studentName: getStudentMeta().studentName,
    payload: {
      total_messages: logMessages.filter((m) => m.role === 'user' || m.role === 'assistant').length,
      timestamp: nowIso(),
    },
  });

  persistSession();
}

async function sendToAI(userText, opts = {}) {
  if (isStreaming) return;

  const force = Boolean(opts.force);
  const normalized = normalizeInput(userText);

  if (!force && currentMode === ChatMode.ASSESSMENT && !assessmentComplete && isLikelyLearningQuestion(normalized)) {
    const blockedMsg = '형성평가 진행 중입니다. 평가를 이어가세요.';
    appendBubble('system', blockedMsg);
    pushLogMessage('system', blockedMsg, currentMode);
    persistSession();
    return;
  }

  isStreaming = true;

  modelMessages.push({ role: 'user', content: normalized });
  pushLogMessage('user', normalized, currentMode);
  appendBubble('user', normalized);
  persistSession();

  const input = getEl('chat-input');
  const sendBtn = getEl('chat-send');
  if (input) input.disabled = true;
  if (sendBtn) sendBtn.disabled = true;

  const aiBubble = appendBubble('ai', '', true);
  const textEl = aiBubble?.querySelector('.bubble-text');
  let fullText = '';

  try {
    const body = await streamFromWorker(modelMessages);
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const chunk = parsed?.choices?.[0]?.delta?.content;
          if (chunk) {
            fullText += chunk;
            if (textEl) textEl.textContent = fullText.replace(COMPLETION_MARKER, '').trimEnd();
            const messagesEl = getEl('chat-messages');
            if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
          }
        } catch {
          // ignore malformed chunks
        }
      }
    }
  } catch (err) {
    if (textEl) {
      textEl.textContent = '오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      textEl.style.color = 'var(--accent-red)';
    }
    console.error('Streaming error:', err);
  } finally {
    if (textEl) textEl.classList.remove('typing-cursor');
    isStreaming = false;
    if (input) {
      input.disabled = false;
      input.focus();
    }
    if (sendBtn) sendBtn.disabled = false;

    if (fullText.includes(COMPLETION_MARKER) && currentMode === ChatMode.ASSESSMENT) {
      fullText = fullText.replace(COMPLETION_MARKER, '').trimEnd();
      if (textEl) textEl.textContent = fullText;
      handleAssessmentComplete();
    }

    modelMessages.push({ role: 'assistant', content: fullText });
    pushLogMessage('assistant', fullText, currentMode);
    persistSession();
  }
}

async function startAssessment() {
  currentMode = ChatMode.ASSESSMENT;
  assessmentComplete = false;
  updateBadge();
  setSubmitEnabled(false);

  const notice = `형성평가 모드를 시작합니다. 총 ${getAssessmentQuestionCount()}문항을 진행합니다.`;
  appendBubble('system', notice);
  pushLogMessage('system', notice, currentMode);

  modelMessages = [{ role: 'system', content: buildAssessmentPrompt(chapterRef) }];
  persistSession();

  await sendToAI('형성평가를 시작합니다. Q1부터 질문해주세요.', { force: true });
}

function handleSend() {
  const input = getEl('chat-input');
  if (!input) return;

  const text = normalizeInput(input.value);
  if (!text || isStreaming) return;

  input.value = '';
  input.style.height = 'auto';

  const lower = text.toLowerCase();
  if (currentMode === ChatMode.LEARNING && lower === ASSESSMENT_TRIGGER.toLowerCase()) {
    startAssessment();
    return;
  }

  if (currentMode === ChatMode.ASSESSMENT_COMPLETE) {
    const msg = '형성평가가 완료되었습니다. PDF 제출 후 다음 학습을 진행하세요.';
    appendBubble('system', msg);
    pushLogMessage('system', msg, currentMode);
    persistSession();
    return;
  }

  sendToAI(text);
}

function bindEventsOnce() {
  if (eventsBound) return;
  eventsBound = true;

  const sendBtn = getEl('chat-send');
  const input = getEl('chat-input');

  if (sendBtn) sendBtn.addEventListener('click', handleSend);

  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    input.addEventListener('input', function onInput() {
      this.style.height = 'auto';
      this.style.height = `${Math.min(this.scrollHeight, 120)}px`;
    });
  }
}

function createNewLearningSession() {
  sessionId = createSessionId(chapterRef?.id || '00');
  currentMode = ChatMode.LEARNING;
  assessmentComplete = false;
  logMessages = [];
  modelMessages = [{ role: 'system', content: buildLearningPrompt(chapterRef) }];

  const welcome = `안녕하세요! ${chapterRef.title} 학습 튜터입니다. 학습 질문을 자유롭게 해주세요. 형성평가를 시작하려면 "형성평가"를 입력하세요.`;
  appendBubble('ai', welcome);
  pushLogMessage('assistant', welcome, currentMode);
  persistSession();

  sendEvent('session_started', {
    chapterId: chapterRef?.id || '',
    sessionId,
      studentId: getStudentMeta().studentId,
      studentName: getStudentMeta().studentName,
    payload: {
      mode: currentMode,
      timestamp: nowIso(),
    },
  });
}

export function getConversationMessages() {
  return logMessages;
}

export function getChapterRef() {
  return chapterRef;
}

export function getSessionId() {
  return sessionId;
}

export function initChatbot(chapterData) {
  chapterRef = chapterData;
  bindEventsOnce();

  const restored = loadSessionForChapter(chapterData.id);

  if (restored) {
    sessionId = restored.sessionId;
    currentMode = restored.currentMode || ChatMode.LEARNING;
    assessmentComplete = Boolean(restored.assessmentComplete);
    logMessages = Array.isArray(restored.logMessages) ? restored.logMessages : [];
    modelMessages = Array.isArray(restored.modelMessages) ? restored.modelMessages : [{ role: 'system', content: buildLearningPrompt(chapterData) }];

    restoreUIFromLogs();
    updateBadge();
    setSubmitEnabled(assessmentComplete);

    appendBubble('system', '이전 세션이 복원되었습니다. 이어서 진행하세요.');
    pushLogMessage('system', '세션 복원', currentMode);
    persistSession();
    return;
  }

  updateBadge();
  setSubmitEnabled(false);

  const container = getEl('chat-messages');
  if (container) container.innerHTML = '';

  createNewLearningSession();
}


