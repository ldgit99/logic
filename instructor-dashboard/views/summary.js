/**
 * views/summary.js
 * Summary cards + submission table
 */

import { escapeHtml, formatDate, scoreColor } from '../utils/format.js';

export function renderSummaryCards(summary, container) {
  if (!container) return;

  const totalCount = summary.totalSubmissions ?? 0;
  const avgScore = summary.avgScore != null ? Number(summary.avgScore).toFixed(1) : '-';
  const riskCount = summary.riskStudentCount ?? 0;
  const topConcept = summary.topWeakConcept ?? '-';
  const chapterBreakdown = summary.chapterBreakdown ?? [];

  const chapterHtml = chapterBreakdown
    .map((c) => {
      const avg = Number(c.avgScore ?? 0);
      const barColor = avg >= 80 ? '#10b981' : avg >= 60 ? '#f59e0b' : '#ef4444';
      const barWidth = Number.isFinite(avg) ? Math.min(avg, 100) : 0;
      return `
        <li class="chapter-row">
          <span class="chapter-row-label">Ch.${escapeHtml(c.chapterId || '')}</span>
          <div class="chapter-row-bar-wrap">
            <div class="chapter-row-bar" style="width:${barWidth}%;background:${barColor};"></div>
          </div>
          <span class="chapter-row-stats">${c.count || 0}紐?/ ${Number.isFinite(avg) ? `${avg}?? : '-'}</span>
        </li>`;
    })
    .join('');

  container.innerHTML = `
    <div class="summary-card">
      <div class="card-label">珥??쒖텧 ??/div>
      <div class="card-value">${totalCount}紐?/div>
    </div>
    <div class="summary-card">
      <div class="card-label">?됯퇏 ?먯닔</div>
      <div class="card-value">${avgScore}??/div>
    </div>
    <div class="summary-card summary-card--chapter">
      <div class="card-label">梨뺥꽣蹂??됯퇏 ?먯닔</div>
      <ul class="chapter-breakdown">${chapterHtml || '<li>-</li>'}</ul>
    </div>
    <div class="summary-card summary-card--risk">
      <div class="card-label">?꾪뿕 ?숈깮 ??/div>
      <div class="card-value card-value--risk">${riskCount}紐?/div>
    </div>
    <div class="summary-card">
      <div class="card-label">理쒕떎 痍⑥빟媛쒕뀗</div>
      <div class="card-value card-value--concept">${escapeHtml(topConcept)}</div>
    </div>
  `;
}

/**
 * @param {object[]} submissions
 * @param {HTMLElement} tbody
 * @param {{ onRowClick?: (s: object) => void, onDelete?: (s: object) => void }} opts
 */
export function renderSummaryTable(submissions, tbody, { onRowClick, onDelete } = {}) {
  if (!tbody) return;

  if (!submissions.length) {
    tbody.innerHTML = '';
    return;
  }

  tbody.innerHTML = submissions.map((s, idx) => {
    const weakArr = s.weak_concepts || s.weakConcepts || [];
    const scoreClass = scoreColor(s.score);
    const score = s.score ?? null;
    const scoreBar = score !== null
      ? `<div class="score-bar-wrap"><div class="score-bar ${scoreClass}-bar" style="width:${Math.min(Number(score), 100)}%"></div></div>`
      : '';
    const weakTagsHtml = weakArr.length
      ? weakArr.slice(0, 3).map((w) => `<span class="concept-tag">${escapeHtml(w)}</span>`).join('')
      : '<span class="concept-tag concept-tag--none">?놁쓬</span>';

    return `
      <tr data-session="${escapeHtml(s.session_id || '')}">
        <td>${escapeHtml(s.student_id || s.studentId || '')}</td>
        <td>${escapeHtml(s.student_name || s.studentName || '')}</td>
        <td>Ch.${escapeHtml(s.chapter_id || s.chapterId || '')}</td>
        <td class="score-cell">
          ${scoreBar}
          <span class="${scoreClass}">${score !== null ? `${score}?? : '-'}</span>
        </td>
        <td class="concept-cell">${weakTagsHtml}</td>
        <td>${formatDate(s.submitted_at || s.submittedAt || s.timestamp)}</td>
        <td>
          <button class="btn-detail" data-action="detail" data-idx="${idx}">?곸꽭蹂닿린</button>
          <button class="btn-delete" data-action="delete" data-idx="${idx}">??젣</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('button[data-action="detail"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      if (onRowClick) onRowClick(submissions[idx]);
    });
  });

  tbody.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      if (onDelete) onDelete(submissions[idx]);
    });
  });
}
