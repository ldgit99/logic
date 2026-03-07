/**
 * views/interventions.js
 * E2: 개입 우선순위 큐 — 위험점수 기준 학생 랭킹
 *
 * 위험점수 구성 (analytics.js에서 계산):
 *   반복오답률 + 힌트의존도 + 미완료세션비율 + 최근하락추세
 */

import { escapeHtml, formatDate, riskLevel } from '../utils/format.js';

/**
 * @param {object[]} interventions  Worker /dashboard/interventions 응답 배열
 * @param {HTMLElement} container
 * @param {{ onStudentClick: (s: object) => void }} opts
 */
export function renderInterventions(interventions, container, { onStudentClick } = {}) {
  if (!container) return;

  if (interventions.length === 0) {
    container.innerHTML = '<p class="empty-msg">개입이 필요한 학생이 없습니다.</p>';
    return;
  }

  container.innerHTML = `
    <div class="intervention-header">
      <h2 class="section-title">개입 우선순위 큐</h2>
      <p class="section-desc">위험점수 = 반복오답률 + 힌트의존도 + 미완료세션 + 최근하락추세 (100점 만점)</p>
    </div>
    <div class="intervention-list">
      ${interventions.map((item, i) => renderInterventionItem(item, i)).join('')}
    </div>
  `;

  container.querySelectorAll('.intervention-item').forEach((el, i) => {
    el.addEventListener('click', () => {
      if (onStudentClick) onStudentClick(interventions[i]);
    });
  });
}

function renderInterventionItem(item, rank) {
  const level = riskLevel(item.riskScore);
  const weak = (item.weakConcepts || []).slice(0, 3).join(', ') || '-';

  return `
    <div class="intervention-item risk-${level.cls}" tabindex="0" role="button"
         aria-label="${escapeHtml(item.studentName)} 상세보기">
      <div class="intervention-rank">${rank + 1}</div>
      <div class="intervention-info">
        <div class="intervention-name">
          ${escapeHtml(item.studentName)}
          <span class="student-id">(${escapeHtml(item.studentId)})</span>
        </div>
        <div class="intervention-meta">
          Ch.${escapeHtml(item.chapterId || '전체')} &nbsp;|&nbsp;
          최근 제출: ${formatDate(item.lastSubmittedAt)}
        </div>
        <div class="intervention-weak">취약개념: ${escapeHtml(weak)}</div>
      </div>
      <div class="intervention-score">
        <div class="risk-score">${item.riskScore ?? '-'}</div>
        <div class="risk-label risk-label--${level.cls}">${level.label}</div>
      </div>
    </div>
  `;
}
