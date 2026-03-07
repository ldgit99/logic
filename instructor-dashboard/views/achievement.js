/**
 * views/achievement.js
 * E3: 성취 분석 — Bloom 레벨별 성취율 차트 (Canvas 막대 그래프)
 */

import { escapeHtml } from '../utils/format.js';

const BLOOM_LEVELS = ['기억', '이해', '적용', '분석', '평가', '창조'];
const BLOOM_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

/**
 * @param {object[]} submissions
 * @param {HTMLElement} container
 */
export function renderAchievement(submissions, container) {
  if (!container) return;

  if (submissions.length === 0) {
    container.innerHTML = '<p class="empty-msg">분석할 데이터가 없습니다.</p>';
    return;
  }

  const bloomStats = calcBloomStats(submissions);
  const chapterStats = calcChapterStats(submissions);

  container.innerHTML = `
    <h2 class="section-title">성취 분석</h2>

    <div class="achievement-grid">
      <div class="chart-card">
        <h3 class="chart-title">Bloom 레벨별 평균 성취율</h3>
        <canvas id="bloom-chart" width="480" height="280"></canvas>
        <div class="chart-legend" id="bloom-legend"></div>
      </div>

      <div class="chart-card">
        <h3 class="chart-title">챕터별 평균 점수</h3>
        <canvas id="chapter-chart" width="480" height="280"></canvas>
      </div>
    </div>

    <div class="achievement-table-wrap">
      <h3 class="chart-title">학생별 성취 요약</h3>
      <table class="dash-table">
        <thead>
          <tr>
            <th>학번</th><th>이름</th><th>챕터</th><th>점수</th>
            <th>기억</th><th>이해</th><th>적용</th><th>분석</th>
          </tr>
        </thead>
        <tbody>
          ${submissions.map(renderStudentRow).join('')}
        </tbody>
      </table>
    </div>
  `;

  drawBloomChart(document.getElementById('bloom-chart'), bloomStats);
  drawChapterChart(document.getElementById('chapter-chart'), chapterStats);
  renderBloomLegend(document.getElementById('bloom-legend'));
}

function calcBloomStats(submissions) {
  // bloomData: { [level]: { correct: number, total: number } }
  const stats = Object.fromEntries(BLOOM_LEVELS.map((l) => [l, { correct: 0, total: 0 }]));

  for (const s of submissions) {
    const bloomBreakdown = s.bloomBreakdown || {};
    for (const [level, data] of Object.entries(bloomBreakdown)) {
      if (stats[level]) {
        stats[level].correct += data.correct ?? 0;
        stats[level].total += data.total ?? 0;
      }
    }
  }

  return BLOOM_LEVELS.map((l) => {
    const { correct, total } = stats[l];
    return { label: l, rate: total > 0 ? Math.round((correct / total) * 100) : null };
  });
}

function calcChapterStats(submissions) {
  const map = {};
  for (const s of submissions) {
    const ch = s.chapter_id || s.chapterId || '?';
    if (!map[ch]) map[ch] = { total: 0, count: 0 };
    map[ch].total += s.score ?? 0;
    map[ch].count += 1;
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ch, { total, count }]) => ({ label: `Ch.${ch}`, avg: Math.round(total / count) }));
}

function drawBloomChart(canvas, stats) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const pad = { top: 20, right: 20, bottom: 40, left: 40 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const barW = chartW / stats.length;

  ctx.clearRect(0, 0, W, H);

  // Y축 눈금
  ctx.strokeStyle = '#e5e7eb';
  ctx.fillStyle = '#6b7280';
  ctx.font = '11px sans-serif';
  for (let v = 0; v <= 100; v += 25) {
    const y = pad.top + chartH - (v / 100) * chartH;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + chartW, y);
    ctx.stroke();
    ctx.fillText(`${v}%`, 2, y + 4);
  }

  // 막대
  stats.forEach(({ label, rate }, i) => {
    const x = pad.left + i * barW + barW * 0.15;
    const bw = barW * 0.7;
    const bh = rate != null ? (rate / 100) * chartH : 0;
    const y = pad.top + chartH - bh;

    ctx.fillStyle = rate != null ? BLOOM_COLORS[i] : '#d1d5db';
    ctx.fillRect(x, y, bw, bh);

    // 값 표시
    ctx.fillStyle = '#111827';
    ctx.textAlign = 'center';
    ctx.font = '12px sans-serif';
    ctx.fillText(rate != null ? `${rate}%` : 'N/A', x + bw / 2, y - 4);

    // X축 라벨
    ctx.fillStyle = '#374151';
    ctx.fillText(label, x + bw / 2, pad.top + chartH + 20);
  });
}

function drawChapterChart(canvas, stats) {
  if (!canvas || stats.length === 0) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const pad = { top: 20, right: 20, bottom: 40, left: 40 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const barW = chartW / Math.max(stats.length, 1);

  ctx.clearRect(0, 0, W, H);

  ctx.strokeStyle = '#e5e7eb';
  ctx.fillStyle = '#6b7280';
  ctx.font = '11px sans-serif';
  for (let v = 0; v <= 100; v += 25) {
    const y = pad.top + chartH - (v / 100) * chartH;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + chartW, y);
    ctx.stroke();
    ctx.fillText(`${v}`, 2, y + 4);
  }

  stats.forEach(({ label, avg }, i) => {
    const x = pad.left + i * barW + barW * 0.15;
    const bw = barW * 0.7;
    const bh = (avg / 100) * chartH;
    const y = pad.top + chartH - bh;

    ctx.fillStyle = '#6366f1';
    ctx.fillRect(x, y, bw, bh);

    ctx.fillStyle = '#111827';
    ctx.textAlign = 'center';
    ctx.font = '11px sans-serif';
    ctx.fillText(`${avg}점`, x + bw / 2, y - 4);
    ctx.fillStyle = '#374151';
    ctx.fillText(label, x + bw / 2, pad.top + chartH + 20);
  });
}

function renderBloomLegend(el) {
  if (!el) return;
  el.innerHTML = BLOOM_LEVELS.map((l, i) => `
    <span class="legend-item">
      <span class="legend-color" style="background:${BLOOM_COLORS[i]}"></span>${l}
    </span>
  `).join('');
}

function renderStudentRow(s) {
  const bloom = s.bloomBreakdown || {};
  const levels = BLOOM_LEVELS.slice(0, 4).map((l) => {
    const d = bloom[l];
    return d && d.total > 0
      ? `<td>${Math.round((d.correct / d.total) * 100)}%</td>`
      : '<td>-</td>';
  });
  return `
    <tr>
      <td>${escapeHtml(s.student_id || s.studentId || '')}</td>
      <td>${escapeHtml(s.student_name || s.studentName || '')}</td>
      <td>Ch.${escapeHtml(s.chapter_id || s.chapterId || '')}</td>
      <td>${s.score ?? '-'}점</td>
      ${levels.join('')}
    </tr>
  `;
}
