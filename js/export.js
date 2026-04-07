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
import { sendAssessment, sendFeedbackReport } from './instrumentation.js?v=20260309e';

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

function setLoading(visible, message = 'PDF를 생성하는 중입니다...') {
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

function buildReportHTML(studentName, studentId, chapterData, messages) {
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

      <h2 style="margin:0 0 8px;font-size:10.7pt;font-weight:700;">전체 대화 로그</h2>
      ${chatRows}
    </div>
  `;
}

async function savePdf(studentName, studentId, chapterData, messages) {
  const jspdfNs = window.jspdf;
  if (!jspdfNs || !jspdfNs.jsPDF) {
    throw new Error('jsPDF library not found');
  }
  if (typeof window.html2canvas !== 'function') {
    throw new Error('html2canvas library not found');
  }

  const html = buildReportHTML(studentName, studentId, chapterData, messages);
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
  setLoading(true, '대화 내용을 전송하는 중입니다...');

  const chatSnapshot = getChatSessionSnapshot();
  const submittedAt = new Date().toISOString();
  const reportSessionId = sessionId || ((typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${chapterData.id}_${studentId}_${Date.now()}`);

  // 1단계: 교수 대시보드 전송 (PDF 생성 성공 여부와 무관하게 항상 실행)
  let sendOk = false;
  try {
    await sendAssessment({
      session_id: reportSessionId,
      student_id: studentId,
      student_name: studentName,
      chapter_id: chapterData.id,
      chapter_title: chapterData.title || '',
      submitted_at: submittedAt,
      score: null,
      weak_concepts: [],
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

  // 2단계: PDF 다운로드
  setLoading(true, 'PDF를 생성하는 중입니다...');
  try {
    await savePdf(studentName, studentId, chapterData, messages);
    showToast(sendOk ? 'PDF 저장 완료, 교수 대시보드에 전송되었습니다.' : 'PDF 저장 완료 (대시보드 전송 실패)', sendOk ? 'success' : 'warn');
  } catch (pdfErr) {
    console.error('[savePdf] PDF 생성 실패:', pdfErr);
    showToast(sendOk
      ? 'PDF 생성에 실패했지만 대화 내용은 대시보드에 저장되었습니다.'
      : 'PDF 생성과 대시보드 전송 모두 실패했습니다.', 'error');
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
