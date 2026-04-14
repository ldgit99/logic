const WORKER_URLS = Array.from(new Set([
  'https://logic-proxy.dongkuklee99.workers.dev/',
  ...((window.location.origin.includes('localhost')
    || window.location.origin.includes('127.0.0.1')
    || /(^|\.)workers\.dev$/i.test(window.location.hostname || ''))
    ? [window.location.origin.endsWith('/') ? window.location.origin : `${window.location.origin}/`]
    : []),
].filter(Boolean)));

const STORAGE_KEY = 'logic_assessment_session_v2';
const MAX_HINTS = 3;

let showToast = () => {};
let getStudentProfile = () => ({ studentId: 'default' });
let openReflection = null;
let currentChapter = null;
let state = null;
let busy = false;

function el(id) { return document.getElementById(id); }
function trim(text) { return String(text || '').trim(); }

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
    startedAt: new Date().toISOString(),
    completedAt: '',
    status: 'in_progress',
    questions,
    results: questions.map((q, i) => ({
      questionId: q.id || `Q${i + 1}`,
      answer: '',
      submitted: false,
      hintRevealed: 0,   // 공개된 힌트 수
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
   'assessment-next-question', 'assessment-final-submit', 'assessment-show-hint'].forEach((id) => {
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
    container.innerHTML = state.results.map((r, i) => {
      const cls = r.submitted ? 'nd-submitted' : 'nd-empty';
      return `<span class="nav-dot ${cls}" title="문항 ${i + 1}">${i + 1}</span>`;
    }).join('');
    return;
  }

  container.innerHTML = state.results.map((r, i) => {
    const isCurrent = i === state.questionIdx;
    const cls = isCurrent ? 'nd-current'
      : r.submitted ? 'nd-submitted'
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
  const total = state?.questions?.length || 0;

  // 답안 제출
  const submitBtn = el('assessment-submit');
  if (submitBtn) {
    submitBtn.classList.toggle('hidden', isCompleted);
    submitBtn.disabled = busy || isCompleted || Boolean(state?.awaitingNext);
  }

  // 다음 문항
  const nextBtn = el('assessment-next-question');
  if (nextBtn) {
    const showNext = !isCompleted && state?.awaitingNext && state.questionIdx < total - 1;
    nextBtn.classList.toggle('hidden', !showNext);
    nextBtn.disabled = busy || !showNext;
  }

  // 최종 제출 — 마지막 문항에서 답변 완료 후에만 표시
  const finalBtn = el('assessment-final-submit');
  if (finalBtn) {
    const isLastQuestion = state?.questionIdx === total - 1;
    const lastSubmitted = state?.results?.[total - 1]?.submitted;
    const showFinal = !isCompleted && isLastQuestion && lastSubmitted;
    finalBtn.classList.toggle('hidden', !showFinal);
    finalBtn.disabled = busy;
  }

  // 단계별 힌트 보기 버튼
  const hintBtn = el('assessment-show-hint');
  if (hintBtn) {
    const question = currentQuestion();
    const result = state?.results?.[state.questionIdx];
    const hints = Array.isArray(question?.hints) ? question.hints : [];
    const revealed = result?.hintRevealed || 0;
    const hasMoreHints = !isCompleted && hints.length > 0 && revealed < hints.length;
    hintBtn.classList.toggle('hidden', !hasMoreHints);
    hintBtn.disabled = busy;
    if (hasMoreHints) {
      hintBtn.textContent = `단계별 힌트 보기 (${revealed}/${hints.length})`;
    }
  }
}

// ── 요약/결과 렌더링 ──────────────────────────────────────────

function renderSummary() {
  const results = Array.isArray(state?.results) ? state.results : [];
  const answered = results.filter((r) => r.submitted).length;
  const total = results.length;
  return `
    <div class="assessment-summary-card">
      <div class="assessment-summary-meta">
        총 ${total}문항 중 ${answered}문항 제출 완료
      </div>
      <p style="font-size:12px;color:var(--text-secondary,#6b7280);margin-top:6px;">
        답안이 교수 대시보드에 전송되었습니다. 채점 결과는 추후 안내됩니다.
      </p>
    </div>`;
}

function renderResultList() {
  return (state?.results || []).map((item, i) => {
    const question = state?.questions?.[i];
    return `
      <div class="assessment-result-item">
        <div class="assessment-result-head">
          <span>문항 ${i + 1}</span>
          <span class="assessment-chip ${item.submitted ? 'submitted' : 'idle'}">${item.submitted ? '제출 완료' : '미응시'}</span>
        </div>
        <div class="assessment-result-question" style="font-size:13px;color:var(--text-secondary,#6b7280);margin:4px 0;">
          ${escapeText(question?.question || '')}
        </div>
        <div class="assessment-result-feedback">
          ${item.submitted ? `<strong>내 답안:</strong> ${escapeText(item.answer)}` : '제출하지 않았습니다.'}
        </div>
      </div>`;
  }).join('');
}

function escapeText(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
    if (hintEl)     { hintEl.innerHTML = ''; hintEl.classList.add('hidden'); }
    if (summaryEl)  { summaryEl.innerHTML = renderSummary(); summaryEl.classList.remove('hidden'); }
    if (resultsEl)  { resultsEl.innerHTML = renderResultList(); resultsEl.classList.remove('hidden'); }
    updateButtons();
    return;
  }

  // ─ 진행 화면 ─
  const question = currentQuestion();
  const result   = state.results[state.questionIdx];

  if (progressEl) progressEl.textContent =
    `문항 ${state.questionIdx + 1} / ${state.questions.length}`;
  if (questionEl) questionEl.textContent = question?.question || '문항을 불러오지 못했습니다.';
  if (feedbackEl) feedbackEl.textContent = state.feedback || '';
  if (answerEl) {
    if (state.awaitingNext) {
      answerEl.value = '';
      answerEl.classList.add('hidden');
      answerEl.disabled = true;
    } else {
      answerEl.value = state.answerDraft || result?.answer || '';
      answerEl.classList.remove('hidden');
      answerEl.disabled = busy;
    }
  }

  // 힌트 영역: 공개된 힌트를 순서대로 표시
  if (hintEl) {
    const hints = Array.isArray(question?.hints) ? question.hints : [];
    const revealed = result?.hintRevealed || 0;
    if (revealed > 0 && hints.length > 0) {
      const hintHtml = hints.slice(0, revealed).map((h, idx) =>
        `<div class="assessment-hint-step"><strong>힌트 ${idx + 1}:</strong> ${escapeText(h)}</div>`
      ).join('');
      hintEl.innerHTML = hintHtml;
      hintEl.classList.remove('hidden');
    } else {
      hintEl.innerHTML = '';
      hintEl.classList.add('hidden');
    }
  }

  if (summaryEl) { summaryEl.innerHTML = ''; summaryEl.classList.add('hidden'); }
  if (resultsEl) { resultsEl.innerHTML = ''; resultsEl.classList.add('hidden'); }

  updateButtons();
}

// ── 문항 이동 ─────────────────────────────────────────────────

function goToQuestion(idx) {
  if (!state || busy) return;
  if (idx < 0 || idx >= state.questions.length) return;

  state.questionIdx = idx;
  state.awaitingNext = false;
  state.feedback = '';
  state.answerDraft = state.results[idx]?.answer || '';

  saveState();
  render();
  el('assessment-answer')?.focus();
}

function goToNextQuestion() {
  if (!state || state.status === 'completed') return;
  goToQuestion(state.questionIdx + 1);
}

// ── 단계별 힌트 보기 ──────────────────────────────────────────

function showNextHint() {
  if (!state || state.status === 'completed' || busy) return;

  const question = currentQuestion();
  const result = state.results[state.questionIdx];
  if (!question || !result) return;

  const hints = Array.isArray(question.hints) ? question.hints : [];
  if (result.hintRevealed >= hints.length) return;

  result.hintRevealed += 1;
  saveState();
  render();
}

// ── 답안 제출 (AI 채점 없이 로컬 기록) ───────────────────────

function submitCurrentAnswer() {
  if (!state || state.status === 'completed' || state.awaitingNext || busy) return;

  const answerEl = el('assessment-answer');
  const answer = trim(answerEl?.value);
  if (!answer) { showToast('답안을 입력해 주세요.', 'error'); return; }

  const question = currentQuestion();
  if (!question) { showToast('문항을 불러오지 못했습니다.', 'error'); return; }

  const current = state.results[state.questionIdx];
  current.answer = answer;
  current.submitted = true;

  state.answerDraft = '';
  state.feedback = '답안이 저장되었습니다.';

  const isLast = state.questionIdx >= state.questions.length - 1;
  if (!isLast) {
    state.awaitingNext = true;
    state.feedback = '답안이 저장되었습니다. 다음 문항으로 이동하세요.';
  }
  // 마지막 문항이면 awaitingNext=false, 최종 제출 버튼으로 유도

  saveState();
  syncBadge();
  render();

  if (state.awaitingNext) {
    el('assessment-next-question')?.focus();
  }
}

// ── 최종 제출 ─────────────────────────────────────────────────

async function finalSubmit() {
  if (!state || busy) return;

  const total = state.questions.length;
  const lastSubmitted = state.results[total - 1]?.submitted;
  if (!lastSubmitted) {
    showToast('마지막 문항까지 모두 풀어야 최종 제출할 수 있습니다.', 'error');
    return;
  }

  setBusy(true);

  // 완료 상태로 전환
  state.status = 'completed';
  state.completedAt = new Date().toISOString();
  saveState();
  syncBadge();
  render();

  // 교수 대시보드 전송
  let profile = getStudentProfile?.() || {};
  if (!profile.studentId) {
    try {
      const stored = JSON.parse(localStorage.getItem('logic_auth_v2') || 'null');
      if (stored?.studentId) {
        profile = { studentId: stored.studentId, studentName: stored.studentName || '', token: stored.token || '' };
      }
    } catch {}
  }

  const results = state.results;
  const answeredCount = results.filter((r) => r.submitted).length;

  try {
    const { sendAssessment } = await import('./instrumentation.js?v=20260407b');
    if (!profile.studentId) throw new Error('로그인 정보를 찾을 수 없습니다. 다시 로그인 후 제출해 주세요.');
    const sessionId = `assess_${state.chapterId}_${profile.studentId}_${Date.now()}`;
    await sendAssessment({
      session_id: sessionId,
      student_id:    profile.studentId,
      student_name:  profile.studentName || '',
      chapter_id:    state.chapterId,
      chapter_title: state.chapterTitle || '',
      submitted_at:  state.completedAt,
      grading_status: 'pending',
      score: 0,
      correct_count: 0,
      total_count:   total,
      weak_concepts: [],
      assessment_results: results.map((r, i) => ({
        question_id: r.questionId,
        question_text: state.questions[i]?.question || '',
        concept: state.questions[i]?.concept || '',
        key_answer: state.questions[i]?.keyAnswer || '',
        answer:      r.answer,
        submitted:   r.submitted,
        hints_used:  r.hintRevealed || 0,
      })),
    });
    showToast('형성평가 답안이 교수 대시보드에 전송되었습니다.', 'success');
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

function isAssessmentInProgress() {
  return state && state.status !== 'completed' && state.results?.some((r) => r?.submitted);
}

function closeModal() {
  el('assessment-modal')?.classList.add('hidden');
}

function tryCloseModal() {
  if (isAssessmentInProgress()) {
    if (!confirm('형성평가가 진행 중입니다. 창을 닫으면 현재까지의 진행 상태는 저장되며 나중에 이어서 풀 수 있습니다.\n\n닫으시겠습니까?')) return;
  }
  closeModal();
}

// ── 이벤트 바인딩 ─────────────────────────────────────────────

function bindModalEvents() {
  const modal = el('assessment-modal');
  if (!modal || modal.dataset.bound === 'true') return;
  modal.dataset.bound = 'true';

  el('assessment-modal-close')?.addEventListener('click', tryCloseModal);
  el('assessment-modal-cancel')?.addEventListener('click', tryCloseModal);
  el('assessment-submit')?.addEventListener('click', submitCurrentAnswer);
  el('assessment-next-question')?.addEventListener('click', goToNextQuestion);
  el('assessment-final-submit')?.addEventListener('click', finalSubmit);
  el('assessment-show-hint')?.addEventListener('click', showNextHint);
  el('assessment-restart')?.addEventListener('click', () => {
    if (!confirm('현재 진행 상태를 초기화하고 처음부터 다시 시작할까요?')) return;
    restartAssessment();
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) tryCloseModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) tryCloseModal();
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
  // 이전 AI 채점 세션(submitted 필드 없음)은 호환 불가 → 새로 시작
  const isCompatible = saved?.status
    && questionSignature(saved.questions) === questionSignature(questions)
    && saved.results?.[0]?.hasOwnProperty('submitted');
  state = isCompatible ? saved : createInitialState(currentChapter);
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
