import { showToast } from './main.js';
import { generateFeedback } from './feedback.js';
import { getConversationMessages, getChapterRef } from './chatbot.js';

let exportEventsBound = false;

function getEl(id) {
  return document.getElementById(id);
}

function setLoading(visible, message = '피드백을 생성하는 중입니다...') {
  const overlay = getEl('loading-overlay');
  const msg = getEl('loading-message');

  if (msg) msg.textContent = message;
  if (!overlay) return;

  overlay.classList.toggle('hidden', !visible);
}

function openModal() {
  const modal = getEl('student-modal');
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
  };
}

function savePdf(studentName, studentId, chapterData, feedback) {
  const jspdfNs = window.jspdf;
  if (!jspdfNs || !jspdfNs.jsPDF) {
    throw new Error('jsPDF 라이브러리를 찾을 수 없습니다.');
  }

  const doc = new jspdfNs.jsPDF({ unit: 'pt', format: 'a4' });
  const left = 50;
  let y = 60;

  const line = (text, size = 11, gap = 18) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(String(text), 500);
    doc.text(wrapped, left, y);
    y += wrapped.length * gap;
  };

  doc.setFontSize(18);
  doc.text('디지털 논리회로 형성평가 결과', left, y);
  y += 28;

  line(`이름: ${studentName}`);
  line(`학번: ${studentId}`);
  line(`챕터: ${chapterData.title}`);
  line(`점수: ${feedback.score}점 (${feedback.correctCount}/${feedback.totalCount})`);
  y += 8;

  line('[Feed Up]', 13, 20);
  line(feedback.feedUp || '-', 11, 17);
  y += 6;

  line('[Feed Back]', 13, 20);
  line(feedback.feedBack || '-', 11, 17);
  y += 6;

  line('[Feed Forward]', 13, 20);
  line(feedback.feedForward || '-', 11, 17);
  y += 6;

  line('[취약 개념]', 13, 20);
  line((feedback.weakConcepts || []).join(', ') || '-', 11, 17);

  const safeName = studentName.replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
  const safeId = studentId.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`logic-feedback-${safeName}-${safeId}.pdf`);
}

async function handleConfirmSubmit() {
  const nameEl = getEl('input-name');
  const idEl = getEl('input-student-id');
  const studentName = (nameEl?.value || '').trim();
  const studentId = (idEl?.value || '').trim();

  if (!studentName || !studentId) {
    showToast('이름과 학번을 입력해주세요.', 'error');
    return;
  }

  const chapterData = getChapterRef();
  const messages = getConversationMessages();
  if (!chapterData || !Array.isArray(messages) || messages.length === 0) {
    showToast('제출할 대화 데이터가 없습니다.', 'error');
    return;
  }

  closeModal();
  setLoading(true);

  try {
    const rawFeedback = await generateFeedback(chapterData, messages);
    const feedback = normalizeFeedback(rawFeedback, chapterData.formativeAssessment.totalQuestions);
    savePdf(studentName, studentId, chapterData, feedback);
    showToast('PDF 생성이 완료되었습니다.', 'success');
  } catch (err) {
    console.error('PDF export error:', err);
    showToast('PDF 생성에 실패했습니다. 잠시 후 다시 시도해주세요.', 'error');
  } finally {
    setLoading(false);
  }
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
      const nameEl = getEl('input-name');
      if (nameEl) nameEl.focus();
    });
  }

  if (modalCancel) modalCancel.addEventListener('click', closeModal);
  if (modalConfirm) modalConfirm.addEventListener('click', handleConfirmSubmit);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Enter' && !getEl('student-modal')?.classList.contains('hidden')) {
      const activeId = document.activeElement?.id;
      if (activeId === 'input-name' || activeId === 'input-student-id') {
        e.preventDefault();
        handleConfirmSubmit();
      }
    }
  });
}