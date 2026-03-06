import { showToast } from './main.js';

const WORKER_URLS = [
  'https://logic-proxy.dongkuklee99.workers.dev/',
  'https://logic-proxy.ldgit99.workers.dev/',
];
let activeWorkerUrl = WORKER_URLS[0];

const COMPLETION_MARKER = '===형성평가완료===';

let conversationMessages = [];
let chapterRef = null;
let isStreaming = false;
let assessmentComplete = false;
let sessionKey = 'logic_session_ch01';
let eventsBound = false;

function buildSystemPrompt(data) {
  const { title, objectives, keyConcepts, formativeAssessment } = data;

  const questionsText = formativeAssessment.questions
    .map((q, i) => {
      const hints = (q.hints || []).map((h, j) => `  힌트${j + 1}: ${h}`).join('\n');
      return `Q${i + 1} [Bloom: ${q.bloomLevel}] 개념: ${q.concept}\n  질문: ${q.question}\n  모범답안: ${q.keyAnswer}${hints ? `\n${hints}` : ''}`;
    })
    .join('\n\n');

  return `당신은 "디지털 논리회로" 과목의 AI 튜터입니다. 학생과의 문답으로 형성평가를 진행하세요.

[현재 챕터]
${title}

[학습목표]
${objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}

[핵심 개념]
${keyConcepts.join(', ')}

[형성평가 문항]
${questionsText}

[진행 규칙]
1. 학생이 "시작"이라고 입력하면 Q1부터 순서대로 진행합니다.
2. 학생이 막히면 힌트를 단계적으로 제공합니다.
3. 정답을 바로 말하지 말고 사고를 유도하세요.
4. 모든 문항이 끝나면 결과를 요약하고 마지막 줄에 정확히 ${COMPLETION_MARKER} 를 출력하세요.
5. 답변은 반드시 한국어로 작성하세요.`;
}

function getEl(id) {
  return document.getElementById(id);
}

function appendBubble(role, text, isTyping = false) {
  const container = getEl('chat-messages');
  if (!container) return null;

  const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;

  if (role === 'system') {
    bubble.innerHTML = `<div class="bubble-text">${escapeHtml(text)}</div>`;
  } else {
    const avatarText = role === 'ai' ? '🤖' : '👤';
    const textEl = document.createElement('div');
    textEl.className = `bubble-text${isTyping ? ' typing-cursor' : ''}`;
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
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function updateBadge() {
  const badge = getEl('assessment-badge');
  if (!badge) return;

  if (assessmentComplete) {
    badge.textContent = '완료';
    badge.className = 'badge badge-complete';
  } else {
    badge.textContent = '진행 중';
    badge.className = 'badge badge-active';
  }
}

function setSubmitEnabled(enabled) {
  const btn = getEl('btn-submit-pdf');
  if (btn) btn.disabled = !enabled;
}

function saveSession() {
  const payload = {
    chapterId: chapterRef?.id,
    messages: conversationMessages,
    assessmentComplete,
    savedAt: Date.now(),
  };

  try {
    localStorage.setItem(sessionKey, JSON.stringify(payload));
  } catch {
    // ignore storage failure
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(sessionKey);
    if (!raw) return false;

    const saved = JSON.parse(raw);
    if (saved.chapterId !== chapterRef?.id) return false;
    if (Date.now() - Number(saved.savedAt || 0) > 86400000) return false;

    conversationMessages = Array.isArray(saved.messages) ? saved.messages : [];
    assessmentComplete = Boolean(saved.assessmentComplete);
    return true;
  } catch {
    return false;
  }
}

function restoreUIFromSession() {
  const container = getEl('chat-messages');
  if (!container) return;

  container.innerHTML = '';
  conversationMessages
    .filter((m) => m.role !== 'system')
    .forEach((m) => appendBubble(m.role === 'user' ? 'user' : 'ai', m.content));

  updateBadge();
  setSubmitEnabled(assessmentComplete);
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
        const text = await res.text();
        throw new Error(`Worker error ${res.status}: ${text}`);
      }

      activeWorkerUrl = url;
      return res.body;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('All worker endpoints failed');
}

async function sendToAI(userText) {
  if (isStreaming) return;
  isStreaming = true;

  conversationMessages.push({ role: 'user', content: userText });
  appendBubble('user', userText);
  saveSession();

  const input = getEl('chat-input');
  const sendBtn = getEl('chat-send');
  if (input) input.disabled = true;
  if (sendBtn) sendBtn.disabled = true;

  const aiBubble = appendBubble('ai', '', true);
  const textEl = aiBubble?.querySelector('.bubble-text');
  let fullText = '';

  try {
    const body = await streamFromWorker(conversationMessages);
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
            if (textEl) {
              textEl.textContent = fullText.replace(COMPLETION_MARKER, '').trimEnd();
            }
            const messages = getEl('chat-messages');
            if (messages) messages.scrollTop = messages.scrollHeight;
          }
        } catch {
          // ignore malformed chunk
        }
      }
    }
  } catch (err) {
    console.error('Streaming error:', err);
    if (textEl) {
      textEl.textContent = '오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      textEl.style.color = 'var(--accent-red)';
    }
    showToast('챗봇 호출에 실패했습니다.', 'error');
  } finally {
    if (textEl) textEl.classList.remove('typing-cursor');
    isStreaming = false;
    if (input) {
      input.disabled = false;
      input.focus();
    }
    if (sendBtn) sendBtn.disabled = false;

    if (fullText.includes(COMPLETION_MARKER)) {
      fullText = fullText.replace(COMPLETION_MARKER, '').trimEnd();
      handleAssessmentComplete();
      if (textEl) textEl.textContent = fullText;
    }

    if (fullText) {
      conversationMessages.push({ role: 'assistant', content: fullText });
      saveSession();
    }
  }
}

function handleAssessmentComplete() {
  assessmentComplete = true;
  updateBadge();
  setSubmitEnabled(true);
  appendBubble('system', '형성평가가 완료되었습니다. 아래 제출 버튼으로 PDF를 생성하세요.');
  saveSession();
}

function handleSend() {
  const input = getEl('chat-input');
  if (!input) return;

  const text = input.value.trim();
  if (!text || isStreaming) return;

  input.value = '';
  input.style.height = 'auto';
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

export function getConversationMessages() {
  return conversationMessages;
}

export function getChapterRef() {
  return chapterRef;
}

export function resetChatbot(chapterData) {
  chapterRef = chapterData;
  sessionKey = `logic_session_ch${chapterData?.id || '01'}`;
  assessmentComplete = false;
  setSubmitEnabled(false);
  updateBadge();

  bindEventsOnce();

  const restored = loadSession();
  if (restored && conversationMessages.length > 0) {
    restoreUIFromSession();
    appendBubble('system', '이전 세션이 복원되었습니다. 이어서 진행하세요.');
    return;
  }

  const container = getEl('chat-messages');
  if (container) container.innerHTML = '';

  conversationMessages = [{ role: 'system', content: buildSystemPrompt(chapterData) }];

  const welcome = `안녕하세요! 저는 ${chapterData.title} AI 튜터입니다.\n\n준비가 되셨다면 "시작"이라고 입력해주세요.`;
  conversationMessages.push({ role: 'assistant', content: welcome });
  appendBubble('ai', welcome);
  saveSession();
}

export function initChatbot(chapterData) {
  resetChatbot(chapterData);
}