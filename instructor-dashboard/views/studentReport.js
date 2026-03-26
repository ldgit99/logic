/**
 * views/studentReport.js
 * Student-centric report with per-submission trace visibility.
 */

import { escapeHtml, formatDate, scoreColor } from '../utils/format.js';
import { openStudentModal } from './studentModal.js';

let selectedStudentId = null;

function readAssessmentTrace(submission) {
  return Array.isArray(submission?.assessment_trace)
    ? submission.assessment_trace
    : (Array.isArray(submission?.assessmentTrace) ? submission.assessmentTrace : []);
}

function readMisconceptions(submission) {
  const summary = submission?.chat_summary || submission?.chatSummary || {};
  return Array.isArray(summary?.misconceptions) ? summary.misconceptions : [];
}

function renderTraceSummary(trace) {
  if (!trace.length) return '';
  return `
    <div class="sr-sub-feedback">
      <div class="sr-fb-label">Assessment Trace</div>
      <div class="sr-fb-text">
        ${trace.map((item, index) => {
          const judgment = escapeHtml(String(item?.judgment || 'unknown'));
          const hints = Number(item?.hint_count || 0);
          const concept = escapeHtml(String(item?.concept || item?.weak_concept || ''));
          const hintText = hints > 0 ? `, hints ${hints}` : '';
          const conceptText = concept ? `, ${concept}` : '';
          return `Q${index + 1} ${judgment}${hintText}${conceptText}`;
        }).join('<br>')}
      </div>
    </div>
  `;
}

function renderMisconceptionSummary(items) {
  if (!items.length) return '';
  return `
    <div class="sr-sub-feedback">
      <div class="sr-fb-label">Session Misconceptions</div>
      <div class="sr-fb-text">${items.map((item) => escapeHtml(item)).join(', ')}</div>
    </div>
  `;
}

export function renderStudentReport(submissions, container) {
  if (!container) return;

  if (submissions.length === 0) {
    container.innerHTML = '<p class="empty-msg">제출 데이터가 없습니다.</p>';
    return;
  }

  const students = groupByStudent(submissions);

  container.innerHTML = `
    <div class="sr-layout">
      <aside class="sr-sidebar">
        <div class="sr-search-wrap">
          <input type="text" id="sr-search" class="sr-search" placeholder="학번 또는 이름 검색" />
        </div>
        <ul class="sr-student-list" id="sr-student-list"></ul>
      </aside>
      <div class="sr-detail" id="sr-detail">
        <div class="sr-detail-empty">
          <p>왼쪽에서 학생을 선택해 주세요.</p>
        </div>
      </div>
    </div>
  `;

  renderStudentList(students, container.querySelector('#sr-student-list'), container.querySelector('#sr-detail'));

  container.querySelector('#sr-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = q
      ? students.filter((s) => s.studentId.includes(q) || s.studentName.toLowerCase().includes(q))
      : students;
    renderStudentList(filtered, container.querySelector('#sr-student-list'), container.querySelector('#sr-detail'));
  });
}

function groupByStudent(submissions) {
  const map = {};
  for (const s of submissions) {
    const id = s.student_id || s.studentId || '?';
    if (!map[id]) {
      map[id] = {
        studentId: id,
        studentName: s.student_name || s.studentName || '-',
        submissions: [],
      };
    }
    map[id].submissions.push(s);
  }

  return Object.values(map)
    .map((student) => {
      const scores = student.submissions.map((s) => s.score ?? null).filter((v) => v !== null);
      student.avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      student.chapters = [...new Set(student.submissions.map((s) => s.chapter_id || s.chapterId || '?'))].sort();
      student.submissions.sort((a, b) => (a.chapter_id || a.chapterId || '').localeCompare(b.chapter_id || b.chapterId || ''));
      return student;
    })
    .sort((a, b) => a.studentId.localeCompare(b.studentId));
}

function renderStudentList(students, listEl, detailEl) {
  if (!listEl) return;

  listEl.innerHTML = students.map((student) => {
    const scoreClass = student.avgScore != null ? scoreColor(student.avgScore) : '';
    const isSelected = student.studentId === selectedStudentId;
    return `
      <li class="sr-student-item ${isSelected ? 'selected' : ''}" data-id="${escapeHtml(student.studentId)}">
        <div class="sr-student-name">${escapeHtml(student.studentName)}</div>
        <div class="sr-student-meta">
          <span class="sr-student-id">${escapeHtml(student.studentId)}</span>
          <span class="${scoreClass} sr-student-score">${student.avgScore != null ? `${student.avgScore}점` : '-'}</span>
        </div>
        <div class="sr-student-chapters">
          ${student.chapters.map((chapter) => `<span class="ch-tag">Ch.${escapeHtml(chapter)}</span>`).join('')}
        </div>
      </li>
    `;
  }).join('');

  listEl.querySelectorAll('.sr-student-item').forEach((item) => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      selectedStudentId = id;
      listEl.querySelectorAll('.sr-student-item').forEach((el) => el.classList.remove('selected'));
      item.classList.add('selected');
      const student = students.find((s) => s.studentId === id);
      if (student) renderDetail(student, detailEl);
    });
  });
}

function renderDetail(student, detailEl) {
  if (!detailEl) return;

  const weakAll = {};
  for (const submission of student.submissions) {
    for (const weak of (submission.weak_concepts || submission.weakConcepts || [])) {
      weakAll[weak] = (weakAll[weak] || 0) + 1;
    }
  }
  const weakSorted = Object.entries(weakAll).sort((a, b) => b[1] - a[1]);

  detailEl.innerHTML = `
    <div class="sr-detail-header">
      <div>
        <h2 class="sr-detail-name">${escapeHtml(student.studentName)}</h2>
        <span class="sr-detail-id">${escapeHtml(student.studentId)}</span>
      </div>
      <div class="sr-detail-summary">
        <span>챕터 ${student.chapters.length}개 완료</span>
        <span class="${scoreColor(student.avgScore ?? 0)} sr-avg-score">평균 ${student.avgScore != null ? `${student.avgScore}점` : '-'}</span>
      </div>
    </div>

    <div class="sr-chart-card">
      <h3 class="chart-title">챕터별 점수</h3>
      <canvas id="sr-score-chart" height="140"></canvas>
    </div>

    ${weakSorted.length ? `
      <div class="sr-section">
        <h3 class="chart-title">누적 취약개념</h3>
        <div class="weak-tags">
          ${weakSorted.map(([weak, count]) => `<span class="weak-tag">${escapeHtml(weak)} <span class="weak-cnt">${count}회</span></span>`).join('')}
        </div>
      </div>
    ` : ''}

    <div class="sr-section">
      <h3 class="chart-title">챕터별 제출 상세</h3>
      ${student.submissions.map((submission, idx) => renderSubmissionCard(submission, idx)).join('')}
    </div>
  `;

  drawScoreChart(detailEl.querySelector('#sr-score-chart'), student.submissions);

  detailEl.querySelectorAll('.btn-detail-modal').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      openStudentModal(student.submissions[idx]);
    });
  });
}

function renderSubmissionCard(submission, idx) {
  const chapter = submission.chapter_id || submission.chapterId || '-';
  const score = submission.score ?? null;
  const scoreClass = score != null ? scoreColor(score) : '';
  const correct = submission.correct_count ?? submission.correctCount ?? '-';
  const total = submission.total_count ?? submission.totalCount ?? '-';
  const scoreBarW = score != null ? Math.min(score, 100) : 0;
  const trace = readAssessmentTrace(submission);
  const misconceptions = readMisconceptions(submission);

  return `
    <div class="sr-sub-card">
      <div class="sr-sub-header">
        <span class="sr-sub-chapter">Ch.${escapeHtml(chapter)}</span>
        <div class="sr-sub-score">
          <div class="score-bar-wrap" style="width:80px">
            <div class="score-bar ${scoreClass}-bar" style="width:${scoreBarW}%"></div>
          </div>
          <span class="${scoreClass}">${score != null ? `${score}점` : '-'} (${correct}/${total})</span>
        </div>
        <span class="sr-sub-date">${formatDate(submission.submitted_at || submission.submittedAt || submission.timestamp)}</span>
        <button class="btn-detail btn-detail-modal" data-idx="${idx ?? 0}">상세 보기</button>
      </div>

      ${submission.feed_back || submission.feedBack ? `
        <div class="sr-sub-feedback">
          <div class="sr-fb-label">Feed Back</div>
          <div class="sr-fb-text">${escapeHtml((submission.feed_back || submission.feedBack || '').slice(0, 200))}${(submission.feed_back || submission.feedBack || '').length > 200 ? '...' : ''}</div>
        </div>
      ` : ''}

      ${submission.feed_forward || submission.feedForward ? `
        <div class="sr-sub-feedback">
          <div class="sr-fb-label">Feed Forward</div>
          <div class="sr-fb-text">${escapeHtml((submission.feed_forward || submission.feedForward || '').slice(0, 200))}${(submission.feed_forward || submission.feedForward || '').length > 200 ? '...' : ''}</div>
        </div>
      ` : ''}

      ${renderTraceSummary(trace)}
      ${renderMisconceptionSummary(misconceptions)}
    </div>
  `;
}

function drawScoreChart(canvas, submissions) {
  if (!canvas || submissions.length === 0) return;

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.offsetWidth || 400;
  const height = 140;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const pad = { top: 12, right: 12, bottom: 28, left: 36 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;

  [0, 25, 50, 75, 100].forEach((value) => {
    const y = pad.top + innerHeight - (value / 100) * innerHeight;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + innerWidth, y);
    ctx.stroke();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(value), pad.left - 4, y + 3);
  });

  const count = submissions.length;
  const barWidth = Math.min(40, (innerWidth / count) * 0.6);
  const gap = innerWidth / count;

  submissions.forEach((submission, index) => {
    const score = submission.score ?? 0;
    const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
    const barHeight = (score / 100) * innerHeight;
    const x = pad.left + gap * index + (gap - barWidth) / 2;
    const y = pad.top + innerHeight - barHeight;

    ctx.fillStyle = `${color}cc`;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 0, 0]);
    ctx.fill();

    ctx.fillStyle = '#6b7280';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    const chapter = submission.chapter_id || submission.chapterId || '?';
    ctx.fillText(`Ch.${chapter}`, x + barWidth / 2, pad.top + innerHeight + 16);

    if (score > 15) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(String(score), x + barWidth / 2, y + 12);
    }
  });
}
