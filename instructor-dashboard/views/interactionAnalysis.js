import { escapeHtml, scoreColor } from '../utils/format.js';

const HINT_KEYWORDS = ['hint', 'help', 'explain', 'why', 'how', 'more', 'again'];

export function renderInteractionAnalysis(submissions, container, researchData = {}) {
  if (!container) return;

  if (!Array.isArray(submissions) || submissions.length === 0) {
    container.innerHTML = '<p class="empty-msg">No interaction data is available.</p>';
    return;
  }

  const enriched = submissions.map(enrichSubmission);
  const studentRows = Array.isArray(researchData?.studentChapterRows) ? researchData.studentChapterRows : [];
  const attemptRows = Array.isArray(researchData?.attemptRows) ? researchData.attemptRows : [];
  const reflectionRows = Array.isArray(researchData?.reflectionRows) ? researchData.reflectionRows : [];
  const summary = normalizeResearchSummary(researchData?.summary || {});
  const warning = researchData?.warning
    ? `<p class="ia-footnote">${escapeHtml(researchData.warning)}</p>`
    : '';

  container.innerHTML = `
    <div class="ia-header-row">
      <h2 class="section-title" style="margin:0;">Interaction Analysis</h2>
      <div class="ia-export-actions">
        <button id="ia-export-student" class="ia-export-btn ia-export-btn--teal" type="button">Student-Chapter CSV</button>
        <button id="ia-export-attempt" class="ia-export-btn ia-export-btn--blue" type="button">Attempt-Level CSV</button>
        <button id="ia-export-reflection" class="ia-export-btn ia-export-btn--violet" type="button">Reflection-Coded CSV</button>
      </div>
    </div>

    <div class="ia-card">
      <h3 class="chart-title">Research Summary</h3>
      ${renderResearchSummary(summary, studentRows, attemptRows, reflectionRows)}
      ${warning}
    </div>

    <div class="ia-top-grid">
      <div class="ia-card">
        <h3 class="chart-title">Interaction Patterns</h3>
        ${renderPatternSummary(enriched)}
      </div>
      <div class="ia-card ia-card--scatter">
        <h3 class="chart-title">Turns vs Score</h3>
        <canvas id="ia-scatter" width="460" height="280"></canvas>
        <div class="scatter-legend">
          <span class="sleg sleg--bad">Below 60</span>
          <span class="sleg sleg--warn">60 to 79</span>
          <span class="sleg sleg--good">80 and above</span>
        </div>
      </div>
    </div>

    <div class="ia-top-grid ia-top-grid--balanced">
      <div class="ia-card">
        <h3 class="chart-title">Learning Trajectory</h3>
        <div id="ia-trajectory"></div>
      </div>
      <div class="ia-card">
        <h3 class="chart-title">State Transition Heatmap</h3>
        <div id="ia-transition"></div>
      </div>
    </div>

    <div class="ia-card">
      <h3 class="chart-title">Distribution Comparison</h3>
      <div id="ia-distribution"></div>
    </div>

    <div class="ia-card ia-card--heatmap">
      <h3 class="chart-title">Weak Concept Heatmap</h3>
      <div id="ia-heatmap"></div>
    </div>

    <div class="ia-card">
      <h3 class="chart-title">Top Hint-Dependent Students</h3>
      <table class="dash-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Student ID</th>
            <th>Name</th>
            <th>Chapter</th>
            <th>Turns</th>
            <th>Hints</th>
            <th>Avg Length</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody id="ia-hint-tbody"></tbody>
      </table>
    </div>

    <div class="ia-card">
      <h3 class="chart-title">Correlation Matrix</h3>
      <div id="ia-corr"></div>
    </div>

    <div class="ia-top-grid ia-top-grid--balanced">
      <div class="ia-card">
        <h3 class="chart-title">Average Score by Hint Band</h3>
        <div id="ia-hint-bar" class="ia-chart-center"></div>
      </div>
      <div class="ia-card">
        <h3 class="chart-title">Cluster Summary</h3>
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

  bindExportButton(container.querySelector('#ia-export-student'), studentRows, 'student_chapter_research');
  bindExportButton(container.querySelector('#ia-export-attempt'), attemptRows, 'attempt_level_research');
  bindExportButton(container.querySelector('#ia-export-reflection'), reflectionRows, 'reflection_coded_research');
}

function bindExportButton(button, rows, prefix) {
  if (!button) return;
  button.disabled = !Array.isArray(rows) || rows.length === 0;
  button.addEventListener('click', () => exportResearchCSV(rows, prefix));
}

function enrichSubmission(submission) {
  const messages = Array.isArray(submission?.messages) ? submission.messages : [];
  const userMessages = messages.filter((item) => String(item?.role || '').toLowerCase() === 'user');
  const hintCount = userMessages.filter((item) => containsHintKeyword(item?.content)).length;
  const avgUserLen = average(userMessages.map((item) => String(item?.content || '').trim().length));
  const concepts = Array.isArray(submission?.weakConcepts)
    ? submission.weakConcepts
    : Array.isArray(submission?.weak_concepts)
      ? submission.weak_concepts
      : [];

  return {
    ...submission,
    studentId: String(submission?.student_id || submission?.studentId || ''),
    studentName: String(submission?.student_name || submission?.studentName || ''),
    chapterId: String(submission?.chapter_id || submission?.chapterId || ''),
    score: Number(submission?.score || 0),
    turnCount: messages.length,
    hintCount,
    avgUserLen,
    weakConcepts: concepts.filter(Boolean),
  };
}

function containsHintKeyword(content) {
  const text = String(content || '').toLowerCase();
  return HINT_KEYWORDS.some((keyword) => text.includes(keyword));
}

function renderResearchSummary(summary, studentRows, attemptRows, reflectionRows) {
  const cards = [
    { label: 'Student-Chapter Rows', value: summary.studentChapterCount ?? studentRows.length ?? 0 },
    { label: 'Attempt Rows', value: summary.attemptCount ?? attemptRows.length ?? 0 },
    { label: 'Reflection Rows', value: summary.reflectionCount ?? reflectionRows.length ?? 0 },
    { label: 'Avg Productive Struggle', value: formatMetric(summary.avgProductiveStruggle) },
    { label: 'Avg Hint Dependency', value: formatMetric(summary.avgHintDependency) },
    { label: 'Avg Reflection Quality', value: formatMetric(summary.avgReflectionQuality) },
  ];

  return `
    <div class="ia-stat-grid">
      ${cards
        .map(
          (card) => `
            <div class="ia-mini-stat">
              <span class="ia-mini-stat__label">${escapeHtml(card.label)}</span>
              <strong class="ia-mini-stat__value">${escapeHtml(String(card.value))}</strong>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderPatternSummary(rows) {
  const submitted = rows.length;
  const avgTurns = average(rows.map((row) => row.turnCount));
  const avgHints = average(rows.map((row) => row.hintCount));
  const avgLen = average(rows.map((row) => row.avgUserLen));
  const avgScore = average(rows.map((row) => row.score));

  const strongest = [...rows]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((row) => `${row.studentName || row.studentId} (Ch.${row.chapterId}, ${row.score})`);

  return `
    <div class="ia-pattern-grid">
      <div class="ia-pattern-card"><span>Total submissions</span><strong>${submitted}</strong></div>
      <div class="ia-pattern-card"><span>Avg turns</span><strong>${formatMetric(avgTurns)}</strong></div>
      <div class="ia-pattern-card"><span>Avg hints</span><strong>${formatMetric(avgHints)}</strong></div>
      <div class="ia-pattern-card"><span>Avg user length</span><strong>${formatMetric(avgLen)}</strong></div>
      <div class="ia-pattern-card"><span>Avg score</span><strong>${formatMetric(avgScore)}</strong></div>
      <div class="ia-pattern-card ia-pattern-card--wide"><span>Top performers</span><strong>${escapeHtml(strongest.join(', ') || 'N/A')}</strong></div>
    </div>
  `;
}

function buildTrajectoryData(studentRows) {
  if (!studentRows.length) return [];
  const byChapter = new Map();
  studentRows.forEach((row) => {
    const chapterId = normalizeChapter(row.chapter_id || row.chapterId);
    if (!chapterId) return;
    if (!byChapter.has(chapterId)) {
      byChapter.set(chapterId, { chapterId, score: [], hint: [], reflection: [] });
    }
    const bucket = byChapter.get(chapterId);
    bucket.score.push(Number(row.score || 0));
    bucket.hint.push(Number(row.hint_dependency_index || row.hintDependencyIndex || 0));
    bucket.reflection.push(Number(row.reflection_quality_index || row.reflectionQualityIndex || 0));
  });

  return [...byChapter.values()]
    .sort((a, b) => a.chapterId.localeCompare(b.chapterId, undefined, { numeric: true }))
    .map((row) => ({
      chapterId: row.chapterId,
      score: average(row.score),
      hint: average(row.hint),
      reflection: average(row.reflection),
    }));
}

function renderTrajectory(rows, container) {
  if (!container) return;
  if (!rows.length) {
    container.innerHTML = '<p class="empty-msg">No trajectory data.</p>';
    return;
  }

  const width = 680;
  const height = 260;
  const padding = { top: 20, right: 18, bottom: 30, left: 38 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const maxY = Math.max(100, ...rows.flatMap((row) => [row.score, row.hint * 100, row.reflection * 100]));
  const xStep = rows.length > 1 ? innerWidth / (rows.length - 1) : innerWidth / 2;
  const yFor = (value) => padding.top + innerHeight - (Number(value || 0) / maxY) * innerHeight;

  const buildPath = (field, scale = 1) =>
    rows
      .map((row, index) => `${index === 0 ? 'M' : 'L'} ${padding.left + index * xStep} ${yFor(row[field] * scale)}`)
      .join(' ');

  const xLabels = rows
    .map(
      (row, index) =>
        `<text x="${padding.left + index * xStep}" y="${height - 8}" text-anchor="middle" class="ia-axis-label">Ch.${escapeHtml(row.chapterId)}</text>`,
    )
    .join('');

  const yTicks = [0, 25, 50, 75, 100]
    .map((tick) => {
      const y = yFor(tick);
      return `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="ia-grid-line"></line>
        <text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" class="ia-axis-label">${tick}</text>
      `;
    })
    .join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="ia-svg ia-svg--trajectory" role="img" aria-label="Learning trajectory">
      ${yTicks}
      <path d="${buildPath('score')}" class="ia-line ia-line--score"></path>
      <path d="${buildPath('hint', 100)}" class="ia-line ia-line--hint"></path>
      <path d="${buildPath('reflection', 100)}" class="ia-line ia-line--reflection"></path>
      ${rows
        .map((row, index) => {
          const x = padding.left + index * xStep;
          return `
            <circle cx="${x}" cy="${yFor(row.score)}" r="4" class="ia-dot ia-dot--score"></circle>
            <circle cx="${x}" cy="${yFor(row.hint * 100)}" r="4" class="ia-dot ia-dot--hint"></circle>
            <circle cx="${x}" cy="${yFor(row.reflection * 100)}" r="4" class="ia-dot ia-dot--reflection"></circle>
          `;
        })
        .join('')}
      ${xLabels}
    </svg>
    <div class="ia-inline-legend">
      <span><i class="ia-legend-swatch ia-legend-swatch--score"></i>Score</span>
      <span><i class="ia-legend-swatch ia-legend-swatch--hint"></i>Hint dependency</span>
      <span><i class="ia-legend-swatch ia-legend-swatch--reflection"></i>Reflection quality</span>
    </div>
  `;
}

function buildTransitionMatrix(attemptRows) {
  const states = ['incorrect', 'partial', 'correct'];
  const matrix = Object.fromEntries(states.map((state) => [state, Object.fromEntries(states.map((next) => [next, 0]))]));
  const grouped = new Map();

  attemptRows.forEach((row) => {
    const key = [
      row.student_id || row.studentId,
      normalizeChapter(row.chapter_id || row.chapterId),
      row.question_id || row.questionId,
    ].join('::');
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  });

  grouped.forEach((rows) => {
    rows
      .sort((a, b) => Number(a.attempt_no || a.attemptNo || 0) - Number(b.attempt_no || b.attemptNo || 0))
      .forEach((row, index, arr) => {
        if (index === arr.length - 1) return;
        const from = normalizeJudgment(row.judgment);
        const to = normalizeJudgment(arr[index + 1]?.judgment);
        if (from && to) matrix[from][to] += 1;
      });
  });

  return matrix;
}

function renderTransitionMatrix(matrix, container) {
  if (!container) return;
  const states = ['incorrect', 'partial', 'correct'];
  const max = Math.max(1, ...states.flatMap((from) => states.map((to) => matrix[from]?.[to] || 0)));
  const cells = states
    .map(
      (from) => `
        <div class="ia-heat-row">
          <div class="ia-heat-head">${escapeHtml(from)}</div>
          ${states
            .map((to) => {
              const value = matrix[from]?.[to] || 0;
              const alpha = 0.12 + (value / max) * 0.88;
              return `<div class="ia-heat-cell" style="background: rgba(37, 99, 235, ${alpha.toFixed(3)});">${value}</div>`;
            })
            .join('')}
        </div>
      `,
    )
    .join('');

  container.innerHTML = `
    <div class="ia-heat-header">
      <div class="ia-heat-head ia-heat-head--blank"></div>
      ${states.map((state) => `<div class="ia-heat-col">${escapeHtml(state)}</div>`).join('')}
    </div>
    ${cells}
  `;
}

function buildDistributionData(studentRows) {
  const chapters = new Map();
  studentRows.forEach((row) => {
    const chapterId = normalizeChapter(row.chapter_id || row.chapterId);
    if (!chapterId) return;
    if (!chapters.has(chapterId)) chapters.set(chapterId, { score: [], struggle: [], reflection: [] });
    const bucket = chapters.get(chapterId);
    bucket.score.push(Number(row.score || 0));
    bucket.struggle.push(Number(row.productive_struggle_index || row.productiveStruggleIndex || 0));
    bucket.reflection.push(Number(row.reflection_quality_index || row.reflectionQualityIndex || 0));
  });

  return [...chapters.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .map(([chapterId, stats]) => ({
      chapterId,
      score: computeBoxStats(stats.score),
      struggle: computeBoxStats(stats.struggle),
      reflection: computeBoxStats(stats.reflection),
    }));
}

function renderDistribution(rows, container) {
  if (!container) return;
  if (!rows.length) {
    container.innerHTML = '<p class="empty-msg">No distribution data.</p>';
    return;
  }

  container.innerHTML = `
    <div class="ia-box-grid">
      <div class="ia-box-card">
        <h4>Score</h4>
        ${renderBoxPlot(rows, 'score', 100)}
      </div>
      <div class="ia-box-card">
        <h4>Productive struggle</h4>
        ${renderBoxPlot(rows, 'struggle', 1)}
      </div>
      <div class="ia-box-card">
        <h4>Reflection quality</h4>
        ${renderBoxPlot(rows, 'reflection', 1)}
      </div>
    </div>
  `;
}

function renderBoxPlot(rows, field, ceiling) {
  const width = 240;
  const height = 220;
  const padding = { top: 12, right: 18, bottom: 32, left: 18 };
  const innerHeight = height - padding.top - padding.bottom;
  const yFor = (value) => padding.top + innerHeight - (Number(value || 0) / ceiling) * innerHeight;
  const step = rows.length > 0 ? (width - padding.left - padding.right) / rows.length : 0;

  return `
    <svg viewBox="0 0 ${width} ${height}" class="ia-svg ia-svg--box" role="img" aria-label="${escapeHtml(field)} box plot">
      ${rows
        .map((row, index) => {
          const stats = row[field];
          const center = padding.left + step * index + step / 2;
          const boxWidth = Math.min(30, step * 0.55);
          const minY = yFor(stats.min);
          const q1Y = yFor(stats.q1);
          const medianY = yFor(stats.median);
          const q3Y = yFor(stats.q3);
          const maxY = yFor(stats.max);
          return `
            <line x1="${center}" y1="${maxY}" x2="${center}" y2="${q3Y}" class="ia-box-line"></line>
            <line x1="${center}" y1="${q1Y}" x2="${center}" y2="${minY}" class="ia-box-line"></line>
            <rect x="${center - boxWidth / 2}" y="${q3Y}" width="${boxWidth}" height="${Math.max(2, q1Y - q3Y)}" class="ia-box-rect"></rect>
            <line x1="${center - boxWidth / 2}" y1="${medianY}" x2="${center + boxWidth / 2}" y2="${medianY}" class="ia-box-median"></line>
            <line x1="${center - boxWidth / 3}" y1="${maxY}" x2="${center + boxWidth / 3}" y2="${maxY}" class="ia-box-cap"></line>
            <line x1="${center - boxWidth / 3}" y1="${minY}" x2="${center + boxWidth / 3}" y2="${minY}" class="ia-box-cap"></line>
            <text x="${center}" y="${height - 10}" text-anchor="middle" class="ia-axis-label">Ch.${escapeHtml(row.chapterId)}</text>
          `;
        })
        .join('')}
    </svg>
  `;
}

function buildConceptHeatmap(rows) {
  const chapters = [...new Set(rows.map((row) => normalizeChapter(row.chapterId)).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  const concepts = new Map();

  rows.forEach((row) => {
    const chapterId = normalizeChapter(row.chapterId);
    row.weakConcepts.forEach((concept) => {
      const key = String(concept).trim();
      if (!key) return;
      if (!concepts.has(key)) concepts.set(key, Object.fromEntries(chapters.map((chapter) => [chapter, 0])));
      concepts.get(key)[chapterId] += 1;
    });
  });

  return { chapters, concepts: [...concepts.entries()] };
}

function renderHeatmap(data, container) {
  if (!container) return;
  if (!data.concepts.length || !data.chapters.length) {
    container.innerHTML = '<p class="empty-msg">No concept data.</p>';
    return;
  }

  const max = Math.max(1, ...data.concepts.flatMap(([, counts]) => data.chapters.map((chapter) => counts[chapter] || 0)));

  container.innerHTML = `
    <div class="ia-heat-header">
      <div class="ia-heat-head ia-heat-head--concept">Concept</div>
      ${data.chapters.map((chapter) => `<div class="ia-heat-col">Ch.${escapeHtml(chapter)}</div>`).join('')}
    </div>
    ${data.concepts
      .map(([concept, counts]) => {
        const cells = data.chapters
          .map((chapter) => {
            const value = counts[chapter] || 0;
            const alpha = 0.1 + (value / max) * 0.9;
            return `<div class="ia-heat-cell" style="background: rgba(239, 68, 68, ${alpha.toFixed(3)});">${value}</div>`;
          })
          .join('');
        return `<div class="ia-heat-row"><div class="ia-heat-head ia-heat-head--concept">${escapeHtml(concept)}</div>${cells}</div>`;
      })
      .join('')}
  `;
}

function renderScatter(rows, canvas) {
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const padding = { top: 18, right: 16, bottom: 32, left: 38 };
  const innerWidth = canvas.width - padding.left - padding.right;
  const innerHeight = canvas.height - padding.top - padding.bottom;
  const maxTurns = Math.max(1, ...rows.map((row) => row.turnCount));

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#64748b';

  [0, 25, 50, 75, 100].forEach((tick) => {
    const y = padding.top + innerHeight - (tick / 100) * innerHeight;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(canvas.width - padding.right, y);
    ctx.stroke();
    ctx.fillText(String(tick), 8, y + 4);
  });

  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, canvas.height - padding.bottom);
  ctx.lineTo(canvas.width - padding.right, canvas.height - padding.bottom);
  ctx.strokeStyle = '#94a3b8';
  ctx.stroke();

  rows.forEach((row) => {
    const x = padding.left + (row.turnCount / maxTurns) * innerWidth;
    const y = padding.top + innerHeight - (row.score / 100) * innerHeight;
    ctx.fillStyle = scoreFill(row.score);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function renderHintTable(rows, tbody) {
  if (!tbody) return;
  const ranked = [...rows]
    .sort((a, b) => {
      if (b.hintCount !== a.hintCount) return b.hintCount - a.hintCount;
      return b.turnCount - a.turnCount;
    })
    .slice(0, 10);

  tbody.innerHTML = ranked
    .map(
      (row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(row.studentId || '-')}</td>
          <td>${escapeHtml(row.studentName || '-')}</td>
          <td>${escapeHtml(row.chapterId || '-')}</td>
          <td>${row.turnCount}</td>
          <td>${row.hintCount}</td>
          <td>${formatMetric(row.avgUserLen)}</td>
          <td><span class="score-pill ${escapeHtml(scoreColor(row.score))}">${row.score}</span></td>
        </tr>
      `,
    )
    .join('');
}

function renderCorrelationMatrix(rows, container) {
  if (!container) return;
  const dimensions = [
    { key: 'turnCount', label: 'Turns' },
    { key: 'hintCount', label: 'Hints' },
    { key: 'avgUserLen', label: 'Avg Length' },
    { key: 'score', label: 'Score' },
  ];

  const header = `<div class="ia-corr-cell ia-corr-cell--head"></div>${dimensions
    .map((dimension) => `<div class="ia-corr-cell ia-corr-cell--head">${escapeHtml(dimension.label)}</div>`)
    .join('')}`;

  const body = dimensions
    .map((rowDimension) => {
      const cells = dimensions
        .map((colDimension) => {
          const xs = rows.map((row) => Number(row[rowDimension.key] || 0));
          const ys = rows.map((row) => Number(row[colDimension.key] || 0));
          const value = pearsonR(xs, ys);
          const alpha = Math.min(1, Math.abs(value));
          const background =
            value >= 0 ? `rgba(59, 130, 246, ${alpha.toFixed(3)})` : `rgba(239, 68, 68, ${alpha.toFixed(3)})`;
          return `<div class="ia-corr-cell" style="background:${background};">${value.toFixed(2)}</div>`;
        })
        .join('');
      return `<div class="ia-corr-cell ia-corr-cell--head">${escapeHtml(rowDimension.label)}</div>${cells}`;
    })
    .join('');

  container.innerHTML = `<div class="ia-corr-grid">${header}${body}</div>`;
}

function renderHintEffectBar(rows, container) {
  if (!container) return;
  const bands = [
    { label: '0 hints', min: 0, max: 0 },
    { label: '1 to 2 hints', min: 1, max: 2 },
    { label: '3 to 4 hints', min: 3, max: 4 },
    { label: '5+ hints', min: 5, max: Infinity },
  ].map((band) => {
    const selected = rows.filter((row) => row.hintCount >= band.min && row.hintCount <= band.max);
    return { ...band, value: average(selected.map((row) => row.score)), count: selected.length };
  });

  const max = Math.max(1, ...bands.map((band) => band.value));

  container.innerHTML = `
    <div class="ia-bar-list">
      ${bands
        .map(
          (band) => `
            <div class="ia-bar-row">
              <div class="ia-bar-label">${escapeHtml(band.label)}</div>
              <div class="ia-bar-track">
                <div class="ia-bar-fill" style="width:${(band.value / max) * 100}%"></div>
              </div>
              <div class="ia-bar-value">${formatMetric(band.value)} <span>n=${band.count}</span></div>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function buildClusters(rows) {
  if (!rows.length) {
    return { stats: [], meta: [] };
  }

  const samples = rows.map((row) => [row.turnCount, row.hintCount, row.avgUserLen, row.score]);
  const model = kmeans(samples, 3);
  const meta = [
    { name: 'Exploratory', color: '#0f766e', desc: 'Higher turns with moderate help-seeking.' },
    { name: 'Help-dependent', color: '#2563eb', desc: 'Frequent hint use with lower performance.' },
    { name: 'Efficient', color: '#7c3aed', desc: 'Lower turns with stronger performance.' },
  ];

  const stats = model.centroids.map((_, clusterIndex) => {
    const members = rows.filter((__, rowIndex) => model.assignments[rowIndex] === clusterIndex);
    return {
      clusterIndex,
      n: members.length,
      avgTurn: average(members.map((row) => row.turnCount)),
      avgHint: average(members.map((row) => row.hintCount)),
      avgScore: average(members.map((row) => row.score)),
    };
  });

  return { stats, meta };
}

function kmeans(samples, k) {
  const centroids = samples.slice(0, k).map((sample) => [...sample]);
  const assignments = new Array(samples.length).fill(0);

  for (let iter = 0; iter < 12; iter += 1) {
    samples.forEach((sample, sampleIndex) => {
      let minDistance = Infinity;
      let bestIndex = 0;
      centroids.forEach((centroid, centroidIndex) => {
        const distance = Math.sqrt(
          centroid.reduce((sum, value, valueIndex) => sum + (value - sample[valueIndex]) ** 2, 0),
        );
        if (distance < minDistance) {
          minDistance = distance;
          bestIndex = centroidIndex;
        }
      });
      assignments[sampleIndex] = bestIndex;
    });

    centroids.forEach((centroid, centroidIndex) => {
      const clusterSamples = samples.filter((__, sampleIndex) => assignments[sampleIndex] === centroidIndex);
      if (!clusterSamples.length) return;
      centroid.forEach((__, dimIndex) => {
        centroid[dimIndex] = average(clusterSamples.map((sample) => sample[dimIndex]));
      });
    });
  }

  return { centroids, assignments };
}

function renderClusterSummary(result, container) {
  if (!container) return;
  if (!result.stats.length) {
    container.innerHTML = '<p class="empty-msg">No cluster data.</p>';
    return;
  }

  container.innerHTML = result.stats
    .filter((row) => row.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((row) => {
      const meta = result.meta[row.clusterIndex] || { name: `Cluster ${row.clusterIndex + 1}`, color: '#6b7280', desc: '' };
      return `
        <div class="ia-cluster-row">
          <div class="ia-cluster-name" style="color:${meta.color};">${escapeHtml(meta.name)}</div>
          <div class="ia-cluster-desc">${escapeHtml(meta.desc)}</div>
          <div class="ia-cluster-meta">
            <span>n=${row.n}</span>
            <span>turns ${formatMetric(row.avgTurn)}</span>
            <span>hints ${formatMetric(row.avgHint)}</span>
            <span>score ${formatMetric(row.avgScore)}</span>
          </div>
        </div>
      `;
    })
    .join('');
}

function pearsonR(xs, ys) {
  const n = xs.length;
  if (n < 3) return 0;
  const meanX = average(xs);
  const meanY = average(ys);
  const numerator = xs.reduce((sum, x, index) => sum + (x - meanX) * (ys[index] - meanY), 0);
  const denX = Math.sqrt(xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0));
  const denY = Math.sqrt(ys.reduce((sum, y) => sum + (y - meanY) ** 2, 0));
  if (!denX || !denY) return 0;
  return numerator / (denX * denY);
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

function normalizeResearchSummary(summary) {
  return {
    studentChapterCount: summary.studentChapterCount ?? summary.total_student_chapter_rows ?? 0,
    attemptCount: summary.attemptCount ?? summary.total_attempt_rows ?? 0,
    reflectionCount: summary.reflectionCount ?? summary.total_reflection_rows ?? 0,
    avgProductiveStruggle: summary.avgProductiveStruggle ?? summary.avg_productive_struggle_index ?? 0,
    avgHintDependency: summary.avgHintDependency ?? summary.avg_hint_dependency_index ?? 0,
    avgReflectionQuality: summary.avgReflectionQuality ?? summary.avg_reflection_quality_index ?? 0,
  };
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function formatMetric(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(1) : '0.0';
}

function scoreFill(score) {
  const cls = scoreColor(score);
  if (cls === 'score-good') return '#10b981';
  if (cls === 'score-warn') return '#f59e0b';
  return '#ef4444';
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
