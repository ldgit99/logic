import { showToast } from './main.js';

const WORKER_URLS = [
  'https://logic-proxy.dongkuklee99.workers.dev/',
  'https://logic-proxy.ldgit99.workers.dev/',
];
let activeWorkerUrl = WORKER_URLS[0];

const COMPLETION_MARKER = '===?뺤꽦?됯??꾨즺===';

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
      const hints = (q.hints || []).map((h, j) => `  ?뚰듃${j + 1}: ${h}`).join('\n');
      return `Q${i + 1} [Bloom: ${q.bloomLevel}] 媛쒕뀗: ${q.concept}\n  吏덈Ц: ${q.question}\n  紐⑤쾾?듭븞: ${q.keyAnswer}${hints ? `\n${hints}` : ''}`;
    })
    .join('\n\n');

  return `?뱀떊? "?붿????쇰━?뚮줈" 怨쇰ぉ??AI ?쒗꽣?낅땲?? ?숈깮怨쇱쓽 臾몃떟?쇰줈 ?뺤꽦?됯?瑜?吏꾪뻾?섏꽭??

[?꾩옱 梨뺥꽣]
${title}

[?숈뒿紐⑺몴]
${objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}

[?듭떖 媛쒕뀗]
${keyConcepts.join(', ')}

[?뺤꽦?됯? 臾명빆]
${questionsText}

[吏꾪뻾 洹쒖튃]
1. ?숈깮??"?쒖옉"?대씪怨??낅젰?섎㈃ Q1遺???쒖꽌?濡?吏꾪뻾?⑸땲??
2. ?숈깮??留됲엳硫??뚰듃瑜??④퀎?곸쑝濡??쒓났?⑸땲??
3. ?뺣떟??諛붾줈 留먰븯吏 留먭퀬 ?ш퀬瑜??좊룄?섏꽭??
4. 紐⑤뱺 臾명빆???앸굹硫?寃곌낵瑜??붿빟?섍퀬 留덉?留?以꾩뿉 ?뺥솗??${COMPLETION_MARKER} 瑜?異쒕젰?섏꽭??
5. ?듬?? 諛섎뱶???쒓뎅?대줈 ?묒꽦?섏꽭??`;
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
    const avatarText = role === 'ai' ? '?쨼' : '?뫀';
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
    badge.textContent = '?꾨즺';
    badge.className = 'badge badge-complete';
  } else {
    badge.textContent = '吏꾪뻾 以?;
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
    if (Date.now() - Number(saved.savedAt || 0) > 2592000000) return false;

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
      textEl.textContent = '?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄?댁＜?몄슂.';
      textEl.style.color = 'var(--accent-red)';
    }
    showToast('梨쀫큸 ?몄텧???ㅽ뙣?덉뒿?덈떎.', 'error');
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
  appendBubble('system', '?뺤꽦?됯?媛 ?꾨즺?섏뿀?듬땲?? ?꾨옒 ?쒖텧 踰꾪듉?쇰줈 PDF瑜??앹꽦?섏꽭??');
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
    appendBubble('system', '?댁쟾 ?몄뀡??蹂듭썝?섏뿀?듬땲?? ?댁뼱??吏꾪뻾?섏꽭??');
    return;
  }

  const container = getEl('chat-messages');
  if (container) container.innerHTML = '';

  conversationMessages = [{ role: 'system', content: buildSystemPrompt(chapterData) }];

  const welcome = `?덈뀞?섏꽭?? ???${chapterData.title} AI ?쒗꽣?낅땲??\n\n以鍮꾧? ?섏뀲?ㅻ㈃ "?쒖옉"?대씪怨??낅젰?댁＜?몄슂.`;
  conversationMessages.push({ role: 'assistant', content: welcome });
  appendBubble('ai', welcome);
  saveSession();
}

export function initChatbot(chapterData) {
  resetChatbot(chapterData);
}