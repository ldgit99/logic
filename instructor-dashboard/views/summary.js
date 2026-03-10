/**
 * views/summary.js
 * Summary cards + submission table
 */

import { escapeHtml, formatDate, scoreColor } from '../utils/format.js';

export function renderSummaryCards(summary, container) {
  if (!container) return;

  const totalCount = Number(summary?.totalSubmissions ?? 0);
  const avgScoreNum = Number(summary?.avgScore);
  const avgScore = Number.isFinite(avgScoreNum) ? avgScoreNum.toFixed(1) : '-';
  const riskCount = Number(summary?.riskStudentCount ?? 0);
  const topConcept = String(summary?.topWeakConcept ?? '-');
  const chapterBreakdown = Array.isArray(summary?.chapterBreakdown) ? summary.chapterBreakdown : [];

  const chapterHtml = chapterBreakdown.map((c) => {
    const chapterId = String(c?.chapterId ?? '');
    const avg = Number(c?.avgScore);
    const count = Number(c?.count ?? 0);
    const barColor = avg >= 80 ? '#10b981' : avg >= 60 ? '#f59e0b' : '#ef4444';
    const barWidth = Number.isFinite(avg) ? Math.min(avg, 100) : 0;
    const avgText = Number.isFinite(avg) ? `${avg}점` : '-';

    return `
      <li class="chapter-row">
        <span class="chapter-row-label">Ch.${escapeHtml(chapterId)}</span>
        <div class="chapter-row-bar-wrap">
          <div class="chapter-row-bar" style="width:${barWidth}%;background:${barColor};"></div>
        </div>
        <span class="chapter-row-stats">${count}명 / ${avgText}</span>
      </li>
    `;
  }).join('');

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
      <div class="card-label">챕터별 평균 점수</div>
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
 * @param {{ onRowClick?: (s: object) => void, onDelete?: (s: object) => void }} opts
 */
export function renderSummaryTable(submissions, tbody, { onRowClick, onDelete } = {}) {
  if (!tbody) return;

  const list = Array.isArray(submissions) ? submissions : [];
  if (!list.length) {
    tbody.innerHTML = '';
    return;
  }

  tbody.innerHTML = list.map((s, idx) => {
    const weakArr = Array.isArray(s?.weak_concepts) ? s.weak_concepts : (Array.isArray(s?.weakConcepts) ? s.weakConcepts : []);
    const scoreValue = s?.score;
    const scoreClass = scoreColor(scoreValue);
    const hasScore = scoreValue !== null && scoreValue !== undefined && scoreValue !== '';
    const scoreNum = hasScore ? Number(scoreValue) : null;

    const scoreBar = hasScore
      ? `<div class="score-bar-wrap"><div class="score-bar ${scoreClass}-bar" style="width:${Math.min(Number(scoreNum || 0), 100)}%"></div></div>`
      : '';

    const weakTagsHtml = weakArr.length
      ? weakArr.slice(0, 3).map((w) => `<span class="concept-tag">${escapeHtml(w)}</span>`).join('')
      : '<span class="concept-tag concept-tag--none">없음</span>';

    return `
      <tr data-session="${escapeHtml(String(s?.session_id || ''))}">
        <td>${escapeHtml(String(s?.student_id || s?.studentId || ''))}</td>
        <td>${escapeHtml(String(s?.student_name || s?.studentName || ''))}</td>
        <td>Ch.${escapeHtml(String(s?.chapter_id || s?.chapterId || ''))}</td>
        <td class="score-cell">
          ${scoreBar}
          <span class="${scoreClass}">${hasScore ? `${scoreValue}점` : '-'}</span>
        </td>
        <td class="concept-cell">${weakTagsHtml}</td>
        <td>${formatDate(s?.submitted_at || s?.submittedAt || s?.timestamp)}</td>
        <td>
          <button class="btn-detail" data-action="detail" data-idx="${idx}">상세보기</button>
          <button class="btn-delete" data-action="delete" data-idx="${idx}">삭제</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('button[data-action="detail"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      if (onRowClick) onRowClick(list[idx]);
    });
  });

  tbody.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      if (onDelete) onDelete(list[idx]);
    });
  });
}