import { showToast } from './main.js';
import { generateFeedback } from './feedback.js';
import { sendEvent } from './instrumentation.js';

// ─── Worker URL 설정 ───
// Cloudflare Worker 배포 후 아래 URL을 변경하세요
const WORKER_URL = 'https://logic-proxy.dongkuklee99.workers.dev/';

const COMPLETION_MARKER = '===형성평가완료===';
const SESSION_KEY = 'logic_session_ch01';

// ─── 상태 ───
let conversationMessages = [];
let chapterRef = null;
let isStreaming = false;
let assessmentComplete = false;
let sessionId = null; // 계측용 세션 UUID

// ─── 시스템 프롬프트 생성 ───
function buildSystemPrompt(data) {
  const { title, objectives, formativeAssessment } = data;
  const keyConcepts = data.keyConcepts || [];
  const questions = formativeAssessment?.questions || [];
  const totalQuestions = formativeAssessment?.totalQuestions ?? questions.length;

  const questionsText = questions.map((q, i) => {
    const bloom = q.bloomLevel || q.bloom || '';
    const concept = q.concept || '';
    const keyAnswer = q.keyAnswer || q.answer || '';
    const hints = (q.hints || []).map((h, j) => `  힌트${j + 1}: ${h}`).join('\n');
    return `Q${i + 1} [Bloom: ${bloom}] 핵심 개념: ${concept}\n  질문: ${q.question}\n  모범 답안: ${keyAnswer}${hints ? '\n' + hints : ''}`;
  }).join('\n\n');

  return `당신은 "디지털 논리회로" 과목의 AI 튜터입니다. 소크라테스 문답법과 Bloom's Taxonomy를 활용하여 형성평가를 진행합니다.

[현재 챕터]
${title}

[학습목표]
${objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}

[핵심 개념]
${keyConcepts.length ? keyConcepts.join(', ') : '챕터 내용 참조'}

[형성평가 문항 (총 ${totalQuestions}개)]
${questionsText}

[형성평가 진행 규칙]
1. 학생이 준비됐다고 하면 Q1부터 순서대로 질문합니다.
2. 답변이 불충분하거나 틀리면 힌트를 단계별로 제공하고 재질문합니다.
3. 절대 바로 정답을 알려주지 않습니다. 힌트는 최대 3단계까지만 사용합니다.
4. 3단계 힌트 이후에도 틀리면 정답을 알려준 후 다음 문제로 넘어갑니다.
5. 각 답변 후 학생의 오개념을 파악하여 누적 메모합니다.
6. 모든 질문이 끝나면 맞춘 문항, 틀린 문항, 취약 개념을 요약합니다.
7. 요약 제시 후 반드시 다음 텍스트를 포함하여 완료를 알립니다: ${COMPLETION_MARKER}

[응답 규칙]
- 반드시 한국어로만 응답합니다.
- 친절하고 격려적인 톤을 유지합니다.
- 한 번에 하나의 질문만 합니다.
- 형성평가와 무관한 질문은 "형성평가를 마친 후에 이야기해요!"라고 답합니다.`;
}

// ─── 채팅 말풍선 추가 ───
function appendBubble(role, text, isStreaming = false) {
  const container = document.getElementById('chat-messages');
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
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── SSE 스트리밍 ───
async function streamFromWorker(messages) {
  if (WORKER_URL.includes('YOUR_WORKER')) {
    showToast('Worker URL을 설정해주세요 (js/chatbot.js)', 'error');
    throw new Error('Worker URL not configured');
  }

  const res = await fetch(WORKER_URL, {
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
}

// ─── AI 응답 스트리밍 처리 ───
async function sendToAI(userText) {
  if (isStreaming) return;
  isStreaming = true;

  // 사용자 메시지 추가
  conversationMessages.push({ role: 'user', content: userText });
  appendBubble('user', userText);
  saveSession();

  // D1: 채팅 이벤트 계측 (student_id/name은 제출 전까지 미입력)
  sendEvent('chat_message', {
    chapterId: chapterRef?.id || '',
    sessionId: sessionId || '',
    studentId: '',
    studentName: '',
    payload: { role: 'user', length: userText.length },
  });

  // 입력창 비활성화
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  input.disabled = true;
  sendBtn.disabled = true;

  // 스트리밍 말풍선 생성
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
            // 완료 마커는 표시하지 않음
            textEl.textContent = fullText.replace(COMPLETION_MARKER, '').trimEnd();
            aiBubble.closest('#chat-messages').scrollTop = 999999;
          }
        } catch { /* JSON parse 오류 무시 */ }
      }
    }
  } catch (err) {
    textEl.textContent = '오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    textEl.style.color = 'var(--accent-red)';
    console.error('Streaming error:', err);
  } finally {
    textEl.classList.remove('typing-cursor');
    isStreaming = false;
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();

    // 시간 추가
    const timeEl = aiBubble.querySelector('.bubble-time');
    if (timeEl) {
      timeEl.textContent = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    }

    // 완료 마커 감지
    if (fullText.includes(COMPLETION_MARKER)) {
      const displayText = fullText.replace(COMPLETION_MARKER, '').trimEnd();
      fullText = displayText;
      handleAssessmentComplete();
    }

    // 대화 기록에 저장
    conversationMessages.push({ role: 'assistant', content: fullText });
    saveSession();
  }
}

// ─── 형성평가 완료 처리 ───
function handleAssessmentComplete() {
  assessmentComplete = true;

  // 배지 업데이트
  const badge = document.getElementById('assessment-badge');
  badge.textContent = '완료';
  badge.className = 'badge badge-complete';

  // 제출 버튼 활성화
  document.getElementById('btn-submit-pdf').disabled = false;

  // 시스템 메시지
  appendBubble('system', '형성평가가 완료되었습니다. 아래 "형성평가 제출 (PDF)" 버튼을 눌러 결과를 제출하세요.');

  // D1: 형성평가 완료 이벤트
  sendEvent('assessment_completed', {
    chapterId: chapterRef?.id || '',
    sessionId: sessionId || '',
    studentId: '',
    studentName: '',
    payload: { messageCount: conversationMessages.filter((m) => m.role === 'user').length },
  });

  saveSession();
}

// ─── 세션 ID 접근자 (instrumentation에서 사용) ───
export function getSessionId() {
  return sessionId;
}

// ─── localStorage 세션 ───
function saveSession() {
  const session = {
    chapterId: chapterRef?.id,
    sessionId,
    messages: conversationMessages,
    assessmentComplete,
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch { /* 용량 초과 시 무시 */ }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const session = JSON.parse(raw);
    if (session.chapterId !== chapterRef?.id) return false;
    // 24시간 이내 세션만 복원
    if (Date.now() - session.savedAt > 2592000000) return false;

    conversationMessages = session.messages || [];
    assessmentComplete = session.assessmentComplete || false;
    sessionId = session.sessionId || crypto.randomUUID?.() || Date.now().toString(36);
    return true;
  } catch {
    return false;
  }
}

function restoreUIFromSession() {
  const container = document.getElementById('chat-messages');
  container.innerHTML = '';

  // system 메시지 제외하고 표시
  conversationMessages.filter(m => m.role !== 'system').forEach(m => {
    appendBubble(m.role === 'user' ? 'user' : 'ai', m.content);
  });

  if (assessmentComplete) {
    document.getElementById('assessment-badge').textContent = '완료';
    document.getElementById('assessment-badge').className = 'badge badge-complete';
    document.getElementById('btn-submit-pdf').disabled = false;
  }
}

// ─── 입력 처리 ───
function handleSend() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || isStreaming) return;
  input.value = '';
  input.style.height = 'auto';
  sendToAI(text);
}

// ─── 외부 노출 (export.js에서 사용) ───
export function getConversationMessages() {
  return conversationMessages;
}

export function getChapterRef() {
  return chapterRef;
}

// ─── 초기화 ───
export function initChatbot(chapterData) {
  chapterRef = chapterData;

  // 배지 초기화
  const badge = document.getElementById('assessment-badge');
  badge.textContent = '진행 중';
  badge.className = 'badge badge-active';

  // 세션 복원
  const restored = loadSession();

  if (restored && conversationMessages.length > 1) {
    restoreUIFromSession();
    appendBubble('system', '이전 세션이 복원되었습니다. 이어서 진행하세요.');
  } else {
    // 새 세션 ID 생성
    sessionId = crypto.randomUUID?.() || Date.now().toString(36);

    // 시스템 프롬프트 설정
    conversationMessages = [{ role: 'system', content: buildSystemPrompt(chapterData) }];

    // D1: 세션 시작 이벤트
    sendEvent('session_started', {
      chapterId: chapterData.id || '',
      sessionId,
      studentId: '',
      studentName: '',
      payload: { chapterTitle: chapterData.title },
    });

    // 웰컴 메시지
    const totalQ = chapterData.formativeAssessment?.totalQuestions
      ?? chapterData.formativeAssessment?.questions?.length
      ?? 0;
    const welcome = `안녕하세요! 저는 ${chapterData.title}의 AI 튜터입니다. 🎓\n\n강의 내용을 학습하셨나요? 준비가 되셨다면 "시작"이라고 입력해주세요. 총 ${totalQ}개의 문제로 형성평가를 진행하겠습니다!`;
    conversationMessages.push({ role: 'assistant', content: welcome });
    appendBubble('ai', welcome);
    saveSession();
  }

  // 이벤트 핸들러
  document.getElementById('chat-send').addEventListener('click', handleSend);

  document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // 자동 높이 조절
  document.getElementById('chat-input').addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  });
}
