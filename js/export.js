function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

import { getConversationMessages, getChapterRef, getSessionId, getChatSessionSnapshot } from './chatbot.js?v=20260326b';
import { getStudentProfile } from './auth.js?v=20260311c';
import { sendAssessment } from './instrumentation.js?v=20260407b';

const WORKER_BASE = 'https://logic-proxy.dongkuklee99.workers.dev';

let exportEventsBound = false;

function getEl(id) {
  return document.getElementById(id);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getUserScopedKey(base, studentId) {
  return `${base}_${studentId || 'anon'}`;
}

function getStoredSessionId(studentId, chapterId) {
  try {
    const raw = localStorage.getItem(getUserScopedKey('logic_session_index_v5', studentId));
    const index = raw ? JSON.parse(raw) : {};
    const sessionId = index?.[chapterId];
    return typeof sessionId === 'string' ? sessionId : '';
  } catch {
    return '';
  }
}

function getStoredMessages(studentId, chapterId, currentSessionId = '') {
  const candidates = [];
  if (currentSessionId) candidates.push(currentSessionId);
  const indexedSessionId = getStoredSessionId(studentId, chapterId);
  if (indexedSessionId && !candidates.includes(indexedSessionId)) candidates.push(indexedSessionId);

  for (const sessionId of candidates) {
    try {
      const key = `${getUserScopedKey('logic_session_v5', studentId)}_${sessionId}`;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.logMessages)) continue;
      const messages = parsed.logMessages.filter((m) => m && typeof m.content === 'string');
      if (messages.length > 0) return messages;
    } catch {
      // ignore and try next
    }
  }

  return [];
}

function getDomMessages() {
  const container = document.getElementById('chat-messages');
  if (!container) return [];

  return Array.from(container.querySelectorAll('.chat-bubble')).map((bubble) => {
    const isUser = bubble.classList.contains('user');
    const isAi = bubble.classList.contains('ai');
    const text = bubble.querySelector('.bubble-text')?.textContent?.trim() || '';
    if (!text) return null;
    return {
      role: isUser ? 'user' : isAi ? 'assistant' : 'system',
      content: text,
    };
  }).filter(Boolean);
}

function resolveConversationMessages({ studentId, chapterId, sessionId }) {
  const liveMessages = getConversationMessages();
  if (Array.isArray(liveMessages) && liveMessages.length > 0) {
    return liveMessages;
  }

  const storedMessages = getStoredMessages(studentId, chapterId, sessionId);
  if (storedMessages.length > 0) {
    return storedMessages;
  }

  return getDomMessages();
}

function setLoading(visible, message = '제출을 처리하는 중입니다...') {
  const overlay = getEl('loading-overlay');
  const msg = getEl('loading-message');

  if (msg) msg.textContent = message;
  if (!overlay) return;
  overlay.classList.toggle('hidden', !visible);
}

function openModal() {
  const modal = getEl('student-modal');
  const profile = getStudentProfile() || {};
  const display = getEl('modal-profile-display');
  if (display) {
    display.textContent = `${profile.studentName || ''}  (${profile.studentId || ''})`;
  }
  if (modal) modal.classList.remove('hidden');
}

function closeModal() {
  const modal = getEl('student-modal');
  if (modal) modal.classList.add('hidden');
}

function normalizeFeedback(feedback, totalCount) {
  return {
    correctCount: Number(feedback.correctCount || 0),
    totalCount,
    score: Number(feedback.score || 0),
    weakConcepts: Array.isArray(feedback.weakConcepts) ? feedback.weakConcepts : [],
    feedUp: feedback.feedUp || '',
    feedBack: feedback.feedBack || '',
    feedForward: feedback.feedForward || '',
    qualityMetrics: feedback.qualityMetrics && typeof feedback.qualityMetrics === 'object' ? feedback.qualityMetrics : {},
  };
}

async function generateFeedback(chapterData, messages, chatSnapshot) {
  try {
    const res = await fetch(`${WORKER_BASE}/chat/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chapter: chapterData,
        messages: messages.filter((m) => m.role !== 'system'),
        memorySummary: chatSnapshot.memorySummary || {},
        chatMetrics: chatSnapshot.qualityMetrics || {},
        assessmentTrace: chatSnapshot.assessmentTrace || [],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result || null;
  } catch {
    return null;
  }
}

function buildReportHTML(studentName, studentId, chapterData, messages, feedback) {
  const now = new Date();
  const createdAt = now.toLocaleString('ko-KR', { hour12: false });

  const printableMessages = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  const chatRows = printableMessages.length
    ? printableMessages
      .map((m) => {
        const roleLabel = m.role === 'user' ? '학생' : 'AI 튜터';
        const bgColor = m.role === 'user' ? '#eff6ff' : '#f9fafb';
        return `
          <div style="border:1px solid #dbe4f0;border-radius:8px;padding:8px;margin-bottom:8px;overflow-wrap:anywhere;word-break:break-word;background:${bgColor};">
            <div style="font-weight:700;margin-bottom:4px;font-size:10pt;">${roleLabel}</div>
            <div style="white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(m.content || '')}</div>
          </div>
        `;
      })
      .join('')
    : '<p style="margin:0;">대화 로그가 없습니다.</p>';

  return `
    <div style="width:794px;padding:24px;background:#fff;color:#111827;font-family:'Noto Sans KR','Malgun Gothic',sans-serif;font-size:10.7pt;line-height:1.45;overflow-wrap:anywhere;word-break:break-word;">
      <h1 style="margin:0 0 8px;font-size:13pt;font-weight:700;">디지털 논리회로 — AI 튜터 대화 기록</h1>
      <div style="height:2px;background:#2563eb;margin-bottom:10px;"></div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:10.7pt;table-layout:fixed;">
        <tr><td style="padding:3px 0;width:90px;font-weight:700;">이름</td><td>${escapeHtml(studentName)}</td></tr>
        <tr><td style="padding:3px 0;font-weight:700;">학번</td><td>${escapeHtml(studentId)}</td></tr>
        <tr><td style="padding:3px 0;font-weight:700;">챕터</td><td>${escapeHtml(chapterData.title || chapterData.id || '')}</td></tr>
        <tr><td style="padding:3px 0;font-weight:700;">제출 시간</td><td>${escapeHtml(createdAt)}</td></tr>
      </table>

      ${feedback ? `
      <h2 style="margin:16px 0 8px;font-size:11pt;font-weight:700;border-top:2px solid #2563eb;padding-top:12px;">AI 튜터 피드백</h2>

      ${feedback.feedUp ? `
      <div style="margin-bottom:12px;padding:10px 14px;background:#f0fdf4;border-left:4px solid #10b981;border-radius:4px;">
        <div style="font-weight:700;font-size:10.5pt;color:#065f46;margin-bottom:4px;">Feed Up — 잘한 점</div>
        <div style="font-size:10.5pt;line-height:1.6;color:#064e3b;white-space:pre-wrap;">${escapeHtml(feedback.feedUp)}</div>
      </div>` : ''}

      ${feedback.feedBack ? `
      <div style="margin-bottom:12px;padding:10px 14px;background:#eff6ff;border-left:4px solid #2563eb;border-radius:4px;">
        <div style="font-weight:700;font-size:10.5pt;color:#1e40af;margin-bottom:4px;">Feed Back — 현재 이해도</div>
        <div style="font-size:10.5pt;line-height:1.6;color:#1e3a8a;white-space:pre-wrap;">${escapeHtml(feedback.feedBack)}</div>
      </div>` : ''}

      ${feedback.feedForward ? `
      <div style="margin-bottom:12px;padding:10px 14px;background:#fff7ed;border-left:4px solid #f59e0b;border-radius:4px;">
        <div style="font-weight:700;font-size:10.5pt;color:#92400e;margin-bottom:4px;">Feed Forward — 다음 학습 방향</div>
        <div style="font-size:10.5pt;line-height:1.6;color:#78350f;white-space:pre-wrap;">${escapeHtml(feedback.feedForward)}</div>
      </div>` : ''}

      ${feedback.weakConcepts?.length ? `
      <div style="margin-bottom:12px;">
        <div style="font-weight:700;font-size:10.5pt;margin-bottom:4px;">취약 개념</div>
        <div style="font-size:10.5pt;">${feedback.weakConcepts.map((w) => `<span style="display:inline-block;background:#fee2e2;color:#991b1b;border-radius:4px;padding:2px 8px;margin:2px 4px 2px 0;">${escapeHtml(w)}</span>`).join('')}</div>
      </div>` : ''}
      ` : ''}

      <h2 style="margin:16px 0 8px;font-size:10.7pt;font-weight:700;${feedback ? 'border-top:1px solid #e5e7eb;padding-top:12px;' : ''}">전체 대화 로그</h2>
      ${chatRows}
    </div>
  `;
}

async function handleConfirmSubmit() {
  const profile = getStudentProfile() || {};
  const studentName = (profile.studentName || '').trim();
  const studentId = (profile.studentId || '').trim();

  if (!studentName || !studentId) {
    showToast('\uB85C\uADF8\uC778 \uC815\uBCF4\uB97C \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.', 'error');
    return;
  }

  const chapterData = getChapterRef();
  const sessionId = getSessionId();
  const messages = resolveConversationMessages({
    studentId,
    chapterId: chapterData?.id || '',
    sessionId,
  });
  if (!chapterData || !Array.isArray(messages) || messages.length === 0) {
    showToast('\uC81C\uCD9C\uD560 \uB300\uD654 \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.', 'error');
    return;
  }

  closeModal();
  const chatSnapshot = getChatSessionSnapshot();
  const submittedAt = new Date().toISOString();
  const reportSessionId = sessionId || ((typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${chapterData.id}_${studentId}_${Date.now()}`);

  // 1단계: AI 피드백 생성
  setLoading(true, 'AI 피드백을 생성하는 중입니다...');
  const feedback = await generateFeedback(chapterData, messages, chatSnapshot);

  // 2단계: 교수 대시보드 전송
  setLoading(true, '대화 내용을 전송하는 중입니다...');
  let sendOk = false;
  try {
    await sendAssessment({
      session_id: reportSessionId,
      student_id: studentId,
      student_name: studentName,
      chapter_id: chapterData.id,
      chapter_title: chapterData.title || '',
      submitted_at: submittedAt,
      score: feedback?.score ?? 0,
      correct_count: feedback?.correctCount ?? 0,
      total_count: feedback?.totalCount ?? 0,
      weak_concepts: feedback?.weakConcepts ?? [],
      has_conversation: true,
      messages_count: messages.filter((m) => m.role !== 'system').length,
      feed_up: feedback?.feedUp ?? '',
      feed_back: feedback?.feedBack ?? '',
      feed_forward: feedback?.feedForward ?? '',
      chat_summary: chatSnapshot.memorySummary || {},
      chat_metrics: chatSnapshot.qualityMetrics || {},
      assessment_trace: chatSnapshot.assessmentTrace || [],
      messages: messages.filter((m) => m.role !== 'system'),
    });
    sendOk = true;
  } catch (sendErr) {
    console.error('[sendAssessment] 전송 실패:', sendErr);
    showToast('교수 대시보드 전송에 실패했습니다. 네트워크를 확인해주세요.', 'error');
  }

  if (sendOk) {
    showToast('대화 내용이 교수 대시보드에 제출되었습니다.', 'success');
  }
  setLoading(false);
}

export function initExport() {
  if (exportEventsBound) return;
  exportEventsBound = true;

  const submitBtn = getEl('btn-submit-pdf');
  const modalCancel = getEl('modal-cancel');
  const modalConfirm = getEl('modal-confirm');

  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      if (submitBtn.disabled) return;
      openModal();
      getEl('modal-confirm')?.focus();
    });
  }

  if (modalCancel) modalCancel.addEventListener('click', closeModal);
  if (modalConfirm) modalConfirm.addEventListener('click', handleConfirmSubmit);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();

    if (e.key === 'Enter' && !getEl('student-modal')?.classList.contains('hidden')) {
      e.preventDefault();
      handleConfirmSubmit();
    }
  });
}
