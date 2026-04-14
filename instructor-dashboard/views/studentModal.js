/**
 * views/studentModal.js
 * 학생 상세 모달 — 문항별 채점 + 대화 로그 + 피드백 상세
 */

import { escapeHtml, formatDate } from '../utils/format.js';
import { apiPost, fetchStudentHistory } from '../apiClient.js';

/**
 * @param {object} submission  제출 데이터 (assessment_results[], messages[], feedBack 등 포함)
 */
export async function openStudentModal(submission) {
  const modal = document.getElementById('student-modal');
  const title = document.getElementById('modal-student-title');
  const body = document.getElementById('modal-body');

  if (!modal || !body) return;

  const name = submission.student_name || submission.studentName || '-';
  const id = submission.student_id || submission.studentId || '-';
  const ch = submission.chapter_id || submission.chapterId || '-';
  const sessionId = submission.session_id || '';

  title.textContent = `${name} (${id}) — Ch.${ch}`;

  const messages = (submission.messages || []).filter((m) => m.role !== 'system');
  const chatHtml = messages.length
    ? messages.map((m) => renderMessage(m)).join('')
    : '<p class="empty-msg">대화 로그가 없습니다.</p>';

  const weakConcepts = (submission.weak_concepts || submission.weakConcepts || []);
  const weakHtml = weakConcepts.length
    ? weakConcepts.map((w) => `<span class="weak-tag">${escapeHtml(w)}</span>`).join('')
    : '<span class="empty-msg">없음</span>';

  const gradingStatus = submission.grading_status || submission.gradingStatus || '';
  const isPending = gradingStatus === 'pending';
  const score = submission.score ?? '-';
  const correct = submission.correctCount ?? submission.correct_count ?? '-';
  const total = submission.totalCount ?? submission.total_count ?? '-';
  const scoreBarWidth = submission.score != null ? Math.min(submission.score, 100) : 0;
  const scoreColorClass = submission.score >= 80 ? 'score-good' : submission.score >= 60 ? 'score-warn' : 'score-bad';

  const assessmentResults = Array.isArray(submission.assessment_results) ? submission.assessment_results : [];
  const hasResults = assessmentResults.length > 0;

  const gradingHtml = hasResults ? renderGradingPanel(assessmentResults, isPending) : '';

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
                ${isPending
                  ? `<span class="grading-pending-badge">채점 대기</span>`
                  : `<div class="score-bar-wrap modal-score-bar"><div class="score-bar ${scoreColorClass}-bar" style="width:${scoreBarWidth}%"></div></div>
                     <span class="${scoreColorClass}">${score}점 (${correct}/${total})</span>`
                }
              </div>
            </td></tr>
            <tr><th>제출시간</th><td>${formatDate(submission.submitted_at || submission.submittedAt || submission.timestamp)}</td></tr>
            ${submission.graded_at ? `<tr><th>채점시간</th><td>${formatDate(submission.graded_at)}</td></tr>` : ''}
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
        ${gradingHtml ? `
          <div class="grading-section">
            <h3 class="grading-title">문항별 채점 <span class="grading-status-label ${isPending ? 'pending' : 'graded'}">${isPending ? '채점 대기' : '채점 완료'}</span></h3>
            <div id="grading-panel">${gradingHtml}</div>
            <div class="grading-actions">
              <span class="grading-save-status" id="grading-save-status"></span>
              <button class="btn-primary" id="btn-save-grades">채점 저장</button>
            </div>
          </div>
        ` : ''}

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
          const pending = (s.grading_status === 'pending') ? ' (대기)' : '';
          return `<span class="hist-item">Ch.${s.chapter_id} <strong class="${cls}">${sc}점${pending}</strong></span>`;
        }).join('');
        historyPanel.innerHTML = `
          <div class="history-header">점수 추이 (${subs.length}회 제출)</div>
          ${sparkline}
          <div class="history-chips">${rows}</div>
        `;
      })
      .catch(() => { historyPanel.innerHTML = ''; });
  }

  // 채점 저장 버튼 이벤트
  const saveGradesBtn = body.querySelector('#btn-save-grades');
  if (saveGradesBtn && hasResults) {
    saveGradesBtn.addEventListener('click', async () => {
      const statusEl = body.querySelector('#grading-save-status');
      saveGradesBtn.disabled = true;
      if (statusEl) { statusEl.textContent = '저장 중...'; statusEl.className = 'grading-save-status'; }

      try {
        const grades = collectGrades(body, assessmentResults.length);
        await apiPost('/dashboard/grade', {
          student_id: id,
          chapter_id: ch,
          session_id: sessionId,
          grades,
        });
        if (statusEl) { statusEl.textContent = '채점이 저장되었습니다!'; statusEl.className = 'grading-save-status ok'; }
        // 상태 라벨 업데이트
        const label = body.querySelector('.grading-status-label');
        if (label) { label.textContent = '채점 완료'; label.className = 'grading-status-label graded'; }
      } catch (err) {
        if (statusEl) { statusEl.textContent = `저장 실패: ${err?.message || '오류'}`; statusEl.className = 'grading-save-status error'; }
      } finally {
        saveGradesBtn.disabled = false;
      }
    });
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

// ── 채점 패널 렌더링 ─────────────────────────────────────────

function renderGradingPanel(results, isPending) {
  return results.map((item, idx) => {
    const questionText = item.question_text || item.questionText || `문항 ${idx + 1}`;
    const concept = item.concept || '';
    const keyAnswer = item.key_answer || item.keyAnswer || '';
    const answer = item.answer || '';
    const submitted = item.submitted !== false;
    const hintsUsed = item.hints_used ?? item.hintsUsed ?? 0;
    const currentJudgment = item.judgment || '';
    const instructorFeedback = item.instructor_feedback || item.instructorFeedback || '';

    return `
      <div class="grading-item" data-idx="${idx}">
        <div class="grading-item-header">
          <span class="grading-q-num">Q${idx + 1}</span>
          ${concept ? `<span class="grading-concept">${escapeHtml(concept)}</span>` : ''}
          ${hintsUsed > 0 ? `<span class="grading-hints">힌트 ${hintsUsed}회</span>` : ''}
        </div>
        <div class="grading-question">${escapeHtml(questionText)}</div>
        ${keyAnswer ? `<div class="grading-key-answer"><strong>모범답안:</strong> ${escapeHtml(keyAnswer)}</div>` : ''}
        <div class="grading-student-answer">
          <strong>학생 답안:</strong>
          ${submitted ? escapeHtml(answer) : '<em class="empty-msg">미응시</em>'}
        </div>
        ${submitted ? `
          <div class="grading-controls">
            <label class="grading-radio">
              <input type="radio" name="grade-${idx}" value="correct" ${currentJudgment === 'correct' ? 'checked' : ''} />
              <span class="grade-label grade-correct">정답</span>
            </label>
            <label class="grading-radio">
              <input type="radio" name="grade-${idx}" value="partial" ${currentJudgment === 'partial' ? 'checked' : ''} />
              <span class="grade-label grade-partial">부분정답</span>
            </label>
            <label class="grading-radio">
              <input type="radio" name="grade-${idx}" value="incorrect" ${currentJudgment === 'incorrect' ? 'checked' : ''} />
              <span class="grade-label grade-incorrect">오답</span>
            </label>
          </div>
          <textarea class="grading-feedback dash-input" data-idx="${idx}" rows="2" placeholder="피드백 (선택사항)">${escapeHtml(instructorFeedback)}</textarea>
        ` : ''}
      </div>
    `;
  }).join('');
}

function collectGrades(container, count) {
  const grades = [];
  for (let i = 0; i < count; i++) {
    const selected = container.querySelector(`input[name="grade-${i}"]:checked`);
    const feedbackEl = container.querySelector(`.grading-feedback[data-idx="${i}"]`);
    grades.push({
      index: i,
      judgment: selected ? selected.value : '',
      instructor_feedback: feedbackEl ? feedbackEl.value.trim() : '',
    });
  }
  return grades;
}

// ── 기존 유틸리티 ────────────────────────────────────────────

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
