/**
 * views/summary.js
 * E1: Summary 화면 — 요약 카드 + 제출 목록 테이블
 */

import { escapeHtml, formatDate, scoreColor } from '../utils/format.js';

/**
 * @param {object} summary  Worker /dashboard/summary 응답
 * @param {HTMLElement} container
 */
export function renderSummaryCards(summary, container) {
  if (!container) return;

  const totalCount = summary.totalSubmissions ?? 0;
  const avgScore = summary.avgScore != null ? summary.avgScore.toFixed(1) : '-';
  const riskCount = summary.riskStudentCount ?? 0;
  const topConcept = summary.topWeakConcept ?? '-';
  const chapterBreakdown = summary.chapterBreakdown ?? [];

  const chapterHtml = chapterBreakdown
    .map((c) => `<li>Ch.${c.chapterId}: ${c.count}명</li>`)
    .join('');

  container.innerHTML = `
    <div class="summary-card">
      <div class="card-label">총 제출 수</div>
      <div class="card-value">${totalCount}명</div>
    </div>
    <div class="summary-card">
      <div class="card-label">평균 점수</div>
      <div class="card-value">${avgScore}점</div>
    </div>
    <div class="summary-card summary-card--chapter">
      <div class="card-label">챕터별 완료</div>
      <ul class="chapter-breakdown">${chapterHtml || '<li>-</li>'}</ul>
    </div>
    <div class="summary-card summary-card--risk">
      <div class="card-label">위험 학생 수</div>
      <div class="card-value card-value--risk">${riskCount}명</div>
    </div>
    <div class="summary-card">
      <div class="card-label">최다 취약개념</div>
      <div class="card-value card-value--concept">${escapeHtml(topConcept)}</div>
    </div>
  `;
}

/**
 * @param {object[]} submissions
 * @param {HTMLElement} tbody
 * @param {{ onRowClick: (s: object) => void }} opts
 */
export function renderSummaryTable(submissions, tbody, { onRowClick } = {}) {
  if (!tbody) return;

  if (submissions.length === 0) {
    tbody.innerHTML = '';
    return;
  }

  tbody.innerHTML = submissions.map((s) => {
    const weak = (s.weak_concepts || s.weakConcepts || []).slice(0, 2).join(', ') || '-';
    const scoreClass = scoreColor(s.score);

    return `
      <tr data-session="${escapeHtml(s.session_id || '')}">
        <td>${escapeHtml(s.student_id || s.studentId || '')}</td>
        <td>${escapeHtml(s.student_name || s.studentName || '')}</td>
        <td>Ch.${escapeHtml(s.chapter_id || s.chapterId || '')}</td>
        <td class="score-cell ${scoreClass}">${s.score ?? '-'}점</td>
        <td class="concept-cell" title="${escapeHtml((s.weak_concepts || s.weakConcepts || []).join(', '))}">
          ${escapeHtml(weak)}
        </td>
        <td>${formatDate(s.submitted_at || s.submittedAt || s.timestamp)}</td>
        <td>
          <button class="btn-detail" data-idx="${submissions.indexOf(s)}">상세보기</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-detail').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      if (onRowClick) onRowClick(submissions[idx]);
    });
  });
}
