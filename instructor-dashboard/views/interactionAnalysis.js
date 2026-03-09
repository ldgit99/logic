/**
 * views/interactionAnalysis.js
 * E6: 상호작용 분석 — 취약개념 히트맵, 점수-대화량 산점도, 힌트 의존도,
 *     상관관계 분석, 힌트 효과성, 행동 군집 (학술 논문용)
 */

import { escapeHtml, scoreColor } from '../utils/format.js';

const HINT_KEYWORDS = ['힌트', '모르겠', '알려줘', '알려 줘', '어떻게 하', '뭔지', '뭐예요', '뭔가요', '이해가 안'];

/**
 * @param {object[]} submissions
 * @param {HTMLElement} container
 */
export function renderInteractionAnalysis(submissions, container) {
  if (!container) return;

  if (submissions.length === 0) {
    container.innerHTML = '<p class="empty-msg">분석할 데이터가 없습니다.</p>';
    return;
  }

  const enriched = submissions.map(enrich);
  const heatmapData = buildConceptHeatmap(enriched);
  const clusterResult = buildClusters(enriched);

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <h2 class="section-title" style="margin:0;">상호작용 분석</h2>
      <button id="ia-research-csv-btn" style="background:var(--color-primary);color:#fff;border:none;border-radius:6px;padding:7px 16px;cursor:pointer;font-size:0.85rem;">📊 연구 CSV 내보내기</button>
    </div>

    <div class="ia-top-grid">
      <div class="ia-card">
        <h3 class="chart-title">대화 패턴 요약</h3>
        ${renderPatternSummary(enriched)}
      </div>
      <div class="ia-card ia-card--scatter">
        <h3 class="chart-title">점수 × 대화 턴 수
          <span class="chart-sub">낮은 점수 + 긴 대화 → 개입 필요</span>
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
        <span class="chart-sub">챕터별 해당 개념을 어려워한 학생 수 (상위 15개)</span>
      </h3>
      <div id="ia-heatmap"></div>
    </div>

    <div class="ia-card">
      <h3 class="chart-title">힌트 의존도 상위 학생</h3>
      <p class="section-desc">학생 발화에서 "힌트", "모르겠", "알려줘" 등의 표현 빈도를 기준으로 정렬합니다.</p>
      <table class="dash-table">
        <thead>
          <tr>
            <th>순위</th>
            <th>학번</th>
            <th>이름</th>
            <th>챕터</th>
            <th>대화 턴</th>
            <th>힌트 표현</th>
            <th>평균 발화 길이</th>
            <th>점수</th>
          </tr>
        </thead>
        <tbody id="ia-hint-tbody"></tbody>
      </table>
    </div>

    <!-- ── 논문용 분석 섹션 ─────────────────────────────────── -->

    <div class="ia-card">
      <h3 class="chart-title">대화 행동 × 학습 성과 상관관계 (Pearson r)
        <span class="chart-sub">|r| &gt; 0.3 강조 표시 · n = ${enriched.length}명 · 논문 Table 1 용도</span>
      </h3>
      <div id="ia-corr"></div>
    </div>

    <div class="ia-top-grid">
      <div class="ia-card">
        <h3 class="chart-title">힌트 사용 구간별 평균 점수
          <span class="chart-sub">도움 요청 행동의 학습 효과</span>
        </h3>
        <div id="ia-hint-bar" style="display:flex;justify-content:center;padding:8px 0;"></div>
      </div>
      <div class="ia-card">
        <h3 class="chart-title">학생 행동 유형 군집 분석 (K=3)
          <span class="chart-sub">대화 턴 수 × 힌트 표현 기반 자동 분류</span>
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
  renderClusterSummary(enriched, clusterResult, container.querySelector('#ia-cluster'));

  container.querySelector('#ia-research-csv-btn')
    ?.addEventListener('click', () => exportResearchCSV(enriched));
}

// ── 데이터 보강 ───────────────────────────────────────────────

function enrich(s) {
  const messages = (s.messages || []).filter((m) => m.role !== 'system');
  const userMessages = messages.filter((m) => m.role === 'user');

  const hintCount = userMessages.reduce((acc, m) => {
    const content = (m.content || '');
    return acc + HINT_KEYWORDS.filter((kw) => content.includes(kw)).length;
  }, 0);

  const totalLen = userMessages.reduce((a, m) => a + (m.content || '').length, 0);
  const avgUserLen = userMessages.length > 0 ? Math.round(totalLen / userMessages.length) : 0;

  return { ...s, turnCount: userMessages.length, hintCount, avgUserLen };
}

// ── 취약개념 히트맵 ───────────────────────────────────────────

function buildConceptHeatmap(enriched) {
  const map = {};
  const chaptersSet = new Set();

  for (const s of enriched) {
    const ch = s.chapter_id || s.chapterId || '?';
    chaptersSet.add(ch);
    for (const c of (s.weak_concepts || s.weakConcepts || [])) {
      if (!map[c]) map[c] = {};
      map[c][ch] = (map[c][ch] || 0) + 1;
    }
  }

  const concepts = Object.entries(map)
    .map(([name, byChapter]) => ({
      name,
      byChapter,
      total: Object.values(byChapter).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  const chapters = [...chaptersSet].sort();
  return { concepts, chapters };
}

function renderHeatmap({ concepts, chapters }, el) {
  if (!el) return;

  if (concepts.length === 0) {
    el.innerHTML = '<p class="empty-msg">취약개념 데이터가 없습니다.</p>';
    return;
  }

  const maxVal = Math.max(...concepts.flatMap((c) => Object.values(c.byChapter)));
  const headerCells = chapters.map((ch) => `<th>Ch.${escapeHtml(ch)}</th>`).join('');

  const rows = concepts.map(({ name, byChapter, total }) => {
    const cells = chapters.map((ch) => {
      const val = byChapter[ch] || 0;
      if (val === 0) return `<td class="hm-cell hm-cell--zero"></td>`;
      const intensity = maxVal > 0 ? val / maxVal : 0;
      const alpha = (0.15 + intensity * 0.75).toFixed(2);
      const textDark = intensity <= 0.5;
      return `<td class="hm-cell" style="background:rgba(239,68,68,${alpha});color:${textDark ? '#111' : '#fff'}">${val}</td>`;
    }).join('');
    return `<tr>
      <td class="hm-concept-name">${escapeHtml(name)}</td>
      ${cells}
      <td class="hm-total">${total}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="heatmap-scroll">
      <table class="dash-table heatmap-table">
        <thead><tr><th>개념</th>${headerCells}<th>합계</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ── 산점도 ────────────────────────────────────────────────────

function renderScatter(enriched, canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const PAD = { top: 16, right: 16, bottom: 40, left: 46 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, W, H);

  const maxTurns = Math.max(...enriched.map((s) => s.turnCount), 5);
  const maxScore = 100;

  ctx.strokeStyle = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-border').trim() || '#e5e7eb';
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i++) {
    const yy = PAD.top + (iH / 4) * i;
    ctx.beginPath(); ctx.moveTo(PAD.left, yy); ctx.lineTo(PAD.left + iW, yy); ctx.stroke();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.round(maxScore - (maxScore / 4) * i)), PAD.left - 6, yy + 4);
  }
  for (let i = 0; i <= 5; i++) {
    const xx = PAD.left + (iW / 5) * i;
    ctx.beginPath(); ctx.moveTo(xx, PAD.top); ctx.lineTo(xx, PAD.top + iH); ctx.stroke();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round((maxTurns / 5) * i)), xx, PAD.top + iH + 16);
  }

  ctx.fillStyle = '#6b7280';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('대화 턴 수', PAD.left + iW / 2, H - 4);
  ctx.save();
  ctx.translate(12, PAD.top + iH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('점수', 0, 0);
  ctx.restore();

  for (const s of enriched) {
    const score = s.score ?? 0;
    const x = PAD.left + (s.turnCount / maxTurns) * iW;
    const y = PAD.top + iH - (score / maxScore) * iH;
    const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';

    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = color + 'bb';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

// ── 대화 패턴 요약 카드 ───────────────────────────────────────

function renderPatternSummary(enriched) {
  const n = enriched.length;
  if (n === 0) return '';

  const avgTurns = (enriched.reduce((a, s) => a + s.turnCount, 0) / n).toFixed(1);
  const avgHints = (enriched.reduce((a, s) => a + s.hintCount, 0) / n).toFixed(1);
  const avgLen   = Math.round(enriched.reduce((a, s) => a + s.avgUserLen, 0) / n);
  const avgTurnsNum = parseFloat(avgTurns);
  const highStruggle = enriched.filter((s) => (s.score ?? 100) < 60 && s.turnCount > avgTurnsNum).length;

  return `
    <div class="pattern-stats">
      <div class="pstat">
        <div class="pstat-value">${avgTurns}</div>
        <div class="pstat-label">평균 대화 턴</div>
      </div>
      <div class="pstat">
        <div class="pstat-value">${avgHints}</div>
        <div class="pstat-label">평균 힌트 표현</div>
      </div>
      <div class="pstat">
        <div class="pstat-value">${avgLen}자</div>
        <div class="pstat-label">평균 발화 길이</div>
      </div>
      <div class="pstat pstat--danger">
        <div class="pstat-value">${highStruggle}명</div>
        <div class="pstat-label">개입 권고<br><small>(저점수 + 긴 대화)</small></div>
      </div>
    </div>
  `;
}

// ── 힌트 의존도 테이블 ────────────────────────────────────────

function renderHintTable(enriched, tbody) {
  if (!tbody) return;

  const sorted = [...enriched]
    .sort((a, b) => b.hintCount - a.hintCount || b.turnCount - a.turnCount)
    .slice(0, 20);

  if (sorted.length === 0 || sorted[0].hintCount === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-msg">힌트 표현이 감지된 학생이 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = sorted.map((s, i) => {
    const score = s.score ?? null;
    const scoreClass = score != null ? scoreColor(score) : '';
    const ch = s.chapter_id || s.chapterId || '-';
    const level = s.hintCount > 5 ? 'high' : s.hintCount > 2 ? 'mid' : 'low';
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(s.student_id || s.studentId || '-')}</td>
        <td>${escapeHtml(s.student_name || s.studentName || '-')}</td>
        <td>Ch.${escapeHtml(ch)}</td>
        <td>${s.turnCount}턴</td>
        <td><span class="hint-badge hint-badge--${level}">${s.hintCount}회</span></td>
        <td>${s.avgUserLen}자</td>
        <td class="${scoreClass}">${score != null ? score + '점' : '-'}</td>
      </tr>
    `;
  }).join('');
}

// ── 상관관계 분석 (Pearson r) ──────────────────────────────────

function pearsonR(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const dx = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0));
  const dy = Math.sqrt(ys.reduce((s, y) => s + (y - my) ** 2, 0));
  return (dx === 0 || dy === 0) ? 0 : num / (dx * dy);
}

function renderCorrelationMatrix(enriched, container) {
  if (!container) return;
  if (enriched.length < 3) {
    container.innerHTML = '<p class="empty-msg">상관관계 분석에는 최소 3명의 데이터가 필요합니다.</p>';
    return;
  }

  const vars = [
    { label: '점수',          values: enriched.map((s) => s.score ?? 0) },
    { label: '대화 턴 수',    values: enriched.map((s) => s.turnCount) },
    { label: '힌트 표현 빈도', values: enriched.map((s) => s.hintCount) },
    { label: '평균 발화 길이', values: enriched.map((s) => s.avgUserLen) },
  ];

  const cell = (r) => {
    if (r === null) return '<td style="color:#9ca3af;">-</td>';
    const rv = r.toFixed(2);
    const strong = Math.abs(r) > 0.3;
    const color = r > 0.3 ? '#059669' : r < -0.3 ? '#dc2626' : '#6b7280';
    return `<td style="color:${color};font-weight:${strong ? '700' : '400'};">${rv}${strong ? ' *' : ''}</td>`;
  };

  const headerCells = vars.map((v) => `<th>${escapeHtml(v.label)}</th>`).join('');
  const rows = vars.map((v1, i) =>
    `<tr>
      <th style="text-align:left;font-weight:600;">${escapeHtml(v1.label)}</th>
      ${vars.map((v2, j) => i === j
        ? '<td style="color:#9ca3af;">1.00</td>'
        : cell(pearsonR(v1.values, v2.values))
      ).join('')}
    </tr>`
  ).join('');

  container.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="dash-table" style="min-width:420px;">
        <thead><tr><th></th>${headerCells}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size:0.75rem;color:var(--color-muted);margin-top:8px;">
        * |r| &gt; 0.3 강조 표시. n = ${enriched.length}명
      </p>
    </div>
  `;
}

// ── 힌트 사용 구간별 평균 점수 (SVG 바 차트) ─────────────────

function renderHintEffectBar(enriched, container) {
  if (!container) return;

  const groups = [
    { label: '힌트 없음', sub: '(0회)', filter: (s) => s.hintCount === 0 },
    { label: '힌트 소량', sub: '(1~2회)', filter: (s) => s.hintCount >= 1 && s.hintCount <= 2 },
    { label: '힌트 다수', sub: '(3회+)',  filter: (s) => s.hintCount >= 3 },
  ];

  const data = groups.map((g) => {
    const pts = enriched.filter(g.filter);
    const avgScore = pts.length > 0
      ? pts.reduce((a, s) => a + (s.score ?? 0), 0) / pts.length
      : null;
    return { label: g.label, sub: g.sub, avgScore, n: pts.length };
  });

  const W = 300, H = 200;
  const PAD = { top: 24, right: 16, bottom: 56, left: 44 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;
  const bw = Math.floor(iW / data.length * 0.55);
  const gap = iW / data.length;

  const yLines = [0, 25, 50, 75, 100].map((v) => {
    const y = PAD.top + iH - (v / 100) * iH;
    return `
      <line x1="${PAD.left}" y1="${y}" x2="${PAD.left + iW}" y2="${y}" stroke="#e5e7eb" stroke-width="1"/>
      <text x="${PAD.left - 5}" y="${y + 4}" text-anchor="end" font-size="10" fill="#9ca3af">${v}</text>
    `;
  }).join('');

  const bars = data.map((d, i) => {
    const cx = PAD.left + gap * i + gap * 0.22;
    if (d.avgScore === null) {
      return `<text x="${cx + bw / 2}" y="${PAD.top + iH / 2}" text-anchor="middle" font-size="10" fill="#9ca3af">데이터 없음</text>`;
    }
    const h = Math.max((d.avgScore / 100) * iH, 2);
    const y = PAD.top + iH - h;
    const color = d.avgScore >= 80 ? '#10b981' : d.avgScore >= 60 ? '#f59e0b' : '#ef4444';
    return `
      <rect x="${cx}" y="${y}" width="${bw}" height="${h}" fill="${color}" rx="3"/>
      <text x="${cx + bw / 2}" y="${y - 5}" text-anchor="middle" font-size="11" font-weight="600" fill="#374151">${d.avgScore.toFixed(1)}점</text>
      <text x="${cx + bw / 2}" y="${PAD.top + iH + 14}" text-anchor="middle" font-size="11" fill="#374151">${escapeHtml(d.label)}</text>
      <text x="${cx + bw / 2}" y="${PAD.top + iH + 26}" text-anchor="middle" font-size="10" fill="#6b7280">${escapeHtml(d.sub)}</text>
      <text x="${cx + bw / 2}" y="${PAD.top + iH + 40}" text-anchor="middle" font-size="9" fill="#9ca3af">n=${d.n}</text>
    `;
  }).join('');

  container.innerHTML = `
    <svg width="${W}" height="${H}" style="max-width:100%;overflow:visible;">
      ${yLines}
      ${bars}
      <text x="${PAD.left + iW / 2}" y="${H - 2}" text-anchor="middle" font-size="10" fill="#9ca3af">힌트 사용 구간</text>
    </svg>
  `;
}

// ── 행동 유형 군집 (K-means, k=3) ────────────────────────────

function buildClusters(enriched) {
  if (enriched.length < 3) return null;

  const points = enriched.map((s) => [s.turnCount, s.hintCount]);
  const labels = kmeans(points, 3);

  // 군집별 통계
  const stats = Array.from({ length: 3 }, (_, ki) => {
    const members = enriched.filter((_, i) => labels[i] === ki);
    if (members.length === 0) return { ki, n: 0, avgTurn: 0, avgHint: 0, avgScore: 0 };
    return {
      ki,
      n: members.length,
      avgTurn: members.reduce((a, s) => a + s.turnCount, 0) / members.length,
      avgHint: members.reduce((a, s) => a + s.hintCount, 0) / members.length,
      avgScore: members.reduce((a, s) => a + (s.score ?? 0), 0) / members.length,
    };
  });

  // 힌트 높음 → "힌트 의존형", 나머지 중 턴 높음 → "적극 탐색형", 나머지 → "수동 참여형"
  const byHint = [...stats].sort((a, b) => b.avgHint - a.avgHint);
  const hintKi = byHint[0].ki;
  const rest = byHint.slice(1).sort((a, b) => b.avgTurn - a.avgTurn);
  const activeKi = rest[0]?.ki ?? -1;

  const CLUSTER_META = {
    [hintKi]:  { name: '힌트 의존형',  color: '#f59e0b', icon: '🟡', desc: '스캐폴딩 과의존' },
    [activeKi]:{ name: '적극 탐색형',  color: '#10b981', icon: '🟢', desc: '자기조절학습' },
  };
  const passiveKi = [0, 1, 2].find((k) => k !== hintKi && k !== activeKi);
  if (passiveKi !== undefined) {
    CLUSTER_META[passiveKi] = { name: '수동 참여형', color: '#ef4444', icon: '🔴', desc: '이탈 위험' };
  }

  return { labels, stats, meta: CLUSTER_META };
}

function kmeans(points, k, maxIter = 60) {
  if (points.length <= k) return points.map((_, i) => i % k);

  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs), rangeX = (Math.max(...xs) - minX) || 1;
  const minY = Math.min(...ys), rangeY = (Math.max(...ys) - minY) || 1;
  const norm = points.map((p) => [(p[0] - minX) / rangeX, (p[1] - minY) / rangeY]);

  // 정렬 기반 초기 중심점 (재현 가능)
  const sorted = [...norm].map((p, i) => ({ p, i })).sort((a, b) => a.p[0] - b.p[0]);
  const seg = Math.floor(norm.length / k);
  let centroids = Array.from({ length: k }, (_, i) => {
    const sl = sorted.slice(i * seg, (i + 1) * seg).map((x) => x.p);
    return [
      sl.reduce((a, p) => a + p[0], 0) / sl.length,
      sl.reduce((a, p) => a + p[1], 0) / sl.length,
    ];
  });

  let labels = new Array(norm.length).fill(0);
  for (let it = 0; it < maxIter; it++) {
    const newLabels = norm.map((p) => {
      const dists = centroids.map((c) => (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2);
      return dists.indexOf(Math.min(...dists));
    });
    if (newLabels.every((l, i) => l === labels[i])) break;
    labels = newLabels;
    centroids = Array.from({ length: k }, (_, ki) => {
      const pts = norm.filter((_, i) => labels[i] === ki);
      if (pts.length === 0) return centroids[ki];
      return [
        pts.reduce((a, p) => a + p[0], 0) / pts.length,
        pts.reduce((a, p) => a + p[1], 0) / pts.length,
      ];
    });
  }
  return labels;
}

function renderClusterSummary(enriched, result, container) {
  if (!container) return;
  if (!result) {
    container.innerHTML = '<p class="empty-msg">군집 분석에는 최소 3명의 데이터가 필요합니다.</p>';
    return;
  }

  const { stats, meta } = result;
  const rows = stats
    .filter((s) => s.n > 0)
    .sort((a, b) => (meta[b.ki]?.name || '').localeCompare(meta[a.ki]?.name || ''))
    .map((s) => {
      const m = meta[s.ki] || { name: `군집 ${s.ki}`, color: '#6b7280', icon: '⚪', desc: '' };
      return `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--color-border);">
          <span style="font-size:1.3rem;line-height:1;">${m.icon}</span>
          <div style="flex:1;">
            <div style="font-weight:600;color:${m.color};">${escapeHtml(m.name)}</div>
            <div style="font-size:0.78rem;color:var(--color-muted);">${escapeHtml(m.desc)}</div>
            <div style="font-size:0.82rem;margin-top:4px;display:flex;gap:12px;flex-wrap:wrap;">
              <span>👤 ${s.n}명</span>
              <span>💬 평균 ${s.avgTurn.toFixed(1)}턴</span>
              <span>❓ 힌트 ${s.avgHint.toFixed(1)}회</span>
              <span>🎯 평균 ${s.avgScore.toFixed(1)}점</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

  container.innerHTML = `<div style="padding:0 4px;">${rows}</div>`;
}

// ── 연구 CSV 내보내기 ──────────────────────────────────────────

export function exportResearchCSV(enriched) {
  const headers = [
    'student_id', 'student_name', 'chapter_id', 'score',
    'correct_count', 'total_count',
    'turn_count', 'hint_count', 'avg_user_len',
    'weak_concepts_count', 'weak_concepts',
    'submitted_at',
  ];

  const rows = enriched.map((s) => {
    const wc = s.weak_concepts || s.weakConcepts || [];
    return [
      s.student_id || s.studentId || '',
      s.student_name || s.studentName || '',
      s.chapter_id || s.chapterId || '',
      s.score ?? '',
      s.correct_count ?? s.correctCount ?? '',
      s.total_count ?? s.totalCount ?? '',
      s.turnCount,
      s.hintCount,
      s.avgUserLen,
      wc.length,
      wc.join('; '),
      s.submitted_at || s.submittedAt || '',
    ];
  });

  const csv = [headers, ...rows]
    .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `interaction_research_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
