import { showToast } from './main.js';
import { generateFeedback } from './feedback.js';
import { getConversationMessages, getChapterRef } from './chatbot.js';

let chapterDataRef = null;

// ─── PDF용 HTML 빌드 ───
function buildExportHTML(chapterData, messages, feedback, studentInfo) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  const chatRows = messages
    .filter(m => m.role !== 'system')
    .map(m => {
      const role = m.role === 'user' ? '학생' : 'AI 튜터';
      const color = m.role === 'user' ? '#1e3a8a' : '#14532d';
      const bg = m.role === 'user' ? '#dbeafe' : '#dcfce7';
      return `
        <tr>
          <td style="padding:6px 10px;font-weight:700;color:${color};background:${bg};white-space:nowrap;vertical-align:top;width:80px;">${role}</td>
          <td style="padding:6px 10px;color:#1f2937;line-height:1.7;white-space:pre-wrap;">${escapeHtml(m.content)}</td>
        </tr>`;
    }).join('<tr><td colspan="2" style="height:4px;"></td></tr>');

  const weakConceptsHtml = (feedback.weakConcepts || []).length > 0
    ? feedback.weakConcepts.map(c => `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;font-size:12px;margin-right:4px;">${escapeHtml(c)}</span>`).join('')
    : '<span style="color:#6b7280;font-size:12px;">해당 없음</span>';

  const scorePct = feedback.score ?? 0;
  const scoreColor = scorePct >= 80 ? '#059669' : scorePct >= 60 ? '#d97706' : '#dc2626';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<style>
  body { font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; color: #1f2937; font-size: 13px; margin: 0; padding: 0; background: #fff; }
  .page { width: 740px; padding: 40px 50px; box-sizing: border-box; }
  h1 { font-size: 22px; margin-bottom: 6px; }
  h2 { font-size: 16px; border-bottom: 2px solid #2563eb; padding-bottom: 6px; margin: 30px 0 14px; color: #1e40af; }
  .cover-meta td { padding: 5px 12px 5px 0; color: #374151; font-size: 13px; }
  .cover-meta .label { font-weight: 700; color: #6b7280; }
  .feedback-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin-bottom: 14px; }
  .feedback-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 6px; }
  .feedback-content { line-height: 1.75; color: #374151; }
  .score-display { display: flex; align-items: center; gap: 20px; margin-bottom: 20px; }
  .score-circle { width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; color: white; background: ${scoreColor}; flex-shrink: 0; }
  .score-bar-wrap { flex: 1; height: 12px; background: #e5e7eb; border-radius: 6px; overflow: hidden; }
  .score-bar-fill { height: 100%; background: linear-gradient(90deg, #2563eb, #10b981); width: ${scorePct}%; border-radius: 6px; }
  .chat-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .sig-line { margin-top: 40px; border-top: 1px solid #d1d5db; padding-top: 16px; display: flex; gap: 60px; }
  .sig-item { flex: 1; }
  .sig-item .sig-label { font-size: 11px; color: #6b7280; margin-bottom: 30px; }
  .sig-item .sig-underline { border-bottom: 1px solid #374151; }
</style>
</head>
<body>
<div class="page">

  <!-- ══ 표지 ══ -->
  <div style="text-align:center;padding:60px 0 40px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:#6b7280;margin-bottom:12px;">디지털 논리회로 · 형성평가 보고서</div>
    <h1 style="font-size:26px;color:#1e40af;margin-bottom:8px;">${escapeHtml(chapterData.title)}</h1>
    <div style="width:60px;height:3px;background:#2563eb;margin:0 auto 30px;"></div>
  </div>

  <table class="cover-meta" style="margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;padding:12px 24px;">
    <tr><td class="label">이름</td><td>${escapeHtml(studentInfo.name)}</td></tr>
    <tr><td class="label">학번</td><td>${escapeHtml(studentInfo.studentId)}</td></tr>
    <tr><td class="label">과목</td><td>디지털 논리회로</td></tr>
    <tr><td class="label">챕터</td><td>${escapeHtml(chapterData.title)}</td></tr>
    <tr><td class="label">제출 일시</td><td>${dateStr} ${timeStr}</td></tr>
  </table>

  <!-- ══ 성적 요약 ══ -->
  <h2>형성평가 결과 요약</h2>

  <div class="score-display">
    <div class="score-circle">${scorePct}점</div>
    <div style="flex:1;">
      <div style="font-weight:700;font-size:15px;margin-bottom:8px;color:${scoreColor};">
        ${feedback.correctCount ?? '-'}개 정답 / ${feedback.totalCount ?? chapterData.formativeAssessment.totalQuestions}개 문항
      </div>
      <div class="score-bar-wrap"><div class="score-bar-fill"></div></div>
    </div>
  </div>

  <div style="margin-bottom:16px;">
    <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">취약 개념</div>
    <div>${weakConceptsHtml}</div>
  </div>

  <!-- ══ AI 피드백 ══ -->
  <h2>AI 튜터 피드백 (Hattie &amp; Timperley 모델)</h2>

  <div class="feedback-box">
    <div class="feedback-label">Feed Up — 학습목표 달성도</div>
    <div class="feedback-content">${escapeHtml(feedback.feedUp ?? '')}</div>
  </div>

  <div class="feedback-box">
    <div class="feedback-label">Feed Back — 학습 과정 분석</div>
    <div class="feedback-content">${escapeHtml(feedback.feedBack ?? '')}</div>
  </div>

  <div class="feedback-box">
    <div class="feedback-label">Feed Forward — 다음 학습 방향</div>
    <div class="feedback-content">${escapeHtml(feedback.feedForward ?? '')}</div>
  </div>

  <!-- ══ 대화 기록 ══ -->
  <h2>전체 대화 기록</h2>
  <table class="chat-table">
    <tbody>
      ${chatRows}
    </tbody>
  </table>

  <!-- ══ 서명란 ══ -->
  <div class="sig-line">
    <div class="sig-item">
      <div class="sig-label">학생 서명</div>
      <div class="sig-underline" style="min-width:160px;">&nbsp;</div>
    </div>
    <div class="sig-item">
      <div class="sig-label">교수자 확인</div>
      <div class="sig-underline" style="min-width:160px;">&nbsp;</div>
    </div>
    <div class="sig-item">
      <div class="sig-label">확인 날짜</div>
      <div class="sig-underline" style="min-width:120px;">&nbsp;</div>
    </div>
  </div>

</div>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── PDF 생성 ───
async function generatePDF(chapterData, messages, feedback, studentInfo) {
  const container = document.getElementById('pdf-export-container');
  container.innerHTML = buildExportHTML(chapterData, messages, feedback, studentInfo);

  // html2canvas로 전체 캡처
  const canvas = await window.html2canvas(container, {
    scale: 1.8,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const A4_W = 210;
  const A4_H = 297;
  const imgW = A4_W;
  const imgH = (canvas.height * A4_W) / canvas.width;

  let yPos = 0;
  let pageIndex = 0;

  while (yPos < imgH) {
    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, -yPos, imgW, imgH);
    yPos += A4_H;
    pageIndex++;
  }

  const safeId = studentInfo.studentId.replace(/[^a-zA-Z0-9가-힣]/g, '_');
  const safeName = studentInfo.name.replace(/[^a-zA-Z0-9가-힣]/g, '_');
  pdf.save(`논리회로_형성평가_${safeName}_${safeId}.pdf`);

  container.innerHTML = '';
}

// ─── 모달 + 제출 흐름 ───
function openStudentModal() {
  document.getElementById('student-modal').classList.remove('hidden');
  document.getElementById('input-name').focus();
}

function closeStudentModal() {
  document.getElementById('student-modal').classList.add('hidden');
}

async function handleConfirmSubmit() {
  const name = document.getElementById('input-name').value.trim();
  const studentId = document.getElementById('input-student-id').value.trim();

  if (!name || !studentId) {
    showToast('이름과 학번을 모두 입력해주세요.', 'error');
    return;
  }

  closeStudentModal();

  const overlay = document.getElementById('loading-overlay');
  overlay.classList.remove('hidden');
  document.getElementById('loading-message').textContent = 'AI가 피드백을 생성 중입니다...';

  try {
    const messages = getConversationMessages();
    const chapterData = getChapterRef() || chapterDataRef;

    document.getElementById('loading-message').textContent = 'AI 피드백 분석 중 (10~20초 소요)...';
    const feedback = await generateFeedback(chapterData, messages);

    document.getElementById('loading-message').textContent = 'PDF 생성 중...';
    await generatePDF(chapterData, messages, feedback, { name, studentId });

    showToast('PDF가 다운로드되었습니다!', 'success');
  } catch (err) {
    console.error('PDF 생성 오류:', err);
    showToast('PDF 생성 중 오류가 발생했습니다. 다시 시도해주세요.', 'error');
  } finally {
    overlay.classList.add('hidden');
  }
}

// ─── 초기화 ───
export function initExport(chapterData) {
  chapterDataRef = chapterData;

  document.getElementById('btn-submit-pdf').addEventListener('click', openStudentModal);
  document.getElementById('modal-cancel').addEventListener('click', closeStudentModal);
  document.getElementById('modal-confirm').addEventListener('click', handleConfirmSubmit);

  // 엔터키로 모달 확인
  document.getElementById('student-modal').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleConfirmSubmit();
    if (e.key === 'Escape') closeStudentModal();
  });

  // 모달 오버레이 클릭 시 닫기
  document.getElementById('student-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeStudentModal();
  });
}
