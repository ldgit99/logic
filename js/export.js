import { getConversationMessages, getChapterRef, getSessionId, getChatSessionSnapshot } from './chatbot.js?v=20260326b';
import { getStudentProfile } from './auth.js?v=20260311c';
import { sendAssessment } from './instrumentation.js?v=20260407b';

let exportEventsBound = false;

function getEl(id) {
  return document.getElementById(id);
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

  setLoading(true, '대화 내용을 제출하는 중입니다...');
  const cleanMessages = messages.filter((item) => item.role !== 'system');

  try {
    await sendAssessment({
      session_id: reportSessionId,
      student_id: studentId,
      student_name: studentName,
      chapter_id: chapterData.id,
      chapter_title: chapterData.title || '',
      submitted_at: submittedAt,
      grading_status: 'pending',
      score: 0,
      correct_count: 0,
      total_count: chapterData.formativeAssessment?.totalQuestions ?? 0,
      weak_concepts: [],
      has_conversation: true,
      messages_count: cleanMessages.length,
      chat_summary: chatSnapshot.memorySummary || {},
      chat_metrics: chatSnapshot.qualityMetrics || {},
      assessment_trace: chatSnapshot.assessmentTrace || [],
      messages: cleanMessages,
    });

    setLoading(false);
    showToast('대화 내용이 제출되었습니다.', 'success');
    document.dispatchEvent(new CustomEvent('submission:saved', {
      detail: {
        type: 'conversation',
        chapter_id: chapterData.id,
        student_id: studentId,
        submitted_at: submittedAt,
      },
    }));
  } catch (error) {
    console.error('[sendAssessment] failed:', error);
    setLoading(false);
    showToast('제출에 실패했습니다. 네트워크를 확인해 주세요.', 'error');
  }
}

export function initExport() {
  if (exportEventsBound) return;
  exportEventsBound = true;

  const submitBtn = getEl('btn-submit-pdf');
  const modalCancel = getEl('modal-cancel');
  const modalConfirm = getEl('modal-confirm');

  submitBtn?.addEventListener('click', () => {
    if (submitBtn.disabled) return;
    openModal();
    getEl('modal-confirm')?.focus();
  });

  modalCancel?.addEventListener('click', closeModal);
  modalConfirm?.addEventListener('click', handleConfirmSubmit);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal();
    }
    if (event.key === 'Enter' && !getEl('student-modal')?.classList.contains('hidden')) {
      event.preventDefault();
      handleConfirmSubmit();
    }
  });
}
