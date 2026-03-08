/**
 * views/studentModal.js
 * 학생 상세 모달 — 대화 로그 + 피드백 상세
 */

import { escapeHtml, formatDate } from '../utils/format.js';
import { apiPost, fetchStudentHistory } from '../apiClient.js';

/**
 * @param {object} submission  제출 데이터 (messages[], feedBack, feedForward, weakConcepts 포함)
 */
export async function openStudentModal(submission) {
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

  const score = submission.score ?? '-';
  const correct = submission.correctCount ?? submission.correct_count ?? '-';
  const total = submission.totalCount ?? submission.total_count ?? '-';
  const scoreBarWidth = submission.score != null ? Math.min(submission.score, 100) : 0;
  const scoreColorClass = submission.score >= 80 ? 'score-good' : submission.score >= 60 ? 'score-warn' : 'score-bad';

  body.innerHTML = `
    <div class="modal-split">
      <div class="modal-split-left">
        <div id="student-history-panel" class="history-panel">
          <div class="history-loading">이력 불러오는 중...</div>
        </div>
        <div class="modal-meta">
          <table class="meta-table">
            <tr><th>학번</th><td>${escapeHtml(id)}</td></tr>
            <tr><th>이름</th><td>${escapeHtml(name)}</td></tr>
            <tr><th>챕터</th><td>Ch.${escapeHtml(ch)}</td></tr>
            <tr><th>점수</th><td>
              <div class="modal-score-wrap">
                <div class="score-bar-wrap modal-score-bar"><div class="score-bar ${scoreColorClass}-bar" style="width:${scoreBarWidth}%"></div></div>
                <span class="${scoreColorClass}">${score}점 (${correct}/${total})</span>
              </div>
            </td></tr>
            <tr><th>제출시간</th><td>${formatDate(submission.submitted_at || submission.submittedAt || submission.timestamp)}</td></tr>
          </table>
        </div>

        <div class="modal-section">
          <h3>취약개념</h3>
          <div class="weak-tags">${weakHtml}</div>
        </div>

        <div class="modal-section">
          <h3>Feed Up</h3>
          <pre class="feedback-text">${escapeHtml(submission.feedUp || submission.feed_up || '-')}</pre>
        </div>

        <div class="modal-section">
          <h3>Feed Back</h3>
          <pre class="feedback-text">${escapeHtml(submission.feedBack || submission.feed_back || '-')}</pre>
        </div>

        <div class="modal-section">
          <h3>Feed Forward</h3>
          <pre class="feedback-text">${escapeHtml(submission.feedForward || submission.feed_forward || '-')}</pre>
        </div>
      </div>

      <div class="modal-split-right">
        <h3 class="chat-log-title">대화 로그 <span class="chat-count">${messages.length}개</span></h3>
        <div class="chat-log">${chatHtml}</div>

        <div class="email-compose">
          <h3>교수 메시지 발송</h3>
          <input type="text" class="email-subject dash-input" placeholder="제목" />
          <textarea class="email-message dash-input" rows="4" placeholder="학생에게 보낼 메시지를 입력하세요."></textarea>
          <div class="email-compose-footer">
            <span class="email-status"></span>
            <button class="btn-primary send-email-btn">발송</button>
          </div>
        </div>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  modal.querySelector('.modal-box').scrollTop = 0;

  // 학생 이력 비동기 로드
  const historyPanel = body.querySelector('#student-history-panel');
  if (historyPanel) {
    fetchStudentHistory(submission.student_id || submission.studentId || '')
      .then((data) => {
        const subs = (data?.submissions || []).sort((a, b) =>
          (a.submitted_at || '').localeCompare(b.submitted_at || ''));
        if (subs.length === 0) { historyPanel.innerHTML = ''; return; }
        const sparkline = buildSparkline(subs.map((s) => s.score ?? 0));
        const rows = subs.map((s) => {
          const sc = s.score ?? '-';
          const cls = s.score >= 80 ? 'score-good' : s.score >= 60 ? 'score-warn' : 'score-bad';
          return `<span class="hist-item">Ch.${s.chapter_id} <strong class="${cls}">${sc}점</strong></span>`;
        }).join('');
        historyPanel.innerHTML = `
          <div class="history-header">점수 추이 (${subs.length}회 제출)</div>
          ${sparkline}
          <div class="history-chips">${rows}</div>
        `;
      })
      .catch(() => { historyPanel.innerHTML = ''; });
  }

  // 교수 메시지 발송 버튼 이벤트
  const sendBtn = body.querySelector('.send-email-btn');
  if (sendBtn) {
    sendBtn.addEventListener('click', async () => {
      const subjectEl = body.querySelector('.email-subject');
      const msgEl = body.querySelector('.email-message');
      const statusEl = body.querySelector('.email-status');
      const subject = String(subjectEl?.value || '').trim();
      const message = String(msgEl?.value || '').trim();
      if (!subject || !message) { if (statusEl) { statusEl.textContent = '제목과 내용을 입력하세요.'; statusEl.className = 'email-status error'; } return; }
      sendBtn.disabled = true;
      if (statusEl) { statusEl.textContent = '발송 중...'; statusEl.className = 'email-status'; }
      try {
        const studentId = submission.student_id || submission.studentId || '';
        await apiPost('/dashboard/send-email', { student_id: studentId, subject, message });
        if (statusEl) { statusEl.textContent = '발송 완료!'; statusEl.className = 'email-status ok'; }
        if (subjectEl) subjectEl.value = '';
        if (msgEl) msgEl.value = '';
      } catch (err) {
        if (statusEl) { statusEl.textContent = `발송 실패: ${err?.message || '오류'}`; statusEl.className = 'email-status error'; }
      } finally {
        sendBtn.disabled = false;
      }
    });
  }
}

function buildSparkline(scores) {
  if (scores.length < 2) return '';
  const W = 200, H = 40, pad = 4;
  const minV = Math.min(...scores, 0);
  const maxV = Math.max(...scores, 100);
  const range = maxV - minV || 1;
  const xs = scores.map((_, i) => pad + (i / (scores.length - 1)) * (W - pad * 2));
  const ys = scores.map((v) => H - pad - ((v - minV) / range) * (H - pad * 2));
  const pts = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const last = scores[scores.length - 1];
  const color = last >= 80 ? '#10b981' : last >= 60 ? '#f59e0b' : '#ef4444';
  return `<svg width="${W}" height="${H}" class="sparkline-svg" viewBox="0 0 ${W} ${H}">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="${xs[xs.length-1].toFixed(1)}" cy="${ys[ys.length-1].toFixed(1)}" r="3" fill="${color}"/>
  </svg>`;
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
