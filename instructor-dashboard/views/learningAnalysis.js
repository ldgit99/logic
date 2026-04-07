/**
 * views/learningAnalysis.js
 * 학습 분석 — SSCI 논문 수준 대화 기반 학습 분석
 *
 * 이론적 기반:
 *   - Transactional Distance Theory (Moore, 1973): 대화 주도성 측정
 *   - Community of Inquiry (Garrison et al., 2000): 인지적 실재감
 *   - Productive Failure (Kapur, 2016): 혼란→돌파 패턴
 *   - Self-Regulated Learning (Zimmerman, 2002): 메타인지 발화
 *   - Bloom's Revised Taxonomy (Anderson & Krathwohl, 2001)
 *
 * 핵심 분석 단위: 학생 발화(utterance) — 단순 턴 수가 아닌 내용 기반 분류
 */

import { escapeHtml, scoreColor } from '../utils/format.js';

// ── 이론 박스 헬퍼 ────────────────────────────────────────────────

/**
 * 패널별 이론 설명 박스를 생성합니다.
 * @param {{ theory: string, cite: string, summary: string, metrics: {name:string, def:string, interpret:string}[], caution?: string }} cfg
 */
function buildTheoryBox(cfg) {
  const metricsHtml = (cfg.metrics || []).map((m) => `
    <div class="la-tb-metric">
      <span class="la-tb-metric-name">${escapeHtml(m.name)}</span>
      <span class="la-tb-metric-def">${escapeHtml(m.def)}</span>
      ${m.interpret ? `<span class="la-tb-metric-interp">${escapeHtml(m.interpret)}</span>` : ''}
    </div>
  `).join('');

  return `
    <details class="la-theory-box">
      <summary class="la-tb-summary">
        <span class="la-tb-icon">📖</span>
        이론 및 지표 설명
        <span class="la-tb-cite">${escapeHtml(cfg.cite)}</span>
      </summary>
      <div class="la-tb-body">
        <div class="la-tb-theory-row">
          <div class="la-tb-left">
            <p class="la-tb-label">이론적 근거</p>
            <p class="la-tb-theory">${escapeHtml(cfg.theory)}</p>
            <p class="la-tb-summary-text">${escapeHtml(cfg.summary)}</p>
          </div>
          ${metricsHtml ? `<div class="la-tb-right"><p class="la-tb-label">측정 지표</p>${metricsHtml}</div>` : ''}
        </div>
        ${cfg.caution ? `<p class="la-tb-caution">⚠ ${escapeHtml(cfg.caution)}</p>` : ''}
      </div>
    </details>
  `;
}

// ── 인지 수준 체계 (Bloom 기반 6단계) ──────────────────────────────

const COG_LEVELS = [
  { id: 0, label: '수동 반응',   short: 'L0', color: '#9ca3af', desc: '단순 확인·인지 (네/알겠어요)' },
  { id: 1, label: '사실 질문',   short: 'L1', color: '#60a5fa', desc: '정의·개념 묻기 — 기억(Remember)' },
  { id: 2, label: '개념 이해',   short: 'L2', color: '#34d399', desc: '이유·원리 탐색 — 이해(Understand)' },
  { id: 3, label: '적용 시도',   short: 'L3', color: '#fbbf24', desc: '상황 적용·예시 — 적용(Apply)' },
  { id: 4, label: '비판적 사고', short: 'L4', color: '#f87171', desc: '비교·도전·반박 — 분석/평가(Analyze/Evaluate)' },
  { id: 5, label: '메타인지',    short: 'L5', color: '#a78bfa', desc: '자기 이해 점검 — 자기조절(Metacognition)' },
];

// ── 학습 사건 유형 ─────────────────────────────────────────────────

const EVENT_TYPES = {
  confusion:    { label: '혼란',     color: '#f87171', icon: '?' },
  breakthrough: { label: '돌파',     color: '#34d399', icon: '!' },
  critical:     { label: '비판적',   color: '#fbbf24', icon: '↯' },
  persistence:  { label: '지속 탐구', color: '#60a5fa', icon: '→' },
};

// ── 진입점 ──────────────────────────────────────────────────────────

export function renderLearningAnalysis(submissions, container, reflections = []) {
  if (!container) return;

  const rows = Array.isArray(submissions) ? submissions : [];
  if (!rows.length) {
    container.innerHTML = '<p class="empty-msg">분석할 데이터가 없습니다.</p>';
    return;
  }

  const profiles = buildProfiles(rows, reflections);
  const hasConvData = profiles.some((p) => p.totalAnalyzedMessages > 0);

  container.innerHTML = `
    <div class="la-page">

      <header class="la-header">
        <div>
          <p class="la-header-eyebrow">Dialogue-Based Learning Analytics</p>
          <h2 class="la-header-title">대화 기반 학습 분석</h2>
          <p class="la-header-desc">
            학생 발화(utterance) 내용을 Bloom 인지 수준으로 자동 분류하고,
            대화 궤적·학습 사건·주도성 지수를 통해 학생-AI 상호작용의 질을 측정합니다.
            <br><span class="la-ref">참조: Moore(1973), Garrison et al.(2000), Kapur(2016), Zimmerman(2002)</span>
          </p>
        </div>
        <div class="la-kpi-row">
          ${buildKPI('분석 학생', `${profiles.length}명`)}
          ${buildKPI('총 학생 발화', `${profiles.reduce((s, p) => s + p.totalAnalyzedMessages, 0)}개`)}
          ${buildKPI('평균 인지 수준', hasConvData ? `${avg(profiles.filter(p=>p.totalAnalyzedMessages>0).map((p) => p.avgCogLevel)).toFixed(2)}` : '-')}
          ${buildKPI('고차 사고 비율', hasConvData ? `${avg(profiles.filter(p=>p.totalAnalyzedMessages>0).map((p) => p.highOrderRate)).toFixed(1)}%` : '-')}
        </div>
      </header>

      ${!hasConvData ? `
        <div class="la-warn-banner">
          대화 원문(messages) 데이터가 없어 발화 분석을 건너뜁니다.
          점수·Bloom·피드백 기반 분석만 표시합니다.
        </div>
      ` : ''}

      <!-- A: 인지 수준 분포 -->
      <div class="la-card">
        <div class="la-card-head">
          <div>
            <h3 class="la-card-title">A. 학생 발화 인지 수준 분포</h3>
            <p class="la-card-desc">Bloom 분류 기준 학생 발화 유형 분포 — 각 막대는 학생 한 명의 발화 구성을 나타냅니다.</p>
          </div>
          <span class="la-theory-tag">Bloom(2001) · CoI(Garrison,2000)</span>
        </div>
        <div id="la-cog-dist-wrap"></div>
      </div>

      <!-- B: 인지 주도성-성취 매트릭스 -->
      <div class="la-grid-2">
        <div class="la-card">
          <div class="la-card-head">
            <div>
              <h3 class="la-card-title">B. 대화 주도성-인지 깊이 매트릭스</h3>
              <p class="la-card-desc">X축: 학생 질문 비율(Agency) / Y축: 평균 인지 수준 / 원 크기: 총 발화 수</p>
            </div>
            <span class="la-theory-tag">Transactional Distance (Moore, 1973)</span>
          </div>
          <canvas id="la-agency-canvas" width="440" height="320"></canvas>
          <div id="la-agency-legend"></div>
        </div>

        <div class="la-card">
          <div class="la-card-head">
            <div>
              <h3 class="la-card-title">C. 대화 궤적 유형 분류</h3>
              <p class="la-card-desc">세션 내 인지 수준 변화 방향 — 상승/평탄/하강 궤적별 성취도 비교</p>
            </div>
            <span class="la-theory-tag">Productive Failure (Kapur, 2016)</span>
          </div>
          <div id="la-trajectory-wrap"></div>
        </div>
      </div>

      <!-- D: 핵심 학습 사건 -->
      <div class="la-card">
        <div class="la-card-head">
          <div>
            <h3 class="la-card-title">D. 핵심 학습 사건 탐지</h3>
            <p class="la-card-desc">대화 내 혼란·돌파·비판적 사고 사건을 감지합니다. 생산적 혼란 지수 = 혼란 후 비판적 사고 또는 돌파 발생 비율</p>
          </div>
          <span class="la-theory-tag">SRL (Zimmerman, 2002) · Metacognition</span>
        </div>
        <div id="la-events-wrap"></div>
      </div>

      <!-- E: 고-저 성취 집단 대화 특성 비교 -->
      <div class="la-card">
        <div class="la-card-head">
          <div>
            <h3 class="la-card-title">E. 고성취 vs 저성취 집단 대화 특성 비교</h3>
            <p class="la-card-desc">상위 33% vs 하위 33% 학생의 발화 패턴 비교 — 논문 Table 직접 활용 가능</p>
          </div>
          <span class="la-theory-tag">Evidence-based Analytics</span>
        </div>
        <div id="la-compare-wrap"></div>
      </div>

      <!-- F: 연구용 종합 지표 테이블 -->
      <div class="la-card">
        <div class="la-card-head">
          <div>
            <h3 class="la-card-title">F. 연구용 종합 지표 테이블</h3>
            <p class="la-card-desc">학생별 대화 기반 핵심 지표 통합 — 논문 Table 1 직접 활용</p>
          </div>
          <button class="btn-secondary" id="la-tsv-btn" style="flex-shrink:0">TSV 복사</button>
        </div>
        <div class="la-table-scroll" id="la-research-wrap"></div>
      </div>

    </div>
  `;

  // 각 패널 렌더링
  renderCogDist(profiles, document.getElementById('la-cog-dist-wrap'));
  drawAgencyMatrix(profiles, document.getElementById('la-agency-canvas'), document.getElementById('la-agency-legend'));
  renderTrajectory(profiles, document.getElementById('la-trajectory-wrap'));
  renderEvents(profiles, document.getElementById('la-events-wrap'));
  renderComparison(profiles, document.getElementById('la-compare-wrap'));
  renderResearchTable(profiles, document.getElementById('la-research-wrap'));

  document.getElementById('la-tsv-btn')?.addEventListener('click', () => copyTSV(profiles));
}

// ── 프로파일 구축 ─────────────────────────────────────────────────

function buildProfiles(submissions, reflections) {
  const reflSet = new Set(
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
    const avgScore = scores.length ? avg(scores) : null;

    // 발화 분석
    let allUserMessages = [];
    let allEvents = [];
    let trajectories = [];

    subs.forEach((s) => {
      const msgs = getUserMessages(s);
      const classified = msgs.map((m) => ({ ...m, level: classifyUtterance(m.content) }));
      allUserMessages = allUserMessages.concat(classified);

      const events = detectLearningEvents(getVisibleMessages(s));
      allEvents = allEvents.concat(events);

      if (classified.length >= 2) {
        const traj = computeTrajectory(classified.map((m) => m.level));
        trajectories.push(traj);
      }
    });

    const levelCounts = Array(6).fill(0);
    allUserMessages.forEach((m) => { levelCounts[m.level]++; });
    const total = allUserMessages.length;
    const levelRates = levelCounts.map((c) => total > 0 ? Math.round((c / total) * 1000) / 10 : 0);
    const avgCogLevel = total > 0
      ? allUserMessages.reduce((s, m) => s + m.level, 0) / total
      : null;
    const highOrderRate = total > 0
      ? ((levelCounts[3] + levelCounts[4] + levelCounts[5]) / total) * 100
      : null;

    // 학생 질문 비율 (Agency)
    const questionCount = allUserMessages.filter((m) => isQuestion(m.content)).length;
    const agencyIndex = total > 0 ? (questionCount / total) * 100 : null;

    // 메시지 평균 길이
    const avgMsgLength = total > 0
      ? avg(allUserMessages.map((m) => m.content.length))
      : null;

    // 생산적 혼란 지수
    const productiveStruggleIndex = calcProductiveStruggle(allEvents);

    // 지배적 궤적
    const dominantTrajectory = calcDominantTrajectory(trajectories);

    // Bloom 집계
    const bloomAgg = Object.fromEntries(['기억','이해','적용','분석','평가','창조'].map((l) => [l, { correct: 0, total: 0 }]));
    subs.forEach((s) => {
      const bd = s?.bloomBreakdown || {};
      Object.keys(bloomAgg).forEach((l) => {
        if (bd[l]) {
          bloomAgg[l].correct += bd[l].correct ?? 0;
          bloomAgg[l].total += bd[l].total ?? 0;
        }
      });
    });

    // 피드백 품질
    const feedbackQuality = avg(subs.map((s) => {
      let q = 0;
      if (s?.feedUp && s.feedUp.length > 10) q++;
      if (s?.feedBack && s.feedBack.length > 30) q++;
      if (s?.feedForward && s.feedForward.length > 30) q++;
      return q;
    }));

    // 성찰 완성율
    const reflCount = subs.filter((s) =>
      reflSet.has(`${p.studentId}::${String(s?.chapter_id || s?.chapterId || '')}`)
    ).length;
    const reflectionRate = subs.length > 0 ? (reflCount / subs.length) * 100 : 0;

    return {
      studentId: p.studentId,
      studentName: p.studentName,
      chapterCount: subs.length,
      avgScore,
      totalAnalyzedMessages: total,
      levelCounts,
      levelRates,
      avgCogLevel,
      highOrderRate,
      agencyIndex,
      avgMsgLength,
      events: allEvents,
      confusionCount: allEvents.filter((e) => e.type === 'confusion').length,
      breakthroughCount: allEvents.filter((e) => e.type === 'breakthrough').length,
      criticalCount: allEvents.filter((e) => e.type === 'critical').length,
      persistenceCount: allEvents.filter((e) => e.type === 'persistence').length,
      productiveStruggleIndex,
      dominantTrajectory,
      feedbackQuality,
      reflectionRate,
      bloomAgg,
    };
  }).sort((a, b) => a.studentId.localeCompare(b.studentId));
}

// ── 발화 분류 엔진 (Bloom 기반) ─────────────────────────────────────

function classifyUtterance(content) {
  if (!content || content.trim().length < 2) return 0;
  const t = content;

  // L5 메타인지 — 자기 이해 점검, SRL
  if (/이해(가|가\s*)?\s*(됩니다|됐|됐어|됐어요|안\s*돼|못|안됩)|모르겠|헷갈|어렵|어려운|이제\s*(알겠|이해|됩|됐)|그렇구나|아\s*그렇|확인(해|해줘|해주세요)|맞나요|맞죠|제가\s*(이해|맞게)|다시\s*(설명|생각|이해)|다시\s*한번|이해했|이해가\s*됐/.test(t)) return 5;

  // L4 비판적 / 분석적 — 반박·비교·도전
  if (/근데|하지만|그런데|그러나|아닌가요|잘못|틀린|틀리지|다른\s*방법|왜\s*꼭|차이(가|는|점)|비교(해|하면|했을)|더\s*(나은|좋은|효율|빠른)|대신|그게\s*(아니라|아닌)|반대로|오히려|사실은|그렇다면|그럼에도|그러면서/.test(t)) return 4;

  // L3 적용 / 창조 — 상황 적용·예시 생성
  if (/이\s*경우|만약|하면\s*(어떻|됩니|되나|될까|어떻게)|적용(하면|했을|이|할|돼)|예를\s*들|경우에|사용하면|이렇게\s*(하면|해도|하면)|실제로|직접\s*(해|적용)|연결(하면|해서)|~라면/.test(t)) return 3;

  // L2 개념 이해 — 이유·원리 탐색
  if ((/왜|어떻게|어떤\s*이유|원리|개념|이해|설명|메커니즘|작동/.test(t) && /[?？]/.test(t)) ||
      /왜\s*그런지|어떤\s*원리|어떻게\s*(동작|작동|되는|작용)|왜\s*이렇게/.test(t)) return 2;

  // L1 사실 질문 — 정의·개념 묻기
  if (/뭐(야|예요|에요|인가요|죠|가요|인지)|무엇(인가|이|을)|정의(가|는|를)|뜻(이|은|을)|의미(가|는|를)|언제|어디|누가|[?？]/.test(t)) return 1;

  // L0 수동 반응
  return 0;
}

function isQuestion(content) {
  return /[?？]/.test(content) ||
    /^(왜|어떻게|뭐|무엇|어떤|언제|어디|어느|얼마나)/.test(content.trim());
}

// ── 학습 사건 탐지 ─────────────────────────────────────────────────

function detectLearningEvents(messages) {
  const events = [];
  const userMsgs = messages.filter((m) => m.role === 'user');

  userMsgs.forEach((msg, idx) => {
    const t = msg.content;

    // 혼란 감지
    if (/모르겠|헷갈|이해(가)?\s*안|어렵|어려운|(?:잘\s*)?모르|복잡|어떻게\s*해야/.test(t)) {
      events.push({ type: 'confusion', turn: idx, preview: t.slice(0, 60) });
    }

    // 돌파 감지 (혼란 이후 이해)
    if (/이제\s*(알겠|이해|됩|됐)|아!\s*|오!\s*|그렇구나|이해됩|아,\s*이제|맞다!|그렇다!|아하|유레카|드디어/.test(t)) {
      events.push({ type: 'breakthrough', turn: idx, preview: t.slice(0, 60) });
    }

    // 비판적 사고
    if (/근데|하지만|그런데|아닌가요|잘못|틀린|차이|비교|왜\s*꼭|그게\s*아니/.test(t)) {
      events.push({ type: 'critical', turn: idx, preview: t.slice(0, 60) });
    }

    // 지속 탐구 (이전 AI 답변 후 추가 질문)
    if (idx > 0 && t.length > 40 && isQuestion(t)) {
      events.push({ type: 'persistence', turn: idx, preview: t.slice(0, 60) });
    }
  });

  return events;
}

function calcProductiveStruggle(events) {
  const confusions = events.filter((e) => e.type === 'confusion');
  if (!confusions.length) return null;
  let productive = 0;
  confusions.forEach((conf) => {
    const after = events.filter((e) =>
      (e.type === 'breakthrough' || e.type === 'critical') && e.turn > conf.turn && e.turn <= conf.turn + 3
    );
    if (after.length) productive++;
  });
  return Math.round((productive / confusions.length) * 100);
}

// ── 궤적 분석 ─────────────────────────────────────────────────────

function computeTrajectory(levels) {
  if (levels.length < 2) return { type: 'insufficient', slope: 0 };
  const n = levels.length;
  const xMean = (n - 1) / 2;
  const yMean = avg(levels);
  let num = 0, den = 0;
  levels.forEach((y, x) => { num += (x - xMean) * (y - yMean); den += (x - xMean) ** 2; });
  const slope = den ? num / den : 0;
  return {
    type: slope > 0.08 ? '상승형' : slope < -0.08 ? '하강형' : '평탄형',
    slope: Math.round(slope * 1000) / 1000,
  };
}

function calcDominantTrajectory(trajectories) {
  if (!trajectories.length) return null;
  const counts = { '상승형': 0, '평탄형': 0, '하강형': 0 };
  trajectories.forEach((t) => { if (counts[t.type] !== undefined) counts[t.type]++; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// ── 패널 A: 인지 수준 분포 ───────────────────────────────────────

function renderCogDist(profiles, el) {
  if (!el) return;

  const hasData = profiles.some((p) => p.totalAnalyzedMessages > 0);
  if (!hasData) {
    el.innerHTML = '<p class="empty-msg la-no-conv">대화 원문 데이터가 필요합니다.</p>';
    return;
  }

  // 전체 집계
  const totalCounts = Array(6).fill(0);
  profiles.forEach((p) => p.levelCounts.forEach((c, i) => { totalCounts[i] += c; }));
  const totalAll = totalCounts.reduce((s, c) => s + c, 0);

  el.innerHTML = buildTheoryBox({
    theory: 'Bloom의 개정 분류체계 (Anderson & Krathwohl, 2001) · Community of Inquiry (Garrison et al., 2000)',
    cite: 'Anderson & Krathwohl(2001); Garrison et al.(2000)',
    summary: '학생이 AI에게 보낸 발화를 인지적 깊이에 따라 6단계로 자동 분류합니다. 단순 확인(L0)부터 메타인지적 자기점검(L5)까지 발화 내용의 패턴을 텍스트 규칙 기반으로 판별합니다.',
    metrics: [
      { name: 'L0 수동 반응', def: '"네", "알겠어요" 등 단순 확인·수용 발화. 10자 미만 또는 확인 표현만 포함.', interpret: '높을수록 AI 응답을 그대로 수용하는 수동적 참여.' },
      { name: 'L1 사실 질문 — 기억(Remember)', def: '"~이 뭐예요?", "정의가 뭔가요?" 등 사실·정의를 묻는 발화.', interpret: '가장 기본적인 인지 참여. 개념 도입 초기에 자연스럽게 높게 나타남.' },
      { name: 'L2 개념 이해 — 이해(Understand)', def: '"왜 그런가요?", "어떻게 동작해요?" 등 이유·원리를 탐색하는 질문.', interpret: '단순 암기를 넘어 의미 이해를 추구하는 참여 신호.' },
      { name: 'L3 적용 시도 — 적용(Apply)', def: '"이 경우에 어떻게 되나요?", "만약 ~하면?" 등 구체적 상황에 적용하려는 발화.', interpret: '학습 내용을 새로운 맥락에 연결하려는 고차 사고의 시작.' },
      { name: 'L4 비판적 사고 — 분석/평가(Analyze/Evaluate)', def: '"근데", "하지만", "차이가 뭔가요?" 등 AI 설명을 비교·도전·반박하는 발화.', interpret: '가장 생산적인 참여 형태. 개념 구조를 능동적으로 검증하는 행동.' },
      { name: 'L5 메타인지 — 자기조절(Metacognition)', def: '"이해가 안 돼요", "이제 알겠어요", "다시 설명해줄 수 있어요?" 등 자신의 이해 상태를 점검하는 발화.', interpret: '자기조절학습(SRL)의 핵심 지표. 높을수록 학습 전략적 행동 가능성 높음.' },
      { name: '고차 사고 비율 (%)', def: '(L3 + L4 + L5 발화 수) ÷ 전체 발화 수 × 100', interpret: '핵심 연구 변수. 학습 성과와 정적 상관이 예측됨.' },
    ],
    caution: '자동 분류는 한국어 텍스트 패턴 매칭 기반으로 측정됩니다. 논문 작성 시 수동 코딩과의 일치율(Cohen\'s κ) 보고 및 분류 한계 명시를 권장합니다.',
  }) + `
    <div class="la-cog-overview">
      <!-- 전체 파이 차트 -->
      <div class="la-cog-summary">
        <h4 class="la-sub-title">전체 발화 분포</h4>
        <svg viewBox="0 0 200 200" width="180" height="180" id="la-cog-donut"></svg>
        <div class="la-cog-legend">
          ${COG_LEVELS.map((l, i) => {
            const pct = totalAll > 0 ? ((totalCounts[i] / totalAll) * 100).toFixed(1) : '0.0';
            return `
              <div class="la-cog-legend-row">
                <span class="la-cog-dot" style="background:${l.color}"></span>
                <span class="la-cog-lname">${l.label}</span>
                <strong>${pct}%</strong>
                <span class="la-muted">(${totalCounts[i]}개)</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 학생별 스택 바 -->
      <div class="la-cog-bars-wrap">
        <h4 class="la-sub-title">학생별 인지 수준 구성</h4>
        <div class="la-cog-bars" id="la-cog-bars"></div>
        <div class="la-cog-bar-legend">
          ${COG_LEVELS.map((l) => `
            <span class="la-cog-bar-legend-item">
              <span style="background:${l.color};display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:3px;"></span>${l.short} ${l.label}
            </span>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- 인지 수준별 설명 -->
    <div class="la-cog-desc-row">
      ${COG_LEVELS.map((l) => `
        <div class="la-cog-desc-card" style="border-color:${l.color}">
          <span class="la-cog-desc-badge" style="background:${l.color}">${l.short}</span>
          <strong>${l.label}</strong>
          <p>${l.desc}</p>
        </div>
      `).join('')}
    </div>
  `;

  // 도넛 차트 (SVG arc)
  drawDonut(document.getElementById('la-cog-donut'), totalCounts, totalAll);

  // 학생별 스택 바
  const barsEl = document.getElementById('la-cog-bars');
  if (barsEl) {
    const withData = profiles.filter((p) => p.totalAnalyzedMessages > 0);
    barsEl.innerHTML = withData.map((p) => `
      <div class="la-cog-bar-row">
        <span class="la-cog-bar-label" title="${escapeHtml(p.studentId)}">${escapeHtml(p.studentName.slice(0, 5))}</span>
        <div class="la-cog-stack-bar">
          ${p.levelCounts.map((c, i) => {
            const w = p.totalAnalyzedMessages > 0 ? (c / p.totalAnalyzedMessages) * 100 : 0;
            return w > 0 ? `<div style="width:${w}%;background:${COG_LEVELS[i].color}" title="${COG_LEVELS[i].label}: ${w.toFixed(1)}%"></div>` : '';
          }).join('')}
        </div>
        <span class="la-cog-bar-avg" style="color:${cogLevelColor(p.avgCogLevel)}">
          ${p.avgCogLevel != null ? p.avgCogLevel.toFixed(1) : '-'}
        </span>
      </div>
    `).join('');
  }
}

function drawDonut(svgEl, counts, total) {
  if (!svgEl || !total) return;
  const cx = 100, cy = 100, R = 80, r = 50;
  let startAngle = -Math.PI / 2;
  let paths = '';

  counts.forEach((c, i) => {
    if (!c) return;
    const angle = (c / total) * Math.PI * 2;
    const endAngle = startAngle + angle;
    const x1 = cx + R * Math.cos(startAngle), y1 = cy + R * Math.sin(startAngle);
    const x2 = cx + R * Math.cos(endAngle), y2 = cy + R * Math.sin(endAngle);
    const ix1 = cx + r * Math.cos(startAngle), iy1 = cy + r * Math.sin(startAngle);
    const ix2 = cx + r * Math.cos(endAngle), iy2 = cy + r * Math.sin(endAngle);
    const large = angle > Math.PI ? 1 : 0;
    paths += `<path d="M${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} L${ix2},${iy2} A${r},${r} 0 ${large} 0 ${ix1},${iy1} Z"
      fill="${COG_LEVELS[i].color}" opacity="0.85"/>`;
    startAngle = endAngle;
  });

  svgEl.innerHTML = paths + `<text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="14" font-weight="700" fill="#374151">${total}</text>
    <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="10" fill="#6b7280">발화</text>`;
}

// ── 패널 B: 대화 주도성-인지 깊이 매트릭스 ──────────────────────

function drawAgencyMatrix(profiles, canvas, legendEl) {
  if (!canvas) return;

  const W = canvas.width, H = canvas.height;
  const pad = { top: 30, right: 20, bottom: 50, left: 55 };
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const withData = profiles.filter((p) => p.agencyIndex != null && p.avgCogLevel != null && p.avgScore != null);
  if (!withData.length) {
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('대화 데이터 없음', W / 2, H / 2);
    return;
  }

  const medAgency = median(withData.map((p) => p.agencyIndex));
  const medCog = median(withData.map((p) => p.avgCogLevel));

  const cx = (v) => pad.left + (v / 100) * (W - pad.left - pad.right);
  const cy = (v) => pad.top + (1 - v / 5) * (H - pad.top - pad.bottom);

  const mx = cx(medAgency), my = cy(medCog);

  // 사분면 배경
  const quadCfg = [
    { x: pad.left, y: pad.top, w: mx - pad.left, h: my - pad.top, color: 'rgba(99,102,241,0.06)', label: '심층 학습자' },
    { x: mx, y: pad.top, w: W - pad.right - mx, h: my - pad.top, color: 'rgba(16,185,129,0.06)', label: '효율 학습자' },
    { x: pad.left, y: my, w: mx - pad.left, h: H - pad.bottom - my, color: 'rgba(245,158,11,0.06)', label: '탐색 학습자' },
    { x: mx, y: my, w: W - pad.right - mx, h: H - pad.bottom - my, color: 'rgba(239,68,68,0.06)', label: '수동 학습자' },
  ];
  quadCfg.forEach(({ x, y, w, h, color, label }) => {
    ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + 13);
  });

  // 기준선
  ctx.strokeStyle = '#d1d5db'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(mx, pad.top); ctx.lineTo(mx, H - pad.bottom); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(pad.left, my); ctx.lineTo(W - pad.right, my); ctx.stroke();
  ctx.setLineDash([]);

  // 축 눈금
  ctx.fillStyle = '#6b7280'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
  for (let v = 0; v <= 5; v++) {
    const y = cy(v);
    ctx.fillText(v, pad.left - 6, y + 3);
    ctx.strokeStyle = '#f3f4f6'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
  }
  ctx.textAlign = 'center';
  [0, 25, 50, 75, 100].forEach((v) => {
    ctx.fillText(`${v}%`, cx(v), H - pad.bottom + 16);
  });

  // 축 레이블
  ctx.fillStyle = '#374151'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('학생 질문 비율 (Agency Index, %)', pad.left + (W - pad.left - pad.right) / 2, H - 6);
  ctx.save();
  ctx.translate(13, pad.top + (H - pad.top - pad.bottom) / 2);
  ctx.rotate(-Math.PI / 2); ctx.fillText('평균 인지 수준 (0-5)', 0, 0); ctx.restore();

  // 산점도
  const maxScore = Math.max(...withData.map((p) => p.avgScore));
  withData.forEach((p) => {
    const x = cx(p.agencyIndex), y = cy(p.avgCogLevel);
    const radius = 4 + (p.totalAnalyzedMessages / 20) * 4;
    const t = p.avgScore / maxScore;
    const color = `hsl(${Math.round(t * 120)}, 70%, 50%)`;

    ctx.beginPath(); ctx.arc(x, y, Math.min(radius, 12), 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.globalAlpha = 0.75; ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();

    // 이름 레이블
    ctx.fillStyle = '#374151'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(p.studentName.slice(0, 3), x, y - Math.min(radius, 12) - 2);
  });

  if (legendEl) {
    legendEl.innerHTML = `
      <div class="la-agency-legend">
        <span>원 크기 = 발화 수</span>
        <span>색상: <span style="color:#ef4444">●</span> 저성취 → <span style="color:#10b981">●</span> 고성취</span>
        <span>중앙선: 전체 중앙값 (Agency ${medAgency.toFixed(1)}% / 인지 ${medCog.toFixed(2)})</span>
      </div>
    ` + buildTheoryBox({
      theory: '거래적 거리 이론 (Transactional Distance Theory, Moore, 1973)',
      cite: 'Moore(1973). Theory of transactional distance. In D. Keegan (Ed.)',
      summary: '학습자와 교수자(AI) 사이의 심리적·의사소통적 거리를 "대화(Dialogue)"와 "구조(Structure)"로 측정합니다. 대화가 많을수록, 구조가 유연할수록 거래적 거리가 줄어들고 학습이 촉진됩니다. 이 매트릭스는 두 가지 대화 품질 지표로 거리를 가시화합니다.',
      metrics: [
        { name: 'Agency Index (학생 질문 비율, %)', def: '전체 학생 발화 중 질문 형태("?", "왜", "어떻게" 등)인 발화의 비율.', interpret: '높을수록 학생이 대화를 주도적으로 이끄는 능동적 학습자. Moore의 대화(Dialogue) 차원을 반영.' },
        { name: '평균 인지 수준 (0–5)', def: '해당 학생의 모든 발화 Bloom 수준(L0-L5)의 평균값.', interpret: '높을수록 인지적 깊이 있는 상호작용. Community of Inquiry의 인지적 실재감(Cognitive Presence) 지표.' },
        { name: '심층 학습자 (고Agency + 고인지)', def: '질문도 많고 질문의 수준도 높은 학습자.', interpret: '이상적 학습 행동. 개입 불필요.' },
        { name: '효율 학습자 (저Agency + 고인지)', def: '질문 수는 적지만 질문 품질이 높은 학습자.', interpret: '선택적·전략적 질문. 높은 사전 지식 보유 가능.' },
        { name: '탐색 학습자 (고Agency + 저인지)', def: '질문은 많지만 표면적 질문 위주인 학습자.', interpret: '참여 의지는 높으나 사고의 깊이가 부족. 개념적 질문을 유도하는 교수 전략 필요.' },
        { name: '수동 학습자 (저Agency + 저인지)', def: '질문도 적고 인지 수준도 낮은 학습자.', interpret: '즉각적 교수 개입 필요. 이탈 위험군.' },
      ],
      caution: '중앙값 기준 사분면 분류이므로 집단 크기에 따라 경계가 달라집니다. 절대 기준 해석보다는 집단 내 상대적 위치로 해석하세요.',
    });
  }
}

// ── 패널 C: 대화 궤적 분류 ────────────────────────────────────────

function renderTrajectory(profiles, el) {
  if (!el) return;

  const withData = profiles.filter((p) => p.dominantTrajectory != null);
  if (!withData.length) {
    el.innerHTML = '<p class="empty-msg">궤적 분석에 충분한 대화 데이터가 없습니다.</p>';
    return;
  }

  const typeCfg = {
    '상승형': { color: '#10b981', bg: '#d1fae5', icon: '↗', desc: '대화 진행 중 인지 수준 상승 — 적극적 학습 전략' },
    '평탄형': { color: '#6366f1', bg: '#ede9fe', icon: '→', desc: '안정적 참여 — 일정한 인지 수준 유지' },
    '하강형': { color: '#ef4444', bg: '#fee2e2', icon: '↘', desc: '대화 후반부 인지 수준 하락 — 이탈·피로 신호' },
  };

  const groups = { '상승형': [], '평탄형': [], '하강형': [] };
  withData.forEach((p) => { if (groups[p.dominantTrajectory]) groups[p.dominantTrajectory].push(p); });

  el.innerHTML = buildTheoryBox({
    theory: '생산적 실패 이론 (Productive Failure, Kapur, 2016) · 근접발달영역 (Vygotsky, 1978)',
    cite: 'Kapur(2016). Examining Productive Failure. Cognition & Instruction; Vygotsky(1978). Mind in Society.',
    summary: '대화 세션 내에서 학생 발화의 인지 수준이 어떤 방향으로 변화하는지 선형 회귀로 분류합니다. Kapur는 초기의 혼란과 실패가 이후 깊은 이해로 이어질 때 가장 효과적인 학습이 일어난다고 주장합니다. 상승형 궤적이 이 생산적 실패 패턴을 가장 잘 반영합니다.',
    metrics: [
      { name: '궤적 기울기 (Slope)', def: '세션 내 발화 인지 수준 시퀀스(L0-L5)에 대한 선형 회귀 기울기.', interpret: '기울기 > 0: 대화가 깊어짐, < 0: 대화가 얕아짐.' },
      { name: '상승형 (Slope > 0.08)', def: '대화가 진행될수록 더 높은 인지 수준의 발화로 발전.', interpret: 'AI와의 상호작용에서 인지적 성장이 실시간으로 일어나고 있음. 가장 바람직한 패턴.' },
      { name: '평탄형 (|Slope| ≤ 0.08)', def: '대화 전반에 걸쳐 일정한 인지 수준을 유지.', interpret: '안정적 참여. 이미 적절한 수준에서 상호작용하거나, 성장 없이 정체된 상태일 수 있음.' },
      { name: '하강형 (Slope < −0.08)', def: '대화 후반부로 갈수록 인지 수준이 낮아짐.', interpret: '피로, 이탈, 또는 초기 탐색 후 단순 확인으로 마무리하는 패턴. 대화 설계 재검토 필요.' },
    ],
    caution: '학생당 여러 챕터의 세션이 존재할 경우 지배적 궤적으로 집계합니다. 발화 수가 2개 미만인 세션은 궤적 분석에서 제외됩니다.',
  }) + `
    <div class="la-traj-cards">
      ${Object.entries(typeCfg).map(([type, cfg]) => {
        const members = groups[type] || [];
        const avgSc = members.length ? avg(members.map((p) => p.avgScore).filter((v) => v != null)) : null;
        const avgCog = members.length ? avg(members.map((p) => p.avgCogLevel).filter((v) => v != null)) : null;
        const pct = withData.length ? Math.round((members.length / withData.length) * 100) : 0;
        return `
          <div class="la-traj-card" style="border-color:${cfg.color};background:${cfg.bg}">
            <div class="la-traj-icon" style="color:${cfg.color}">${cfg.icon}</div>
            <div class="la-traj-name" style="color:${cfg.color}">${type}</div>
            <p class="la-traj-desc">${cfg.desc}</p>
            <div class="la-traj-stat">
              <span>${members.length}명 (${pct}%)</span>
              <span>평균 점수 <strong class="${scoreColor(avgSc)}">${avgSc != null ? `${avgSc.toFixed(1)}점` : '-'}</strong></span>
              <span>평균 인지 <strong>${avgCog != null ? avgCog.toFixed(2) : '-'}</strong></span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
    <p class="la-footnote">* 궤적: 세션 내 발화 인지 수준 시퀀스의 선형 회귀 기울기로 분류 (기울기 &gt;0.08 = 상승, &lt;-0.08 = 하강).</p>
  `;
}

// ── 패널 D: 핵심 학습 사건 탐지 ─────────────────────────────────

function renderEvents(profiles, el) {
  if (!el) return;

  const withData = profiles.filter((p) => p.totalAnalyzedMessages > 0);
  if (!withData.length) {
    el.innerHTML = '<p class="empty-msg">대화 원문 데이터가 필요합니다.</p>';
    return;
  }

  const totConf = withData.reduce((s, p) => s + p.confusionCount, 0);
  const totBrk  = withData.reduce((s, p) => s + p.breakthroughCount, 0);
  const totCrit = withData.reduce((s, p) => s + p.criticalCount, 0);
  const totPers = withData.reduce((s, p) => s + p.persistenceCount, 0);
  const avgPS   = avg(withData.map((p) => p.productiveStruggleIndex).filter((v) => v != null));

  el.innerHTML = buildTheoryBox({
    theory: '자기조절학습 (Self-Regulated Learning, Zimmerman, 2002) · 메타인지 (Flavell, 1979) · 생산적 혼란 (Kapur, 2016)',
    cite: 'Zimmerman(2002). Becoming a Self-Regulated Learner. Theory Into Practice; Flavell(1979). Metacognition. American Psychologist.',
    summary: '대화 텍스트에서 4가지 핵심 학습 사건을 텍스트 패턴으로 자동 탐지합니다. Zimmerman의 SRL 모델에서 자기모니터링과 자기평가, Kapur의 생산적 실패에서 혼란→이해 전환 개념을 통합합니다.',
    metrics: [
      { name: '혼란 사건 (Confusion Event)', def: '"모르겠어요", "헷갈려요", "이해가 안 돼요" 등 인지적 갈등을 명시적으로 표현한 발화.', interpret: '학습의 필수 선행 조건. 혼란 없이는 개념적 변화가 일어나기 어렵습니다(Cognitive Disequilibrium, Piaget).' },
      { name: '돌파 사건 (Breakthrough Event)', def: '"아!", "이제 알겠어요", "그렇구나" 등 개념 이해의 전환점을 나타내는 발화.', interpret: 'Aha-moment 또는 개념적 변화(Conceptual Change) 순간. 혼란 사건과 쌍을 이룰 때 특히 유의미함.' },
      { name: '비판적 사건 (Critical Thinking Event)', def: '"근데", "하지만", "차이가 뭔가요?" 등 AI 설명을 비교·검증·반박하는 발화.', interpret: 'Bloom L4(분석/평가)의 실제 발현. 고차 인지 참여의 직접적 증거.' },
      { name: '지속 탐구 사건 (Persistence Event)', def: 'AI 응답 이후 40자 이상의 추가 질문을 보내는 발화.', interpret: '학습 지속성(Academic Persistence)과 관련. 쉬운 답변에 만족하지 않고 더 깊이 탐색하는 행동.' },
      { name: '생산적 혼란 지수 (Productive Struggle Index, %)', def: '혼란 사건 후 3턴 이내에 돌파 또는 비판적 사건이 뒤따른 비율.', interpret: '핵심 연구 지표. Kapur(2016) 생산적 실패 이론의 조작적 정의. 높을수록 AI 튜터링이 효과적으로 작동함을 의미.' },
    ],
    caution: '텍스트 패턴 기반 자동 탐지이므로 동일 발화에 복수의 사건이 중복 감지될 수 있습니다. 생산적 혼란 지수는 3턴 이내 연속성을 기준으로 하며, 더 긴 간격의 지연 이해는 포착하지 못합니다.',
  }) + `
    <div class="la-events-top">
      ${Object.entries(EVENT_TYPES).map(([type, cfg]) => {
        const total = type === 'confusion' ? totConf : type === 'breakthrough' ? totBrk
          : type === 'critical' ? totCrit : totPers;
        return `
          <div class="la-event-card" style="border-color:${cfg.color}">
            <span class="la-event-icon" style="color:${cfg.color}">${cfg.icon}</span>
            <strong class="la-event-count" style="color:${cfg.color}">${total}</strong>
            <span class="la-event-label">${cfg.label} 사건</span>
          </div>
        `;
      }).join('')}
      <div class="la-event-card la-event-ps">
        <span class="la-event-icon">⚡</span>
        <strong class="la-event-count">${Number.isFinite(avgPS) ? `${avgPS.toFixed(0)}%` : '-'}</strong>
        <span class="la-event-label">생산적 혼란 지수*</span>
      </div>
    </div>

    <table class="dash-table la-events-table">
      <thead>
        <tr>
          <th>학번</th><th>이름</th>
          <th title="${EVENT_TYPES.confusion.label}">혼란</th>
          <th title="${EVENT_TYPES.breakthrough.label}">돌파</th>
          <th title="${EVENT_TYPES.critical.label}">비판</th>
          <th title="${EVENT_TYPES.persistence.label}">지속</th>
          <th>생산적 혼란(%)</th>
          <th>평균 점수</th>
        </tr>
      </thead>
      <tbody>
        ${withData.map((p) => `
          <tr>
            <td>${escapeHtml(p.studentId)}</td>
            <td>${escapeHtml(p.studentName)}</td>
            <td><span class="la-event-badge" style="background:#fee2e2;color:#991b1b">${p.confusionCount}</span></td>
            <td><span class="la-event-badge" style="background:#d1fae5;color:#065f46">${p.breakthroughCount}</span></td>
            <td><span class="la-event-badge" style="background:#fef3c7;color:#92400e">${p.criticalCount}</span></td>
            <td><span class="la-event-badge" style="background:#dbeafe;color:#1e40af">${p.persistenceCount}</span></td>
            <td>${p.productiveStruggleIndex != null ? `<strong>${p.productiveStruggleIndex}%</strong>` : '-'}</td>
            <td class="${scoreColor(p.avgScore)}">${p.avgScore != null ? `${p.avgScore.toFixed(1)}점` : '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p class="la-footnote">* 생산적 혼란 지수 = 혼란 사건 후 3턴 이내에 돌파 또는 비판적 사고 사건이 발생한 비율 (Kapur, 2016 기반).</p>
  `;
}

// ── 패널 E: 고-저 성취 집단 비교 ─────────────────────────────────

function renderComparison(profiles, el) {
  if (!el) return;

  const scored = profiles.filter((p) => p.avgScore != null).sort((a, b) => b.avgScore - a.avgScore);
  if (scored.length < 3) {
    el.innerHTML = '<p class="empty-msg">비교 분석을 위해 최소 3명 이상의 데이터가 필요합니다.</p>';
    return;
  }

  const n = Math.max(1, Math.floor(scored.length / 3));
  const high = scored.slice(0, n);
  const low  = scored.slice(scored.length - n);

  const metrics = [
    { key: 'avgScore',              label: '평균 점수',          unit: '점',  fmt: (v) => v?.toFixed(1) ?? '-' },
    { key: 'avgCogLevel',           label: '평균 인지 수준',     unit: '',    fmt: (v) => v?.toFixed(2) ?? '-' },
    { key: 'highOrderRate',         label: '고차 사고 비율',     unit: '%',   fmt: (v) => v?.toFixed(1) ?? '-' },
    { key: 'agencyIndex',           label: '학생 질문 비율',     unit: '%',   fmt: (v) => v?.toFixed(1) ?? '-' },
    { key: 'avgMsgLength',          label: '평균 발화 길이',     unit: '자',  fmt: (v) => v?.toFixed(0) ?? '-' },
    { key: 'productiveStruggleIndex', label: '생산적 혼란 지수', unit: '%',   fmt: (v) => v?.toFixed(0) ?? '-' },
    { key: 'confusionCount',        label: '혼란 사건 수',       unit: '회',  fmt: (v) => v ?? '-' },
    { key: 'breakthroughCount',     label: '돌파 사건 수',       unit: '회',  fmt: (v) => v ?? '-' },
    { key: 'feedbackQuality',       label: '피드백 품질 (0-3)', unit: '',    fmt: (v) => v?.toFixed(1) ?? '-' },
    { key: 'reflectionRate',        label: '성찰일지 완성(%)',   unit: '%',   fmt: (v) => v?.toFixed(0) ?? '-' },
  ];

  const avgGroup = (group, key) => avg(group.map((p) => p[key]).filter((v) => v != null && Number.isFinite(v)));

  el.innerHTML = buildTheoryBox({
    theory: '학습 분석 기반 증거 (Evidence-based Learning Analytics, Siemens & Long, 2011) · 집단 비교 설계',
    cite: 'Siemens & Long(2011). Penetrating the Fog. EDUCAUSE Review.',
    summary: '학습 성과(평균 점수) 기준 상위 33%와 하위 33% 학생 집단의 대화 행동 지표를 비교합니다. 두 집단 간에 유의미한 차이를 보이는 지표는 학습 성과 예측 변수로 활용할 수 있습니다.',
    metrics: [
      { name: '평균 인지 수준 (0–5)', def: '발화 Bloom 수준 평균. 전반적 인지 참여 깊이를 요약하는 단일 지표.', interpret: '고성취 집단이 유의하게 높으면 인지 수준 → 성과 예측 관계 성립.' },
      { name: '고차 사고 비율 (%)', def: 'L3+L4+L5 발화 비율. 분석·평가·메타인지 참여도.', interpret: '논문의 핵심 예측 변수 후보. ANCOVA 또는 회귀분석에 직접 투입 가능.' },
      { name: '학생 질문 비율 — Agency Index (%)', def: '질문 형태 발화 비율. 대화 주도성 측정.', interpret: 'Moore(1973) 거래적 거리 이론의 조작적 정의. 대화 주도성과 성과의 관계 확인.' },
      { name: '평균 발화 길이 (자)', def: '학생 발화의 평균 글자 수. 설명의 정교화(Elaboration) 수준 대리 측정.', interpret: '길수록 더 상세한 설명을 시도하는 적극적 참여. 단, 반복 복붙은 노이즈 요인.' },
      { name: '생산적 혼란 지수 (%)', def: '혼란 후 이해로 연결된 비율. Kapur(2016) 조작적 정의.', interpret: '학습 과정의 질을 직접 측정하는 과정 지표(process indicator).' },
      { name: '피드백 품질 (0–3)', def: 'AI가 제공한 Feed Up·Feed Back·Feed Forward 각 충족 시 1점, 합산 0–3점.', interpret: 'Hattie & Timperley(2007) 3단계 피드백 모델 기반. 피드백 질이 성과에 미치는 영향 분석.' },
      { name: '성찰일지 완성율 (%)', def: '형성평가 제출 챕터 수 대비 성찰일지 작성 챕터 수 비율.', interpret: 'Zimmerman(2002) SRL 성찰 단계(Self-reflection phase) 이행 정도.' },
    ],
    caution: '집단 크기(n)가 작을 경우 통계적 유의성 해석에 주의하세요. 논문에서는 독립표본 t-검정 또는 Mann-Whitney U 검정으로 집단 차이를 검증하기를 권장합니다.',
  }) + `
    <div class="la-compare-info">
      <span class="la-compare-badge la-high">상위 ${n}명 (평균 ${avg(high.map((p)=>p.avgScore)).toFixed(1)}점)</span>
      <span class="la-compare-badge la-low">하위 ${n}명 (평균 ${avg(low.map((p)=>p.avgScore)).toFixed(1)}점)</span>
    </div>
    <table class="dash-table la-compare-table">
      <thead>
        <tr>
          <th>지표</th>
          <th class="la-high-col">상위 집단 (n=${n})</th>
          <th class="la-low-col">하위 집단 (n=${n})</th>
          <th>차이</th>
          <th>방향</th>
        </tr>
      </thead>
      <tbody>
        ${metrics.map(({ key, label, unit, fmt }) => {
          const h = avgGroup(high, key);
          const l = avgGroup(low, key);
          const diff = Number.isFinite(h) && Number.isFinite(l) ? h - l : null;
          const dir = diff == null ? '-' : Math.abs(diff) < 0.1 ? '→ 유사' : diff > 0 ? '▲ 상위 높음' : '▼ 하위 높음';
          const dirClass = diff == null ? '' : Math.abs(diff) < 0.1 ? '' : diff > 0 ? 'rate-good' : 'rate-bad';
          return `
            <tr>
              <td><strong>${label}</strong></td>
              <td class="la-high-col">${Number.isFinite(h) ? `${fmt(h)}${unit}` : '-'}</td>
              <td class="la-low-col">${Number.isFinite(l) ? `${fmt(l)}${unit}` : '-'}</td>
              <td>${diff != null ? `${diff > 0 ? '+' : ''}${fmt(diff)}${unit}` : '-'}</td>
              <td class="${dirClass}">${dir}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

// ── 패널 F: 연구용 종합 테이블 ────────────────────────────────────

function renderResearchTable(profiles, el) {
  if (!el) return;

  el.innerHTML = buildTheoryBox({
    theory: '다변량 학습자 프로파일링 (Multivariate Learner Profiling) · SSCI 논문 Table 설계',
    cite: 'Gašević et al.(2016). Learning Analytics Should Not Promote One Size Fits All. Internet & Higher Ed.',
    summary: '모든 대화 기반 지표를 학생별로 통합하여 단일 테이블로 제공합니다. 이 테이블은 논문 Table 1 또는 Appendix로 직접 활용 가능하며, SPSS·R·Python에 바로 투입할 수 있도록 TSV 형식으로 복사됩니다.',
    metrics: [
      { name: '발화 수', def: '분석된 총 학생 발화 수 (system 메시지 제외, 2자 미만 제외).', interpret: '참여량의 기본 지표. 단독으로는 해석에 한계 있음 — 반드시 인지 수준과 함께 해석.' },
      { name: '평균 인지 수준 (0–5)', def: '전체 발화의 Bloom 수준 평균. 소수점 둘째 자리까지 보고.', interpret: 'SSCI 논문에서 주요 독립변수로 활용. 회귀분석 시 연속 변수로 투입.' },
      { name: '고차 사고율 (%)', def: 'L3+L4+L5 발화 비율.', interpret: '학습자 유형 분류(클러스터링)의 핵심 특성 변수.' },
      { name: '질문 비율 — Agency Index (%)', def: '질문 형태 발화 / 전체 발화 × 100.', interpret: 'Moore(1973) 대화 차원의 조작적 정의. 구조방정식 모델(SEM)에서 잠재변수 지표로 활용 가능.' },
      { name: '혼란 · 돌파 사건 수', def: '각 사건 유형별 탐지 횟수.', interpret: '과정 지표(process indicator). 성과 지표(점수)와의 시간적 선행 관계 분석에 활용.' },
      { name: '생산적 혼란 지수 (%)', def: '혼란 사건 후 돌파·비판으로 이어진 비율.', interpret: 'Kapur(2016) 생산적 실패의 조작적 정의. 중재 분석(Mediation Analysis)에서 매개변수로 활용 가능.' },
      { name: '대화 궤적', def: '상승형·평탄형·하강형 — 범주형 변수.', interpret: '분산분석(ANOVA) 독립변수로 활용. 이진 코딩(상승=1, 그외=0)으로 로지스틱 회귀 가능.' },
      { name: '피드백 품질 (0–3)', def: 'Hattie & Timperley(2007) 3단계 피드백 충족 합산.', interpret: '교수설계 변수. 학생 변수(인지 수준)와의 상호작용 효과 검증에 활용.' },
      { name: '성찰 완성율 (%)', def: '챕터별 성찰일지 작성 비율.', interpret: 'SRL 성찰 단계 이행 지표. 대화 품질과의 상관 분석 시 흥미로운 패턴 발견 기대.' },
    ],
    caution: 'TSV 복사 후 Excel에 붙여넣기하면 열 정렬이 자동으로 됩니다. R에서는 read.delim(text=clipboard)으로 바로 로드 가능합니다.',
  }) + `
    <table class="dash-table la-research-table" id="la-rt">
      <thead>
        <tr>
          <th>학번</th>
          <th>이름</th>
          <th>발화수</th>
          <th>평균 인지 수준</th>
          <th>고차 사고(%)</th>
          <th>질문 비율(%)</th>
          <th>혼란</th>
          <th>돌파</th>
          <th>생산적 혼란(%)</th>
          <th>대화 궤적</th>
          <th>피드백 품질</th>
          <th>성찰(%)</th>
          <th>평균 점수</th>
        </tr>
      </thead>
      <tbody>
        ${profiles.map((p) => {
          const trajCfg = { '상승형': 'rate-good', '평탄형': '', '하강형': 'rate-bad' };
          return `
            <tr>
              <td>${escapeHtml(p.studentId)}</td>
              <td>${escapeHtml(p.studentName)}</td>
              <td>${p.totalAnalyzedMessages}</td>
              <td>${p.avgCogLevel != null ? p.avgCogLevel.toFixed(2) : '-'}</td>
              <td>${p.highOrderRate != null ? `${p.highOrderRate.toFixed(1)}` : '-'}</td>
              <td>${p.agencyIndex != null ? `${p.agencyIndex.toFixed(1)}` : '-'}</td>
              <td>${p.confusionCount}</td>
              <td>${p.breakthroughCount}</td>
              <td>${p.productiveStruggleIndex != null ? p.productiveStruggleIndex : '-'}</td>
              <td class="${trajCfg[p.dominantTrajectory] || ''}">${p.dominantTrajectory || '-'}</td>
              <td>${p.feedbackQuality.toFixed(1)}</td>
              <td>${p.reflectionRate.toFixed(0)}</td>
              <td class="${scoreColor(p.avgScore)}"><strong>${p.avgScore != null ? p.avgScore.toFixed(1) : '-'}</strong></td>
            </tr>
          `;
        }).join('')}
      </tbody>
      <tfoot>
        <tr class="la-research-avg-row">
          <td colspan="2"><strong>평균</strong></td>
          <td>${avg(profiles.map((p) => p.totalAnalyzedMessages)).toFixed(0)}</td>
          <td>${avgNullable(profiles.map((p) => p.avgCogLevel), 2)}</td>
          <td>${avgNullable(profiles.map((p) => p.highOrderRate), 1)}</td>
          <td>${avgNullable(profiles.map((p) => p.agencyIndex), 1)}</td>
          <td>${avg(profiles.map((p) => p.confusionCount)).toFixed(1)}</td>
          <td>${avg(profiles.map((p) => p.breakthroughCount)).toFixed(1)}</td>
          <td>${avgNullable(profiles.map((p) => p.productiveStruggleIndex), 0)}</td>
          <td>-</td>
          <td>${avg(profiles.map((p) => p.feedbackQuality)).toFixed(2)}</td>
          <td>${avg(profiles.map((p) => p.reflectionRate)).toFixed(0)}</td>
          <td class="${scoreColor(avg(profiles.map((p) => p.avgScore).filter(Boolean)))}">
            <strong>${avgNullable(profiles.map((p) => p.avgScore), 1)}</strong>
          </td>
        </tr>
      </tfoot>
    </table>
  `;
}

function copyTSV(profiles) {
  const headers = ['학번','이름','발화수','평균인지수준','고차사고율','질문비율','혼란','돌파','생산적혼란','대화궤적','피드백품질','성찰완성율','평균점수'];
  const rows = profiles.map((p) => [
    p.studentId, p.studentName, p.totalAnalyzedMessages,
    p.avgCogLevel?.toFixed(2) ?? '', p.highOrderRate?.toFixed(1) ?? '',
    p.agencyIndex?.toFixed(1) ?? '', p.confusionCount, p.breakthroughCount,
    p.productiveStruggleIndex ?? '', p.dominantTrajectory ?? '',
    p.feedbackQuality.toFixed(1), p.reflectionRate.toFixed(0),
    p.avgScore?.toFixed(1) ?? '',
  ]);
  const tsv = [headers, ...rows].map((r) => r.join('\t')).join('\n');
  navigator.clipboard.writeText(tsv)
    .then(() => {
      const btn = document.getElementById('la-tsv-btn');
      if (btn) { btn.textContent = '복사 완료!'; setTimeout(() => { btn.textContent = 'TSV 복사'; }, 2000); }
    })
    .catch(() => alert('클립보드 복사 실패 — 브라우저 권한 확인'));
}

// ── 유틸 ──────────────────────────────────────────────────────────

function getVisibleMessages(submission) {
  return (Array.isArray(submission?.messages) ? submission.messages : [])
    .filter((m) => String(m?.role || '').toLowerCase() !== 'system')
    .map((m) => ({ role: String(m.role), content: String(m.content || '').trim() }))
    .filter((m) => m.content);
}

function getUserMessages(submission) {
  return getVisibleMessages(submission).filter((m) => m.role === 'user');
}

function avg(arr) {
  const valid = arr.filter(Number.isFinite);
  return valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : 0;
}

function avgNullable(arr, decimals = 1) {
  const valid = arr.filter((v) => v != null && Number.isFinite(v));
  return valid.length ? (valid.reduce((s, v) => s + v, 0) / valid.length).toFixed(decimals) : '-';
}

function median(arr) {
  const sorted = [...arr].filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function cogLevelColor(level) {
  if (level == null) return '#9ca3af';
  if (level >= 4) return '#8b5cf6';
  if (level >= 3) return '#f59e0b';
  if (level >= 2) return '#10b981';
  if (level >= 1) return '#3b82f6';
  return '#9ca3af';
}

function buildKPI(label, value) {
  return `
    <div class="la-kpi">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}
