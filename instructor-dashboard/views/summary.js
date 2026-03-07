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
    const weakArr = s.weak_concepts || s.weakConcepts || [];
    const scoreClass = scoreColor(s.score);
    const score = s.score ?? null;
    const scoreBar = score !== null
      ? `<div class="score-bar-wrap"><div class="score-bar ${scoreClass}-bar" style="width:${Math.min(score, 100)}%"></div></div>`
      : '';
    const weakTagsHtml = weakArr.length
      ? weakArr.slice(0, 3).map((w) => `<span class="concept-tag">${escapeHtml(w)}</span>`).join('')
      : '<span class="concept-tag concept-tag--none">없음</span>';

    return `
      <tr data-session="${escapeHtml(s.session_id || '')}">
        <td>${escapeHtml(s.student_id || s.studentId || '')}</td>
        <td>${escapeHtml(s.student_name || s.studentName || '')}</td>
        <td>Ch.${escapeHtml(s.chapter_id || s.chapterId || '')}</td>
        <td class="score-cell">
          ${scoreBar}
          <span class="${scoreClass}">${score !== null ? score + '점' : '-'}</span>
        </td>
        <td class="concept-cell">${weakTagsHtml}</td>
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
