/**
 * views/studentReport.js
 * E7: 학생 개별 보고서 — 학생별 챕터 이력, 점수 차트, 피드백 전문
 */

import { escapeHtml, formatDate, scoreColor } from '../utils/format.js';
import { openStudentModal } from './studentModal.js';

let selectedStudentId = null;

/**
 * @param {object[]} submissions
 * @param {HTMLElement} container
 */
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
          <input type="text" id="sr-search" class="sr-search" placeholder="학번 또는 이름 검색…" />
        </div>
        <ul class="sr-student-list" id="sr-student-list"></ul>
      </aside>
      <div class="sr-detail" id="sr-detail">
        <div class="sr-detail-empty">
          <p>왼쪽에서 학생을 선택하세요.</p>
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

// ── 학생별 그룹화 ─────────────────────────────────────────────

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
    .map((st) => {
      const scores = st.submissions.map((s) => s.score ?? null).filter((v) => v !== null);
      st.avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      st.chapters = [...new Set(st.submissions.map((s) => s.chapter_id || s.chapterId || '?'))].sort();
      st.submissions.sort((a, b) =>
        (a.chapter_id || a.chapterId || '').localeCompare(b.chapter_id || b.chapterId || '')
      );
      return st;
    })
    .sort((a, b) => a.studentId.localeCompare(b.studentId));
}

// ── 학생 목록 렌더링 ──────────────────────────────────────────

function renderStudentList(students, listEl, detailEl) {
  if (!listEl) return;

  listEl.innerHTML = students.map((st) => {
    const scoreClass = st.avgScore != null ? scoreColor(st.avgScore) : '';
    const isSelected = st.studentId === selectedStudentId;
    return `
      <li class="sr-student-item ${isSelected ? 'selected' : ''}" data-id="${escapeHtml(st.studentId)}">
        <div class="sr-student-name">${escapeHtml(st.studentName)}</div>
        <div class="sr-student-meta">
          <span class="sr-student-id">${escapeHtml(st.studentId)}</span>
          <span class="${scoreClass} sr-student-score">${st.avgScore != null ? st.avgScore + '점' : '-'}</span>
        </div>
        <div class="sr-student-chapters">
          ${st.chapters.map((ch) => `<span class="ch-tag">Ch.${escapeHtml(ch)}</span>`).join('')}
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

// ── 상세 패널 렌더링 ──────────────────────────────────────────

function renderDetail(student, detailEl) {
  if (!detailEl) return;

  const weakAll = {};
  for (const s of student.submissions) {
    for (const w of (s.weak_concepts || s.weakConcepts || [])) {
      weakAll[w] = (weakAll[w] || 0) + 1;
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
        <span class="${scoreColor(student.avgScore ?? 0)} sr-avg-score">
          평균 ${student.avgScore != null ? student.avgScore + '점' : '-'}
        </span>
      </div>
    </div>

    <div class="sr-chart-card">
      <h3 class="chart-title">챕터별 점수</h3>
      <canvas id="sr-score-chart" height="140"></canvas>
    </div>

    ${weakSorted.length > 0 ? `
    <div class="sr-section">
      <h3 class="chart-title">누적 취약개념</h3>
      <div class="weak-tags">
        ${weakSorted.map(([w, cnt]) => `
          <span class="weak-tag">${escapeHtml(w)} <span class="weak-cnt">${cnt}회</span></span>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <div class="sr-section">
      <h3 class="chart-title">챕터별 제출 상세</h3>
      ${student.submissions.map((s) => renderSubmissionCard(s)).join('')}
    </div>
  `;

  drawScoreChart(
    detailEl.querySelector('#sr-score-chart'),
    student.submissions
  );

  detailEl.querySelectorAll('.btn-detail-modal').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      openStudentModal(student.submissions[idx]);
    });
  });
}

function renderSubmissionCard(s, idx) {
  const ch = s.chapter_id || s.chapterId || '-';
  const score = s.score ?? null;
  const scoreClass = score != null ? scoreColor(score) : '';
  const correct = s.correct_count ?? s.correctCount ?? '-';
  const total = s.total_count ?? s.totalCount ?? '-';
  const scoreBarW = score != null ? Math.min(score, 100) : 0;

  return `
    <div class="sr-sub-card">
      <div class="sr-sub-header">
        <span class="sr-sub-chapter">Ch.${escapeHtml(ch)}</span>
        <div class="sr-sub-score">
          <div class="score-bar-wrap" style="width:80px">
            <div class="score-bar ${scoreClass}-bar" style="width:${scoreBarW}%"></div>
          </div>
          <span class="${scoreClass}">${score != null ? score + '점' : '-'} (${correct}/${total})</span>
        </div>
        <span class="sr-sub-date">${formatDate(s.submitted_at || s.submittedAt || s.timestamp)}</span>
        <button class="btn-detail btn-detail-modal" data-idx="${idx ?? 0}">대화 보기</button>
      </div>

      ${s.feed_back || s.feedBack ? `
      <div class="sr-sub-feedback">
        <div class="sr-fb-label">Feed Back</div>
        <div class="sr-fb-text">${escapeHtml((s.feed_back || s.feedBack || '').slice(0, 200))}${(s.feed_back || s.feedBack || '').length > 200 ? '…' : ''}</div>
      </div>
      ` : ''}

      ${s.feed_forward || s.feedForward ? `
      <div class="sr-sub-feedback">
        <div class="sr-fb-label">Feed Forward</div>
        <div class="sr-fb-text">${escapeHtml((s.feed_forward || s.feedForward || '').slice(0, 200))}${(s.feed_forward || s.feedForward || '').length > 200 ? '…' : ''}</div>
      </div>
      ` : ''}
    </div>
  `;
}

// ── 점수 막대 차트 (Canvas) ───────────────────────────────────

function drawScoreChart(canvas, submissions) {
  if (!canvas || submissions.length === 0) return;

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 400;
  const H = 140;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const PAD = { top: 12, right: 12, bottom: 28, left: 36 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;

  ctx.clearRect(0, 0, W, H);

  // 가로선
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  [0, 25, 50, 75, 100].forEach((v) => {
    const y = PAD.top + iH - (v / 100) * iH;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + iW, y); ctx.stroke();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(v), PAD.left - 4, y + 3);
  });

  // 막대
  const n = submissions.length;
  const barW = Math.min(40, (iW / n) * 0.6);
  const gap = iW / n;

  submissions.forEach((s, i) => {
    const score = s.score ?? 0;
    const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
    const barH = (score / 100) * iH;
    const x = PAD.left + gap * i + (gap - barW) / 2;
    const y = PAD.top + iH - barH;

    ctx.fillStyle = color + 'cc';
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, [3, 3, 0, 0]);
    ctx.fill();

    // 챕터 라벨
    ctx.fillStyle = '#6b7280';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    const ch = s.chapter_id || s.chapterId || '?';
    ctx.fillText(`Ch.${ch}`, x + barW / 2, PAD.top + iH + 16);

    // 점수 라벨
    if (score > 15) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(String(score), x + barW / 2, y + 12);
    }
  });
}
