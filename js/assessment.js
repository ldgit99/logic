const WORKER_URLS = Array.from(new Set([
  'https://logic-proxy.dongkuklee99.workers.dev/',
  ...((window.location.origin.includes('localhost')
    || window.location.origin.includes('127.0.0.1')
    || /(^|\.)workers\.dev$/i.test(window.location.hostname || ''))
    ? [window.location.origin.endsWith('/') ? window.location.origin : `${window.location.origin}/`]
    : []),
].filter(Boolean)));

const STORAGE_KEY = 'logic_assessment_session_v1';
const MAX_HINTS = 3;

let showToast = () => {};
let getStudentProfile = () => ({ studentId: 'default' });
let openReflection = null;
let currentChapter = null;
let state = null;
let busy = false;

function el(id) { return document.getElementById(id); }
function trim(text) { return String(text || '').trim(); }

// ── JSON 파싱 ──────────────────────────────────────────────────

function parseJson(text) {
  const raw = trim(text);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch {}
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
  if (s !== -1 && e > s) { try { return JSON.parse(raw.slice(s, e + 1)); } catch {} }
  return null;
}

function parseCompletionJson(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.result && typeof data.result === 'object') return data.result;
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return parseJson(content);
  if (Array.isArray(content)) {
    return parseJson(content.map((i) => (typeof i === 'string' ? i : i?.text || '')).join(''));
  }
  return null;
}

// ── 스토리지 ──────────────────────────────────────────────────

function uid() { return getStudentProfile?.()?.studentId || 'default'; }
function storageKey(chapterId) { return `${STORAGE_KEY}_${chapterId}_${uid()}`; }

function saveState() {
  if (!state?.chapterId) return;
  try {
    localStorage.setItem(storageKey(state.chapterId), JSON.stringify({
      chapterId: state.chapterId,
      chapterTitle: state.chapterTitle,
      questionIdx: state.questionIdx,
      hintCount: state.hintCount,
      startedAt: state.startedAt,
      updatedAt: new Date().toISOString(),
      completedAt: state.completedAt || '',
      status: state.status,
      questions: state.questions,
      results: state.results,
      feedback: state.feedback,
      answerDraft: state.answerDraft || '',
      awaitingNext: Boolean(state.awaitingNext),
    }));
  } catch {}
}

function loadState(chapterId) {
  try {
    const raw = localStorage.getItem(storageKey(chapterId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearState(chapterId) {
  try { localStorage.removeItem(storageKey(chapterId)); } catch {}
}

function getAssessmentStatus(chapterId) {
  const saved = loadState(chapterId);
  if (!saved) return 'idle';
  if (saved.status === 'completed') return 'completed';
  if (saved.status === 'in_progress') return 'in_progress';
  return 'idle';
}

// ── 초기 상태 생성 ────────────────────────────────────────────

function createInitialState(chapterData) {
  const questions = Array.isArray(chapterData?.formativeAssessment?.questions)
    ? chapterData.formativeAssessment.questions : [];
  return {
    chapterId: chapterData.id,
    chapterTitle: chapterData.title || `제${chapterData.id}장`,
    questionIdx: 0,
    hintCount: 0,
    startedAt: new Date().toISOString(),
    completedAt: '',
    status: 'in_progress',
    questions,
    results: questions.map((q, i) => ({
      questionId: q.id || `Q${i + 1}`,
      attempts: 0,
      judgment: '',
      confidence: '',
      answer: '',
      feedback: '',
      hint: '',
      weakConcept: '',
      advanced: false,
      _hintCount: 0,   // 문항별 힌트 카운트
    })),
    feedback: '',
    answerDraft: '',
    awaitingNext: false,
  };
}

function currentQuestion() { return state?.questions?.[state.questionIdx] || null; }

function questionSignature(questions) {
  return JSON.stringify((questions || []).map((q) => ({
    id: q?.id || '', question: q?.question || '',
    concept: q?.concept || '', keyAnswer: q?.keyAnswer || q?.answer || '',
  })));
}

// ── UI 상태 제어 ──────────────────────────────────────────────

function setBusy(nextBusy) {
  busy = nextBusy;
  ['assessment-submit', 'assessment-restart', 'assessment-modal-close',
   'assessment-next-question', 'assessment-final-submit'].forEach((id) => {
    const b = el(id);
    if (b) b.disabled = nextBusy;
  });
  const ans = el('assessment-answer');
  if (ans) ans.disabled = nextBusy || Boolean(state?.awaitingNext);
}

// ── 문항 탐색 아이콘 렌더링 ───────────────────────────────────

function renderNavDots() {
  const container = el('assessment-nav-dots');
  if (!container || !state) return;

  if (state.status === 'completed') {
    // 완료 상태: 색상만 표시, 클릭 불가
    container.innerHTML = state.results.map((r, i) => {
      const cls = r.judgment === 'correct' ? 'nd-ok'
        : r.judgment === 'partial'  ? 'nd-partial'
        : r.judgment === 'incorrect' ? 'nd-incorrect'
        : 'nd-empty';
      return `<span class="nav-dot ${cls}" title="문항 ${i + 1}">${i + 1}</span>`;
    }).join('');
    return;
  }

  container.innerHTML = state.results.map((r, i) => {
    const isCurrent = i === state.questionIdx;
    const cls = isCurrent ? 'nd-current'
      : r.judgment === 'correct'   ? 'nd-ok'
      : r.judgment === 'partial'   ? 'nd-partial'
      : r.judgment === 'incorrect' ? 'nd-incorrect'
      : 'nd-empty';
    return `<button class="nav-dot ${cls}" data-idx="${i}" title="문항 ${i + 1}으로 이동">${i + 1}</button>`;
  }).join('');

  container.querySelectorAll('button.nav-dot').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (busy) return;
      goToQuestion(Number(btn.dataset.idx));
    });
  });
}

// ── 버튼 표시 제어 ────────────────────────────────────────────

function updateButtons() {
  const isCompleted = state?.status === 'completed';
  const answered = (state?.results || []).filter((r) => r.judgment).length;
  const total = state?.questions?.length || 0;

  // 답안 제출
  const submitBtn = el('assessment-submit');
  if (submitBtn) {
    submitBtn.textContent = '답안 제출';
    submitBtn.classList.toggle('hidden', isCompleted);
    submitBtn.disabled = busy || isCompleted || Boolean(state?.awaitingNext);
  }

  // 다음 문제 풀이
  const nextBtn = el('assessment-next-question');
  if (nextBtn) {
    const showNext = !isCompleted && state?.awaitingNext
      && state.questionIdx < total - 1;
    nextBtn.classList.toggle('hidden', !showNext);
    nextBtn.disabled = busy || !showNext;
  }

  // 최종 제출
  const finalBtn = el('assessment-final-submit');
  if (finalBtn) {
    finalBtn.classList.toggle('hidden', isCompleted);
    finalBtn.disabled = busy || answered === 0;
    finalBtn.title = answered === 0 ? '최소 1문항을 제출해야 합니다'
      : answered < total ? `${total - answered}문항 미완성 — 그래도 제출 가능`
      : '최종 제출';
  }
}

// ── 요약/결과 렌더링 ──────────────────────────────────────────

function renderSummary() {
  const results = Array.isArray(state?.results) ? state.results : [];
  const correct  = results.filter((r) => r.judgment === 'correct').length;
  const partial  = results.filter((r) => r.judgment === 'partial').length;
  const incorrect = results.filter((r) => r.judgment === 'incorrect').length;
  const unanswered = results.filter((r) => !r.judgment).length;
  const total = results.length || 1;
  const score = Math.round(((correct + partial * 0.5) / total) * 100);
  return `
    <div class="assessment-summary-card">
      <div class="assessment-summary-score">${score}점</div>
      <div class="assessment-summary-meta">
        정답 ${correct} · 부분정답 ${partial} · 보완 필요 ${incorrect}
        ${unanswered > 0 ? ` · 미응시 ${unanswered}` : ''}
      </div>
      <p style="font-size:12px;color:var(--text-secondary,#6b7280);margin-top:6px;">
        결과가 교수 대시보드에 전송되었습니다.
      </p>
    </div>`;
}

function renderResultList() {
  return (state?.results || []).map((item, i) => {
    const label = item.judgment === 'correct' ? '정답'
      : item.judgment === 'partial'   ? '부분정답'
      : item.judgment === 'incorrect' ? '보완 필요'
      : '미응시';
    return `
      <div class="assessment-result-item">
        <div class="assessment-result-head">
          <span>문항 ${i + 1}</span>
          <span class="assessment-chip ${item.judgment || 'idle'}">${label}</span>
        </div>
        <div class="assessment-result-feedback">${item.feedback || '제출하지 않았습니다.'}</div>
      </div>`;
  }).join('');
}

// ── 메인 렌더링 ───────────────────────────────────────────────

function render() {
  if (!state) return;

  renderNavDots();

  const titleEl    = el('assessment-modal-title');
  const progressEl = el('assessment-progress');
  const questionEl = el('assessment-question');
  const feedbackEl = el('assessment-feedback');
  const answerEl   = el('assessment-answer');
  const hintEl     = el('assessment-hint');
  const summaryEl  = el('assessment-summary');
  const resultsEl  = el('assessment-results');

  if (titleEl) titleEl.textContent = `${state.chapterTitle} 형성평가`;

  // ─ 완료 화면 ─
  if (state.status === 'completed') {
    if (progressEl) progressEl.textContent = `총 ${state.questions.length}문항 완료`;
    if (questionEl) questionEl.textContent = '평가가 완료되었습니다. 아래 결과를 확인하세요.';
    if (feedbackEl) feedbackEl.textContent = '';
    if (answerEl)   { answerEl.value = ''; answerEl.classList.add('hidden'); }
    if (hintEl)     { hintEl.textContent = ''; hintEl.classList.add('hidden'); }
    if (summaryEl)  { summaryEl.innerHTML = renderSummary(); summaryEl.classList.remove('hidden'); }
    if (resultsEl)  { resultsEl.innerHTML = renderResultList(); resultsEl.classList.remove('hidden'); }
    updateButtons();
    return;
  }

  // ─ 진행 화면 ─
  const question = currentQuestion();
  const result   = state.results[state.questionIdx];
  const attempts = result?.attempts ?? 0;
  const attemptsText = attempts > 0 ? ` · 시도 ${attempts}회` : '';
  const hintsText = state.hintCount > 0 ? ` · 힌트 ${state.hintCount}/${MAX_HINTS}회` : '';

  if (progressEl) progressEl.textContent =
    `문항 ${state.questionIdx + 1} / ${state.questions.length}${attemptsText}${hintsText}`;
  if (questionEl) questionEl.textContent = question?.question || '문항을 불러오지 못했습니다.';
  if (feedbackEl) feedbackEl.textContent = state.feedback || '';
  if (answerEl) {
    answerEl.value = state.answerDraft || result?.answer || '';
    answerEl.classList.remove('hidden');
    answerEl.disabled = busy || Boolean(state.awaitingNext);
  }
  if (hintEl) {
    const hint = result?.hint || '';
    hintEl.textContent = hint ? `힌트: ${hint}` : '';
    hintEl.classList.toggle('hidden', !hint);
  }
  if (summaryEl) { summaryEl.innerHTML = ''; summaryEl.classList.add('hidden'); }
  if (resultsEl) { resultsEl.innerHTML = ''; resultsEl.classList.add('hidden'); }

  updateButtons();
}

// ── 문항 이동 ─────────────────────────────────────────────────

function goToQuestion(idx) {
  if (!state || busy) return;
  if (idx < 0 || idx >= state.questions.length) return;

  // 현재 문항의 힌트 카운트 저장
  if (state.results[state.questionIdx]) {
    state.results[state.questionIdx]._hintCount = state.hintCount;
  }

  state.questionIdx = idx;
  state.awaitingNext = false;
  state.hintCount = state.results[idx]?._hintCount || 0;
  state.feedback = state.results[idx]?.feedback || '';
  // 이미 답변한 경우 이전 답안 표시 (재답변 가능)
  state.answerDraft = state.results[idx]?.answer || '';

  saveState();
  render();
  el('assessment-answer')?.focus();
}

function goToNextQuestion() {
  if (!state || state.status === 'completed') return;
  goToQuestion(state.questionIdx + 1);
}

// ── 답안 제출 ─────────────────────────────────────────────────

async function workerRouteJson(path, body) {
  let lastError = null;
  for (const url of WORKER_URLS) {
    try {
      const base = url.endsWith('/') ? url.slice(0, -1) : url;
      const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
      return await res.json();
    } catch (err) { lastError = err; }
  }
  throw lastError || new Error(`All worker endpoints failed for ${path}`);
}

async function requestAssessmentDecision(payload) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const data = await workerRouteJson('/chat/respond', payload);
      const result = parseCompletionJson(data);
      if (result) return result;
      throw new Error('Invalid assessment response');
    } catch (err) {
      if (attempt === 0) await new Promise((r) => setTimeout(r, 350));
      else throw err;
    }
  }
}

async function submitCurrentAnswer() {
  if (!state || state.status === 'completed' || state.awaitingNext || busy) return;

  const answerEl = el('assessment-answer');
  const answer = trim(answerEl?.value);
  if (!answer) { showToast('답안을 입력해 주세요.', 'error'); return; }

  const question = currentQuestion();
  if (!question) { showToast('문항을 불러오지 못했습니다.', 'error'); return; }

  setBusy(true);
  state.answerDraft = answer;
  state.feedback = '답안을 판정하고 있습니다...';
  render();

  try {
    const result = await requestAssessmentDecision({
      mode: 'assessment',
      chapter: currentChapter,
      question,
      user_input: answer,
      memorySummary: {},
      remaining_hints: Math.max(0, MAX_HINTS - state.hintCount),
      is_last_question: state.questionIdx === state.questions.length - 1,
    });

    const current = state.results[state.questionIdx];
    current.attempts += 1;
    current.judgment    = trim(result.judgment) || 'incorrect';
    current.confidence  = trim(result.confidence) || 'medium';
    current.answer      = answer;
    current.feedback    = trim(result.feedback) || '';
    current.hint        = trim(result.hint) || current.hint || '';
    current.weakConcept = trim(result.weak_concept) || '';
    current.advanced    = Boolean(result.advance);

    state.answerDraft = '';
    state.feedback = current.feedback || '판정이 완료되었습니다.';
    state.awaitingNext = false;

    if (!current.advanced && current.hint) {
      state.hintCount += 1;
      current._hintCount = state.hintCount;
    }

    if (current.advanced) {
      // 정답 → 다음 문항으로 유도
      const isLast = state.questionIdx >= state.questions.length - 1;
      if (!isLast) {
        state.awaitingNext = true;
        state.feedback = `${current.feedback || ''}\n\n다음 문항으로 이동하거나 최종 제출하세요.`;
      }
      // 마지막 문항이면 awaitingNext=false, 최종 제출 버튼으로 유도
    } else if (state.hintCount >= MAX_HINTS) {
      // 힌트 소진
      const isLast = state.questionIdx >= state.questions.length - 1;
      if (!isLast) {
        state.awaitingNext = true;
        state.feedback = `힌트를 ${MAX_HINTS}회 모두 사용했습니다. 다음 문항으로 넘어가 주세요.`;
      }
    }

    saveState();
    syncBadge();
    render();
  } catch (err) {
    state.feedback = '판정 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    render();
    showToast('형성평가 판정이 일시적으로 불안정합니다. 다시 시도해 주세요.', 'error');
  } finally {
    setBusy(false);
    saveState();
  }
}

// ── 최종 제출 ─────────────────────────────────────────────────

async function finalSubmit() {
  if (!state || busy) return;

  const answered = state.results.filter((r) => r.judgment).length;
  if (answered === 0) {
    showToast('최소 1문항 이상 제출해야 합니다.', 'error');
    return;
  }
  const total = state.questions.length;
  if (answered < total) {
    const ok = confirm(`${total - answered}개 문항이 미완성입니다. 그래도 최종 제출하시겠습니까?`);
    if (!ok) return;
  }

  setBusy(true);

  // 완료 상태로 전환 및 요약 표시
  state.status = 'completed';
  state.completedAt = new Date().toISOString();
  saveState();
  syncBadge();
  render();

  // 교수 대시보드 전송
  const profile = getStudentProfile?.() || {};
  const results = state.results;
  const correct  = results.filter((r) => r.judgment === 'correct').length;
  const partial  = results.filter((r) => r.judgment === 'partial').length;
  const score    = Math.round(((correct + partial * 0.5) / total) * 100);
  const weakConcepts = [...new Set(results.map((r) => r.weakConcept).filter(Boolean))];

  try {
    const { sendAssessment } = await import('./instrumentation.js?v=20260309e');
    const sessionId = `assess_${state.chapterId}_${profile.studentId || 'anon'}_${Date.now()}`;
    await sendAssessment({
      session_id: sessionId,
      student_id:    profile.studentId || '',
      student_name:  profile.studentName || '',
      chapter_id:    state.chapterId,
      chapter_title: state.chapterTitle || '',
      submitted_at:  state.completedAt,
      score,
      correct_count: correct,
      total_count:   total,
      weak_concepts: weakConcepts,
      assessment_results: results.map((r) => ({
        question_id: r.questionId,
        judgment:    r.judgment,
        answer:      r.answer,
        attempts:    r.attempts,
        weak_concept: r.weakConcept,
      })),
    });
    showToast('형성평가 결과가 교수 대시보드에 전송되었습니다.', 'success');
  } catch (err) {
    console.error('[finalSubmit] sendAssessment failed:', err);
    showToast('결과 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.', 'error');
  } finally {
    setBusy(false);
  }
}

// ── 배지 동기화 ───────────────────────────────────────────────

function syncBadge(chapterId = state?.chapterId) {
  if (!chapterId) return;
  document.querySelectorAll(`.toc-assessment-btn[data-chapter-id="${chapterId}"]`).forEach((btn) => {
    const status = getAssessmentStatus(chapterId);
    btn.classList.toggle('has-entry',    status === 'completed');
    btn.classList.toggle('has-progress', status === 'in_progress');
    btn.setAttribute('data-status', status);
    btn.title = status === 'completed' ? '형성평가 결과 보기'
      : status === 'in_progress' ? '형성평가 이어하기'
      : '형성평가 시작';
  });
}

// ── 다시 시작 ─────────────────────────────────────────────────

function restartAssessment() {
  if (!currentChapter) return;
  state = createInitialState(currentChapter);
  saveState();
  syncBadge();
  render();
}

function closeModal() {
  el('assessment-modal')?.classList.add('hidden');
}

// ── 이벤트 바인딩 ─────────────────────────────────────────────

function bindModalEvents() {
  const modal = el('assessment-modal');
  if (!modal || modal.dataset.bound === 'true') return;
  modal.dataset.bound = 'true';

  el('assessment-modal-close')?.addEventListener('click', closeModal);
  el('assessment-modal-cancel')?.addEventListener('click', closeModal);
  el('assessment-submit')?.addEventListener('click', submitCurrentAnswer);
  el('assessment-next-question')?.addEventListener('click', goToNextQuestion);
  el('assessment-final-submit')?.addEventListener('click', finalSubmit);
  el('assessment-restart')?.addEventListener('click', () => {
    if (!confirm('현재 진행 상태를 초기화하고 처음부터 다시 시작할까요?')) return;
    restartAssessment();
  });
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  });
  el('assessment-answer')?.addEventListener('input', (e) => {
    if (!state) return;
    state.answerDraft = e.target.value;
    saveState();
  });
}

// ── 공개 API ──────────────────────────────────────────────────

export function initAssessmentFeature(options = {}) {
  showToast        = typeof options.showToast === 'function' ? options.showToast : showToast;
  getStudentProfile = typeof options.getStudentProfile === 'function' ? options.getStudentProfile : getStudentProfile;
  openReflection   = typeof options.openReflection === 'function' ? options.openReflection : null;
  bindModalEvents();
}

export async function openAssessmentModal(chapterData) {
  if (!chapterData?.id) {
    showToast('이 장에는 형성평가 문항이 아직 준비되지 않았습니다.', 'error');
    return;
  }

  let remotePayload = null;
  try { remotePayload = await fetchQuestions(chapterData.id); } catch {}

  const questions = normalizeQuestions(chapterData, remotePayload);
  if (questions.length === 0) {
    showToast('이 장에는 형성평가 문항이 아직 준비되지 않았습니다.', 'error');
    return;
  }

  currentChapter = {
    ...chapterData,
    formativeAssessment: {
      ...(chapterData.formativeAssessment || {}),
      totalQuestions: questions.length,
      questions,
    },
  };
  const saved = loadState(chapterData.id);
  state = (saved?.status && questionSignature(saved.questions) === questionSignature(questions))
    ? saved : createInitialState(currentChapter);
  saveState();
  syncBadge(chapterData.id);
  render();
  el('assessment-modal')?.classList.remove('hidden');
  window.requestAnimationFrame(() => { el('assessment-answer')?.focus(); });
}

async function fetchQuestions(chapterId) {
  let lastError = null;
  for (const url of WORKER_URLS) {
    try {
      const base = url.endsWith('/') ? url.slice(0, -1) : url;
      const res = await fetch(`${base}/questions/${encodeURIComponent(chapterId)}`, {
        method: 'GET', cache: 'no-store',
      });
      if (!res.ok) { if (res.status === 404) return null; throw new Error(`HTTP ${res.status}`); }
      return await res.json();
    } catch (err) { lastError = err; }
  }
  if (lastError) throw lastError;
  return null;
}

function normalizeQuestions(chapterData, remotePayload) {
  if (Array.isArray(remotePayload?.questions?.questions) && remotePayload.questions.questions.length > 0) {
    return remotePayload.questions.questions;
  }
  if (Array.isArray(chapterData?.formativeAssessment?.questions)) {
    return chapterData.formativeAssessment.questions;
  }
  return [];
}

export function refreshAssessmentBadges() {
  document.querySelectorAll('.toc-assessment-btn').forEach((btn) => {
    const chapterId = btn.dataset.chapterId;
    if (chapterId) syncBadge(chapterId);
  });
}

export function clearAssessmentSession(chapterId) {
  clearState(chapterId);
  syncBadge(chapterId);
}
