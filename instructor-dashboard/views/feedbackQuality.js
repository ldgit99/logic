/**
 * views/feedbackQuality.js
 * E5: 피드백 품질 화면 — Feed Up/Back/Forward 충족률
 */

import { escapeHtml } from '../utils/format.js';

/**
 * @param {object[]} submissions
 * @param {HTMLElement} container
 */
export function renderFeedbackQuality(submissions, container) {
  if (!container) return;

  if (submissions.length === 0) {
    container.innerHTML = '<p class="empty-msg">분석할 데이터가 없습니다.</p>';
    return;
  }

  const stats = calcFeedbackStats(submissions);
  const chapterStats = calcChapterFeedback(submissions);

  container.innerHTML = `
    <h2 class="section-title">피드백 품질 분석</h2>

    <div class="fq-overview">
      ${renderGauge('Feed Up 충족률', stats.feedUpRate)}
      ${renderGauge('Feed Back 충족률', stats.feedBackRate)}
      ${renderGauge('Feed Forward 충족률', stats.feedForwardRate)}
      ${renderGauge('실행가능 피드포워드 비율', stats.actionableFeedForwardRate)}
    </div>

    <div class="fq-chapter-wrap">
      <h3 class="chart-title">챕터별 피드백 품질 비교</h3>
      <table class="dash-table">
        <thead>
          <tr>
            <th>챕터</th>
            <th>제출 수</th>
            <th>평균 점수</th>
            <th>Feed Up</th>
            <th>Feed Back</th>
            <th>Feed Forward</th>
          </tr>
        </thead>
        <tbody>
          ${chapterStats.map(renderChapterFqRow).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function calcFeedbackStats(submissions) {
  let feedUp = 0, feedBack = 0, feedForward = 0, actionable = 0;
  const n = submissions.length;

  for (const s of submissions) {
    if (s.feedUp && s.feedUp.length > 10) feedUp++;
    if (s.feedBack && s.feedBack.length > 30) feedBack++;
    if (s.feedForward && s.feedForward.length > 30) feedForward++;
    // 실행가능 피드포워드: 번호 목록 또는 "1)" 패턴 포함 여부로 판단
    if (s.feedForward && /\d+[.)]/u.test(s.feedForward)) actionable++;
  }

  return {
    feedUpRate: n > 0 ? Math.round((feedUp / n) * 100) : 0,
    feedBackRate: n > 0 ? Math.round((feedBack / n) * 100) : 0,
    feedForwardRate: n > 0 ? Math.round((feedForward / n) * 100) : 0,
    actionableFeedForwardRate: n > 0 ? Math.round((actionable / n) * 100) : 0,
  };
}

function calcChapterFeedback(submissions) {
  const map = {};
  for (const s of submissions) {
    const ch = s.chapter_id || s.chapterId || '?';
    if (!map[ch]) map[ch] = { count: 0, scoreSum: 0, fu: 0, fb: 0, ff: 0 };
    map[ch].count++;
    map[ch].scoreSum += s.score ?? 0;
    if (s.feedUp && s.feedUp.length > 10) map[ch].fu++;
    if (s.feedBack && s.feedBack.length > 30) map[ch].fb++;
    if (s.feedForward && s.feedForward.length > 30) map[ch].ff++;
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ch, d]) => ({
      ch,
      count: d.count,
      avg: Math.round(d.scoreSum / d.count),
      fuRate: Math.round((d.fu / d.count) * 100),
      fbRate: Math.round((d.fb / d.count) * 100),
      ffRate: Math.round((d.ff / d.count) * 100),
    }));
}

function renderGauge(label, pct) {
  const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return `
    <div class="fq-gauge">
      <svg viewBox="0 0 100 60" class="gauge-svg">
        <path d="M10,50 A40,40 0 0,1 90,50" fill="none" stroke="#e5e7eb" stroke-width="10"/>
        <path d="M10,50 A40,40 0 0,1 90,50" fill="none" stroke="${color}" stroke-width="10"
              stroke-dasharray="${pct * 1.257} 125.7" stroke-linecap="round"/>
        <text x="50" y="52" text-anchor="middle" font-size="14" font-weight="700" fill="#111827">${pct}%</text>
      </svg>
      <div class="gauge-label">${escapeHtml(label)}</div>
    </div>
  `;
}

function renderChapterFqRow({ ch, count, avg, fuRate, fbRate, ffRate }) {
  return `
    <tr>
      <td>Ch.${escapeHtml(ch)}</td>
      <td>${count}명</td>
      <td>${avg}점</td>
      <td class="${rateClass(fuRate)}">${fuRate}%</td>
      <td class="${rateClass(fbRate)}">${fbRate}%</td>
      <td class="${rateClass(ffRate)}">${ffRate}%</td>
    </tr>
  `;
}

function rateClass(pct) {
  if (pct >= 80) return 'rate-good';
  if (pct >= 50) return 'rate-warn';
  return 'rate-bad';
}
