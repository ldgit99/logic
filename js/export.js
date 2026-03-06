import { showToast } from './main.js';
import { generateFeedback } from './feedback.js';
import { getConversationMessages, getChapterRef } from './chatbot.js';

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

function buildReportHTML(studentName, studentId, chapterData, feedback) {
  const now = new Date();
  const submittedAt = now.toLocaleString('ko-KR');
  const weakConcepts = feedback.weakConcepts.length
    ? feedback.weakConcepts.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>해당 없음</li>';

  return `
    <div style="width:794px;padding:36px 44px;background:#fff;color:#111827;font-family:'Noto Sans KR','Malgun Gothic',sans-serif;line-height:1.6;">
      <h1 style="margin:0 0 12px;font-size:28px;color:#0f172a;">디지털 논리회로 형성평가 결과</h1>
      <div style="height:3px;background:#2563eb;margin-bottom:18px;"></div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:15px;">
        <tr><td style="padding:6px 0;width:120px;font-weight:700;">이름</td><td>${escapeHtml(studentName)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:700;">학번</td><td>${escapeHtml(studentId)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:700;">챕터</td><td>${escapeHtml(chapterData.title)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:700;">점수</td><td>${feedback.score}점 (${feedback.correctCount}/${feedback.totalCount})</td></tr>
        <tr><td style="padding:6px 0;font-weight:700;">제출 시각</td><td>${escapeHtml(submittedAt)}</td></tr>
      </table>

      <h2 style="margin:20px 0 8px;font-size:22px;color:#1d4ed8;">Feed Up</h2>
      <p style="margin:0 0 12px;white-space:pre-wrap;">${escapeHtml(feedback.feedUp || '-')}</p>

      <h2 style="margin:20px 0 8px;font-size:22px;color:#1d4ed8;">Feed Back</h2>
      <p style="margin:0 0 12px;white-space:pre-wrap;">${escapeHtml(feedback.feedBack || '-')}</p>

      <h2 style="margin:20px 0 8px;font-size:22px;color:#1d4ed8;">Feed Forward</h2>
      <p style="margin:0 0 12px;white-space:pre-wrap;">${escapeHtml(feedback.feedForward || '-')}</p>

      <h2 style="margin:20px 0 8px;font-size:22px;color:#1d4ed8;">취약 개념</h2>
      <ul style="margin:0 0 8px 22px;padding:0;">${weakConcepts}</ul>
    </div>
  `;
}

async function savePdf(studentName, studentId, chapterData, feedback) {
  const jspdfNs = window.jspdf;
  if (!jspdfNs || !jspdfNs.jsPDF) {
    throw new Error('jsPDF 라이브러리를 찾을 수 없습니다.');
  }
  if (typeof window.html2canvas !== 'function') {
    throw new Error('html2canvas 라이브러리를 찾을 수 없습니다.');
  }

  const html = buildReportHTML(studentName, studentId, chapterData, feedback);
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-100000px';
  host.style.top = '0';
  host.style.zIndex = '-1';
  host.innerHTML = html;
  document.body.appendChild(host);

  try {
    const canvas = await window.html2canvas(host.firstElementChild, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const doc = new jspdfNs.jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position -= pageHeight;
      doc.addPage();
      doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const safeName = studentName.replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
    const safeId = studentId.replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`logic-feedback-${safeName}-${safeId}.pdf`);
  } finally {
    host.remove();
  }
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
    await savePdf(studentName, studentId, chapterData, feedback);
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