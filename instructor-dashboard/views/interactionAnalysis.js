/**
 * views/interactionAnalysis.js
 * E6: 상호작용 분석 — 취약개념 히트맵, 점수-대화량 산점도, 힌트 의존도
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

  container.innerHTML = `
    <h2 class="section-title">상호작용 분석</h2>

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
  `;

  renderHeatmap(heatmapData, container.querySelector('#ia-heatmap'));
  renderScatter(enriched, container.querySelector('#ia-scatter'));
  renderHintTable(enriched, container.querySelector('#ia-hint-tbody'));
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

  // Retina support
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, W, H);

  const maxTurns = Math.max(...enriched.map((s) => s.turnCount), 5);
  const maxScore = 100;

  // Grid
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

  // Axis labels
  ctx.fillStyle = '#6b7280';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('대화 턴 수', PAD.left + iW / 2, H - 4);
  ctx.save();
  ctx.translate(12, PAD.top + iH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('점수', 0, 0);
  ctx.restore();

  // Dots
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
