import { sendEvent } from './instrumentation.js?v=20260309d';
import { getStudentProfile } from './auth.js?v=20260309d';

const LOCAL_ORIGIN_WITH_SLASH = window.location.origin.endsWith('/') ? window.location.origin : (window.location.origin + '/');

const WORKER_URLS = [
  'https://logic-proxy.dongkuklee99.workers.dev/',
  'https://logic.dongkuklee99.workers.dev/',
  ...(window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1') ? [LOCAL_ORIGIN_WITH_SLASH] : []),
];

const COMPLETION_MARKER = '===\ud615\uc131\ud3c9\uac00\uc644\ub8cc===';
const ASSESSMENT_TRIGGER = '\ud615\uc131\ud3c9\uac00';
const SESSION_INDEX_KEY = 'logic_session_index_v3';
const SESSION_PREFIX = 'logic_session_v3';
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
    `?뱀떊? "${title}"??AI ?숈뒿 ?쒗꽣?낅땲??`,
    '',
    '[??븷]',
    '- ?꾩옱 梨뺥꽣???숈뒿 ?댁슜 吏덈Ц???뺥솗?섍퀬 ?댄빐?섍린 ?쎄쾶 ?듬??⑸땲??',
    '- ?덉떆, 鍮꾩쑀, ?④퀎蹂??ㅻ챸???ъ슜???숈뒿???뺤뒿?덈떎.',
    '- ?뺤꽦?됯?瑜??쒖옉?섎젮硫??ъ슜?먭? ?뺥솗??"?뺤꽦?됯?"?쇨퀬 ?낅젰?댁빞 ?쒕떎怨??덈궡?⑸땲??',
    '',
    '[?숈뒿紐⑺몴]',
    ...objectives.map((o, i) => `${i + 1}. ${o}`),
    '',
    '[?듭떖 媛쒕뀗]',
    keyConcepts.length ? keyConcepts.join(', ') : '梨뺥꽣 ?댁슜 李몄“',
    '',
    '[?묐떟 洹쒖튃]',
    '- 諛섎뱶???쒓뎅?대줈 ?듬??⑸땲??',
    '- ?ъ떎怨?異붾줎??援щ텇???ㅻ챸?⑸땲??',
    '- 遺덊븘?뷀븳 ?λЦ ????듭떖遺??紐낇솗???듬??⑸땲??',
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
    const hints = (q.hints || []).map((h, j) => `  ?뚰듃${j + 1}: ${h}`).join('\n');
    return `Q${i + 1} [Bloom: ${bloom}] ?듭떖 媛쒕뀗: ${concept}\n  吏덈Ц: ${q.question}\n  紐⑤쾾 ?듭븞: ${keyAnswer}${hints ? `\n${hints}` : ''}`;
  }).join('\n\n');

  return [
    `?뱀떊? "?붿????쇰━?뚮줈" 怨쇰ぉ??AI ?쒗꽣?낅땲?? ?뺤꽦?됯?瑜?吏꾪뻾?⑸땲??`,
    '',
    '[?꾩옱 梨뺥꽣]',
    title,
    '',
    '[?숈뒿紐⑺몴]',
    ...objectives.map((o, i) => `${i + 1}. ${o}`),
    '',
    '[?듭떖 媛쒕뀗]',
    keyConcepts.length ? keyConcepts.join(', ') : '梨뺥꽣 ?댁슜 李몄“',
    '',
    `[?뺤꽦?됯? 臾명빆 (珥?${totalQuestions}媛?]`,
    questionsText,
    '',
    '[?뺤꽦?됯? 吏꾪뻾 洹쒖튃]',
    '1. Q1遺???쒖꽌?濡?吏덈Ц?⑸땲??',
    '2. ?ㅻ떟/遺덉땐遺??듬??먮뒗 ?④퀎???뚰듃瑜??쒓났?⑸땲??',
    '3. ?뚰듃 理쒕? 3?④퀎 ?꾩뿉???ㅻ떟?대㈃ ?뺣떟 ?쒖떆 ???ㅼ쓬 臾명빆?쇰줈 ?대룞?⑸땲??',
    '4. 紐⑤뱺 臾명빆 醫낅즺 ??寃곌낵瑜??붿빟?⑸땲??',
    `5. 理쒖쥌 ?묐떟??諛섎뱶??${COMPLETION_MARKER} 臾몄옄?댁쓣 ?ы븿?⑸땲??`,
    '',
    '[?묐떟 洹쒖튃]',
    '- 諛섎뱶???쒓뎅?대줈 ?듬??⑸땲??',
    '- ??踰덉뿉 ?섎굹??吏덈Ц留?吏꾪뻾?⑸땲??',
  ].join('\n');
}

function appendBubble(role, text, isStreaming = false) {
  const container = getEl('chat-messages');
  if (!container) return null;

  const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;

  const avatarText = role === 'ai' ? '?쨼' : role === 'user' ? '?뫀' : '';

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
    badge.textContent = '\uc9c4\ud589 \uc911';
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
  pushLogMessage('system', '?몄뀡 蹂듭썝(server)', currentMode);
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

  appendBubble('system', '\ud615\uc131\ud3c9\uac00\uac00 \uc644\ub8cc\ub418\uc5c8\uc2b5\ub2c8\ub2e4. \ud615\uc131\ud3c9\uac00 \uc81c\ucd9c (PDF) \ubc84\ud2bc\uc73c\ub85c \uc81c\ucd9c\ud558\uc138\uc694.');
  pushLogMessage('system', '?뺤꽦?됯? ?꾨즺', ChatMode.ASSESSMENT_COMPLETE);

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
      textEl.textContent = '?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄?댁＜?몄슂.';
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

  const notice = `\ud615\uc131\ud3c9\uac00\ub97c \uc2dc\uc791\ud569\ub2c8\ub2e4. \ucd1d ${getAssessmentQuestionCount()}\ubb38\ud56d\uc73c\ub85c \uc9c4\ud589\ud569\ub2c8\ub2e4.`;
  appendBubble('system', notice);
  pushLogMessage('system', notice, currentMode);

  modelMessages = [{ role: 'system', content: buildAssessmentPrompt(chapterRef) }];
  persistSession();

  await sendToAI('\ud615\uc131\ud3c9\uac00\ub97c \uc2dc\uc791\ud569\ub2c8\ub2e4. Q1\uc744 \uc9c8\ubb38\ud574\uc8fc\uc138\uc694.', { force: true });
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

  const welcome = `\uc548\ub155\ud558\uc138\uc694! ${chapterRef.title} \ud559\uc2b5 \ub3c4\uc6b0\ubbf8\uc785\ub2c8\ub2e4. \ud559\uc2b5 \uc9c8\ubb38\uc740 \uc790\uc720\ub86d\uac8c \ud574\uc8fc\uc138\uc694. \ud615\uc131\ud3c9\uac00\ub97c \uc2dc\uc791\ud558\ub824\uba74 "\ud615\uc131\ud3c9\uac00"\ub97c \uc785\ub825\ud558\uc138\uc694.`;
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
    pushLogMessage('system', '?몄뀡 蹂듭썝(local)', currentMode);
    persistSession();
    return;
  }

  updateBadge();
  setSubmitEnabled(false);

  const container = getEl('chat-messages');
  if (container) container.innerHTML = '';

  createNewLearningSession();
}
