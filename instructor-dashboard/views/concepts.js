/**
 * views/concepts.js
 * E4: 오개념 화면 — 취약개념 Top-N + 챕터별 분포
 */

import { escapeHtml } from '../utils/format.js';

/**
 * @param {object[]} concepts  Worker /dashboard/concepts 응답 배열
 *   각 항목: { concept: string, count: number, chapterBreakdown: {chapterId, count}[], students: object[] }
 * @param {HTMLElement} container
 * @param {{ onConceptClick: (concept: string) => void }} opts
 */
export function renderConcepts(concepts, container, { onConceptClick } = {}) {
  if (!container) return;

  if (concepts.length === 0) {
    container.innerHTML = '<p class="empty-msg">취약개념 데이터가 없습니다.</p>';
    return;
  }

  const maxCount = Math.max(...concepts.map((c) => c.count), 1);

  container.innerHTML = `
    <h2 class="section-title">오개념 분포</h2>
    <p class="section-desc">개념을 클릭하면 해당 개념이 취약한 학생 목록을 확인할 수 있습니다.</p>
    <div class="concept-list">
      ${concepts.map((c, i) => renderConceptItem(c, i, maxCount)).join('')}
    </div>
  `;

  container.querySelectorAll('.concept-item').forEach((el) => {
    el.addEventListener('click', () => {
      const concept = el.dataset.concept;
      if (onConceptClick) onConceptClick(concept);

      // 선택 강조
      container.querySelectorAll('.concept-item').forEach((e) => e.classList.remove('selected'));
      el.classList.add('selected');
    });
  });
}

function renderConceptItem(item, rank, maxCount) {
  const barPct = Math.round((item.count / maxCount) * 100);
  const chBreak = (item.chapterBreakdown || [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((c) => `<span class="ch-tag">Ch.${escapeHtml(c.chapterId)}: ${c.count}명</span>`)
    .join('');

  return `
    <div class="concept-item" data-concept="${escapeHtml(item.concept)}" tabindex="0" role="button">
      <div class="concept-rank">${rank + 1}</div>
      <div class="concept-body">
        <div class="concept-name">${escapeHtml(item.concept)}</div>
        <div class="concept-bar-wrap">
          <div class="concept-bar" style="width:${barPct}%"></div>
        </div>
        <div class="concept-chapters">${chBreak}</div>
      </div>
      <div class="concept-count">${item.count}명</div>
    </div>
  `;
}
