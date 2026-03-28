/**
 * views/summary.js
 * Summary cards + submission table
 */

import { escapeHtml, formatDate, scoreColor } from '../utils/format.js';

export function renderSummaryCards(summary, container, submissions = []) {
  if (!container) return;

  const rows = Array.isArray(submissions) ? submissions : [];
  const totalCount = Number(summary?.totalSubmissions ?? rows.length);
  const avgScoreNum = Number(summary?.avgScore);
  const avgScore = Number.isFinite(avgScoreNum) ? avgScoreNum.toFixed(1) : '-';
  const riskCount = Number(summary?.riskStudentCount ?? 0);
  const topConcept = String(summary?.topWeakConcept ?? '데이터 없음');
  const avgHintRequests = Number(summary?.avgHintRequests ?? 0);
  const chapterBreakdown = Array.isArray(summary?.chapterBreakdown) ? summary.chapterBreakdown : [];
  const uniqueStudents = new Set(
    rows
      .map((submission) => String(submission?.student_id || submission?.studentId || '').trim())
      .filter(Boolean),
  ).size || totalCount;
  const riskRate = uniqueStudents ? Math.round((riskCount / uniqueStudents) * 100) : 0;
  const lastSubmittedAt = rows
    .map((submission) => String(submission?.submitted_at || submission?.submittedAt || submission?.timestamp || ''))
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))[0] || '';
  const activity = buildActivitySeries(rows, chapterBreakdown);
  const scoreDelta = calcDelta(activity.points, 'avgScore');
  const strongestChapter = pickChapterByAverage(chapterBreakdown, 'max');
  const weakestChapter = pickChapterByAverage(chapterBreakdown, 'min');
  const chapterFocus = buildChapterFocus(chapterBreakdown);
  const latestActivityPoint = activity.points[activity.points.length - 1] || { count: 0 };
  const avgScoreDisplay = avgScore === '-' ? '-' : `${avgScore}점`;
  const latestSubmissionDisplay = lastSubmittedAt ? formatDate(lastSubmittedAt) : '기록 없음';

  container.innerHTML = `
    <div class="summary-shell">
      <section class="summary-top-grid">
        <article class="summary-panel summary-panel--gauge">
          <div class="summary-panel-head">
            <span class="summary-panel-kicker">Average score</span>
            <strong class="summary-panel-value">${avgScoreDisplay}</strong>
          </div>
          ${buildGaugeSvg(avgScoreNum)}
          <p class="summary-panel-note">현재 평균 점수는 목표 100점 기준 ${avgScore === '-' ? '0.0' : avgScore}% 수준입니다.</p>
        </article>

        <article class="summary-panel summary-panel--bars">
          <div class="summary-panel-head">
            <span class="summary-panel-kicker">Recent activity</span>
            <strong class="summary-panel-value">${latestActivityPoint.count ?? 0}건</strong>
          </div>
          <div class="summary-mini-bars">
            ${buildMiniBars(activity.points)}
          </div>
          <p class="summary-panel-note">${activity.mode === 'date' ? '최근 제출 일자' : '챕터별'} 기준 평균 점수 변화 ${formatSigned(scoreDelta, '점')}</p>
        </article>

        <article class="summary-panel summary-panel--progress">
          <div class="summary-panel-head">
            <span class="summary-panel-kicker">Chapter progress</span>
            <strong class="summary-panel-value">${chapterBreakdown.length}개</strong>
          </div>
          <div class="summary-progress-list">
            ${chapterFocus}
          </div>
        </article>
      </section>

      <section class="summary-chart-band">
        <article class="summary-panel summary-panel--chart summary-panel--chart-wide">
          <div class="summary-panel-head summary-panel-head--spread">
            <div>
              <span class="summary-panel-kicker">Overall progress</span>
              <strong class="summary-panel-value">최근 학습 흐름</strong>
              <p class="summary-panel-note">평균 점수와 제출 활동 밀도를 겹쳐서 보여줍니다.</p>
            </div>
            <span class="summary-panel-chip">${activity.mode === 'date' ? 'THIS WEEK' : 'CHAPTER VIEW'}</span>
          </div>
          ${buildAreaChart(activity.points)}
          <div class="summary-chart-legend">
            <span><i class="summary-legend-swatch summary-legend-swatch--score"></i>평균 점수 흐름</span>
            <span><i class="summary-legend-swatch summary-legend-swatch--volume"></i>제출 활동 밀도</span>
          </div>
        </article>
      </section>

      <section class="summary-stat-row">
        ${buildStatCard('총 제출 수', `${totalCount}건`, '누적 형성평가 제출')}
        ${buildStatCard('참여 학생 수', `${uniqueStudents}명`, '최근 필터 기준 고유 학생')}
        ${buildStatCard('최근 제출', latestSubmissionDisplay, '마지막 제출 시각')}
        ${buildStatCard('최다 취약개념', topConcept, '오답 빈도 기준')}
        ${buildStatCard('평균 힌트 요청', `${formatMetric(avgHintRequests)}회`, '학생당 평균 요청 수')}
        ${buildStatCard('강점 챕터', strongestChapter ? `Ch.${strongestChapter.chapterId}` : '데이터 없음', strongestChapter ? `${formatMetric(strongestChapter.avgScore)}점` : '평균 점수 기준')}
        ${buildStatCard('보완 챕터', weakestChapter ? `Ch.${weakestChapter.chapterId}` : '데이터 없음', weakestChapter ? `${formatMetric(weakestChapter.avgScore)}점` : '평균 점수 기준')}
        ${buildStatCard('위험 학생 수', `${riskCount}명`, `${riskRate}% 비중`, 'summary-stat-card--alert')}
      </section>
    </div>
  `;
}

function buildStatCard(label, value, meta, className = '') {
  return `
    <article class="summary-stat-card ${className}">
      <span class="summary-stat-card__label">${escapeHtml(label)}</span>
      <strong class="summary-stat-card__value">${escapeHtml(value)}</strong>
      <span class="summary-stat-card__meta">${escapeHtml(meta)}</span>
    </article>
  `;
}

function buildChapterFocus(chapterBreakdown) {
  const list = [...chapterBreakdown]
    .sort((a, b) => Number(b?.count || 0) - Number(a?.count || 0))
    .slice(0, 4);

  if (!list.length) {
    return '<p class="summary-panel-note">챕터 데이터가 없습니다.</p>';
  }

  const maxCount = Math.max(...list.map((chapter) => Number(chapter?.count || 0)), 1);

  return list.map((chapter) => {
    const chapterId = String(chapter?.chapterId ?? '');
    const count = Number(chapter?.count ?? 0);
    const avg = Number(chapter?.avgScore ?? 0);
    const fillWidth = clamp((count / maxCount) * 100, 10, 100);
    const toneClass = avg >= 80 ? 'is-good' : avg >= 60 ? 'is-mid' : 'is-alert';

    return `
      <div class="summary-progress-item">
        <div class="summary-progress-row">
          <strong>Ch.${escapeHtml(chapterId)}</strong>
          <span>${count}건</span>
        </div>
        <div class="summary-progress-track">
          <span class="summary-progress-fill ${toneClass}" style="width:${fillWidth}%;"></span>
        </div>
        <div class="summary-progress-row summary-progress-row--muted">
          <span>평균 점수</span>
          <span>${formatMetric(avg)}점</span>
        </div>
      </div>
    `;
  }).join('');
}

function buildActivitySeries(submissions, chapterBreakdown) {
  const datedRows = submissions
    .map((submission) => ({
      date: String(submission?.submitted_at || submission?.submittedAt || submission?.timestamp || '').slice(0, 10),
      score: Number(submission?.score ?? 0),
      hints: Number(submission?.chat_metrics?.hint_request_count || 0),
    }))
    .filter((row) => row.date);

  if (datedRows.length) {
    const grouped = new Map();
    datedRows.forEach((row) => {
      const found = grouped.get(row.date) || { count: 0, scoreSum: 0, hintSum: 0 };
      found.count += 1;
      found.scoreSum += row.score;
      found.hintSum += row.hints;
      grouped.set(row.date, found);
    });

    const points = Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([date, item]) => ({
        label: date.slice(5).replace('-', '.'),
        count: item.count,
        avgScore: round1(item.scoreSum / Math.max(item.count, 1)),
        hintRate: round1(item.hintSum / Math.max(item.count, 1)),
      }));

    return { mode: 'date', points };
  }

  const chapterPoints = chapterBreakdown
    .slice(-8)
    .map((chapter) => ({
      label: `Ch.${String(chapter?.chapterId ?? '')}`,
      count: Number(chapter?.count ?? 0),
      avgScore: Number(chapter?.avgScore ?? 0),
      hintRate: 0,
    }));

  if (chapterPoints.length) {
    return { mode: 'chapter', points: chapterPoints };
  }

  return {
    mode: 'empty',
    points: [{ label: '-', count: 0, avgScore: 0, hintRate: 0 }],
  };
}

function buildMiniBars(points) {
  const maxCount = Math.max(...points.map((point) => Number(point?.count || 0)), 1);

  return points.map((point, index) => {
    const countHeight = clamp((Number(point?.count || 0) / maxCount) * 100, 14, 100);
    const scoreHeight = clamp(Number(point?.avgScore || 0), 14, 100);

    return `
      <div class="summary-mini-bar-group ${index === points.length - 1 ? 'is-current' : ''}">
        <div class="summary-mini-bar-stack">
          <span class="summary-mini-bar summary-mini-bar--count" style="height:${countHeight}%;"></span>
          <span class="summary-mini-bar summary-mini-bar--score" style="height:${scoreHeight}%;"></span>
        </div>
        <span class="summary-mini-bar-label">${escapeHtml(point?.label || '-')}</span>
      </div>
    `;
  }).join('');
}

function buildGaugeSvg(value) {
  const safeValue = clamp(Number.isFinite(value) ? value : 0, 0, 100);
  const angle = Math.PI - (Math.PI * safeValue) / 100;
  const needleX = 80 + Math.cos(angle) * 44;
  const needleY = 90 - Math.sin(angle) * 44;

  return `
    <svg class="summary-gauge" viewBox="0 0 160 112" role="img" aria-label="평균 점수 ${safeValue.toFixed(1)}점">
      <path class="summary-gauge-track" d="M20 90 A60 60 0 0 1 140 90" pathLength="100"></path>
      <path class="summary-gauge-fill" d="M20 90 A60 60 0 0 1 140 90" pathLength="100" style="stroke-dasharray:${safeValue} 100;"></path>
      <line class="summary-gauge-needle" x1="80" y1="90" x2="${needleX.toFixed(1)}" y2="${needleY.toFixed(1)}"></line>
      <circle class="summary-gauge-center" cx="80" cy="90" r="7"></circle>
      <text class="summary-gauge-caption" x="80" y="58" text-anchor="middle">${safeValue.toFixed(1)}</text>
    </svg>
  `;
}

function buildAreaChart(points) {
  const chartWidth = 760;
  const chartHeight = 280;
  const padding = { top: 18, right: 18, bottom: 42, left: 22 };
  const innerHeight = chartHeight - padding.top - padding.bottom;
  const maxCount = Math.max(...points.map((point) => Number(point?.count || 0)), 1);
  const scoreValues = points.map((point) => clamp(Number(point?.avgScore || 0), 0, 100));
  const volumeValues = points.map((point) => clamp((Number(point?.count || 0) / maxCount) * 100, 0, 100));
  const scorePoints = mapChartPoints(scoreValues, chartWidth, chartHeight, padding);
  const volumePoints = mapChartPoints(volumeValues, chartWidth, chartHeight, padding);
  const baseline = chartHeight - padding.bottom;
  const yAxis = [0, 25, 50, 75, 100].map((value) => {
    const y = padding.top + innerHeight - (value / 100) * innerHeight;
    return `
      <g>
        <line class="summary-grid-line" x1="${padding.left}" y1="${y}" x2="${chartWidth - padding.right}" y2="${y}"></line>
        <text class="summary-axis-label" x="${padding.left - 6}" y="${y + 4}" text-anchor="end">${value}</text>
      </g>
    `;
  }).join('');
  const xLabels = scorePoints.map((point, index) => `
    <text class="summary-axis-label" x="${point.x}" y="${chartHeight - 14}" text-anchor="middle">${escapeHtml(points[index]?.label || '-')}</text>
  `).join('');
  const scoreArea = buildAreaPath(scorePoints, baseline);
  const volumeArea = buildAreaPath(volumePoints, baseline);
  const scoreLine = buildLinePath(scorePoints);
  const volumeLine = buildLinePath(volumePoints);
  const scoreDots = scorePoints.map((point) => `
    <circle class="summary-dot summary-dot--score" cx="${point.x}" cy="${point.y}" r="4.5"></circle>
  `).join('');
  const volumeDots = volumePoints.map((point) => `
    <circle class="summary-dot summary-dot--volume" cx="${point.x}" cy="${point.y}" r="4.5"></circle>
  `).join('');

  return `
    <svg class="summary-area-chart" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="최근 학습 흐름 차트">
      ${yAxis}
      <path class="summary-area summary-area--volume" d="${volumeArea}"></path>
      <path class="summary-area summary-area--score" d="${scoreArea}"></path>
      <path class="summary-line summary-line--volume" d="${volumeLine}"></path>
      <path class="summary-line summary-line--score" d="${scoreLine}"></path>
      ${volumeDots}
      ${scoreDots}
      ${xLabels}
    </svg>
  `;
}

function pickChapterByAverage(chapterBreakdown, mode) {
  const list = chapterBreakdown.filter((chapter) => Number.isFinite(Number(chapter?.avgScore)));
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => (
    mode === 'min'
      ? Number(a?.avgScore || 0) - Number(b?.avgScore || 0)
      : Number(b?.avgScore || 0) - Number(a?.avgScore || 0)
  ));
  return sorted[0] || null;
}

function calcDelta(points, key) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  const current = points[points.length - 1];
  const previous = points[points.length - 2];
  return round1(Number(current?.[key] || 0) - Number(previous?.[key] || 0));
}

function mapChartPoints(values, width, height, padding) {
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  return values.map((value, index) => {
    const ratio = values.length === 1 ? 0.5 : index / (values.length - 1);
    const x = padding.left + innerWidth * ratio;
    const y = padding.top + innerHeight - (clamp(Number(value || 0), 0, 100) / 100) * innerHeight;
    return { x: round1(x), y: round1(y) };
  });
}

function buildLinePath(points) {
  if (!points.length) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function buildAreaPath(points, baseline) {
  if (!points.length) return '';
  const line = buildLinePath(points);
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  return `${line} L ${lastPoint.x} ${baseline} L ${firstPoint.x} ${baseline} Z`;
}

function formatMetric(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(1) : '-';
}

function formatSigned(value, suffix = '') {
  if (!Number.isFinite(Number(value)) || Number(value) === 0) {
    return `0.0${suffix}`;
  }
  return `${Number(value) > 0 ? '+' : ''}${Number(value).toFixed(1)}${suffix}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value || 0), min), max);
}

function round1(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

export function renderSummaryTable(submissions, tbody, { onRowClick, onDelete } = {}) {
  if (!tbody) return;

  const list = Array.isArray(submissions) ? submissions : [];
  if (!list.length) {
    tbody.innerHTML = '';
    return;
  }

  tbody.innerHTML = list.map((submission, idx) => {
    const weakArr = Array.isArray(submission?.weak_concepts)
      ? submission.weak_concepts
      : (Array.isArray(submission?.weakConcepts) ? submission.weakConcepts : []);
    const scoreValue = submission?.score;
    const scoreClass = scoreColor(scoreValue);
    const hasScore = scoreValue !== null && scoreValue !== undefined && scoreValue !== '';
    const scoreNum = hasScore ? Number(scoreValue) : null;

    const scoreBar = hasScore
      ? `<div class="score-bar-wrap"><div class="score-bar ${scoreClass}-bar" style="width:${Math.min(Number(scoreNum || 0), 100)}%"></div></div>`
      : '';

    const weakTagsHtml = weakArr.length
      ? weakArr.slice(0, 3).map((weak) => `<span class="concept-tag">${escapeHtml(weak)}</span>`).join('')
      : '<span class="concept-tag concept-tag--none">없음</span>';

    return `
      <tr data-session="${escapeHtml(String(submission?.session_id || ''))}">
        <td>${escapeHtml(String(submission?.student_id || submission?.studentId || ''))}</td>
        <td>${escapeHtml(String(submission?.student_name || submission?.studentName || ''))}</td>
        <td>Ch.${escapeHtml(String(submission?.chapter_id || submission?.chapterId || ''))}</td>
        <td class="score-cell">
          ${scoreBar}
          <span class="${scoreClass}">${hasScore ? `${scoreValue}점` : '-'}</span>
        </td>
        <td class="concept-cell">${weakTagsHtml}</td>
        <td>${formatDate(submission?.submitted_at || submission?.submittedAt || submission?.timestamp)}</td>
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
