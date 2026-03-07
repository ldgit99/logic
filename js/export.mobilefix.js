import { showToast } from './main.js';
import { generateFeedback } from './feedback.js';
import { getConversationMessages, getChapterRef, getSessionId } from './chatbot.mobilefix.js';
import { sendAssessment, sendFeedbackReport, sendEvent } from './instrumentation.js';

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

function setLoading(visible, message = '\uD53C\uB4DC\uBC31\uC744 \uC0DD\uC131\uD558\uB294 \uC911\uC785\uB2C8\uB2E4...') {
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

  const printableMessages = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  const chatRows = printableMessages.length
    ? printableMessages
      .map((m) => {
        const roleLabel = m.role === 'user' ? '\\uD559\\uC0DD' : 'AI \\uD29C\\uD130';

        return `
          <div style="border:1px solid #dbe4f0;border-radius:8px;padding:8px;margin-bottom:8px;overflow-wrap:anywhere;word-break:break-word;">
            <div style="font-weight:700;margin-bottom:4px;">${roleLabel}</div>
            <div style="white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(m.content || '')}</div>
          </div>
        `;
      })
      .join('')
    : '<p style="margin:0;">\uB300\uD654 \uB85C\uADF8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';

  const weakConcepts = feedback.weakConcepts.length
    ? feedback.weakConcepts.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>\uD574\uB2F9 \uC5C6\uC74C</li>';

  return `
    <div style="width:794px;padding:24px;background:#fff;color:#111827;font-family:'Noto Sans KR','Malgun Gothic',sans-serif;font-size:10.7pt;line-height:1.45;overflow-wrap:anywhere;word-break:break-word;">
      <h1 style="margin:0 0 8px;font-size:10.7pt;font-weight:700;">\uB514\uC9C0\uD138 \uB17C\uB9AC\uD68C\uB85C \uD615\uC131\uD3C9\uAC00 \uACB0\uACFC</h1>
      <div style="height:2px;background:#2563eb;margin-bottom:10px;"></div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;font-size:10.7pt;table-layout:fixed;">
        <tr><td style="padding:3px 0;width:90px;font-weight:700;">\uC774\uB984</td><td>${escapeHtml(studentName)}</td></tr>
        <tr><td style="padding:3px 0;font-weight:700;">\uD559\uBC88</td><td>${escapeHtml(studentId)}</td></tr>
        <tr><td style="padding:3px 0;font-weight:700;">\uCC55\uD130</td><td>${escapeHtml(chapterData.title)}</td></tr>
        <tr><td style="padding:3px 0;font-weight:700;">\uC791\uC131 \uC2DC\uAC04</td><td>${escapeHtml(createdAt)}</td></tr>
      </table>

      <h2 style="margin:10px 0 6px;font-size:10.7pt;font-weight:700;">\uC804\uCCB4 \uB300\uD654 \uB85C\uADF8</h2>
      ${chatRows}

      <h2 style="margin:12px 0 6px;font-size:10.7pt;font-weight:700;">\uD53C\uB4DC\uBC31</h2>
      <p style="margin:0 0 6px;font-size:10.7pt;"><strong>\uC810\uC218:</strong> ${feedback.score}\uC810 (${feedback.correctCount}/${feedback.totalCount})</p>

      <h3 style="margin:8px 0 4px;font-size:10.7pt;font-weight:700;">Feed Up</h3>
      <p style="margin:0 0 6px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;font-size:10.7pt;">${escapeHtml(feedback.feedUp || '-')}</p>

      <h3 style="margin:8px 0 4px;font-size:10.7pt;font-weight:700;">Feed Back</h3>
      <p style="margin:0 0 6px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;font-size:10.7pt;">${escapeHtml(feedback.feedBack || '-')}</p>

      <h3 style="margin:8px 0 4px;font-size:10.7pt;font-weight:700;">Feed Forward</h3>
      <p style="margin:0 0 6px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;font-size:10.7pt;">${escapeHtml(feedback.feedForward || '-')}</p>

      <h3 style="margin:8px 0 4px;font-size:10.7pt;font-weight:700;">\uCDE8\uC57D \uAC1C\uB150</h3>
      <ul style="margin:0 0 0 16px;padding:0;overflow-wrap:anywhere;word-break:break-word;font-size:10.7pt;">${weakConcepts}</ul>
    </div>
  `;
}

async function savePdf(studentName, studentId, chapterData, messages, feedback) {
  const jspdfNs = window.jspdf;
  if (!jspdfNs || !jspdfNs.jsPDF) {
    throw new Error('jsPDF library not found');
  }
  if (typeof window.html2canvas !== 'function') {
    throw new Error('html2canvas library not found');
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

    const marginTopBottomPt = (15 / 25.4) * 72; // 15mm top/bottom
    const marginLeftRightPt = (15 / 25.4) * 72;
    const usableWidth = pageWidth - marginLeftRightPt * 2;
    const usableHeight = pageHeight - marginTopBottomPt * 2;

    const imgWidth = usableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let offsetY = 0;
    doc.addImage(imgData, 'PNG', marginLeftRightPt, marginTopBottomPt - offsetY, imgWidth, imgHeight);
    offsetY += usableHeight;

    while (offsetY < imgHeight) {
      doc.addPage();
      doc.addImage(imgData, 'PNG', marginLeftRightPt, marginTopBottomPt - offsetY, imgWidth, imgHeight);
      offsetY += usableHeight;
    }

    const safeName = studentName.replace(/[^a-zA-Z0-9\uAC00-\uD7A3]/g, '');
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
    showToast('\uC774\uB984\uACFC \uD559\uBC88\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.', 'error');
    return;
  }

  const chapterData = getChapterRef();
  const messages = getConversationMessages();
  if (!chapterData || !Array.isArray(messages) || messages.length === 0) {
    showToast('\uC81C\uCD9C\uD560 \uB300\uD654 \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.', 'error');
    return;
  }

  closeModal();
  setLoading(true);

  try {
    const rawFeedback = await generateFeedback(chapterData, messages);
    const feedback = normalizeFeedback(rawFeedback, chapterData.formativeAssessment.totalQuestions);
    await savePdf(studentName, studentId, chapterData, messages, feedback);
    showToast('PDF \uC0DD\uC131\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'success');

    // D2: ?됯? 寃곌낵 + ?쇰뱶諛?由ы룷?몃? ?쒕쾭濡??꾩넚 (PDF ?깃났 ???낅┰ ?ㅽ뻾)
    const sessionId = getSessionId() || '';
    const submittedAt = new Date().toISOString();

    sendAssessment({
      session_id: sessionId,
      student_id: studentId,
      student_name: studentName,
      chapter_id: chapterData.id || '',
      chapter_title: chapterData.title || '',
      submitted_at: submittedAt,
      correct_count: feedback.correctCount,
      total_count: feedback.totalCount,
      score: feedback.score,
      weak_concepts: feedback.weakConcepts,
      messages: messages.filter((m) => m.role !== 'system'),
    });

    sendFeedbackReport({
      session_id: sessionId,
      student_id: studentId,
      student_name: studentName,
      chapter_id: chapterData.id || '',
      submitted_at: submittedAt,
      feed_up: feedback.feedUp,
      feed_back: feedback.feedBack,
      feed_forward: feedback.feedForward,
      score: feedback.score,
      correct_count: feedback.correctCount,
      total_count: feedback.totalCount,
      weak_concepts: feedback.weakConcepts,
    });

    sendEvent('pdf_generated', {
      chapterId: chapterData.id || '',
      sessionId,
      studentId,
      studentName,
      payload: { score: feedback.score },
    });
  } catch (err) {
    console.error('PDF export error:', err);
    showToast('PDF \uC0DD\uC131\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.', 'error');
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