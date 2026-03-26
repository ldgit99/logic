/**
 * views/interactionAnalysis.js
 * Research-oriented interaction analysis for the instructor dashboard.
 */

import { escapeHtml, scoreColor } from '../utils/format.js';

const HINT_KEYWORDS = ['힌트', '모르겠', '알려줘', '어떻게', '무엇', '이해가'];

export function renderInteractionAnalysis(submissions, container, researchData = {}) {
  if (!container) return;

  if (!Array.isArray(submissions) || submissions.length === 0) {
    container.innerHTML = '<p class="empty-msg">분석할 데이터가 없습니다.</p>';
    return;
  }

  const enriched = submissions.map(enrichSubmission);
  const heatmapData = buildConceptHeatmap(enriched);
  const clusterResult = buildClusters(enriched);
  const researchSummary = researchData?.summary || {};
  const studentChapterRows = Array.isArray(researchData?.studentChapterRows) ? researchData.studentChapterRows : [];
  const attemptRows = Array.isArray(researchData?.attemptRows) ? researchData.attemptRows : [];
  const reflectionRows = Array.isArray(researchData?.reflectionRows) ? researchData.reflectionRows : [];
  const trajectoryData = buildTrajectoryData(studentChapterRows);
  const transitionData = buildTransitionMatrix(attemptRows);
  const distributionData = buildDistributionData(studentChapterRows);

  container.innerHTML = `
    <div class="ia-header-row">
      <h2 class="section-title" style="margin:0;">상호작용 분석</h2>
      <div class="ia-export-actions">
        <button id="ia-export-student" class="ia-export-btn ia-export-btn--teal" type="button">Student-Chapter CSV</button>
        <button id="ia-export-attempt" class="ia-export-btn ia-export-btn--blue" type="button">Attempt-Level CSV</button>
        <button id="ia-export-reflection" class="ia-export-btn ia-export-btn--violet" type="button">Reflection-Coded CSV</button>
      </div>
    </div>

    <div class="ia-card">
      <h3 class="chart-title">SSCI 연구 요약 지표</h3>
      ${renderResearchSummary(researchSummary, studentChapterRows, attemptRows, reflectionRows)}
    </div>

    <div class="ia-top-grid">
      <div class="ia-card">
        <h3 class="chart-title">상호작용 패턴 요약</h3>
        ${renderPatternSummary(enriched)}
      </div>
      <div class="ia-card ia-card--scatter">
        <h3 class="chart-title">턴 수와 점수 산점도
          <span class="chart-sub">고점수 저턴, 저점수 고턴 패턴을 비교합니다.</span>
        </h3>
        <canvas id="ia-scatter" width="460" height="280"></canvas>
        <div class="scatter-legend">
          <span class="sleg sleg--bad">60점 미만</span>
          <span class="sleg sleg--warn">60~79점</span>
          <span class="sleg sleg--good">80점 이상</span>
        </div>
      </div>
    </div>

    <div class="ia-top-grid ia-top-grid--balanced">
      <div class="ia-card">
        <h3 class="chart-title">학습 궤적
          <span class="chart-sub">챕터 진행에 따른 평균 점수, 힌트 의존, 성찰 품질 변화를 봅니다.</span>
        </h3>
        <div id="ia-trajectory"></div>
      </div>
      <div class="ia-card">
        <h3 class="chart-title">상태 전이 Heatmap
          <span class="chart-sub">incorrect, partial, correct 전이 빈도로 문제 해결 흐름을 확인합니다.</span>
        </h3>
        <div id="ia-transition"></div>
      </div>
    </div>

    <div class="ia-card">
      <h3 class="chart-title">분포 기반 비교
        <span class="chart-sub">챕터별 productive struggle, reflection quality, score 분포를 box plot으로 표시합니다.</span>
      </h3>
      <div id="ia-distribution"></div>
    </div>

    <div class="ia-card ia-card--heatmap">
      <h3 class="chart-title">취약개념 히트맵
        <span class="chart-sub">챕터별로 반복 출현하는 취약개념 상위 15개를 보여줍니다.</span>
      </h3>
      <div id="ia-heatmap"></div>
    </div>

    <div class="ia-card">
      <h3 class="chart-title">힌트 의존 상위 학생</h3>
      <p class="section-desc">학생 발화와 저장된 채팅 지표를 함께 사용해 도움 요청 패턴을 봅니다.</p>
      <table class="dash-table">
        <thead>
          <tr>
            <th>순위</th>
            <th>학번</th>
            <th>이름</th>
            <th>챕터</th>
            <th>턴 수</th>
            <th>힌트 수</th>
            <th>평균 발화 길이</th>
            <th>점수</th>
          </tr>
        </thead>
        <tbody id="ia-hint-tbody"></tbody>
      </table>
    </div>

    <div class="ia-card">
      <h3 class="chart-title">상관관계 행렬 (Pearson r)
        <span class="chart-sub">논문 Table 형식으로 바로 옮길 수 있는 탐색적 상관입니다.</span>
      </h3>
      <div id="ia-corr"></div>
    </div>

    <div class="ia-top-grid ia-top-grid--balanced">
      <div class="ia-card">
        <h3 class="chart-title">힌트 사용 구간별 평균 점수
          <span class="chart-sub">힌트 요청 빈도와 성취의 관계를 요약합니다.</span>
        </h3>
        <div id="ia-hint-bar" class="ia-chart-center"></div>
      </div>
      <div class="ia-card">
        <h3 class="chart-title">행동 군집 요약
          <span class="chart-sub">턴 수와 힌트 수를 기준으로 학습자 유형을 분류합니다.</span>
        </h3>
        <div id="ia-cluster"></div>
      </div>
    </div>
  `;

  renderHeatmap(heatmapData, container.querySelector('#ia-heatmap'));
  renderScatter(enriched, container.querySelector('#ia-scatter'));
  renderTrajectory(trajectoryData, container.querySelector('#ia-trajectory'));
  renderTransitionMatrix(transitionData, container.querySelector('#ia-transition'));
  renderDistribution(distributionData, container.querySelector('#ia-distribution'));
  renderHintTable(enriched, container.querySelector('#ia-hint-tbody'));
  renderCorrelationMatrix(enriched, container.querySelector('#ia-corr'));
  renderHintEffectBar(enriched, container.querySelector('#ia-hint-bar'));
  renderClusterSummary(clusterResult, container.querySelector('#ia-cluster'));

  container.querySelector('#ia-export-student')
    ?.addEventListener('click', () => exportResearchCSV(studentChapterRows, 'student_chapter_research'));
  container.querySelector('#ia-export-attempt')
    ?.addEventListener('click', () => exportResearchCSV(attemptRows, 'attempt_level_research'));
  container.querySelector('#ia-export-reflection')
    ?.addEventListener('click', () => exportResearchCSV(reflectionRows, 'reflection_coded_research'));
}

function enrichSubmission(submission) {
  const messages = Array.isArray(submission?.messages)
    ? submission.messages.filter((message) => message?.role !== 'system')
    : [];
  const userMessages = messages.filter((message) => message?.role === 'user');
  const metrics = submission?.chat_metrics || {};
  const inferredHintCount = userMessages.reduce((acc, message) => {
    const content = String(message?.content || '');
    return acc + HINT_KEYWORDS.filter((keyword) => content.includes(keyword)).length;
  }, 0);
  const hintCount = Number(metrics.hint_request_count ?? inferredHintCount);
  const totalLen = userMessages.reduce((sum, message) => sum + String(message?.content || '').length, 0);
  const avgUserLen = Number(
    metrics.average_user_message_length
      ?? (userMessages.length ? Math.round(totalLen / userMessages.length) : 0),
  );

  return {
    ...submission,
    turnCount: Number(metrics.user_message_count || userMessages.length || 0),
    hintCount,
    avgUserLen,
  };
}

function renderResearchSummary(summary, studentChapterRows, attemptRows, reflectionRows) {
  const cards = [
    ['Student-chapter N', studentChapterRows.length],
    ['Attempt N', attemptRows.length],
    ['Reflection-coded N', reflectionRows.length],
    ['Prod. Struggle', formatMetric(summary.avg_productive_struggle_index)],
    ['Hint Dependency', formatMetric(summary.avg_hint_dependency_index)],
    ['Self-Explanation', formatMetric(summary.avg_self_explanation_index)],
    ['Misconception Repair', formatMetric(summary.avg_misconception_repair_rate)],
    ['Reflection Quality', formatMetric(summary.avg_reflection_quality_index)],
    ['Persistence', formatMetric(summary.avg_persistence_index)],
  ];

  return `
    <div class="pattern-stats pattern-stats--research">
      ${cards.map(([label, value]) => `
        <div class="pstat">
          <div class="pstat-value">${escapeHtml(String(value))}</div>
          <div class="pstat-label">${escapeHtml(label)}</div>
        </div>
      `).join('')}
    </div>
    <p class="ia-footnote">
      Student-chapter, attempt-level, reflection-coded 3종 데이터셋을 논문용 CSV로 분리 export할 수 있습니다.
    </p>
  `;
}

function renderPatternSummary(enriched) {
  const avgTurns = average(enriched.map((row) => row.turnCount)).toFixed(1);
  const avgHints = average(enriched.map((row) => row.hintCount)).toFixed(1);
  const avgLen = Math.round(average(enriched.map((row) => row.avgUserLen)));
  const struggling = enriched.filter((row) => Number(row.score || 100) < 60 && row.turnCount > Number(avgTurns)).length;

  return `
    <div class="pattern-stats">
      <div class="pstat"><div class="pstat-value">${avgTurns}</div><div class="pstat-label">평균 턴 수</div></div>
      <div class="pstat"><div class="pstat-value">${avgHints}</div><div class="pstat-label">평균 힌트 수</div></div>
      <div class="pstat"><div class="pstat-value">${avgLen}자</div><div class="pstat-label">평균 발화 길이</div></div>
      <div class="pstat"><div class="pstat-value">${enriched.length}</div><div class="pstat-label">분석 표본 수</div></div>
      <div class="pstat pstat--danger"><div class="pstat-value">${struggling}명</div><div class="pstat-label">개입 권고</div></div>
    </div>
  `;
}

function buildTrajectoryData(rows) {
  const chapterMap = {};
  for (const row of rows) {
    const chapterId = normalizeChapter(row.chapter_id);
    if (!chapterId) continue;
    if (!chapterMap[chapterId]) {
      chapterMap[chapterId] = {
        chapterId,
        scores: [],
        hintDependency: [],
        reflectionQuality: [],
      };
    }
    chapterMap[chapterId].scores.push(Number(row.score || 0));
    chapterMap[chapterId].hintDependency.push(Number(row.hint_dependency_index || 0));
    chapterMap[chapterId].reflectionQuality.push(Number(row.reflection_quality_index || 0));
  }

  return Object.values(chapterMap)
    .sort((a, b) => a.chapterId.localeCompare(b.chapterId))
    .map((item) => ({
      chapterId: item.chapterId,
      score: round1(average(item.scores)),
      hintDependency: round1(average(item.hintDependency)),
      reflectionQuality: round1(average(item.reflectionQuality)),
      n: item.scores.length,
    }));
}

function renderTrajectory(rows, container) {
  if (!container) return;
  if (!rows.length) {
    container.innerHTML = '<p class="empty-msg">학습 궤적을 그릴 연구 데이터가 없습니다.</p>';
    return;
  }

  const width = 640;
  const height = 260;
  const pad = { top: 20, right: 20, bottom: 36, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxIndex = Math.max(rows.length - 1, 1);
  const y = (value) => pad.top + innerH - (value / 100) * innerH;
  const x = (index) => pad.left + (index / maxIndex) * innerW;
  const lineSet = [
    { key: 'score', color: '#2563eb', label: 'Score' },
    { key: 'hintDependency', color: '#ef4444', label: 'Hint Dependency' },
    { key: 'reflectionQuality', color: '#10b981', label: 'Reflection Quality' },
  ];

  const yLines = [0, 25, 50, 75, 100].map((value) => `
    <line x1="${pad.left}" y1="${y(value)}" x2="${pad.left + innerW}" y2="${y(value)}" stroke="#e5e7eb" stroke-width="1" />
    <text x="${pad.left - 6}" y="${y(value) + 4}" text-anchor="end" font-size="10" fill="#9ca3af">${value}</text>
  `).join('');
  const xLabels = rows.map((row, index) => `
    <text x="${x(index)}" y="${height - 10}" text-anchor="middle" font-size="10" fill="#6b7280">Ch.${escapeHtml(row.chapterId)}</text>
  `).join('');
  const paths = lineSet.map((line) => {
    const d = rows.map((row, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(row[line.key])}`).join(' ');
    return `<path d="${d}" fill="none" stroke="${line.color}" stroke-width="2.5" />`;
  }).join('');
  const points = lineSet.map((line) => rows.map((row, index) => `
    <circle cx="${x(index)}" cy="${y(row[line.key])}" r="3.5" fill="${line.color}" />
  `).join('')).join('');
  const legend = lineSet.map((line) => `
    <span class="ia-legend-item"><span class="ia-legend-dot" style="background:${line.color};"></span>${escapeHtml(line.label)}</span>
  `).join('');
  const chips = rows.map((row) => `<span class="ia-mini-chip">Ch.${escapeHtml(row.chapterId)} n=${row.n}</span>`).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="ia-svg-chart" aria-label="trajectory chart">
      ${yLines}
      ${paths}
      ${points}
      ${xLabels}
    </svg>
    <div class="ia-inline-legend">${legend}</div>
    <div class="ia-chip-row">${chips}</div>
  `;
}

function buildTransitionMatrix(rows) {
  const states = ['incorrect', 'partial', 'correct'];
  const matrix = Object.fromEntries(states.map((state) => [state, Object.fromEntries(states.map((target) => [target, 0]))]));
  const bySession = {};

  rows.forEach((row) => {
    const sessionId = String(row.session_id || '');
    if (!sessionId) return;
    if (!bySession[sessionId]) bySession[sessionId] = [];
    bySession[sessionId].push(row);
  });

  Object.values(bySession).forEach((sessionRows) => {
    sessionRows
      .sort((a, b) => Number(a.question_order || 0) - Number(b.question_order || 0))
      .forEach((row, index, ordered) => {
        const from = normalizeJudgment(row.judgment);
        const to = normalizeJudgment(ordered[index + 1]?.judgment);
        if (!from || !to) return;
        matrix[from][to] += 1;
      });
  });

  return { states, matrix };
}

function renderTransitionMatrix(data, container) {
  if (!container) return;
  const total = data.states.reduce((sum, from) => sum + data.states.reduce((inner, to) => inner + data.matrix[from][to], 0), 0);
  if (!total) {
    container.innerHTML = '<p class="empty-msg">전이 데이터가 부족합니다.</p>';
    return;
  }

  const maxValue = Math.max(...data.states.flatMap((from) => data.states.map((to) => data.matrix[from][to])));
  const headers = data.states.map((state) => `<th>${escapeHtml(state)}</th>`).join('');
  const rows = data.states.map((from) => {
    const cells = data.states.map((to) => {
      const value = data.matrix[from][to];
      const alpha = maxValue ? (0.12 + (value / maxValue) * 0.78).toFixed(2) : 0.12;
      const textColor = value / maxValue > 0.55 ? '#fff' : '#111';
      return `<td class="ia-transition-cell" style="background:rgba(37,99,235,${alpha});color:${textColor}">${value}</td>`;
    }).join('');
    return `<tr><th>${escapeHtml(from)}</th>${cells}</tr>`;
  }).join('');

  container.innerHTML = `
    <div class="heatmap-scroll">
      <table class="dash-table ia-transition-table">
        <thead><tr><th>From \\ To</th>${headers}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="ia-footnote">전체 전이 수: ${total}</p>
  `;
}

function buildDistributionData(rows) {
  const metrics = [
    { key: 'productive_struggle_index', label: 'Productive Struggle', color: '#2563eb' },
    { key: 'reflection_quality_index', label: 'Reflection Quality', color: '#10b981' },
    { key: 'score', label: 'Score', color: '#f59e0b' },
  ];

  return metrics.map((metric) => {
    const byChapter = {};
    rows.forEach((row) => {
      const chapterId = normalizeChapter(row.chapter_id);
      if (!chapterId) return;
      if (!byChapter[chapterId]) byChapter[chapterId] = [];
      byChapter[chapterId].push(Number(row[metric.key] || 0));
    });
    return {
      ...metric,
      chapters: Object.entries(byChapter)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([chapterId, values]) => ({
          chapterId,
          stats: computeBoxStats(values),
          n: values.length,
        })),
    };
  });
}

function renderDistribution(groups, container) {
  if (!container) return;
  const validGroups = groups.filter((group) => group.chapters.length > 0);
  if (!validGroups.length) {
    container.innerHTML = '<p class="empty-msg">분포 비교를 위한 연구 데이터가 없습니다.</p>';
    return;
  }

  container.innerHTML = validGroups.map((group) => `
    <div class="ia-dist-block">
      <div class="ia-dist-head">
        <h4>${escapeHtml(group.label)}</h4>
        <span class="ia-mini-chip">Chapter-level box plot</span>
      </div>
      ${renderBoxPlot(group)}
    </div>
  `).join('');
}

function renderBoxPlot(group) {
  const width = 620;
  const height = 190;
  const pad = { top: 14, right: 16, bottom: 34, left: 42 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxIndex = Math.max(group.chapters.length - 1, 1);
  const x = (index) => pad.left + (index / maxIndex) * innerW;
  const y = (value) => pad.top + innerH - (value / 100) * innerH;
  const boxWidth = Math.max(22, Math.min(44, innerW / Math.max(group.chapters.length, 1) / 1.8));

  const yLines = [0, 25, 50, 75, 100].map((value) => `
    <line x1="${pad.left}" y1="${y(value)}" x2="${pad.left + innerW}" y2="${y(value)}" stroke="#e5e7eb" stroke-width="1" />
    <text x="${pad.left - 6}" y="${y(value) + 4}" text-anchor="end" font-size="10" fill="#9ca3af">${value}</text>
  `).join('');
  const boxes = group.chapters.map((chapter, index) => {
    const center = x(index);
    const stats = chapter.stats;
    return `
      <line x1="${center}" y1="${y(stats.min)}" x2="${center}" y2="${y(stats.max)}" stroke="${group.color}" stroke-width="1.5" />
      <rect x="${center - boxWidth / 2}" y="${y(stats.q3)}" width="${boxWidth}" height="${Math.max(y(stats.q1) - y(stats.q3), 2)}" fill="${group.color}22" stroke="${group.color}" stroke-width="1.5" />
      <line x1="${center - boxWidth / 2}" y1="${y(stats.median)}" x2="${center + boxWidth / 2}" y2="${y(stats.median)}" stroke="${group.color}" stroke-width="2.5" />
      <line x1="${center - boxWidth / 3}" y1="${y(stats.min)}" x2="${center + boxWidth / 3}" y2="${y(stats.min)}" stroke="${group.color}" stroke-width="1.5" />
      <line x1="${center - boxWidth / 3}" y1="${y(stats.max)}" x2="${center + boxWidth / 3}" y2="${y(stats.max)}" stroke="${group.color}" stroke-width="1.5" />
      <text x="${center}" y="${height - 10}" text-anchor="middle" font-size="10" fill="#6b7280">Ch.${escapeHtml(chapter.chapterId)}</text>
    `;
  }).join('');
  const chips = group.chapters.map((chapter) => `<span class="ia-mini-chip">Ch.${escapeHtml(chapter.chapterId)} n=${chapter.n}</span>`).join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="ia-svg-chart" aria-label="${escapeHtml(group.label)} box plot">
      ${yLines}
      ${boxes}
    </svg>
    <div class="ia-chip-row">${chips}</div>
  `;
}

function buildConceptHeatmap(enriched) {
  const conceptMap = {};
  const chapters = new Set();

  enriched.forEach((row) => {
    const chapterId = String(row.chapter_id || row.chapterId || '?');
    chapters.add(chapterId);
    const weakConcepts = Array.isArray(row.weak_concepts)
      ? row.weak_concepts
      : Array.isArray(row.weakConcepts)
        ? row.weakConcepts
        : [];

    weakConcepts.forEach((concept) => {
      if (!conceptMap[concept]) conceptMap[concept] = {};
      conceptMap[concept][chapterId] = (conceptMap[concept][chapterId] || 0) + 1;
    });
  });

  const concepts = Object.entries(conceptMap)
    .map(([name, byChapter]) => ({
      name,
      byChapter,
      total: Object.values(byChapter).reduce((sum, value) => sum + value, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  return { concepts, chapters: [...chapters].sort() };
}

function renderHeatmap(data, container) {
  if (!container) return;
  if (!data.concepts.length) {
    container.innerHTML = '<p class="empty-msg">취약개념 데이터가 없습니다.</p>';
    return;
  }

  const maxValue = Math.max(...data.concepts.flatMap((item) => Object.values(item.byChapter)));
  const headers = data.chapters.map((chapterId) => `<th>Ch.${escapeHtml(chapterId)}</th>`).join('');
  const rows = data.concepts.map((item) => {
    const cells = data.chapters.map((chapterId) => {
      const value = item.byChapter[chapterId] || 0;
      if (!value) return '<td class="hm-cell hm-cell--zero"></td>';
      const alpha = (0.15 + (value / maxValue) * 0.75).toFixed(2);
      const textColor = value / maxValue > 0.5 ? '#fff' : '#111';
      return `<td class="hm-cell" style="background:rgba(239,68,68,${alpha});color:${textColor}">${value}</td>`;
    }).join('');
    return `<tr><td class="hm-concept-name">${escapeHtml(item.name)}</td>${cells}<td class="hm-total">${item.total}</td></tr>`;
  }).join('');

  container.innerHTML = `
    <div class="heatmap-scroll">
      <table class="dash-table heatmap-table">
        <thead><tr><th>개념</th>${headers}<th>합계</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderScatter(enriched, canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const pad = { top: 16, right: 16, bottom: 40, left: 46 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const maxTurns = Math.max(...enriched.map((row) => row.turnCount), 5);
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() || '#e5e7eb';
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i += 1) {
    const yPos = pad.top + (innerH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, yPos);
    ctx.lineTo(pad.left + innerW, yPos);
    ctx.stroke();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(100 - 25 * i), pad.left - 6, yPos + 4);
  }

  for (let i = 0; i <= 5; i += 1) {
    const xPos = pad.left + (innerW / 5) * i;
    ctx.beginPath();
    ctx.moveTo(xPos, pad.top);
    ctx.lineTo(xPos, pad.top + innerH);
    ctx.stroke();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round((maxTurns / 5) * i)), xPos, pad.top + innerH + 16);
  }

  ctx.fillStyle = '#6b7280';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('턴 수', pad.left + innerW / 2, height - 4);
  ctx.save();
  ctx.translate(12, pad.top + innerH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('점수', 0, 0);
  ctx.restore();

  enriched.forEach((row) => {
    const score = Number(row.score || 0);
    const xPos = pad.left + (row.turnCount / maxTurns) * innerW;
    const yPos = pad.top + innerH - (score / 100) * innerH;
    const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
    ctx.beginPath();
    ctx.arc(xPos, yPos, 5, 0, Math.PI * 2);
    ctx.fillStyle = `${color}bb`;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

function renderHintTable(enriched, tbody) {
  if (!tbody) return;
  const rows = [...enriched]
    .sort((a, b) => b.hintCount - a.hintCount || b.turnCount - a.turnCount)
    .slice(0, 20);

  if (!rows.length || rows[0].hintCount === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">힌트 의존 패턴이 관측되지 않았습니다.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((row, index) => {
    const score = row.score ?? null;
    const scoreClass = score != null ? scoreColor(score) : '';
    const chapterId = row.chapter_id || row.chapterId || '-';
    const level = row.hintCount > 5 ? 'high' : row.hintCount > 2 ? 'mid' : 'low';
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(row.student_id || row.studentId || '-')}</td>
        <td>${escapeHtml(row.student_name || row.studentName || '-')}</td>
        <td>Ch.${escapeHtml(chapterId)}</td>
        <td>${row.turnCount}</td>
        <td><span class="hint-badge hint-badge--${level}">${row.hintCount}</span></td>
        <td>${row.avgUserLen}자</td>
        <td class="${scoreClass}">${score != null ? `${score}점` : '-'}</td>
      </tr>
    `;
  }).join('');
}

function renderCorrelationMatrix(enriched, container) {
  if (!container) return;
  if (enriched.length < 3) {
    container.innerHTML = '<p class="empty-msg">상관관계 분석에는 최소 3건 이상의 데이터가 필요합니다.</p>';
    return;
  }

  const variables = [
    { label: '점수', values: enriched.map((row) => Number(row.score || 0)) },
    { label: '턴 수', values: enriched.map((row) => row.turnCount) },
    { label: '힌트 수', values: enriched.map((row) => row.hintCount) },
    { label: '평균 발화 길이', values: enriched.map((row) => row.avgUserLen) },
  ];

  const headers = variables.map((item) => `<th>${escapeHtml(item.label)}</th>`).join('');
  const rows = variables.map((rowVar, rowIndex) => `
    <tr>
      <th style="text-align:left;font-weight:600;">${escapeHtml(rowVar.label)}</th>
      ${variables.map((colVar, colIndex) => {
        if (rowIndex === colIndex) return '<td style="color:#9ca3af;">1.00</td>';
        const r = pearsonR(rowVar.values, colVar.values);
        const color = r > 0.3 ? '#059669' : r < -0.3 ? '#dc2626' : '#6b7280';
        return `<td style="color:${color};font-weight:${Math.abs(r) > 0.3 ? '700' : '400'};">${r.toFixed(2)}${Math.abs(r) > 0.3 ? ' *' : ''}</td>`;
      }).join('')}
    </tr>
  `).join('');

  container.innerHTML = `
    <div class="heatmap-scroll">
      <table class="dash-table ia-corr-table">
        <thead><tr><th></th>${headers}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="ia-footnote">* |r| &gt; 0.30을 강조 표시했습니다. n = ${enriched.length}</p>
    </div>
  `;
}

function renderHintEffectBar(enriched, container) {
  if (!container) return;

  const groups = [
    { label: '힌트 없음', sub: '(0회)', filter: (row) => row.hintCount === 0 },
    { label: '힌트 소수', sub: '(1~2회)', filter: (row) => row.hintCount >= 1 && row.hintCount <= 2 },
    { label: '힌트 다수', sub: '(3회 이상)', filter: (row) => row.hintCount >= 3 },
  ];

  const data = groups.map((group) => {
    const rows = enriched.filter(group.filter);
    return {
      ...group,
      n: rows.length,
      avgScore: rows.length ? average(rows.map((row) => Number(row.score || 0))) : null,
    };
  });

  const width = 320;
  const height = 200;
  const pad = { top: 24, right: 16, bottom: 56, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const barWidth = Math.floor((innerW / data.length) * 0.55);
  const gap = innerW / data.length;

  const yLines = [0, 25, 50, 75, 100].map((value) => {
    const yPos = pad.top + innerH - (value / 100) * innerH;
    return `
      <line x1="${pad.left}" y1="${yPos}" x2="${pad.left + innerW}" y2="${yPos}" stroke="#e5e7eb" stroke-width="1"/>
      <text x="${pad.left - 5}" y="${yPos + 4}" text-anchor="end" font-size="10" fill="#9ca3af">${value}</text>
    `;
  }).join('');

  const bars = data.map((item, index) => {
    const xPos = pad.left + gap * index + gap * 0.22;
    if (item.avgScore == null) {
      return `<text x="${xPos + barWidth / 2}" y="${pad.top + innerH / 2}" text-anchor="middle" font-size="10" fill="#9ca3af">데이터 없음</text>`;
    }
    const barHeight = Math.max((item.avgScore / 100) * innerH, 2);
    const yPos = pad.top + innerH - barHeight;
    const color = item.avgScore >= 80 ? '#10b981' : item.avgScore >= 60 ? '#f59e0b' : '#ef4444';
    return `
      <rect x="${xPos}" y="${yPos}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="3" />
      <text x="${xPos + barWidth / 2}" y="${yPos - 5}" text-anchor="middle" font-size="11" font-weight="600" fill="#374151">${item.avgScore.toFixed(1)}</text>
      <text x="${xPos + barWidth / 2}" y="${pad.top + innerH + 14}" text-anchor="middle" font-size="11" fill="#374151">${escapeHtml(item.label)}</text>
      <text x="${xPos + barWidth / 2}" y="${pad.top + innerH + 26}" text-anchor="middle" font-size="10" fill="#6b7280">${escapeHtml(item.sub)}</text>
      <text x="${xPos + barWidth / 2}" y="${pad.top + innerH + 40}" text-anchor="middle" font-size="9" fill="#9ca3af">n=${item.n}</text>
    `;
  }).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="ia-svg-chart" aria-label="hint effect chart">
      ${yLines}
      ${bars}
      <text x="${pad.left + innerW / 2}" y="${height - 4}" text-anchor="middle" font-size="10" fill="#9ca3af">힌트 사용 구간</text>
    </svg>
  `;
}

function buildClusters(enriched) {
  if (enriched.length < 3) return null;

  const points = enriched.map((row) => [row.turnCount, row.hintCount]);
  const labels = kmeans(points, 3);
  const stats = Array.from({ length: 3 }, (_, clusterIndex) => {
    const members = enriched.filter((_, index) => labels[index] === clusterIndex);
    if (!members.length) {
      return { clusterIndex, n: 0, avgTurn: 0, avgHint: 0, avgScore: 0 };
    }
    return {
      clusterIndex,
      n: members.length,
      avgTurn: average(members.map((row) => row.turnCount)),
      avgHint: average(members.map((row) => row.hintCount)),
      avgScore: average(members.map((row) => Number(row.score || 0))),
    };
  });

  const byHint = [...stats].sort((a, b) => b.avgHint - a.avgHint);
  const helpSeeking = byHint[0]?.clusterIndex;
  const rest = byHint.slice(1).sort((a, b) => b.avgTurn - a.avgTurn);
  const exploratory = rest[0]?.clusterIndex;
  const passive = [0, 1, 2].find((clusterIndex) => clusterIndex !== helpSeeking && clusterIndex !== exploratory);

  return {
    stats,
    meta: {
      [helpSeeking]: { name: '도움의존형', color: '#f59e0b', desc: '힌트 요청이 많고 추가 점검이 필요한 집단' },
      [exploratory]: { name: '탐색참여형', color: '#10b981', desc: '상대적으로 적극적으로 상호작용하는 집단' },
      [passive]: { name: '저활동형', color: '#ef4444', desc: '상호작용 빈도가 낮은 집단' },
    },
  };
}

function kmeans(points, k, maxIter = 50) {
  if (points.length <= k) return points.map((_, index) => index % k);

  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const rangeX = Math.max(...xs) - minX || 1;
  const rangeY = Math.max(...ys) - minY || 1;
  const normalized = points.map((point) => [(point[0] - minX) / rangeX, (point[1] - minY) / rangeY]);

  let centroids = normalized.slice(0, k).map((point) => [...point]);
  let labels = new Array(normalized.length).fill(0);

  for (let iter = 0; iter < maxIter; iter += 1) {
    const nextLabels = normalized.map((point) => {
      const distances = centroids.map((centroid) => (point[0] - centroid[0]) ** 2 + (point[1] - centroid[1]) ** 2);
      return distances.indexOf(Math.min(...distances));
    });
    if (nextLabels.every((label, index) => label === labels[index])) break;
    labels = nextLabels;
    centroids = Array.from({ length: k }, (_, clusterIndex) => {
      const members = normalized.filter((_, index) => labels[index] === clusterIndex);
      if (!members.length) return centroids[clusterIndex];
      return [
        average(members.map((point) => point[0])),
        average(members.map((point) => point[1])),
      ];
    });
  }

  return labels;
}

function renderClusterSummary(result, container) {
  if (!container) return;
  if (!result) {
    container.innerHTML = '<p class="empty-msg">군집 분석에는 최소 3건 이상의 데이터가 필요합니다.</p>';
    return;
  }

  const rows = result.stats
    .filter((row) => row.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((row) => {
      const meta = result.meta[row.clusterIndex] || { name: `Cluster ${row.clusterIndex}`, color: '#6b7280', desc: '' };
      return `
        <div class="ia-cluster-row">
          <div class="ia-cluster-name" style="color:${meta.color};">${escapeHtml(meta.name)}</div>
          <div class="ia-cluster-desc">${escapeHtml(meta.desc)}</div>
          <div class="ia-cluster-meta">
            <span>표본 ${row.n}명</span>
            <span>평균 턴 ${row.avgTurn.toFixed(1)}</span>
            <span>평균 힌트 ${row.avgHint.toFixed(1)}</span>
            <span>평균 점수 ${row.avgScore.toFixed(1)}</span>
          </div>
        </div>
      `;
    }).join('');

  container.innerHTML = `<div>${rows}</div>`;
}

function pearsonR(xs, ys) {
  const n = xs.length;
  if (n < 3) return 0;
  const meanX = average(xs);
  const meanY = average(ys);
  const num = xs.reduce((sum, x, index) => sum + (x - meanX) * (ys[index] - meanY), 0);
  const denX = Math.sqrt(xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0));
  const denY = Math.sqrt(ys.reduce((sum, y) => sum + (y - meanY) ** 2, 0));
  if (!denX || !denY) return 0;
  return num / (denX * denY);
}

function computeBoxStats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: sorted[0] ?? 0,
    q1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    max: sorted[sorted.length - 1] ?? 0,
  };
}

function quantile(sortedValues, q) {
  if (!sortedValues.length) return 0;
  const pos = (sortedValues.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sortedValues[base + 1] === undefined) return sortedValues[base];
  return sortedValues[base] + rest * (sortedValues[base + 1] - sortedValues[base]);
}

function normalizeJudgment(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'correct') return 'correct';
  if (text === 'partial') return 'partial';
  if (text === 'incorrect') return 'incorrect';
  return '';
}

function normalizeChapter(value) {
  const text = String(value || '').trim();
  return text ? text.padStart(2, '0') : '';
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function round1(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function formatMetric(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(1) : '0.0';
}

export function exportResearchCSV(rows, prefix = 'interaction_research') {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const headers = Object.keys(rows[0] || {});
  const matrix = rows.map((row) => headers.map((header) => row?.[header] ?? ''));
  const csv = [headers, ...matrix]
    .map((line) => line.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${prefix}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
