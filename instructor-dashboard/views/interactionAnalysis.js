/**
 * views/interactionAnalysis.js
 * Research-oriented interaction analysis for the instructor dashboard.
 */

import { escapeHtml, scoreColor } from '../utils/format.js';

const HINT_KEYWORDS = ['힌트', '모르겠', '알려줘', '어떻게', '무엇', '이해가'];

/**
 * @param {object[]} submissions
 * @param {HTMLElement} container
 * @param {object} researchData
 */
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

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
      <h2 class="section-title" style="margin:0;">상호작용 분석</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button id="ia-export-student" style="background:#0f766e;color:#fff;border:none;border-radius:6px;padding:7px 14px;cursor:pointer;font-size:0.82rem;">Student-Chapter CSV</button>
        <button id="ia-export-attempt" style="background:#1d4ed8;color:#fff;border:none;border-radius:6px;padding:7px 14px;cursor:pointer;font-size:0.82rem;">Attempt-Level CSV</button>
        <button id="ia-export-reflection" style="background:#7c3aed;color:#fff;border:none;border-radius:6px;padding:7px 14px;cursor:pointer;font-size:0.82rem;">Reflection-Coded CSV</button>
      </div>
    </div>

    <div class="ia-card" style="margin-bottom:16px;">
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
          <span class="chart-sub">고점수 저턴, 저점수 고턴 패턴을 확인합니다.</span>
        </h3>
        <canvas id="ia-scatter" width="460" height="280"></canvas>
        <div class="scatter-legend">
          <span class="sleg sleg--bad">60점 미만</span>
          <span class="sleg sleg--warn">60~79점</span>
          <span class="sleg sleg--good">80점 이상</span>
        </div>
      </div>
    </div>

    <div class="ia-card ia-card--heatmap">
      <h3 class="chart-title">취약개념 히트맵
        <span class="chart-sub">챕터별로 반복 출현하는 취약개념 상위 15개를 표시합니다.</span>
      </h3>
      <div id="ia-heatmap"></div>
    </div>

    <div class="ia-card">
      <h3 class="chart-title">힌트 의존 상위 학생</h3>
      <p class="section-desc">학생 발화와 저장된 채팅 지표를 함께 사용해 도움 요청 패턴을 확인합니다.</p>
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
        <span class="chart-sub">논문 Table 형태로 사용할 수 있는 탐색적 상관계수입니다.</span>
      </h3>
      <div id="ia-corr"></div>
    </div>

    <div class="ia-top-grid">
      <div class="ia-card">
        <h3 class="chart-title">힌트 사용 구간별 평균 점수
          <span class="chart-sub">힌트 요청 빈도와 성취의 관계를 보여줍니다.</span>
        </h3>
        <div id="ia-hint-bar" style="display:flex;justify-content:center;padding:8px 0;"></div>
      </div>
      <div class="ia-card">
        <h3 class="chart-title">행동 군집 요약
          <span class="chart-sub">턴 수와 힌트 수를 바탕으로 학습자 유형을 분류합니다.</span>
        </h3>
        <div id="ia-cluster"></div>
      </div>
    </div>
  `;

  renderHeatmap(heatmapData, container.querySelector('#ia-heatmap'));
  renderScatter(enriched, container.querySelector('#ia-scatter'));
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
  const messages = Array.isArray(submission?.messages) ? submission.messages.filter((m) => m?.role !== 'system') : [];
  const userMessages = messages.filter((m) => m?.role === 'user');
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
    <div class="pattern-stats">
      ${cards.map(([label, value]) => `
        <div class="pstat">
          <div class="pstat-value">${escapeHtml(String(value))}</div>
          <div class="pstat-label">${escapeHtml(label)}</div>
        </div>
      `).join('')}
    </div>
    <p style="margin:12px 0 0;color:var(--color-muted);font-size:0.82rem;">
      Student-chapter, attempt-level, reflection-coded 3종 데이터셋을 논문용 CSV로 분리 export할 수 있습니다.
    </p>
  `;
}

function buildConceptHeatmap(enriched) {
  const conceptMap = {};
  const chapters = new Set();

  for (const row of enriched) {
    const chapterId = String(row.chapter_id || row.chapterId || '?');
    chapters.add(chapterId);
    const weakConcepts = Array.isArray(row.weak_concepts) ? row.weak_concepts : Array.isArray(row.weakConcepts) ? row.weakConcepts : [];
    for (const concept of weakConcepts) {
      if (!conceptMap[concept]) conceptMap[concept] = {};
      conceptMap[concept][chapterId] = (conceptMap[concept][chapterId] || 0) + 1;
    }
  }

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

  const maxVal = Math.max(...data.concepts.flatMap((item) => Object.values(item.byChapter)));
  const headers = data.chapters.map((chapterId) => `<th>Ch.${escapeHtml(chapterId)}</th>`).join('');
  const rows = data.concepts.map((item) => {
    const cells = data.chapters.map((chapterId) => {
      const value = item.byChapter[chapterId] || 0;
      if (!value) return '<td class="hm-cell hm-cell--zero"></td>';
      const alpha = (0.15 + (value / maxVal) * 0.75).toFixed(2);
      return `<td class="hm-cell" style="background:rgba(239,68,68,${alpha});color:${value / maxVal > 0.5 ? '#fff' : '#111'}">${value}</td>`;
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
  const maxScore = 100;
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() || '#e5e7eb';
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (innerH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + innerW, y);
    ctx.stroke();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.round(maxScore - (maxScore / 4) * i)), pad.left - 6, y + 4);
  }

  for (let i = 0; i <= 5; i += 1) {
    const x = pad.left + (innerW / 5) * i;
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + innerH);
    ctx.stroke();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round((maxTurns / 5) * i)), x, pad.top + innerH + 16);
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

  for (const row of enriched) {
    const score = Number(row.score || 0);
    const x = pad.left + (row.turnCount / maxTurns) * innerW;
    const y = pad.top + innerH - (score / maxScore) * innerH;
    const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = `${color}bb`;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function renderPatternSummary(enriched) {
  const count = enriched.length;
  const avgTurns = average(enriched.map((row) => row.turnCount)).toFixed(1);
  const avgHints = average(enriched.map((row) => row.hintCount)).toFixed(1);
  const avgLen = Math.round(average(enriched.map((row) => row.avgUserLen)));
  const struggling = enriched.filter((row) => Number(row.score || 100) < 60 && row.turnCount > Number(avgTurns)).length;

  return `
    <div class="pattern-stats">
      <div class="pstat"><div class="pstat-value">${avgTurns}</div><div class="pstat-label">평균 턴 수</div></div>
      <div class="pstat"><div class="pstat-value">${avgHints}</div><div class="pstat-label">평균 힌트 수</div></div>
      <div class="pstat"><div class="pstat-value">${avgLen}자</div><div class="pstat-label">평균 발화 길이</div></div>
      <div class="pstat"><div class="pstat-value">${count}</div><div class="pstat-label">분석 표본 수</div></div>
      <div class="pstat pstat--danger"><div class="pstat-value">${struggling}명</div><div class="pstat-label">개입 권고</div></div>
    </div>
  `;
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
    <div style="overflow-x:auto;">
      <table class="dash-table" style="min-width:420px;">
        <thead><tr><th></th>${headers}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size:0.75rem;color:var(--color-muted);margin-top:8px;">* |r| &gt; 0.30은 강조 표시했습니다. n = ${enriched.length}</p>
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

  const width = 300;
  const height = 200;
  const pad = { top: 24, right: 16, bottom: 56, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const barWidth = Math.floor((innerW / data.length) * 0.55);
  const gap = innerW / data.length;

  const yLines = [0, 25, 50, 75, 100].map((value) => {
    const y = pad.top + innerH - (value / 100) * innerH;
    return `
      <line x1="${pad.left}" y1="${y}" x2="${pad.left + innerW}" y2="${y}" stroke="#e5e7eb" stroke-width="1"/>
      <text x="${pad.left - 5}" y="${y + 4}" text-anchor="end" font-size="10" fill="#9ca3af">${value}</text>
    `;
  }).join('');

  const bars = data.map((item, index) => {
    const x = pad.left + gap * index + gap * 0.22;
    if (item.avgScore == null) {
      return `<text x="${x + barWidth / 2}" y="${pad.top + innerH / 2}" text-anchor="middle" font-size="10" fill="#9ca3af">데이터 없음</text>`;
    }
    const barHeight = Math.max((item.avgScore / 100) * innerH, 2);
    const y = pad.top + innerH - barHeight;
    const color = item.avgScore >= 80 ? '#10b981' : item.avgScore >= 60 ? '#f59e0b' : '#ef4444';
    return `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="3"/>
      <text x="${x + barWidth / 2}" y="${y - 5}" text-anchor="middle" font-size="11" font-weight="600" fill="#374151">${item.avgScore.toFixed(1)}</text>
      <text x="${x + barWidth / 2}" y="${pad.top + innerH + 14}" text-anchor="middle" font-size="11" fill="#374151">${escapeHtml(item.label)}</text>
      <text x="${x + barWidth / 2}" y="${pad.top + innerH + 26}" text-anchor="middle" font-size="10" fill="#6b7280">${escapeHtml(item.sub)}</text>
      <text x="${x + barWidth / 2}" y="${pad.top + innerH + 40}" text-anchor="middle" font-size="9" fill="#9ca3af">n=${item.n}</text>
    `;
  }).join('');

  container.innerHTML = `
    <svg width="${width}" height="${height}" style="max-width:100%;overflow:visible;">
      ${yLines}
      ${bars}
      <text x="${pad.left + innerW / 2}" y="${height - 2}" text-anchor="middle" font-size="10" fill="#9ca3af">힌트 사용 구간</text>
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

  const meta = {
    [helpSeeking]: { name: '도움의존형', color: '#f59e0b', desc: '힌트 요청이 많고 점검이 필요한 집단' },
    [exploratory]: { name: '탐색참여형', color: '#10b981', desc: '상대적으로 적극적으로 상호작용하는 집단' },
    [passive]: { name: '저활동형', color: '#ef4444', desc: '상호작용 빈도가 낮은 집단' },
  };

  return { stats, meta };
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
    const newLabels = normalized.map((point) => {
      const distances = centroids.map((centroid) => (point[0] - centroid[0]) ** 2 + (point[1] - centroid[1]) ** 2);
      return distances.indexOf(Math.min(...distances));
    });
    if (newLabels.every((label, index) => label === labels[index])) break;
    labels = newLabels;
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
        <div style="padding:10px 0;border-bottom:1px solid var(--color-border);">
          <div style="font-weight:700;color:${meta.color};">${escapeHtml(meta.name)}</div>
          <div style="font-size:0.78rem;color:var(--color-muted);margin:4px 0 6px;">${escapeHtml(meta.desc)}</div>
          <div style="font-size:0.82rem;display:flex;gap:12px;flex-wrap:wrap;">
            <span>표본 ${row.n}명</span>
            <span>평균 턴 ${row.avgTurn.toFixed(1)}</span>
            <span>평균 힌트 ${row.avgHint.toFixed(1)}</span>
            <span>평균 점수 ${row.avgScore.toFixed(1)}</span>
          </div>
        </div>
      `;
    }).join('');

  container.innerHTML = `<div style="padding:0 4px;">${rows}</div>`;
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

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
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

function formatMetric(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(1) : '0.0';
}
