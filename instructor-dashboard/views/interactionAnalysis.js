import { escapeHtml, scoreColor } from '../utils/format.js';

const HINT_KEYWORDS = ['힌트', '모르겠', '알려줘', '어떻게', '무엇', '이해가'];

export function renderInteractionAnalysis(submissions, container, researchData = {}) {
  if (!container) return;

  if (!Array.isArray(submissions) || submissions.length === 0) {
    container.innerHTML = '<p class="empty-msg">분석할 데이터가 없습니다.</p>';
    return;
  }

  const enriched = submissions.map(enrichSubmission);
  const studentRows = Array.isArray(researchData?.studentChapterRows) ? researchData.studentChapterRows : [];
  const attemptRows = Array.isArray(researchData?.attemptRows) ? researchData.attemptRows : [];
  const reflectionRows = Array.isArray(researchData?.reflectionRows) ? researchData.reflectionRows : [];
  const researchSummary = researchData?.summary || {};

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
      <h3 class="chart-title">연구 요약 지표</h3>
      ${renderResearchSummary(researchSummary, studentRows, attemptRows, reflectionRows)}
    </div>

    <div class="ia-top-grid">
      <div class="ia-card">
        <h3 class="chart-title">상호작용 패턴 요약</h3>
        ${renderPatternSummary(enriched)}
      </div>
      <div class="ia-card ia-card--scatter">
        <h3 class="chart-title">턴 수와 점수 산점도</h3>
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
        <h3 class="chart-title">학습 궤적</h3>
        <div id="ia-trajectory"></div>
      </div>
      <div class="ia-card">
        <h3 class="chart-title">상태 전이 Heatmap</h3>
        <div id="ia-transition"></div>
      </div>
    </div>

    <div class="ia-card">
      <h3 class="chart-title">분포 기반 비교</h3>
      <div id="ia-distribution"></div>
    </div>

    <div class="ia-card ia-card--heatmap">
      <h3 class="chart-title">취약개념 히트맵</h3>
      <div id="ia-heatmap"></div>
    </div>

    <div class="ia-card">
      <h3 class="chart-title">힌트 의존 상위 학생</h3>
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
      <h3 class="chart-title">상관관계 행렬</h3>
      <div id="ia-corr"></div>
    </div>

    <div class="ia-top-grid ia-top-grid--balanced">
      <div class="ia-card">
        <h3 class="chart-title">힌트 사용 구간별 평균 점수</h3>
        <div id="ia-hint-bar" class="ia-chart-center"></div>
      </div>
      <div class="ia-card">
        <h3 class="chart-title">행동 군집 요약</h3>
        <div id="ia-cluster"></div>
      </div>
    </div>
  `;

  renderScatter(enriched, container.querySelector('#ia-scatter'));
  renderTrajectory(buildTrajectoryData(studentRows), container.querySelector('#ia-trajectory'));
  renderTransitionMatrix(buildTransitionMatrix(attemptRows), container.querySelector('#ia-transition'));
  renderDistribution(buildDistributionData(studentRows), container.querySelector('#ia-distribution'));
  renderHeatmap(buildConceptHeatmap(enriched), container.querySelector('#ia-heatmap'));
  renderHintTable(enriched, container.querySelector('#ia-hint-tbody'));
  renderCorrelationMatrix(enriched, container.querySelector('#ia-corr'));
  renderHintEffectBar(enriched, container.querySelector('#ia-hint-bar'));
  renderClusterSummary(buildClusters(enriched), container.querySelector('#ia-cluster'));

  container.querySelector('#ia-export-student')?.addEventListener('click', () => exportResearchCSV(studentRows, 'student_chapter_research'));
  container.querySelector('#ia-export-attempt')?.addEventListener('click', () => exportResearchCSV(attemptRows, 'attempt_level_research'));
  container.querySelector('#ia-export-reflection')?.addEventListener('click', () => exportResearchCSV(reflectionRows, 'reflection_coded_research'));
}

function enrichSubmission(submission) {
  const messages = Array.isArray(submission?.messages) ? submission.messages.filter((m) => m?.role !== 'system') : [];
  const userMessages = messages.filter((m) => m?.role === 'user');
  const metrics = submission?.chat_metrics || {};
  const inferredHintCount = userMessages.reduce((acc, m) => acc + HINT_KEYWORDS.filter((kw) => String(m?.content || '').includes(kw)).length, 0);
  const totalLen = userMessages.reduce((sum, m) => sum + String(m?.content || '').length, 0);
  return {
    ...submission,
    turnCount: Number(metrics.user_message_count || userMessages.length || 0),
    hintCount: Number(metrics.hint_request_count ?? inferredHintCount),
    avgUserLen: Number(metrics.average_user_message_length ?? (userMessages.length ? Math.round(totalLen / userMessages.length) : 0)),
  };
}

function renderResearchSummary(summary, studentRows, attemptRows, reflectionRows) {
  const cards = [
    ['Student-chapter N', studentRows.length],
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
      ${cards.map(([label, value]) => `<div class="pstat"><div class="pstat-value">${escapeHtml(String(value))}</div><div class="pstat-label">${escapeHtml(label)}</div></div>`).join('')}
    </div>
    <p class="ia-footnote">논문용 CSV 3종을 현재 화면에서 바로 내보낼 수 있습니다.</p>
  `;
}

function renderPatternSummary(rows) {
  const avgTurns = average(rows.map((r) => r.turnCount)).toFixed(1);
  const avgHints = average(rows.map((r) => r.hintCount)).toFixed(1);
  const avgLen = Math.round(average(rows.map((r) => r.avgUserLen)));
  const struggling = rows.filter((r) => Number(r.score || 100) < 60 && r.turnCount > Number(avgTurns)).length;
  return `
    <div class="pattern-stats">
      <div class="pstat"><div class="pstat-value">${avgTurns}</div><div class="pstat-label">평균 턴 수</div></div>
      <div class="pstat"><div class="pstat-value">${avgHints}</div><div class="pstat-label">평균 힌트 수</div></div>
      <div class="pstat"><div class="pstat-value">${avgLen}자</div><div class="pstat-label">평균 발화 길이</div></div>
      <div class="pstat"><div class="pstat-value">${rows.length}</div><div class="pstat-label">분석 표본 수</div></div>
      <div class="pstat pstat--danger"><div class="pstat-value">${struggling}명</div><div class="pstat-label">개입 권고</div></div>
    </div>
  `;
}

function buildTrajectoryData(rows) {
  const map = {};
  rows.forEach((row) => {
    const chapterId = normalizeChapter(row.chapter_id);
    if (!chapterId) return;
    if (!map[chapterId]) map[chapterId] = { chapterId, score: [], hint: [], reflection: [] };
    map[chapterId].score.push(Number(row.score || 0));
    map[chapterId].hint.push(Number(row.hint_dependency_index || 0));
    map[chapterId].reflection.push(Number(row.reflection_quality_index || 0));
  });
  return Object.values(map).sort((a, b) => a.chapterId.localeCompare(b.chapterId)).map((row) => ({
    chapterId: row.chapterId,
    score: round1(average(row.score)),
    hint: round1(average(row.hint)),
    reflection: round1(average(row.reflection)),
    n: row.score.length,
  }));
}

function renderTrajectory(rows, container) {
  if (!container) return;
  if (!rows.length) {
    container.innerHTML = '<p class="empty-msg">학습 궤적 데이터가 없습니다.</p>';
    return;
  }
  const width = 640;
  const height = 250;
  const pad = { top: 18, right: 16, bottom: 34, left: 42 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxIndex = Math.max(rows.length - 1, 1);
  const x = (i) => pad.left + (i / maxIndex) * innerW;
  const y = (v) => pad.top + innerH - (v / 100) * innerH;
  const series = [
    { key: 'score', color: '#2563eb', label: 'Score' },
    { key: 'hint', color: '#ef4444', label: 'Hint Dependency' },
    { key: 'reflection', color: '#10b981', label: 'Reflection Quality' },
  ];
  const grid = [0, 25, 50, 75, 100].map((v) => `<line x1="${pad.left}" y1="${y(v)}" x2="${pad.left + innerW}" y2="${y(v)}" stroke="#e5e7eb" stroke-width="1" />`).join('');
  const paths = series.map((s) => `<path d="${rows.map((row, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(row[s.key])}`).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.5" />`).join('');
  const dots = series.map((s) => rows.map((row, i) => `<circle cx="${x(i)}" cy="${y(row[s.key])}" r="3.5" fill="${s.color}" />`).join('')).join('');
  const labels = rows.map((row, i) => `<text x="${x(i)}" y="${height - 10}" text-anchor="middle" font-size="10" fill="#6b7280">Ch.${escapeHtml(row.chapterId)}</text>`).join('');
  const legend = series.map((s) => `<span class="ia-legend-item"><span class="ia-legend-dot" style="background:${s.color};"></span>${escapeHtml(s.label)}</span>`).join('');
  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" class="ia-svg-chart">${grid}${paths}${dots}${labels}</svg><div class="ia-inline-legend">${legend}</div><div class="ia-chip-row">${rows.map((row) => `<span class="ia-mini-chip">Ch.${escapeHtml(row.chapterId)} n=${row.n}</span>`).join('')}</div>`;
}

function buildTransitionMatrix(rows) {
  const states = ['incorrect', 'partial', 'correct'];
  const matrix = Object.fromEntries(states.map((from) => [from, Object.fromEntries(states.map((to) => [to, 0]))]));
  const bySession = {};
  rows.forEach((row) => {
    const sessionId = String(row.session_id || '');
    if (!sessionId) return;
    if (!bySession[sessionId]) bySession[sessionId] = [];
    bySession[sessionId].push(row);
  });
  Object.values(bySession).forEach((sessionRows) => {
    sessionRows.sort((a, b) => Number(a.question_order || 0) - Number(b.question_order || 0));
    sessionRows.forEach((row, idx) => {
      const from = normalizeJudgment(row.judgment);
      const to = normalizeJudgment(sessionRows[idx + 1]?.judgment);
      if (from && to) matrix[from][to] += 1;
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
  container.innerHTML = `<div class="heatmap-scroll"><table class="dash-table ia-transition-table"><thead><tr><th>From \\ To</th>${data.states.map((s) => `<th>${escapeHtml(s)}</th>`).join('')}</tr></thead><tbody>${data.states.map((from) => `<tr><th>${escapeHtml(from)}</th>${data.states.map((to) => { const value = data.matrix[from][to]; const alpha = maxValue ? (0.12 + (value / maxValue) * 0.78).toFixed(2) : 0.12; const color = value / maxValue > 0.55 ? '#fff' : '#111'; return `<td class="ia-transition-cell" style="background:rgba(37,99,235,${alpha});color:${color}">${value}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div><p class="ia-footnote">전체 전이 수: ${total}</p>`;
}

function buildDistributionData(rows) {
  return [
    { key: 'productive_struggle_index', label: 'Productive Struggle', color: '#2563eb' },
    { key: 'reflection_quality_index', label: 'Reflection Quality', color: '#10b981' },
    { key: 'score', label: 'Score', color: '#f59e0b' },
  ].map((metric) => {
    const byChapter = {};
    rows.forEach((row) => {
      const chapterId = normalizeChapter(row.chapter_id);
      if (!chapterId) return;
      if (!byChapter[chapterId]) byChapter[chapterId] = [];
      byChapter[chapterId].push(Number(row[metric.key] || 0));
    });
    return {
      ...metric,
      chapters: Object.entries(byChapter).sort(([a], [b]) => a.localeCompare(b)).map(([chapterId, values]) => ({ chapterId, stats: computeBoxStats(values), n: values.length })),
    };
  });
}

function renderDistribution(groups, container) {
  if (!container) return;
  const valid = groups.filter((g) => g.chapters.length > 0);
  if (!valid.length) {
    container.innerHTML = '<p class="empty-msg">분포 비교 데이터가 없습니다.</p>';
    return;
  }
  container.innerHTML = valid.map((group) => `<div class="ia-dist-block"><div class="ia-dist-head"><h4>${escapeHtml(group.label)}</h4><span class="ia-mini-chip">Chapter-level box plot</span></div>${renderBoxPlot(group)}</div>`).join('');
}

function renderBoxPlot(group) {
  const width = 620;
  const height = 190;
  const pad = { top: 14, right: 16, bottom: 34, left: 42 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxIndex = Math.max(group.chapters.length - 1, 1);
  const x = (i) => pad.left + (i / maxIndex) * innerW;
  const y = (v) => pad.top + innerH - (v / 100) * innerH;
  const boxWidth = Math.max(22, Math.min(44, innerW / Math.max(group.chapters.length, 1) / 1.8));
  const grid = [0, 25, 50, 75, 100].map((v) => `<line x1="${pad.left}" y1="${y(v)}" x2="${pad.left + innerW}" y2="${y(v)}" stroke="#e5e7eb" stroke-width="1" />`).join('');
  const boxes = group.chapters.map((chapter, i) => {
    const c = x(i);
    const s = chapter.stats;
    return `<line x1="${c}" y1="${y(s.min)}" x2="${c}" y2="${y(s.max)}" stroke="${group.color}" stroke-width="1.5" />
    <rect x="${c - boxWidth / 2}" y="${y(s.q3)}" width="${boxWidth}" height="${Math.max(y(s.q1) - y(s.q3), 2)}" fill="${group.color}22" stroke="${group.color}" stroke-width="1.5" />
    <line x1="${c - boxWidth / 2}" y1="${y(s.median)}" x2="${c + boxWidth / 2}" y2="${y(s.median)}" stroke="${group.color}" stroke-width="2.5" />
    <line x1="${c - boxWidth / 3}" y1="${y(s.min)}" x2="${c + boxWidth / 3}" y2="${y(s.min)}" stroke="${group.color}" stroke-width="1.5" />
    <line x1="${c - boxWidth / 3}" y1="${y(s.max)}" x2="${c + boxWidth / 3}" y2="${y(s.max)}" stroke="${group.color}" stroke-width="1.5" />
    <text x="${c}" y="${height - 10}" text-anchor="middle" font-size="10" fill="#6b7280">Ch.${escapeHtml(chapter.chapterId)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" class="ia-svg-chart">${grid}${boxes}</svg><div class="ia-chip-row">${group.chapters.map((chapter) => `<span class="ia-mini-chip">Ch.${escapeHtml(chapter.chapterId)} n=${chapter.n}</span>`).join('')}</div>`;
}

function buildConceptHeatmap(rows) {
  const conceptMap = {};
  const chapters = new Set();
  rows.forEach((row) => {
    const chapterId = String(row.chapter_id || row.chapterId || '?');
    chapters.add(chapterId);
    const weakConcepts = Array.isArray(row.weak_concepts) ? row.weak_concepts : Array.isArray(row.weakConcepts) ? row.weakConcepts : [];
    weakConcepts.forEach((concept) => {
      if (!conceptMap[concept]) conceptMap[concept] = {};
      conceptMap[concept][chapterId] = (conceptMap[concept][chapterId] || 0) + 1;
    });
  });
  const concepts = Object.entries(conceptMap).map(([name, byChapter]) => ({ name, byChapter, total: Object.values(byChapter).reduce((sum, value) => sum + value, 0) })).sort((a, b) => b.total - a.total).slice(0, 15);
  return { concepts, chapters: [...chapters].sort() };
}

function renderHeatmap(data, container) {
  if (!container) return;
  if (!data.concepts.length) {
    container.innerHTML = '<p class="empty-msg">취약개념 데이터가 없습니다.</p>';
    return;
  }
  const maxValue = Math.max(...data.concepts.flatMap((item) => Object.values(item.byChapter)));
  container.innerHTML = `<div class="heatmap-scroll"><table class="dash-table heatmap-table"><thead><tr><th>개념</th>${data.chapters.map((chapterId) => `<th>Ch.${escapeHtml(chapterId)}</th>`).join('')}<th>합계</th></tr></thead><tbody>${data.concepts.map((item) => `<tr><td class="hm-concept-name">${escapeHtml(item.name)}</td>${data.chapters.map((chapterId) => { const value = item.byChapter[chapterId] || 0; if (!value) return '<td class="hm-cell hm-cell--zero"></td>'; const alpha = (0.15 + (value / maxValue) * 0.75).toFixed(2); const color = value / maxValue > 0.5 ? '#fff' : '#111'; return `<td class="hm-cell" style="background:rgba(239,68,68,${alpha});color:${color}">${value}</td>`; }).join('')}<td class="hm-total">${item.total}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderScatter(rows, canvas) {
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
  const maxTurns = Math.max(...rows.map((row) => row.turnCount), 5);
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() || '#e5e7eb';
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (innerH / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + innerW, y); ctx.stroke();
  }
  rows.forEach((row) => {
    const score = Number(row.score || 0);
    const x = pad.left + (row.turnCount / maxTurns) * innerW;
    const y = pad.top + innerH - (score / 100) * innerH;
    const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = `${color}bb`;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.stroke();
  });
}

function renderHintTable(rows, tbody) {
  if (!tbody) return;
  const top = [...rows].sort((a, b) => b.hintCount - a.hintCount || b.turnCount - a.turnCount).slice(0, 20);
  if (!top.length || top[0].hintCount === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">힌트 의존 패턴이 관측되지 않았습니다.</td></tr>';
    return;
  }
  tbody.innerHTML = top.map((row, idx) => {
    const score = row.score ?? null;
    const scoreClass = score != null ? scoreColor(score) : '';
    const level = row.hintCount > 5 ? 'high' : row.hintCount > 2 ? 'mid' : 'low';
    return `<tr><td>${idx + 1}</td><td>${escapeHtml(row.student_id || row.studentId || '-')}</td><td>${escapeHtml(row.student_name || row.studentName || '-')}</td><td>Ch.${escapeHtml(row.chapter_id || row.chapterId || '-')}</td><td>${row.turnCount}</td><td><span class="hint-badge hint-badge--${level}">${row.hintCount}</span></td><td>${row.avgUserLen}자</td><td class="${scoreClass}">${score != null ? `${score}점` : '-'}</td></tr>`;
  }).join('');
}

function renderCorrelationMatrix(rows, container) {
  if (!container) return;
  if (rows.length < 3) {
    container.innerHTML = '<p class="empty-msg">상관관계 분석에는 최소 3건 이상의 데이터가 필요합니다.</p>';
    return;
  }
  const variables = [
    { label: '점수', values: rows.map((row) => Number(row.score || 0)) },
    { label: '턴 수', values: rows.map((row) => row.turnCount) },
    { label: '힌트 수', values: rows.map((row) => row.hintCount) },
    { label: '평균 발화 길이', values: rows.map((row) => row.avgUserLen) },
  ];
  container.innerHTML = `<div class="heatmap-scroll"><table class="dash-table ia-corr-table"><thead><tr><th></th>${variables.map((item) => `<th>${escapeHtml(item.label)}</th>`).join('')}</tr></thead><tbody>${variables.map((rowVar, rowIdx) => `<tr><th style="text-align:left;font-weight:600;">${escapeHtml(rowVar.label)}</th>${variables.map((colVar, colIdx) => { if (rowIdx === colIdx) return '<td style="color:#9ca3af;">1.00</td>'; const r = pearsonR(rowVar.values, colVar.values); const color = r > 0.3 ? '#059669' : r < -0.3 ? '#dc2626' : '#6b7280'; return `<td style="color:${color};font-weight:${Math.abs(r) > 0.3 ? '700' : '400'};">${r.toFixed(2)}${Math.abs(r) > 0.3 ? ' *' : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table><p class="ia-footnote">* |r| &gt; 0.30을 강조 표시했습니다. n = ${rows.length}</p></div>`;
}

function renderHintEffectBar(rows, container) {
  if (!container) return;
  const groups = [
    { label: '힌트 없음', sub: '(0회)', filter: (row) => row.hintCount === 0 },
    { label: '힌트 소수', sub: '(1~2회)', filter: (row) => row.hintCount >= 1 && row.hintCount <= 2 },
    { label: '힌트 다수', sub: '(3회 이상)', filter: (row) => row.hintCount >= 3 },
  ];
  const data = groups.map((group) => {
    const matched = rows.filter(group.filter);
    return { ...group, n: matched.length, avgScore: matched.length ? average(matched.map((row) => Number(row.score || 0))) : null };
  });
  const width = 320;
  const height = 200;
  const pad = { top: 24, right: 16, bottom: 56, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const barWidth = Math.floor((innerW / data.length) * 0.55);
  const gap = innerW / data.length;
  const bars = data.map((item, idx) => {
    const x = pad.left + gap * idx + gap * 0.22;
    if (item.avgScore == null) return `<text x="${x + barWidth / 2}" y="${pad.top + innerH / 2}" text-anchor="middle" font-size="10" fill="#9ca3af">데이터 없음</text>`;
    const h = Math.max((item.avgScore / 100) * innerH, 2);
    const y = pad.top + innerH - h;
    const color = item.avgScore >= 80 ? '#10b981' : item.avgScore >= 60 ? '#f59e0b' : '#ef4444';
    return `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" fill="${color}" rx="3" /><text x="${x + barWidth / 2}" y="${y - 5}" text-anchor="middle" font-size="11" font-weight="600" fill="#374151">${item.avgScore.toFixed(1)}</text><text x="${x + barWidth / 2}" y="${pad.top + innerH + 14}" text-anchor="middle" font-size="11" fill="#374151">${escapeHtml(item.label)}</text><text x="${x + barWidth / 2}" y="${pad.top + innerH + 26}" text-anchor="middle" font-size="10" fill="#6b7280">${escapeHtml(item.sub)}</text><text x="${x + barWidth / 2}" y="${pad.top + innerH + 40}" text-anchor="middle" font-size="9" fill="#9ca3af">n=${item.n}</text>`;
  }).join('');
  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" class="ia-svg-chart">${bars}</svg>`;
}

function buildClusters(rows) {
  if (rows.length < 3) return null;
  const points = rows.map((row) => [row.turnCount, row.hintCount]);
  const labels = kmeans(points, 3);
  const stats = Array.from({ length: 3 }, (_, clusterIndex) => {
    const members = rows.filter((_, idx) => labels[idx] === clusterIndex);
    if (!members.length) return { clusterIndex, n: 0, avgTurn: 0, avgHint: 0, avgScore: 0 };
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
  const passive = [0, 1, 2].find((idx) => idx !== helpSeeking && idx !== exploratory);
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
  if (points.length <= k) return points.map((_, idx) => idx % k);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const rangeX = Math.max(...xs) - minX || 1;
  const rangeY = Math.max(...ys) - minY || 1;
  const normalized = points.map((p) => [(p[0] - minX) / rangeX, (p[1] - minY) / rangeY]);
  let centroids = normalized.slice(0, k).map((p) => [...p]);
  let labels = new Array(normalized.length).fill(0);
  for (let iter = 0; iter < maxIter; iter += 1) {
    const nextLabels = normalized.map((point) => {
      const distances = centroids.map((centroid) => (point[0] - centroid[0]) ** 2 + (point[1] - centroid[1]) ** 2);
      return distances.indexOf(Math.min(...distances));
    });
    if (nextLabels.every((label, idx) => label === labels[idx])) break;
    labels = nextLabels;
    centroids = Array.from({ length: k }, (_, clusterIndex) => {
      const members = normalized.filter((_, idx) => labels[idx] === clusterIndex);
      if (!members.length) return centroids[clusterIndex];
      return [average(members.map((point) => point[0])), average(members.map((point) => point[1]))];
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
  container.innerHTML = result.stats.filter((row) => row.n > 0).sort((a, b) => b.n - a.n).map((row) => {
    const meta = result.meta[row.clusterIndex] || { name: `Cluster ${row.clusterIndex}`, color: '#6b7280', desc: '' };
    return `<div class="ia-cluster-row"><div class="ia-cluster-name" style="color:${meta.color};">${escapeHtml(meta.name)}</div><div class="ia-cluster-desc">${escapeHtml(meta.desc)}</div><div class="ia-cluster-meta"><span>표본 ${row.n}명</span><span>평균 턴 ${row.avgTurn.toFixed(1)}</span><span>평균 힌트 ${row.avgHint.toFixed(1)}</span><span>평균 점수 ${row.avgScore.toFixed(1)}</span></div></div>`;
  }).join('');
}

function pearsonR(xs, ys) {
  const n = xs.length;
  if (n < 3) return 0;
  const meanX = average(xs);
  const meanY = average(ys);
  const num = xs.reduce((sum, x, idx) => sum + (x - meanX) * (ys[idx] - meanY), 0);
  const denX = Math.sqrt(xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0));
  const denY = Math.sqrt(ys.reduce((sum, y) => sum + (y - meanY) ** 2, 0));
  if (!denX || !denY) return 0;
  return num / (denX * denY);
}

function computeBoxStats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return { min: sorted[0] ?? 0, q1: quantile(sorted, 0.25), median: quantile(sorted, 0.5), q3: quantile(sorted, 0.75), max: sorted[sorted.length - 1] ?? 0 };
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
  const csv = [headers, ...matrix].map((line) => line.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
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
