import { sendEvent } from './instrumentation.js?v=20260309e';
import { getStudentProfile } from './auth.js?v=20260309e';

const LOCAL_ORIGIN_WITH_SLASH = window.location.origin.endsWith('/') ? window.location.origin : (window.location.origin + '/');

const WORKER_URLS = [
  'https://logic-proxy.dongkuklee99.workers.dev/',
  'https://logic.dongkuklee99.workers.dev/',
  ...(window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1') ? [LOCAL_ORIGIN_WITH_SLASH] : []),
];

const COMPLETION_MARKER = '===\ud615\uc131\ud3c9\uac00\uc644\ub8cc===';
const NEXT_QUESTION_MARKER = '===\ub2e4\uc74c\ubb38\ud56d===';
const ASSESSMENT_TRIGGER = '\ud615\uc131\ud3c9\uac00';
const SESSION_INDEX_KEY = 'logic_session_index_v4';
const SESSION_PREFIX = 'logic_session_v4';
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
let assessmentQuestions = [];
let assessmentQIdx = 0;
let assessmentHintCount = 0;

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

function getUserScopedKey(base) {
  const uid = getStudentMeta().studentId || 'anon';
  return `${base}_${uid}`;
}

function getSessionStorageKey(id) {
  return `${getUserScopedKey(SESSION_PREFIX)}_${id}`;
}

function loadSessionIndex() {
  try {
    return JSON.parse(localStorage.getItem(getUserScopedKey(SESSION_INDEX_KEY)) || '{}');
  } catch {
    return {};
  }
}

function saveSessionIndex(index) {
  try {
    localStorage.setItem(getUserScopedKey(SESSION_INDEX_KEY), JSON.stringify(index));
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
    `\uc5ed\ud560: "${title}" \ucc55\ud130 AI \ud559\uc2b5 \uc870\ub825\uc790\uc785\ub2c8\ub2e4.`,
    '',
    '[\uc9c0\uce68]',
    '- \ud559\uc0dd\uc774 \ud559\uc2b5 \ub0b4\uc6a9\uc744 \uc774\ud574\ud558\ub3c4\ub85d \uce5c\uc808\ud558\uace0 \uc0c1\uc138\ud558\uac8c \ub3c4\uc6c0\uc744 \uc90d\ub2c8\ub2e4.',
    '- \uc608\uc2dc, \ube44\uc720, \ub2e8\uacc4\ubcc4 \uc124\uba85\uc744 \uc801\uadf9 \ud65c\uc6a9\ud569\ub2c8\ub2e4.',
    '- \ud615\uc131\ud3c9\uac00\ub97c \uc2dc\uc791\ud558\ub824\uba74 \ud559\uc0dd\uc774 "\ud615\uc131\ud3c9\uac00"\ub77c\uace0 \uc785\ub825\ud574\uc57c \ud569\ub2c8\ub2e4.',
    '',
    '[\ud559\uc2b5\ubaa9\ud45c]',
    ...objectives.map((o, i) => `${i + 1}. ${o}`),
    '',
    '[\ud575\uc2ec \uac1c\ub150]',
    keyConcepts.length ? keyConcepts.join(', ') : '\ucc55\ud130 \ub0b4\uc6a9 \ucc38\uace0',
    '',
    '[\ub2f5\ubcc0 \uc6d0\uce59]',
    '- \ud55c\uad6d\uc5b4\ub85c \ub2f5\ud569\ub2c8\ub2e4.',
    '- \uaca9\ub824\ud558\uace0 \uae0d\uc815\uc801\uc778 \ud53c\ub4dc\ubc31\uc744 \ub4dc\ub9bd\ub2c8\ub2e4.',
    '- \ubd88\ud544\uc694\ud55c \uc9c8\ubb38 \uc5c6\uc774 \ud575\uc2ec \uc9c8\ubb38\uc5d0 \ub2f5\ud569\ub2c8\ub2e4.',
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
    const hints = (q.hints || []).map((h, j) => `  \ud78c\ub4dc${j + 1}: ${h}`).join('\n');
    return `Q${i + 1} [Bloom: ${bloom}] \uac1c\ub150: ${concept}
  \uc9c8\ubb38: ${q.question}
  \ubaa8\ubc94\ub2f5\uc548: ${keyAnswer}${hints ? `
${hints}` : ''}`;
  }).join('\n\n');

  return [
    '\uc5ed\ud560: "\ud615\uc131\ud3c9\uac00 \uc2dc\ub098\ub9ac\uc624" AI \uc870\ub825\uc790\uc785\ub2c8\ub2e4. \uc544\ub798 \ubb38\ud56d\uc5d0 \ub530\ub77c \ud559\uc0dd\uc744 \ud3c9\uac00\ud558\uc138\uc694.',
    '',
    '[\ud604\uc7ac \ucc55\ud130]',
    title,
    '',
    '[\ud559\uc2b5\ubaa9\ud45c]',
    ...objectives.map((o, i) => `${i + 1}. ${o}`),
    '',
    '[\ud575\uc2ec \uac1c\ub150]',
    keyConcepts.length ? keyConcepts.join(', ') : '\ucc55\ud130 \ub0b4\uc6a9 \ucc38\uace0',
    '',
    `[\ud3c9\uac00 \ubb38\ud56d (\uc9c1 ${totalQuestions}\ubb38\ud56d)]`,
    questionsText,
    '',
    '[\ud3c9\uac00 \uc9c4\ud589 \uc9c0\uc2dc]',
    '1. Q1\ubd80\ud130 \uc21c\uc11c\ub300\ub85c \uc9c8\ubb38\ud569\ub2c8\ub2e4.',
    '2. \uc815\ub2f5/\uc624\ub2f5\uc5d0 \ub530\ub77c \ud78c\ub4dc\ub97c \uc81c\uacf5\ud569\ub2c8\ub2e4.',
    '3. \ud78c\ub4dc \ucd5c\ub300 3\uac1c \uc774\ud6c4 \uc815\ub2f5\uc744 \uc54c\ub824\uc8fc\uace0 \ub2e4\uc74c \ubb38\uc81c\ub85c \ub118\uc5b4\uac11\ub2c8\ub2e4.',
    '4. \ubaa8\ub4e0 \ubb38\uc81c \uc885\ub8cc \ud6c4 \uacb0\uacfc\ub97c \uc694\uc57d\ud569\ub2c8\ub2e4.',
    `5. \ucd5c\uc885 \ub2f5\ubcc0 \ub9c8\uc9c0\ub9c9\uc5d0 \ubc18\ub4dc\uc2dc ${COMPLETION_MARKER} \ubb38\uc790\uc5f4\uc744 \ud3ec\ud568\ud558\uc138\uc694.`,
    '',
    '[\ub2f5\ubcc0 \uc9c0\uce68]',
    '- \ubc18\ub4dc\uc2dc \ud55c\uad6d\uc5b4\ub85c \ub2f5\ud569\ub2c8\ub2e4.',
    '- \ud55c \ubc88\uc5d0 \ud558\ub098\uc758 \uc9c8\ubb38\ub9cc \uc9c4\ud589\ud569\ub2c8\ub2e4.',
  ].join('\n');
}



function buildAssessmentEvalPrompt(q, idx, total, isLast, hintCount = 0) {
  const hints = (q.hints || []).map((h, i) => `  \ud78c\ud2b8${i + 1}: ${h}`).join('\n');
  const advanceMarker = isLast ? COMPLETION_MARKER : NEXT_QUESTION_MARKER;
  const remaining = Math.max(0, 3 - hintCount);
  return [
    `\uc5ed\ud560: \ud615\uc131\ud3c9\uac00 \ucc44\uc810 AI\uc785\ub2c8\ub2e4. \ud604\uc7ac \ubb38\ud56d Q${idx + 1}/${total}.`,
    `[\ud604\uc7ac \uc0c1\ud0dc] \uc774 \ubb38\ud56d\uc5d0\uc11c \ud78c\ud2b8 ${hintCount}\ubc88 \uc81c\uacf5\ud568. \ub0a8\uc740 \ud78c\ud2b8: ${remaining}\ubc88.`,
    '',
    '[\ubb38\ud56d]',
    q.question || '',
    '',
    '[\ubaa8\ubc94 \ub2f5\uc548]',
    q.keyAnswer || q.answer || '',
    ...(hints ? ['', '[\ud78c\ud2b8 \ubaa9\ub85d]', hints] : []),
    '',
    '[\ucc44\uc810 \uaddc\uce59 - \ubc18\ub4dc\uc2dc \uc5c4\uaca9\ud788 \ub530\ub974\uc138\uc694]',
    `1. \uc815\ub2f5\uc774\uba74: \uce5c\ucc2c + \uc751\ub2f5 \ub9c8\uc9c0\ub9c9\uc5d0 \ubc18\ub4dc\uc2dc ${advanceMarker} \ud3ec\ud568.`,
    remaining > 0
      ? `2. \uc624\ub2f5\uc774\uba74: \ud78c\ud2b8 ${hintCount + 1}\ubc88\ub9cc \uc81c\uacf5. ${advanceMarker} \uc808\ub300 \ud3ec\ud568 \uae08\uc9c0.`
      : `2. \uc624\ub2f5\uc774\uba74: \ud78c\ud2b8\uac00 \uc18c\uc9c4\ub418\uc5c8\uc2b5\ub2c8\ub2e4. \ubaa8\ubc94 \ub2f5\uc548\uc744 \uacf5\uac1c\ud558\uace0 \uc751\ub2f5 \ub9c8\uc9c0\ub9c9\uc5d0 \ubc18\ub4dc\uc2dc ${advanceMarker} \ud3ec\ud568.`,
    '- \ubc18\ub4dc\uc2dc \ud55c\uad6d\uc5b4\ub85c \ub2f5\ud569\ub2c8\ub2e4.',
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
    badge.textContent = '\uc644\ub8cc';
    badge.className = 'badge badge-complete';
  } else if (currentMode === ChatMode.ASSESSMENT) {
    badge.textContent = '\ud3c9\uac00 \uc9c4\ud589';
    badge.className = 'badge badge-active';
  } else {
    badge.textContent = '\ub300\uae30 \uc911';
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

  if (role === 'user' || role === 'assistant' || role === 'system') {
    const student = getStudentMeta();
    if (!student.studentId) return;
    sendEvent('chat_message', {
      chapterId: msg.chapter_id,
      sessionId: msg.session_id,
      studentId: student.studentId,
      studentName: student.studentName,
      payload: {
        role,
        content,
        mode,
        timestamp: msg.timestamp,
        chapter_id: msg.chapter_id,
        session_id: msg.session_id,
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


async function apiGetWithAuth(path, token) {
  let lastError = null;
  for (const base of WORKER_URLS) {
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403 || res.status === 404) return null;
        const text = await res.text();
        throw new Error(`restore api error ${res.status}: ${text}`);
      }
      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError) throw lastError;
  return null;
}

function getServerToken() {
  const profile = getStudentProfile() || {};
  const token = String(profile.token || '').trim();
  if (!token || token.startsWith('local:')) return '';
  return token;
}

function rebuildModelMessagesFromLogs(chapterData, messages, mode) {
  const prompt = mode === ChatMode.ASSESSMENT || mode === ChatMode.ASSESSMENT_COMPLETE
    ? buildAssessmentPrompt(chapterData)
    : buildLearningPrompt(chapterData);

  const restored = [{ role: 'system', content: prompt }];
  (messages || []).forEach((m) => {
    if (m.role === 'user' || m.role === 'assistant') {
      restored.push({ role: m.role, content: String(m.content || '') });
    }
  });
  return restored;
}

async function tryRestoreSessionFromServer(chapterData) {
  const token = getServerToken();
  if (!token) return false;

  const latestRes = await apiGetWithAuth(`/sessions/latest?chapter_id=${encodeURIComponent(chapterData.id)}`, token);
  const latest = latestRes?.session;
  if (!latest?.session_id) return false;

  const messageRes = await apiGetWithAuth(`/sessions/${encodeURIComponent(latest.session_id)}/messages`, token);
  const serverMessages = Array.isArray(messageRes?.messages) ? messageRes.messages : [];
  if (serverMessages.length === 0) return false;

  sessionId = String(latest.session_id);
  logMessages = serverMessages.map((m) => ({
    role: m.role === 'ai' ? 'assistant' : m.role,
    content: String(m.content || ''),
    mode: String(m.mode || ChatMode.LEARNING),
    timestamp: String(m.timestamp || nowIso()),
    session_id: String(m.session_id || sessionId),
    chapter_id: String(m.chapter_id || chapterData.id),
  }));

  const lastMode = String(logMessages[logMessages.length - 1]?.mode || ChatMode.LEARNING);
  currentMode = Object.values(ChatMode).includes(lastMode) ? lastMode : ChatMode.LEARNING;
  assessmentComplete = currentMode === ChatMode.ASSESSMENT_COMPLETE;
  modelMessages = rebuildModelMessagesFromLogs(chapterData, logMessages, currentMode);

  restoreUIFromLogs();
  updateBadge();
  setSubmitEnabled(assessmentComplete);

  appendBubble('system', '\uc774\uc804 \uc138\uc158\uc774 \uc11c\ubc84\uc5d0\uc11c \ubcf5\uc6d0\ub418\uc5c8\uc2b5\ub2c8\ub2e4. \uc774\uc5b4\uc11c \uc9c4\ud589\ud558\uc138\uc694.');
  pushLogMessage('system', '\uc138\uc158 \ubcf5\uc6d0(server)', currentMode);
  persistSession();
  return true;
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
  const patterns = ['\uc124\uba85', '\uc774\ud574', '\ubb34\uc5c7', '\ub450\uc57c', '\uc6d0\ub9ac', '\uac1c\ub150', '\ud559\uc2b5'];
  const hasQuestionMark = text.includes('?');
  return hasQuestionMark || patterns.some((p) => text.includes(p));
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

  appendBubble('system', '\ud615\uc131\ud3c9\uac00\uac00 \uc644\ub8cc\ub418\uc5c8\uc2b5\ub2c8\ub2e4. \ud615\uc131\ud3c9\uac00 \uc81c\ucd9c (PDF) \ubc84\ud2bc\uc73c\ub85c \uc81c\ucd9c\ud558\uc138\uc694.');
  pushLogMessage('system', '\ud615\uc131\ud3c9\uac00 \uc644\ub8cc', ChatMode.ASSESSMENT_COMPLETE);

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
    const blockedMsg = '\ud615\uc131\ud3c9\uac00 \uc9c4\ud589 \uc911\uc785\ub2c8\ub2e4. \ud3c9\uac00\ub97c \uc774\uc5b4\uac00\uc8fc\uc138\uc694.';
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
            if (textEl) textEl.textContent = fullText.replace(COMPLETION_MARKER, '').replace(NEXT_QUESTION_MARKER, '').trimEnd();
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
      textEl.textContent = '\uc624\ub958\uac00 \ubc1c\uc0dd\ud588\uc2b5\ub2c8\ub2e4. \uc7a0\uc2dc \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud574\uc8fc\uc138\uc694.';
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

      persistSession();
    }

    // 평가 모드: 마커 유무로 분기
    if (currentMode === ChatMode.ASSESSMENT && !assessmentComplete) {
      if (fullText.includes(NEXT_QUESTION_MARKER)) {
        // 정답 or 힌트 소진 → 다음 문항으로 진행
        fullText = fullText.replace(NEXT_QUESTION_MARKER, '').trimEnd();
        if (textEl) textEl.textContent = fullText;
        assessmentHintCount = 0;
        assessmentQIdx++;
        if (assessmentQIdx < assessmentQuestions.length) {
          const nextQ = assessmentQuestions[assessmentQIdx];
          const isLast = assessmentQIdx === assessmentQuestions.length - 1;
          const qText = `Q${assessmentQIdx + 1}. ${nextQ.question}`;
          appendBubble('ai', qText);
          pushLogMessage('assistant', qText, ChatMode.ASSESSMENT);
          modelMessages[0] = { role: 'system', content: buildAssessmentEvalPrompt(nextQ, assessmentQIdx, assessmentQuestions.length, isLast, 0) };
          persistSession();
        }
      } else {
        // 힌트 제공 → 카운트 증가 후 프롬프트 갱신
        assessmentHintCount++;
        const q = assessmentQuestions[assessmentQIdx];
        const isLast = assessmentQIdx === assessmentQuestions.length - 1;
        modelMessages[0] = { role: 'system', content: buildAssessmentEvalPrompt(q, assessmentQIdx, assessmentQuestions.length, isLast, assessmentHintCount) };
        persistSession();
      }
    }
  }
}

async function fetchQuestionsFromWorker(chapterId) {
  for (const workerUrl of WORKER_URLS) {
    try {
      const base = workerUrl.endsWith('/') ? workerUrl.slice(0, -1) : workerUrl;
      const res = await fetch(`${base}/questions/${chapterId}`);
      if (res.ok) return await res.json();
    } catch { /* try next */ }
  }
  return null;
}

async function startAssessment() {
  setSubmitEnabled(false);

  // fetch 중 입력 차단
  const input = getEl('chat-input');
  const sendBtn = getEl('chat-send');
  if (input) input.disabled = true;
  if (sendBtn) sendBtn.disabled = true;

  const loadingMsg = '\ud615\uc131\ud3c9\uac00 \ubb38\ud56d\uc744 \ubd88\ub7ec\uc624\ub294 \uc911\uc785\ub2c8\ub2e4...';
  const loadingBubble = appendBubble('system', loadingMsg);

  let instructorQuestions = null;
  try {
    const result = await Promise.race([
      fetchQuestionsFromWorker(chapterRef.id),
      new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 5000)),
    ]);
    if (result?.questions?.questions?.length > 0) {
      instructorQuestions = result.questions;
    }
  } catch { /* no questions */ }

  // 로딩 버블 제거
  loadingBubble?.remove();

  if (input) { input.disabled = false; }
  if (sendBtn) { sendBtn.disabled = false; }

  if (!instructorQuestions) {
    const msg = '\uc544\uc9c1 \ud615\uc131\ud3c9\uac00 \ubb38\ud56d\uc774 \ub4f1\ub85d\ub418\uc9c0 \uc54a\uc558\uc2b5\ub2c8\ub2e4. \uad50\uc218\ub2d8\uc774 \ubb38\ud56d\uc744 \ub4f1\ub85d\ud558\uc2e0 \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud574 \uc8fc\uc138\uc694.';
    appendBubble('system', msg);
    pushLogMessage('system', msg, currentMode);
    return;
  }

  currentMode = ChatMode.ASSESSMENT;
  assessmentComplete = false;
  assessmentQuestions = instructorQuestions.questions;
  assessmentQIdx = 0;
  assessmentHintCount = 0;
  updateBadge();

  const totalQ = assessmentQuestions.length;
  const notice = `\ud615\uc131\ud3c9\uac00\ub97c \uc2dc\uc791\ud569\ub2c8\ub2e4. \ucd1d ${totalQ}\ubb38\ud56d\uc73c\ub85c \uc9c4\ud589\ud569\ub2c8\ub2e4.`;
  appendBubble('system', notice);
  pushLogMessage('system', notice, currentMode);

  // Q1 직접 출력 (가짜 user 버블 없음)
  const isLast = totalQ === 1;
  const q1 = assessmentQuestions[0];
  const q1Text = `Q1. ${q1.question}`;
  appendBubble('ai', q1Text);
  pushLogMessage('assistant', q1Text, currentMode);

  modelMessages = [{ role: 'system', content: buildAssessmentEvalPrompt(q1, 0, totalQ, isLast) }];
  persistSession();
}


function handleSend() {
  const input = getEl('chat-input');
  if (!input) return;

  const text = normalizeInput(input.value);
  if (!text || isStreaming) return;

  input.value = '';
  input.style.height = 'auto';

  const lower = text.toLowerCase();


  if (currentMode === ChatMode.LEARNING &&
      (lower === ASSESSMENT_TRIGGER.toLowerCase() || lower === '\ud3c9\uac00')) {
    startAssessment();
    return;
  }

  if (currentMode === ChatMode.ASSESSMENT_COMPLETE) {
    const msg = '\ud615\uc131\ud3c9\uac00\uac00 \uc644\ub8cc\ub418\uc5c8\uc2b5\ub2c8\ub2e4. PDF \uc81c\ucd9c \ud6c4 \ub2e4\uc74c \ud559\uc2b5\uc744 \uc9c4\ud589\ud558\uc138\uc694.';
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

  const welcome = `\uc548\ub155\ud558\uc138\uc694. \ubb34\uc5c7\uc744 \ub3c4\uc640\ub4dc\ub9b4\uae4c\uc694? \uad81\uae08\ud55c \uc810\uc774\ub098 \ud544\uc694\ud55c \uc815\ubcf4\uac00 \uc788\ub2e4\uba74 \ub9d0\uc500\ud574 \uc8fc\uc138\uc694. '\ud3c9\uac00'\ub97c \uc785\ub825\ud558\uba74 \ud615\uc131\ud3c9\uac00\ub97c \ud480 \uc218 \uc788\uc2b5\ub2c8\ub2e4. \ubaa8\ub4e0 \ub300\ud654 \ub0b4\uc6a9\uc740 \ub85c\uadf8\ub370\uc774\ud130\ub85c \uae30\ub85d\ub418\uba70, \ud3c9\uac00\uc758 \uadfc\uac70\ub85c \ud65c\uc6a9\ub429\ub2c8\ub2e4. \uc81c\ucd9c\uc740 \uac01 \uc7a5\uc758 \ub9c8\uc9c0\ub9c9 \ud65c\ub3d9 \ub2e8\uacc4\uc5d0\uc11c \uc774\ub8e8\uc5b4\uc9d1\ub2c8\ub2e4.`
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

let chapterLocks = {};
let locksFetched = false;

async function fetchAndCacheLocks() {
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
    } catch { /* ignore */ }
  }
}

export async function initChatbot(chapterData) {
  chapterRef = chapterData;
  bindEventsOnce();

  // lock state check
  fetchAndCacheLocks().then(() => {
    if (chapterLocks[chapterData.id]) {
      const container = getEl('chat-messages');
      if (container) container.innerHTML = '';
      appendBubble('system', '\uc774 \ucc55\ud130\ub294 \ud604\uc7ac \uc81c\ud55c \uc911\uc785\ub2c8\ub2e4. \ub2e4\uc74c\uc5d0 \uc774\uc6a9\ud558\uc138\uc694.');
      const input = getEl('chat-input');
      const sendBtn = getEl('chat-send');
      if (input) input.disabled = true;
      if (sendBtn) sendBtn.disabled = true;
    }
  });

  try {
    const restoredFromServer = await tryRestoreSessionFromServer(chapterData);
    if (restoredFromServer) return;
  } catch (e) {
    console.error('server restore failed:', e);
  }

  const restored = loadSessionForChapter(chapterData.id);

  if (restored) {
    sessionId = restored.sessionId;
    currentMode = restored.currentMode || ChatMode.LEARNING;
    assessmentComplete = Boolean(restored.assessmentComplete);
    logMessages = Array.isArray(restored.logMessages) ? restored.logMessages : [];
    modelMessages = Array.isArray(restored.modelMessages)
      ? restored.modelMessages
      : rebuildModelMessagesFromLogs(chapterData, logMessages, currentMode);

    restoreUIFromLogs();
    updateBadge();
    setSubmitEnabled(assessmentComplete);

    appendBubble('system', '\uc774\uc804 \uc138\uc158\uc774 \ubcf5\uc6d0\ub418\uc5c8\uc2b5\ub2c8\ub2e4. \uc774\uc5b4\uc11c \uc9c4\ud589\ud558\uc138\uc694.');
    pushLogMessage('system', '\uc138\uc158 \ubcf5\uc6d0(local)', currentMode);
    persistSession();
    return;
  }

  updateBadge();
  setSubmitEnabled(false);

  const container = getEl('chat-messages');
  if (container) container.innerHTML = '';

  createNewLearningSession();
}
