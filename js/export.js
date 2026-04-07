import { getConversationMessages, getChapterRef, getSessionId, getChatSessionSnapshot } from './chatbot.js?v=20260326b';
import { getStudentProfile } from './auth.js?v=20260311c';
import { sendAssessment } from './instrumentation.js?v=20260407b';

const WORKER_BASE = 'https://logic-proxy.dongkuklee99.workers.dev';

let exportEventsBound = false;

function getEl(id) {
  return document.getElementById(id);
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

function getUserScopedKey(base, studentId) {
  return `${base}_${studentId || 'anon'}`;
}

function getStoredSessionId(studentId, chapterId) {
  try {
    const raw = localStorage.getItem(getUserScopedKey('logic_session_index_v5', studentId));
    const index = raw ? JSON.parse(raw) : {};
    return typeof index?.[chapterId] === 'string' ? index[chapterId] : '';
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
      const messages = parsed.logMessages.filter((item) => item && typeof item.content === 'string');
      if (messages.length) return messages;
    } catch {
      // ignore and continue
    }
  }

  return [];
}

function getDomMessages() {
  const container = document.getElementById('chat-messages');
  if (!container) return [];

  return Array.from(container.querySelectorAll('.chat-bubble'))
    .map((bubble) => {
      const text = bubble.querySelector('.bubble-text')?.textContent?.trim() || '';
      if (!text) return null;
      return {
        role: bubble.classList.contains('user')
          ? 'user'
          : bubble.classList.contains('ai')
            ? 'assistant'
            : 'system',
        content: text,
      };
    })
    .filter(Boolean);
}

function resolveConversationMessages({ studentId, chapterId, sessionId }) {
  const liveMessages = getConversationMessages();
  if (Array.isArray(liveMessages) && liveMessages.length > 0) return liveMessages;

  const storedMessages = getStoredMessages(studentId, chapterId, sessionId);
  if (storedMessages.length > 0) return storedMessages;

  return getDomMessages();
}

function setLoading(visible, message = '제출을 처리하는 중입니다...') {
  const overlay = getEl('loading-overlay');
  const msg = getEl('loading-message');
  if (msg) msg.textContent = message;
  if (overlay) overlay.classList.toggle('hidden', !visible);
}

function openModal() {
  const modal = getEl('student-modal');
  const profile = getStudentProfile() || {};
  const display = getEl('modal-profile-display');
  if (display) {
    display.textContent = `${profile.studentName || ''} (${profile.studentId || ''})`;
  }
  modal?.classList.remove('hidden');
}

function closeModal() {
  getEl('student-modal')?.classList.add('hidden');
}

function openFeedbackModal(feedback, chapterData) {
  const modal = getEl('feedback-result-modal');
  const chapterEl = getEl('feedback-result-chapter');
  const weakEl = getEl('feedback-result-weak');
  const sectionsEl = getEl('feedback-result-sections');
  if (!modal || !chapterEl || !weakEl || !sectionsEl) return;

  const normalized = normalizeFeedback(feedback);
  chapterEl.textContent = chapterData?.title || `Ch.${chapterData?.id || ''}`;
  weakEl.innerHTML = normalized.weakConcepts.length
    ? normalized.weakConcepts.map((item) => `<span class="feedback-chip">${escapeHtml(item)}</span>`).join('')
    : '<span class="feedback-chip feedback-chip--muted">취약 개념 없음</span>';

  sectionsEl.innerHTML = [
    { title: 'Feed Up', body: normalized.feedUp, tone: 'up' },
    { title: 'Feed Back', body: normalized.feedBack, tone: 'back' },
    { title: 'Feed Forward', body: normalized.feedForward, tone: 'forward' },
  ].map((section) => `
    <section class="feedback-result-section feedback-result-section--${section.tone}">
      <h3>${section.title}</h3>
      <p>${escapeHtml(section.body || '제공된 피드백이 없습니다.').replace(/\n/g, '<br>')}</p>
    </section>
  `).join('');

  modal.classList.remove('hidden');
}

function closeFeedbackModal() {
  getEl('feedback-result-modal')?.classList.add('hidden');
}

function normalizeFeedback(feedback = {}) {
  return {
    correctCount: Number(feedback.correctCount || 0),
    totalCount: Number(feedback.totalCount || 0),
    score: Number(feedback.score || 0),
    weakConcepts: Array.isArray(feedback.weakConcepts) ? feedback.weakConcepts : [],
    feedUp: String(feedback.feedUp || ''),
    feedBack: String(feedback.feedBack || ''),
    feedForward: String(feedback.feedForward || ''),
  };
}

async function generateFeedback(chapterData, messages, chatSnapshot) {
  try {
    const res = await fetch(`${WORKER_BASE}/chat/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chapter: chapterData,
        messages: messages.filter((item) => item.role !== 'system'),
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

async function handleConfirmSubmit() {
  const profile = getStudentProfile() || {};
  const studentName = String(profile.studentName || '').trim();
  const studentId = String(profile.studentId || '').trim();
  if (!studentName || !studentId) {
    showToast('로그인 정보를 확인할 수 없습니다.', 'error');
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
    showToast('제출할 대화 데이터가 없습니다.', 'error');
    return;
  }

  closeModal();
  const chatSnapshot = getChatSessionSnapshot();
  const submittedAt = new Date().toISOString();
  const reportSessionId = sessionId || ((typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${chapterData.id}_${studentId}_${Date.now()}`);

  setLoading(true, 'AI 피드백을 생성하는 중입니다...');
  const draftFeedback = normalizeFeedback(await generateFeedback(chapterData, messages, chatSnapshot));

  setLoading(true, '대화 내용을 제출하는 중입니다...');
  try {
    const result = await sendAssessment({
      session_id: reportSessionId,
      student_id: studentId,
      student_name: studentName,
      chapter_id: chapterData.id,
      chapter_title: chapterData.title || '',
      submitted_at: submittedAt,
      score: draftFeedback.score,
      correct_count: draftFeedback.correctCount,
      total_count: draftFeedback.totalCount,
      weak_concepts: draftFeedback.weakConcepts,
      has_conversation: true,
      messages_count: messages.filter((item) => item.role !== 'system').length,
      feed_up: draftFeedback.feedUp,
      feed_back: draftFeedback.feedBack,
      feed_forward: draftFeedback.feedForward,
      chat_summary: chatSnapshot.memorySummary || {},
      chat_metrics: chatSnapshot.qualityMetrics || {},
      assessment_trace: chatSnapshot.assessmentTrace || [],
      messages: messages.filter((item) => item.role !== 'system'),
    });
    const savedFeedback = normalizeFeedback(result?.feedback || draftFeedback);
    setLoading(false);
    showToast('대화 내용이 교수 대시보드에 제출되었습니다.', 'success');
    openFeedbackModal(savedFeedback, chapterData);
  } catch (error) {
    console.error('[sendAssessment] failed:', error);
    setLoading(false);
    showToast('교수 대시보드 제출에 실패했습니다. 네트워크를 확인해 주세요.', 'error');
  }
}

export function initExport() {
  if (exportEventsBound) return;
  exportEventsBound = true;

  const submitBtn = getEl('btn-submit-pdf');
  const modalCancel = getEl('modal-cancel');
  const modalConfirm = getEl('modal-confirm');
  const feedbackClose = getEl('feedback-result-close');
  const feedbackDone = getEl('feedback-result-done');
  const feedbackModal = getEl('feedback-result-modal');

  submitBtn?.addEventListener('click', () => {
    if (submitBtn.disabled) return;
    openModal();
    getEl('modal-confirm')?.focus();
  });

  modalCancel?.addEventListener('click', closeModal);
  modalConfirm?.addEventListener('click', handleConfirmSubmit);
  feedbackClose?.addEventListener('click', closeFeedbackModal);
  feedbackDone?.addEventListener('click', closeFeedbackModal);
  feedbackModal?.addEventListener('click', (event) => {
    if (event.target === feedbackModal) closeFeedbackModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal();
      closeFeedbackModal();
    }
    if (event.key === 'Enter' && !getEl('student-modal')?.classList.contains('hidden')) {
      event.preventDefault();
      handleConfirmSubmit();
    }
  });
}
