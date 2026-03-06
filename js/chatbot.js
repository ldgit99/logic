import { showToast } from './main.js';
import { generateFeedback } from './feedback.js';

// ??? Worker URL ?ㅼ젙 ???
// Cloudflare Worker 諛고룷 ???꾨옒 URL??蹂寃쏀븯?몄슂
const WORKER_URLS = ['https://logic-proxy.dongkuklee99.workers.dev/', 'https://logic-proxy.ldgit99.workers.dev/'];
let activeWorkerUrl = WORKER_URLS[0];

const COMPLETION_MARKER = '===?뺤꽦?됯??꾨즺===';

// ??? ?곹깭 ???
let conversationMessages = [];
let chapterRef = null;
let isStreaming = false;
let assessmentComplete = false;
let sessionKey = 'logic_session_ch01';
let chatbotEventsBound = false;

// ??? ?쒖뒪???꾨＼?꾪듃 ?앹꽦 ???
function buildSystemPrompt(data) {
  const { title, objectives, keyConcepts, formativeAssessment } = data;

  const questionsText = formativeAssessment.questions.map((q, i) => {
    const hints = q.hints.map((h, j) => `  ?뚰듃${j + 1}: ${h}`).join('\n');
    return `Q${i + 1} [Bloom: ${q.bloomLevel}] ?듭떖 媛쒕뀗: ${q.concept}\n  吏덈Ц: ${q.question}\n  紐⑤쾾 ?듭븞: ${q.keyAnswer}\n${hints}`;
  }).join('\n\n');

  return `?뱀떊? "?붿????쇰━?뚮줈" 怨쇰ぉ??AI ?쒗꽣?낅땲?? ?뚰겕?쇳뀒??臾몃떟踰뺢낵 Bloom's Taxonomy瑜??쒖슜?섏뿬 ?뺤꽦?됯?瑜?吏꾪뻾?⑸땲??

[?꾩옱 梨뺥꽣]
${title}

[?숈뒿紐⑺몴]
${objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}

[?듭떖 媛쒕뀗]
${keyConcepts.join(', ')}

[?뺤꽦?됯? 臾명빆 (珥?${formativeAssessment.totalQuestions}媛?]
${questionsText}

[?뺤꽦?됯? 吏꾪뻾 洹쒖튃]
1. ?숈깮??以鍮꾨릱?ㅺ퀬 ?섎㈃ Q1遺???쒖꽌?濡?吏덈Ц?⑸땲??
2. ?듬???遺덉땐遺꾪븯嫄곕굹 ?由щ㈃ ?뚰듃瑜??④퀎蹂꾨줈 ?쒓났?섍퀬 ?ъ쭏臾명빀?덈떎.
3. ?덈? 諛붾줈 ?뺣떟???뚮젮二쇱? ?딆뒿?덈떎. ?뚰듃??理쒕? 3?④퀎源뚯?留??ъ슜?⑸땲??
4. 3?④퀎 ?뚰듃 ?댄썑?먮룄 ?由щ㈃ ?뺣떟???뚮젮以 ???ㅼ쓬 臾몄젣濡??섏뼱媛묐땲??
5. 媛??듬? ???숈깮???ㅺ컻?먯쓣 ?뚯븙?섏뿬 ?꾩쟻 硫붾え?⑸땲??
6. 紐⑤뱺 吏덈Ц???앸굹硫?留욎텣 臾명빆, ?由?臾명빆, 痍⑥빟 媛쒕뀗???붿빟?⑸땲??
7. ?붿빟 ?쒖떆 ??諛섎뱶???ㅼ쓬 ?띿뒪?몃? ?ы븿?섏뿬 ?꾨즺瑜??뚮┰?덈떎: ${COMPLETION_MARKER}

[?묐떟 洹쒖튃]
- 諛섎뱶???쒓뎅?대줈留??묐떟?⑸땲??
- 移쒖젅?섍퀬 寃⑸젮?곸씤 ?ㅼ쓣 ?좎??⑸땲??
- ??踰덉뿉 ?섎굹??吏덈Ц留??⑸땲??
- ?뺤꽦?됯?? 臾닿???吏덈Ц? "?뺤꽦?됯?瑜?留덉튇 ?꾩뿉 ?댁빞湲고빐??"?쇨퀬 ?듯빀?덈떎.`;
}

// ??? 梨꾪똿 留먰뭾??異붽? ???
function appendBubble(role, text, isStreaming = false) {
  const container = document.getElementById('chat-messages');
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
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ??? SSE ?ㅽ듃由щ컢 ???
async function streamFromWorker(messages) {
  if (activeWorkerUrl.includes('YOUR_WORKER')) {
    showToast('Worker URL을 설정해주세요 (js/chatbot.js)', 'error');
    throw new Error('Worker URL not configured');
  }

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

      activeWorkerUrl = url;
      return res.body;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('No worker endpoint available');
}

// ??? AI ?묐떟 ?ㅽ듃由щ컢 泥섎━ ???
async function sendToAI(userText) {
  if (isStreaming) return;
  isStreaming = true;

  // ?ъ슜??硫붿떆吏 異붽?
  conversationMessages.push({ role: 'user', content: userText });
  appendBubble('user', userText);
  saveSession();

  // ?낅젰李?鍮꾪솢?깊솕
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  input.disabled = true;
  sendBtn.disabled = true;

  // ?ㅽ듃由щ컢 留먰뭾???앹꽦
  const aiBubble = appendBubble('ai', '', true);
  const textEl = aiBubble.querySelector('.bubble-text');

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
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;
        try {
          const parsed = JSON.parse(data);
          const chunk = parsed.choices?.[0]?.delta?.content;
          if (chunk) {
            fullText += chunk;
            // ?꾨즺 留덉빱???쒖떆?섏? ?딆쓬
            textEl.textContent = fullText.replace(COMPLETION_MARKER, '').trimEnd();
            aiBubble.closest('#chat-messages').scrollTop = 999999;
          }
        } catch { /* JSON parse ?ㅻ쪟 臾댁떆 */ }
      }
    }
  } catch (err) {
    textEl.textContent = '?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄?댁＜?몄슂.';
    textEl.style.color = 'var(--accent-red)';
    console.error('Streaming error:', err);
  } finally {
    textEl.classList.remove('typing-cursor');
    isStreaming = false;
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();

    // ?쒓컙 異붽?
    const timeEl = aiBubble.querySelector('.bubble-time');
    if (timeEl) {
      timeEl.textContent = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    }

    // ?꾨즺 留덉빱 媛먯?
    if (fullText.includes(COMPLETION_MARKER)) {
      const displayText = fullText.replace(COMPLETION_MARKER, '').trimEnd();
      fullText = displayText;
      handleAssessmentComplete();
    }

    // ???湲곕줉?????    conversationMessages.push({ role: 'assistant', content: fullText });
    saveSession();
  }
}

// ??? ?뺤꽦?됯? ?꾨즺 泥섎━ ???
function handleAssessmentComplete() {
  assessmentComplete = true;

  // 諛곗? ?낅뜲?댄듃
  const badge = document.getElementById('assessment-badge');
  badge.textContent = '?꾨즺';
  badge.className = 'badge badge-complete';

  // ?쒖텧 踰꾪듉 ?쒖꽦??  document.getElementById('btn-submit-pdf').disabled = false;

  // ?쒖뒪??硫붿떆吏
  appendBubble('system', '?뺤꽦?됯?媛 ?꾨즺?섏뿀?듬땲?? ?꾨옒 "?뺤꽦?됯? ?쒖텧 (PDF)" 踰꾪듉???뚮윭 寃곌낵瑜??쒖텧?섏꽭??');

  saveSession();
}

// ??? localStorage ?몄뀡 ???
function saveSession() {
  const session = {
    chapterId: chapterRef?.id,
    messages: conversationMessages,
    assessmentComplete,
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(sessionKey, JSON.stringify(session));
  } catch { /* ?⑸웾 珥덇낵 ??臾댁떆 */ }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(sessionKey);
    if (!raw) return false;
    const session = JSON.parse(raw);
    if (session.chapterId !== chapterRef?.id) return false;
    // 24?쒓컙 ?대궡 ?몄뀡留?蹂듭썝
    if (Date.now() - session.savedAt > 86400000) return false;

    conversationMessages = session.messages || [];
    assessmentComplete = session.assessmentComplete || false;
    return true;
  } catch {
    return false;
  }
}

function restoreUIFromSession() {
  const container = document.getElementById('chat-messages');
  container.innerHTML = '';

  // system 硫붿떆吏 ?쒖쇅?섍퀬 ?쒖떆
  conversationMessages.filter(m => m.role !== 'system').forEach(m => {
    appendBubble(m.role === 'user' ? 'user' : 'ai', m.content);
  });

  if (assessmentComplete) {
    document.getElementById('assessment-badge').textContent = '?꾨즺';
    document.getElementById('assessment-badge').className = 'badge badge-complete';
    document.getElementById('btn-submit-pdf').disabled = false;
  }
}

// ??? ?낅젰 泥섎━ ???
function handleSend() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || isStreaming) return;
  input.value = '';
  input.style.height = 'auto';
  sendToAI(text);
}

// ??? ?몃? ?몄텧 (export.js?먯꽌 ?ъ슜) ???
export function getConversationMessages() {
  return conversationMessages;
}

export function getChapterRef() {
  return chapterRef;
}

// ??? 梨뺥꽣 ?꾪솚 ??由ъ뀑 (main.js?먯꽌 ?몄텧) ???
export function resetChatbot(chapterData) {
  chapterRef = chapterData;
  sessionKey = `logic_session_ch${chapterData.id}`;
  isStreaming = false;
  assessmentComplete = false;

  // UI 珥덇린??  document.getElementById('chat-messages').innerHTML = '';
  document.getElementById('assessment-badge').textContent = '吏꾪뻾 以?;
  document.getElementById('assessment-badge').className = 'badge badge-active';
  document.getElementById('btn-submit-pdf').disabled = true;
  document.getElementById('chat-input').disabled = false;
  document.getElementById('chat-send').disabled = false;

  // ?몄뀡 蹂듭썝 ?쒕룄
  const restored = loadSession();

  if (restored && conversationMessages.length > 1) {
    restoreUIFromSession();
    appendBubble('system', '?댁쟾 ?몄뀡??蹂듭썝?섏뿀?듬땲?? ?댁뼱??吏꾪뻾?섏꽭??');
  } else {
    conversationMessages = [{ role: 'system', content: buildSystemPrompt(chapterData) }];
    const welcome = `?덈뀞?섏꽭?? ???${chapterData.title}??AI ?쒗꽣?낅땲?? ?럳\n\n媛뺤쓽 ?댁슜???숈뒿?섏뀲?섏슂? 以鍮꾧? ?섏뀲?ㅻ㈃ "?쒖옉"?대씪怨??낅젰?댁＜?몄슂. 珥?${chapterData.formativeAssessment.totalQuestions}媛쒖쓽 臾몄젣濡??뺤꽦?됯?瑜?吏꾪뻾?섍쿋?듬땲??`;
    conversationMessages.push({ role: 'assistant', content: welcome });
    appendBubble('ai', welcome);
    saveSession();
  }

  // ?대깽?몃뒗 理쒖큹 1?뚮쭔 諛붿씤??  if (!chatbotEventsBound) {
    chatbotEventsBound = true;
    document.getElementById('chat-send').addEventListener('click', handleSend);
    document.getElementById('chat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
    document.getElementById('chat-input').addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
  }
}

// ??? ?섏쐞 ?명솚 (initChatbot ??resetChatbot ?꾩엫) ???
export function initChatbot(chapterData) {
  resetChatbot(chapterData);
}





