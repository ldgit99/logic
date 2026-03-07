/**
 * views/studentModal.js
 * 학생 상세 모달 — 대화 로그 + 피드백 상세
 */

import { escapeHtml, formatDate } from '../utils/format.js';

/**
 * @param {object} submission  제출 데이터 (messages[], feedBack, feedForward, weakConcepts 포함)
 */
export function openStudentModal(submission) {
  const modal = document.getElementById('student-modal');
  const title = document.getElementById('modal-student-title');
  const body = document.getElementById('modal-body');

  if (!modal || !body) return;

  const name = submission.student_name || submission.studentName || '-';
  const id = submission.student_id || submission.studentId || '-';
  const ch = submission.chapter_id || submission.chapterId || '-';

  title.textContent = `${name} (${id}) — Ch.${ch}`;

  const messages = (submission.messages || []).filter((m) => m.role !== 'system');
  const chatHtml = messages.length
    ? messages.map((m) => renderMessage(m)).join('')
    : '<p class="empty-msg">대화 로그가 없습니다.</p>';

  const weakConcepts = (submission.weak_concepts || submission.weakConcepts || []);
  const weakHtml = weakConcepts.length
    ? weakConcepts.map((w) => `<span class="weak-tag">${escapeHtml(w)}</span>`).join('')
    : '<span class="empty-msg">없음</span>';

  body.innerHTML = `
    <div class="modal-meta">
      <table class="meta-table">
        <tr><th>학번</th><td>${escapeHtml(id)}</td></tr>
        <tr><th>이름</th><td>${escapeHtml(name)}</td></tr>
        <tr><th>챕터</th><td>Ch.${escapeHtml(ch)}</td></tr>
        <tr><th>점수</th><td>${submission.score ?? '-'}점 (${submission.correctCount ?? submission.correct_count ?? '-'}/${submission.totalCount ?? submission.total_count ?? '-'})</td></tr>
        <tr><th>제출시간</th><td>${formatDate(submission.submitted_at || submission.submittedAt || submission.timestamp)}</td></tr>
      </table>
    </div>

    <div class="modal-section">
      <h3>취약개념</h3>
      <div class="weak-tags">${weakHtml}</div>
    </div>

    <div class="modal-section">
      <h3>Feed Back</h3>
      <pre class="feedback-text">${escapeHtml(submission.feedBack || submission.feed_back || '-')}</pre>
    </div>

    <div class="modal-section">
      <h3>Feed Forward</h3>
      <pre class="feedback-text">${escapeHtml(submission.feedForward || submission.feed_forward || '-')}</pre>
    </div>

    <div class="modal-section">
      <h3>전체 대화 로그</h3>
      <div class="chat-log">${chatHtml}</div>
    </div>
  `;

  modal.classList.remove('hidden');
  modal.querySelector('.modal-box').scrollTop = 0;
}

function renderMessage(m) {
  const isUser = m.role === 'user';
  const label = isUser ? '학생' : 'AI 튜터';
  const cls = isUser ? 'msg-user' : 'msg-ai';
  return `
    <div class="chat-msg ${cls}">
      <div class="msg-label">${label}</div>
      <div class="msg-content">${escapeHtml(m.content || '')}</div>
    </div>
  `;
}
