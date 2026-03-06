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

function setLoading(visible, message = '??곕굡獄쏄퉮????밴쉐??롫뮉 餓λ쵐???덈뼄...') {
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

function buildReportHTML(studentName, studentId, chapterData, messages, feedback) {
  const now = new Date();
  const createdAt = now.toLocaleString('ko-KR', { hour12: false });

  const chatRows = messages.length
    ? messages
      .map((m) => {
        let roleLabel = 'SYSTEM';
        if (m.role === 'user') roleLabel = '??덇문';
        if (m.role === 'assistant') roleLabel = 'AI ??쀪숲';

        return `
          <div style="border:1px solid #dbe4f0;border-radius:10px;padding:10px 12px;margin-bottom:10px;overflow-wrap:anywhere;word-break:break-word;">
            <div style="font-weight:700;color:#1e3a8a;margin-bottom:6px;">${roleLabel}</div>
            <div style="white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(m.content || '')}</div>
          </div>
        `;
      })
      .join('')
    : '<p style="margin:0;">????嚥≪뮄?뉐첎? ??곷뮸??덈뼄.</p>';

  const weakConcepts = feedback.weakConcepts.length
    ? feedback.weakConcepts.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>??????곸벉</li>';

  return `
    <div style="width:794px;padding:36px 44px;background:#fff;color:#111827;font-family:'Noto Sans KR','Malgun Gothic',sans-serif;line-height:1.6;overflow-wrap:anywhere;word-break:break-word;">
      <h1 style="margin:0 0 12px;font-size:28px;color:#0f172a;">?遺?????겸봺???쨮 ?類ㅺ쉐??? 野껉퀗??/h1>
      <div style="height:3px;background:#2563eb;margin-bottom:18px;"></div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:15px;table-layout:fixed;">
        <tr><td style="padding:6px 0;width:120px;font-weight:700;">??已?/td><td style="overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(studentName)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:700;">??뉗쓰</td><td style="overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(studentId)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:700;">筌?벤苑?/td><td style="overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(chapterData.title)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:700;">?臾믨쉐 ??볦퍢</td><td style="overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(createdAt)}</td></tr>
      </table>

      <h2 style="margin:20px 0 8px;font-size:22px;color:#1d4ed8;">?袁⑷퍥 ????嚥≪뮄??/h2>
      ${chatRows}

      <h2 style="margin:24px 0 8px;font-size:22px;color:#1d4ed8;">??곕굡獄?/h2>
      <p style="margin:0 0 10px;overflow-wrap:anywhere;word-break:break-word;"><strong>?癒?땾:</strong> ${feedback.score}??(${feedback.correctCount}/${feedback.totalCount})</p>

      <h3 style="margin:14px 0 6px;font-size:18px;color:#1e40af;">Feed Up</h3>
      <p style="margin:0 0 12px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(feedback.feedUp || '-')}</p>

      <h3 style="margin:14px 0 6px;font-size:18px;color:#1e40af;">Feed Back</h3>
      <p style="margin:0 0 12px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(feedback.feedBack || '-')}</p>

      <h3 style="margin:14px 0 6px;font-size:18px;color:#1e40af;">Feed Forward</h3>
      <p style="margin:0 0 12px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(feedback.feedForward || '-')}</p>

      <h3 style="margin:14px 0 6px;font-size:18px;color:#1e40af;">?띯뫁鍮?揶쏆뮆??/h3>
      <ul style="margin:0 0 8px 22px;padding:0;overflow-wrap:anywhere;word-break:break-word;">${weakConcepts}</ul>
    </div>
  `;
}

async function savePdf(studentName, studentId, chapterData, messages, feedback) {
  const jspdfNs = window.jspdf;
  if (!jspdfNs || !jspdfNs.jsPDF) {
    throw new Error('jsPDF ??깆뵠?됰슢??뵳?? 筌≪뼚??????곷뮸??덈뼄.');
  }
  if (typeof window.html2canvas !== 'function') {
    throw new Error('html2canvas ??깆뵠?됰슢??뵳?? 筌≪뼚??????곷뮸??덈뼄.');
  }

  const html = buildReportHTML(studentName, studentId, chapterData, messages, feedback);
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

    const marginPt = (15 / 25.4) * 72;
    const usableWidth = pageWidth - marginPt * 2;
    const usableHeight = pageHeight - marginPt * 2;

    const imgWidth = usableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let offsetY = 0;
    doc.addImage(imgData, 'PNG', marginPt, marginPt - offsetY, imgWidth, imgHeight);
    offsetY += usableHeight;

    while (offsetY < imgHeight) {
      doc.addPage();
      doc.addImage(imgData, 'PNG', marginPt, marginPt - offsetY, imgWidth, imgHeight);
      offsetY += usableHeight;
    }

    const safeName = studentName.replace(/[^a-zA-Z0-9가-힣]/g, '');
    const safeId = studentId.replace(/[^a-zA-Z0-9]/g, '');
    const fileName = `${safeId}${safeName}` || 'feedback';
    doc.save(`${fileName}.pdf`);
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
    showToast('??已ユ???뉗쓰????낆젾??곻폒?紐꾩뒄.', 'error');
    return;
  }

  const chapterData = getChapterRef();
  const messages = getConversationMessages();
  if (!chapterData || !Array.isArray(messages) || messages.length === 0) {
    showToast('??뽱뀱???????怨쀬뵠?怨? ??곷뮸??덈뼄.', 'error');
    return;
  }

  closeModal();
  setLoading(true);

  try {
    const rawFeedback = await generateFeedback(chapterData, messages);
    const feedback = normalizeFeedback(rawFeedback, chapterData.formativeAssessment.totalQuestions);
    await savePdf(studentName, studentId, chapterData, messages, feedback);
    showToast('PDF ??밴쉐???袁⑥┷??뤿???щ빍??', 'success');
  } catch (err) {
    console.error('PDF export error:', err);
    showToast('PDF ??밴쉐????쎈솭??됰뮸??덈뼄. ?醫롫뻻 ????쇰뻻 ??뺣즲??곻폒?紐꾩뒄.', 'error');
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