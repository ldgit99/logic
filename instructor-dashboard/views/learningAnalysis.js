/**
 * views/learningAnalysis.js
 * 학습 분석 — SSCI 논문 게재를 위한 연구용 분석 대시보드
 *
 * 포함 패널:
 *   A. 참여-성취 산점도 (4사분면 학습자 유형 분류)
 *   B. Bloom 인지 수준 레이더 차트
 *   C. 학습자 유형 분포 요약
 *   D. 오개념 패턴 분석
 *   E. 피드백 품질-성과 비교
 *   F. 연구용 종합 데이터 테이블 (논문 직접 활용)
 */

import { escapeHtml, scoreColor } from '../utils/format.js';

const BLOOM_LEVELS = ['기억', '이해', '적용', '분석', '평가', '창조'];
const BLOOM_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// ── 진입점 ────────────────────────────────────────────────────────

/**
 * @param {object[]} submissions  /dashboard/students 응답의 submissions 배열
 * @param {HTMLElement} container
 * @param {object[]} reflections  /dashboard/reflections 응답의 reflections 배열
 */
export function renderLearningAnalysis(submissions, container, reflections = []) {
  if (!container) return;

  const rows = Array.isArray(submissions) ? submissions : [];
  if (!rows.length) {
    container.innerHTML = '<p class="empty-msg">분석할 제출 데이터가 없습니다.</p>';
    return;
  }

  const profiles = buildStudentProfiles(rows, reflections);

  container.innerHTML = `
    <div class="la-page">

      <header class="la-header">
        <div>
          <p class="la-header-eyebrow">Learning Analytics</p>
          <h2 class="la-header-title">학습 분석</h2>
          <p class="la-header-desc">
            학생-AI 대화 로그, 형성평가, 성찰일지를 통합 분석합니다.
            각 패널은 SSCI 논문 Figure로 직접 활용 가능하도록 설계되었습니다.
          </p>
        </div>
        <div class="la-header-stat-row">
          <div class="la-header-stat"><span>분석 대상</span><strong>${profiles.length}명</strong></div>
          <div class="la-header-stat"><span>총 제출</span><strong>${rows.length}건</strong></div>
          <div class="la-header-stat"><span>총 대화 턴</span><strong>${profiles.reduce((s, p) => s + p.totalTurns, 0)}회</strong></div>
          <div class="la-header-stat"><span>평균 점수</span><strong>${avg(profiles.map((p) => p.avgScore)).toFixed(1)}점</strong></div>
        </div>
      </header>

      <!-- 패널 A + B (2열) -->
      <div class="la-grid-2">
        <div class="la-card" id="la-panel-scatter">
          <h3 class="la-card-title">A. 참여-성취 산점도</h3>
          <p class="la-card-desc">X축: 총 대화 턴 수 / Y축: 평균 점수 — 4사분면 학습자 유형 분류</p>
          <canvas id="la-scatter-canvas" width="480" height="340"></canvas>
          <div class="la-scatter-legend" id="la-scatter-legend"></div>
        </div>

        <div class="la-card" id="la-panel-bloom">
          <h3 class="la-card-title">B. Bloom 인지 수준 레이더</h3>
          <p class="la-card-desc">형성평가 문항의 Bloom 레벨별 평균 정답률 — 전체 학생 통합</p>
          <div class="la-radar-wrap">
            <svg id="la-radar-svg" viewBox="0 0 320 280" width="320" height="280"></svg>
          </div>
          <div class="la-bloom-stats" id="la-bloom-stats"></div>
        </div>
      </div>

      <!-- 패널 C: 학습자 유형 분포 -->
      <div class="la-card" id="la-panel-typology">
        <h3 class="la-card-title">C. 학습자 유형 분포</h3>
        <p class="la-card-desc">대화 참여도와 학습 성취도를 기준으로 4가지 학습자 유형으로 분류합니다.</p>
        <div class="la-typology-grid" id="la-typology-grid"></div>
      </div>

      <!-- 패널 D: 오개념 패턴 분석 -->
      <div class="la-card" id="la-panel-misconception">
        <h3 class="la-card-title">D. 오개념 패턴 분석</h3>
        <p class="la-card-desc">취약개념 빈도 Top-10 및 챕터별 분포 — 교수 개입 우선순위 도출</p>
        <div id="la-misconception-content"></div>
      </div>

      <!-- 패널 E: 피드백 품질-성과 비교 -->
      <div class="la-card" id="la-panel-feedback">
        <h3 class="la-card-title">E. 피드백 품질–성과 비교</h3>
        <p class="la-card-desc">AI 피드백 수준(Feed Up / Feed Back / Feed Forward)에 따른 점수 차이 분석</p>
        <div id="la-feedback-content"></div>
      </div>

      <!-- 패널 F: 연구용 종합 데이터 테이블 -->
      <div class="la-card" id="la-panel-research">
        <h3 class="la-card-title">F. 연구용 종합 데이터 테이블</h3>
        <p class="la-card-desc">학생별 핵심 지표를 통합한 논문 직접 활용 테이블 (Table 형식)</p>
        <div class="la-research-actions">
          <button class="btn-secondary" id="la-copy-table-btn">클립보드 복사 (TSV)</button>
        </div>
        <div class="la-table-scroll" id="la-research-table-wrap"></div>
      </div>

    </div>
  `;

  // 각 패널 렌더링
  drawScatterPlot(profiles, document.getElementById('la-scatter-canvas'), document.getElementById('la-scatter-legend'));
  drawBloomRadar(rows, document.getElementById('la-radar-svg'), document.getElementById('la-bloom-stats'));
  renderTypology(profiles, document.getElementById('la-typology-grid'));
  renderMisconceptionPanel(rows, document.getElementById('la-misconception-content'));
  renderFeedbackPanel(rows, document.getElementById('la-feedback-content'));
  renderResearchTable(profiles, document.getElementById('la-research-table-wrap'));

  // 클립보드 복사
  document.getElementById('la-copy-table-btn')?.addEventListener('click', () => {
    copyResearchTableTSV(profiles);
  });
}

// ── 학생 프로파일 구축 ────────────────────────────────────────────

function buildStudentProfiles(submissions, reflections) {
  const reflectionSet = new Set(
    (Array.isArray(reflections) ? reflections : [])
      .filter((r) => !r?.is_deleted)
      .map((r) => `${r?.student_id}::${r?.chapter_id}`),
  );

  const map = new Map();
  submissions.forEach((s) => {
    const sid = String(s?.student_id || s?.studentId || '').trim();
    if (!sid) return;
    if (!map.has(sid)) {
      map.set(sid, {
        studentId: sid,
        studentName: String(s?.student_name || s?.studentName || sid),
        submissions: [],
      });
    }
    map.get(sid).submissions.push(s);
  });

  return [...map.values()].map((p) => {
    const subs = p.submissions;
    const scores = subs.map((s) => Number(s?.score)).filter(Number.isFinite);
    const avgScore = scores.length ? avg(scores) : 0;

    // 대화 턴 집계
    const totalTurns = subs.reduce((sum, s) => {
      const msgs = Array.isArray(s?.messages)
        ? s.messages.filter((m) => String(m?.role || '').toLowerCase() === 'user').length
        : 0;
      const metrics = s?.chat_metrics || {};
      return sum + (msgs || Number(metrics.user_message_count || metrics.turn_count || 0));
    }, 0);

    // Bloom 집계
    const bloomAgg = Object.fromEntries(BLOOM_LEVELS.map((l) => [l, { correct: 0, total: 0 }]));
    subs.forEach((s) => {
      const bd = s?.bloomBreakdown || {};
      BLOOM_LEVELS.forEach((l) => {
        if (bd[l]) {
          bloomAgg[l].correct += bd[l].correct ?? 0;
          bloomAgg[l].total += bd[l].total ?? 0;
        }
      });
    });
    const bloomRates = BLOOM_LEVELS.map((l) => {
      const { correct, total } = bloomAgg[l];
      return total > 0 ? Math.round((correct / total) * 100) : null;
    });
    const highOrderRate = calcHighOrderRate(bloomAgg); // 분석+평가+창조

    // 오개념 집계
    const misconceptions = new Set();
    subs.forEach((s) => {
      (s?.weak_concepts || s?.weakConcepts || []).forEach((c) => misconceptions.add(String(c)));
      (s?.chat_summary?.misconceptions || []).forEach((c) => misconceptions.add(String(c)));
    });

    // 피드백 품질
    const feedbackScores = subs.map((s) => {
      let q = 0;
      if (s?.feedUp && s.feedUp.length > 10) q++;
      if (s?.feedBack && s.feedBack.length > 30) q++;
      if (s?.feedForward && s.feedForward.length > 30) q++;
      return q;
    });
    const avgFeedbackQuality = feedbackScores.length ? avg(feedbackScores) : 0;

    // 성찰일지 제출률
    const reflectionChapters = subs.filter((s) => {
      const key = `${p.studentId}::${String(s?.chapter_id || s?.chapterId || '')}`;
      return reflectionSet.has(key);
    }).length;
    const reflectionRate = subs.length > 0 ? Math.round((reflectionChapters / subs.length) * 100) : 0;

    // 학습자 유형 분류 (후처리에서 중앙값 기준으로 재분류)
    return {
      ...p,
      avgScore: Math.round(avgScore * 10) / 10,
      totalTurns,
      chapterCount: subs.length,
      bloomRates,
      highOrderRate,
      misconceptionCount: misconceptions.size,
      misconceptions: [...misconceptions],
      avgFeedbackQuality: Math.round(avgFeedbackQuality * 10) / 10,
      reflectionRate,
    };
  }).map((p, _, arr) => {
    // 중앙값 기준 유형 분류
    const medTurns = median(arr.map((x) => x.totalTurns));
    const medScore = median(arr.map((x) => x.avgScore));
    const highEngage = p.totalTurns >= medTurns;
    const highAchieve = p.avgScore >= medScore;
    let typology;
    if (highEngage && highAchieve) typology = '적극 학습자';
    else if (highEngage && !highAchieve) typology = '노력형 학습자';
    else if (!highEngage && highAchieve) typology = '효율 학습자';
    else typology = '위험 학습자';
    return { ...p, typology };
  }).sort((a, b) => a.studentId.localeCompare(b.studentId));
}

// ── 패널 A: 참여-성취 산점도 ──────────────────────────────────────

function drawScatterPlot(profiles, canvas, legendEl) {
  if (!canvas) return;

  const W = canvas.width;
  const H = canvas.height;
  const pad = { top: 30, right: 30, bottom: 50, left: 55 };
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  if (!profiles.length) return;

  const maxTurns = Math.max(...profiles.map((p) => p.totalTurns), 1);
  const medTurns = median(profiles.map((p) => p.totalTurns));
  const medScore = median(profiles.map((p) => p.avgScore));

  const cx = (t) => pad.left + (t / maxTurns) * (W - pad.left - pad.right);
  const cy = (s) => pad.top + (1 - s / 100) * (H - pad.top - pad.bottom);

  // 배경 사분면
  const mx = cx(medTurns);
  const my = cy(medScore);
  const quadColors = ['rgba(16,185,129,0.06)', 'rgba(245,158,11,0.06)',
    'rgba(99,102,241,0.06)', 'rgba(239,68,68,0.06)'];
  const quads = [
    [pad.left, pad.top, mx - pad.left, my - pad.top],     // 고참여/고성취
    [mx, pad.top, W - pad.right - mx, my - pad.top],      // 저참여/고성취
    [pad.left, my, mx - pad.left, H - pad.bottom - my],   // 고참여/저성취
    [mx, my, W - pad.right - mx, H - pad.bottom - my],    // 저참여/저성취
  ];
  quads.forEach(([x, y, w, h], i) => {
    ctx.fillStyle = quadColors[i];
    ctx.fillRect(x, y, w, h);
  });

  // 사분면 레이블
  ctx.font = '10px sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.textAlign = 'center';
  ctx.fillText('적극 학습자', (pad.left + mx) / 2, pad.top + 14);
  ctx.fillText('효율 학습자', (mx + W - pad.right) / 2, pad.top + 14);
  ctx.fillText('노력형 학습자', (pad.left + mx) / 2, H - pad.bottom - 6);
  ctx.fillText('위험 학습자', (mx + W - pad.right) / 2, H - pad.bottom - 6);

  // 중앙값 기준선
  ctx.strokeStyle = '#d1d5db';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(mx, pad.top); ctx.lineTo(mx, H - pad.bottom); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(pad.left, my); ctx.lineTo(W - pad.right, my); ctx.stroke();
  ctx.setLineDash([]);

  // Y축
  ctx.fillStyle = '#6b7280';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'right';
  for (let v = 0; v <= 100; v += 20) {
    const y = cy(v);
    ctx.fillText(`${v}`, pad.left - 6, y + 4);
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
  }

  // X축
  ctx.textAlign = 'center';
  ctx.fillStyle = '#6b7280';
  for (let t = 0; t <= maxTurns; t += Math.ceil(maxTurns / 5)) {
    const x = cx(t);
    ctx.fillText(`${t}`, x, H - pad.bottom + 16);
  }

  // 축 레이블
  ctx.fillStyle = '#374151';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('총 대화 턴 수', pad.left + (W - pad.left - pad.right) / 2, H - pad.bottom + 34);
  ctx.save();
  ctx.translate(14, pad.top + (H - pad.top - pad.bottom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('평균 점수', 0, 0);
  ctx.restore();

  // 산점도 점
  const typeColors = {
    '적극 학습자': '#10b981',
    '효율 학습자': '#6366f1',
    '노력형 학습자': '#f59e0b',
    '위험 학습자': '#ef4444',
  };
  profiles.forEach((p) => {
    const x = cx(p.totalTurns);
    const y = cy(p.avgScore);
    const color = typeColors[p.typology] || '#6b7280';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.8;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // 범례
  if (legendEl) {
    legendEl.innerHTML = Object.entries(typeColors).map(([label, color]) => `
      <span class="la-legend-item">
        <span class="la-legend-dot" style="background:${color}"></span>${label}
      </span>
    `).join('');
  }
}

// ── 패널 B: Bloom 레이더 차트 ────────────────────────────────────

function drawBloomRadar(submissions, svgEl, statsEl) {
  if (!svgEl) return;

  const bloomAgg = Object.fromEntries(BLOOM_LEVELS.map((l) => [l, { correct: 0, total: 0 }]));
  submissions.forEach((s) => {
    const bd = s?.bloomBreakdown || {};
    BLOOM_LEVELS.forEach((l) => {
      if (bd[l]) {
        bloomAgg[l].correct += bd[l].correct ?? 0;
        bloomAgg[l].total += bd[l].total ?? 0;
      }
    });
  });

  const rates = BLOOM_LEVELS.map((l) => {
    const { correct, total } = bloomAgg[l];
    return total > 0 ? correct / total : 0;
  });

  const hasData = rates.some((r) => r > 0);
  if (!hasData) {
    svgEl.innerHTML = '<text x="160" y="140" text-anchor="middle" fill="#9ca3af" font-size="13">Bloom 데이터 없음</text>';
    return;
  }

  const cx = 160, cy = 145, R = 100, n = BLOOM_LEVELS.length;
  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const px = (r, i) => cx + r * Math.cos(angle(i));
  const py = (r, i) => cy + r * Math.sin(angle(i));

  let svg = '';

  // 배경 그물
  [0.25, 0.5, 0.75, 1].forEach((t) => {
    const pts = BLOOM_LEVELS.map((_, i) => `${px(R * t, i)},${py(R * t, i)}`).join(' ');
    svg += `<polygon points="${pts}" fill="none" stroke="#e5e7eb" stroke-width="1"/>`;
    svg += `<text x="${cx + 4}" y="${cy - R * t + 4}" font-size="9" fill="#9ca3af">${Math.round(t * 100)}%</text>`;
  });

  // 축
  BLOOM_LEVELS.forEach((l, i) => {
    svg += `<line x1="${cx}" y1="${cy}" x2="${px(R, i)}" y2="${py(R, i)}" stroke="#e5e7eb" stroke-width="1"/>`;
    const lx = px(R + 20, i);
    const ly = py(R + 20, i);
    const anchor = lx < cx - 5 ? 'end' : lx > cx + 5 ? 'start' : 'middle';
    svg += `<text x="${lx}" y="${ly + 4}" text-anchor="${anchor}" font-size="11" fill="#374151" font-weight="600">${escapeHtml(l)}</text>`;
  });

  // 데이터 영역
  const dataPts = rates.map((r, i) => `${px(R * r, i)},${py(R * r, i)}`).join(' ');
  svg += `<polygon points="${dataPts}" fill="rgba(99,102,241,0.2)" stroke="#6366f1" stroke-width="2"/>`;

  // 데이터 점
  rates.forEach((r, i) => {
    const color = BLOOM_COLORS[i];
    svg += `<circle cx="${px(R * r, i)}" cy="${py(R * r, i)}" r="4" fill="${color}" stroke="#fff" stroke-width="1.5"/>`;
  });

  svgEl.innerHTML = svg;

  // 수치 표
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="la-bloom-row">
        ${BLOOM_LEVELS.map((l, i) => {
          const { correct, total } = bloomAgg[l];
          const rate = total > 0 ? Math.round((correct / total) * 100) : null;
          return `
            <div class="la-bloom-cell">
              <span class="la-bloom-dot" style="background:${BLOOM_COLORS[i]}"></span>
              <span class="la-bloom-level">${l}</span>
              <strong class="la-bloom-rate">${rate != null ? `${rate}%` : '-'}</strong>
              <span class="la-bloom-base">(${total > 0 ? `${correct}/${total}` : '데이터없음'})</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
}

// ── 패널 C: 학습자 유형 분포 ──────────────────────────────────────

function renderTypology(profiles, el) {
  if (!el) return;

  const types = {
    '적극 학습자': { color: '#10b981', bg: '#d1fae5', desc: '높은 참여 + 높은 성취', icon: '◆' },
    '효율 학습자': { color: '#6366f1', bg: '#ede9fe', desc: '낮은 참여 + 높은 성취', icon: '▲' },
    '노력형 학습자': { color: '#f59e0b', bg: '#fef3c7', desc: '높은 참여 + 낮은 성취', icon: '●' },
    '위험 학습자': { color: '#ef4444', bg: '#fee2e2', desc: '낮은 참여 + 낮은 성취', icon: '■' },
  };

  const grouped = {};
  Object.keys(types).forEach((t) => { grouped[t] = []; });
  profiles.forEach((p) => { if (grouped[p.typology]) grouped[p.typology].push(p); });

  el.innerHTML = `
    <div class="la-typology-cards">
      ${Object.entries(types).map(([name, cfg]) => {
        const members = grouped[name] || [];
        const avgSc = members.length ? avg(members.map((p) => p.avgScore)).toFixed(1) : '-';
        const avgTn = members.length ? Math.round(avg(members.map((p) => p.totalTurns))) : '-';
        const pct = profiles.length ? Math.round((members.length / profiles.length) * 100) : 0;
        return `
          <div class="la-typology-card" style="border-color:${cfg.color};background:${cfg.bg}">
            <div class="la-typology-icon" style="color:${cfg.color}">${cfg.icon}</div>
            <div class="la-typology-name" style="color:${cfg.color}">${name}</div>
            <div class="la-typology-desc">${cfg.desc}</div>
            <div class="la-typology-count">${members.length}명 <span>(${pct}%)</span></div>
            <div class="la-typology-metrics">
              <span>평균 점수 <strong>${avgSc}점</strong></span>
              <span>평균 턴 <strong>${avgTn}회</strong></span>
            </div>
            ${members.length ? `
              <details class="la-typology-detail">
                <summary>학생 목록</summary>
                <ul class="la-typology-member-list">
                  ${members.map((p) => `<li>${escapeHtml(p.studentName)} <span>(${escapeHtml(p.studentId)})</span></li>`).join('')}
                </ul>
              </details>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>

    <div class="la-typology-insight">
      <strong>해석 가이드:</strong>
      위험 학습자(낮은 참여+낮은 성취)에게는 즉각적인 교수 개입이 필요합니다.
      노력형 학습자(높은 참여+낮은 성취)는 학습 전략 지도가 효과적입니다.
      효율 학습자(낮은 참여+높은 성취)는 선행 지식 보유 가능성이 높습니다.
    </div>
  `;
}

// ── 패널 D: 오개념 패턴 분석 ──────────────────────────────────────

function renderMisconceptionPanel(submissions, el) {
  if (!el) return;

  // 오개념 빈도 집계
  const conceptCount = new Map();
  const conceptChapterMap = new Map();

  submissions.forEach((s) => {
    const ch = String(s?.chapter_id || s?.chapterId || '?');
    const concepts = [
      ...(s?.weak_concepts || s?.weakConcepts || []),
      ...(s?.chat_summary?.misconceptions || []),
    ].map((c) => String(c).trim()).filter(Boolean);

    [...new Set(concepts)].forEach((c) => {
      conceptCount.set(c, (conceptCount.get(c) || 0) + 1);
      if (!conceptChapterMap.has(c)) conceptChapterMap.set(c, new Map());
      conceptChapterMap.get(c).set(ch, (conceptChapterMap.get(c).get(ch) || 0) + 1);
    });
  });

  if (!conceptCount.size) {
    el.innerHTML = '<p class="empty-msg">오개념 데이터가 없습니다.</p>';
    return;
  }

  const sorted = [...conceptCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxCount = sorted[0][1];

  el.innerHTML = `
    <div class="la-misconception-wrap">
      <div class="la-misconception-chart">
        <h4 class="la-sub-title">빈도 Top-10 취약개념</h4>
        <div class="la-mc-bars">
          ${sorted.map(([concept, count], i) => {
            const pct = Math.round((count / maxCount) * 100);
            const chapters = [...(conceptChapterMap.get(concept) || new Map()).entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([ch, n]) => `Ch.${ch}(${n}명)`)
              .join(', ');
            return `
              <div class="la-mc-row">
                <span class="la-mc-rank">${i + 1}</span>
                <div class="la-mc-body">
                  <div class="la-mc-label-row">
                    <span class="la-mc-name">${escapeHtml(concept)}</span>
                    <span class="la-mc-count">${count}명</span>
                  </div>
                  <div class="la-mc-bar-wrap">
                    <div class="la-mc-bar" style="width:${pct}%"></div>
                  </div>
                  <div class="la-mc-chapters">${chapters}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="la-misconception-summary">
        <h4 class="la-sub-title">요약 통계</h4>
        <table class="dash-table">
          <thead><tr><th>지표</th><th>값</th></tr></thead>
          <tbody>
            <tr><td>총 식별 오개념 수</td><td><strong>${conceptCount.size}개</strong></td></tr>
            <tr><td>가장 빈번한 오개념</td><td><strong>${escapeHtml(sorted[0][0])}</strong></td></tr>
            <tr><td>최다 오개념 학생 수</td><td><strong>${sorted[0][1]}명</strong></td></tr>
            <tr><td>오개념 1개 이상 학생</td><td><strong>${countStudentsWithMisconceptions(submissions)}명</strong></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function countStudentsWithMisconceptions(submissions) {
  const students = new Set();
  submissions.forEach((s) => {
    const concepts = [
      ...(s?.weak_concepts || s?.weakConcepts || []),
      ...(s?.chat_summary?.misconceptions || []),
    ];
    if (concepts.length > 0) {
      students.add(String(s?.student_id || s?.studentId || ''));
    }
  });
  return students.size;
}

// ── 패널 E: 피드백 품질-성과 비교 ───────────────────────────────

function renderFeedbackPanel(submissions, el) {
  if (!el) return;

  // 그룹 분류: 각 피드백 유형 있음/없음
  const groups = {
    feedUp: { yes: [], no: [] },
    feedBack: { yes: [], no: [] },
    feedForward: { yes: [], no: [] },
    fullFeedback: { yes: [], no: [] },
  };

  submissions.forEach((s) => {
    const score = Number(s?.score);
    if (!Number.isFinite(score)) return;

    const hasFU = s?.feedUp && s.feedUp.length > 10;
    const hasFB = s?.feedBack && s.feedBack.length > 30;
    const hasFF = s?.feedForward && s.feedForward.length > 30;

    groups.feedUp[hasFU ? 'yes' : 'no'].push(score);
    groups.feedBack[hasFB ? 'yes' : 'no'].push(score);
    groups.feedForward[hasFF ? 'yes' : 'no'].push(score);
    groups.fullFeedback[(hasFU && hasFB && hasFF) ? 'yes' : 'no'].push(score);
  });

  const labels = {
    feedUp: 'Feed Up',
    feedBack: 'Feed Back',
    feedForward: 'Feed Forward',
    fullFeedback: '3단계 완전 피드백',
  };

  el.innerHTML = `
    <div class="la-feedback-wrap">
      <table class="dash-table la-feedback-table">
        <thead>
          <tr>
            <th>피드백 유형</th>
            <th>있음 (n)</th>
            <th>있음 평균 점수</th>
            <th>없음 (n)</th>
            <th>없음 평균 점수</th>
            <th>차이</th>
            <th>효과 방향</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(groups).map(([key, { yes, no }]) => {
            const avgYes = yes.length ? avg(yes) : null;
            const avgNo = no.length ? avg(no) : null;
            const diff = avgYes != null && avgNo != null ? avgYes - avgNo : null;
            const direction = diff == null ? '-' : diff > 2 ? '▲ 긍정적' : diff < -2 ? '▼ 부정적' : '→ 유사';
            const dirClass = diff == null ? '' : diff > 2 ? 'rate-good' : diff < -2 ? 'rate-bad' : 'rate-warn';
            return `
              <tr>
                <td><strong>${labels[key]}</strong></td>
                <td>${yes.length}건</td>
                <td>${avgYes != null ? `<strong class="${scoreColor(avgYes)}">${avgYes.toFixed(1)}점</strong>` : '-'}</td>
                <td>${no.length}건</td>
                <td>${avgNo != null ? `<strong class="${scoreColor(avgNo)}">${avgNo.toFixed(1)}점</strong>` : '-'}</td>
                <td>${diff != null ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}점` : '-'}</td>
                <td class="${dirClass}">${direction}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      <p class="la-footnote">
        * 피드백 있음 기준: Feed Up &gt; 10자, Feed Back/Forward &gt; 30자.
        점수 차이 ±2점 이하는 유사한 것으로 판정합니다.
      </p>
    </div>
  `;
}

// ── 패널 F: 연구용 종합 데이터 테이블 ───────────────────────────

function renderResearchTable(profiles, el) {
  if (!el) return;

  el.innerHTML = `
    <table class="dash-table la-research-table" id="la-research-data-table">
      <thead>
        <tr>
          <th>학번</th>
          <th>이름</th>
          <th>챕터 수</th>
          <th>총 대화턴</th>
          <th>평균점수</th>
          <th>고차사고율*</th>
          <th>오개념 수</th>
          <th>성찰 완성(%)</th>
          <th>피드백 품질†</th>
          <th>학습자 유형</th>
        </tr>
      </thead>
      <tbody>
        ${profiles.map((p) => {
          const scoreClass = scoreColor(p.avgScore);
          const typeColors = {
            '적극 학습자': 'la-type-active',
            '효율 학습자': 'la-type-efficient',
            '노력형 학습자': 'la-type-effort',
            '위험 학습자': 'la-type-risk',
          };
          return `
            <tr>
              <td>${escapeHtml(p.studentId)}</td>
              <td>${escapeHtml(p.studentName)}</td>
              <td>${p.chapterCount}</td>
              <td>${p.totalTurns}</td>
              <td class="${scoreClass}"><strong>${p.avgScore.toFixed(1)}</strong></td>
              <td>${p.highOrderRate != null ? `${p.highOrderRate}%` : '-'}</td>
              <td>${p.misconceptionCount}</td>
              <td>${p.reflectionRate}%</td>
              <td>${p.avgFeedbackQuality.toFixed(1)}/3</td>
              <td><span class="la-type-badge ${typeColors[p.typology] || ''}">${p.typology}</span></td>
            </tr>
          `;
        }).join('')}
      </tbody>
      <tfoot>
        <tr class="la-research-avg-row">
          <td colspan="2"><strong>평균</strong></td>
          <td>${avg(profiles.map((p) => p.chapterCount)).toFixed(1)}</td>
          <td>${avg(profiles.map((p) => p.totalTurns)).toFixed(1)}</td>
          <td class="${scoreColor(avg(profiles.map((p) => p.avgScore)))}">
            <strong>${avg(profiles.map((p) => p.avgScore)).toFixed(1)}</strong>
          </td>
          <td>${avgNullable(profiles.map((p) => p.highOrderRate))}</td>
          <td>${avg(profiles.map((p) => p.misconceptionCount)).toFixed(1)}</td>
          <td>${avg(profiles.map((p) => p.reflectionRate)).toFixed(1)}%</td>
          <td>${avg(profiles.map((p) => p.avgFeedbackQuality)).toFixed(2)}</td>
          <td>-</td>
        </tr>
      </tfoot>
    </table>
    <p class="la-footnote">
      * 고차사고율: Bloom 분석+평가+창조 문항의 평균 정답률.<br>
      † 피드백 품질: Feed Up/Back/Forward 존재 여부 합산 (0–3점 척도).
    </p>
  `;
}

function copyResearchTableTSV(profiles) {
  const headers = ['학번', '이름', '챕터수', '총대화턴', '평균점수', '고차사고율', '오개념수', '성찰완성율', '피드백품질', '학습자유형'];
  const rows = profiles.map((p) => [
    p.studentId, p.studentName, p.chapterCount, p.totalTurns,
    p.avgScore.toFixed(1),
    p.highOrderRate != null ? p.highOrderRate : '',
    p.misconceptionCount, p.reflectionRate, p.avgFeedbackQuality.toFixed(1),
    p.typology,
  ]);
  const tsv = [headers, ...rows].map((r) => r.join('\t')).join('\n');
  navigator.clipboard.writeText(tsv).then(() => {
    const btn = document.getElementById('la-copy-table-btn');
    if (btn) { btn.textContent = '복사 완료!'; setTimeout(() => { btn.textContent = '클립보드 복사 (TSV)'; }, 2000); }
  }).catch(() => {
    alert('클립보드 복사에 실패했습니다. 브라우저 권한을 확인하세요.');
  });
}

// ── 유틸 ──────────────────────────────────────────────────────────

function avg(arr) {
  const valid = arr.filter(Number.isFinite);
  return valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : 0;
}

function avgNullable(arr) {
  const valid = arr.filter((v) => v != null && Number.isFinite(v));
  return valid.length ? `${(valid.reduce((s, v) => s + v, 0) / valid.length).toFixed(1)}%` : '-';
}

function median(arr) {
  const sorted = [...arr].filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calcHighOrderRate(bloomAgg) {
  const highOrder = ['분석', '평가', '창조'];
  let correct = 0, total = 0;
  highOrder.forEach((l) => {
    correct += bloomAgg[l]?.correct ?? 0;
    total += bloomAgg[l]?.total ?? 0;
  });
  return total > 0 ? Math.round((correct / total) * 100) : null;
}
