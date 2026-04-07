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
let advanceTimer = null;

function el(id) { return document.getElementById(id); }
function trim(text) { return String(text || '').trim(); }

function parseJson(text) {
  const raw = trim(text);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {}

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {}
  }
  return null;
}

function parseCompletionJson(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.result && typeof data.result === 'object') return data.result;

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return parseJson(content);

  if (Array.isArray(content)) {
    const text = content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item?.type === 'text') return item.text || '';
        return '';
      })
      .join('');
    return parseJson(text);
  }

  return null;
}

function uid() {
  return getStudentProfile?.()?.studentId || 'default';
}

function storageKey(chapterId) {
  return `${STORAGE_KEY}_${chapterId}_${uid()}`;
}

function serializeState() {
  return {
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
  };
}

function saveState() {
  if (!state?.chapterId) return;
  try {
    localStorage.setItem(storageKey(state.chapterId), JSON.stringify(serializeState()));
  } catch {}
}

function loadState(chapterId) {
  try {
    const raw = localStorage.getItem(storageKey(chapterId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function fetchQuestions(chapterId) {
  let lastError = null;
  for (const url of WORKER_URLS) {
    try {
      const base = url.endsWith('/') ? url.slice(0, -1) : url;
      const res = await fetch(`${base}/questions/${encodeURIComponent(chapterId)}`, {
        method: 'GET',
        cache: 'no-store',
      });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      lastError = err;
    }
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

function questionSignature(questions) {
  return JSON.stringify(
    (questions || []).map((question) => ({
      id: question?.id || '',
      question: question?.question || '',
      concept: question?.concept || '',
      keyAnswer: question?.keyAnswer || question?.answer || '',
      hints: Array.isArray(question?.hints) ? question.hints : [],
    })),
  );
}

function clearState(chapterId) {
  try {
    localStorage.removeItem(storageKey(chapterId));
  } catch {}
}

function clearAdvanceTimer() {
  if (advanceTimer) {
    clearTimeout(advanceTimer);
    advanceTimer = null;
  }
}

function getAssessmentStatus(chapterId) {
  const saved = loadState(chapterId);
  if (!saved) return 'idle';
  if (saved.status === 'completed') return 'completed';
  if (saved.status === 'in_progress') return 'in_progress';
  return 'idle';
}

function createInitialState(chapterData) {
  const questions = Array.isArray(chapterData?.formativeAssessment?.questions)
    ? chapterData.formativeAssessment.questions
    : [];
  return {
    chapterId: chapterData.id,
    chapterTitle: chapterData.title || `제${chapterData.id}장`,
    questionIdx: 0,
    hintCount: 0,
    startedAt: new Date().toISOString(),
    completedAt: '',
    status: 'in_progress',
    questions,
    results: questions.map((question, index) => ({
      questionId: question.id || `Q${index + 1}`,
      attempts: 0,
      judgment: '',
      confidence: '',
      answer: '',
      feedback: '',
      hint: '',
      weakConcept: '',
      advanced: false,
    })),
    feedback: '',
    answerDraft: '',
    awaitingNext: false,
  };
}

function currentQuestion() {
  return state?.questions?.[state.questionIdx] || null;
}

function setBusy(nextBusy) {
  busy = nextBusy;
  const submitBtn = el('assessment-submit');
  const restartBtn = el('assessment-restart');
  const closeBtn = el('assessment-modal-close');
  const answerEl = el('assessment-answer');
  const nextBtn = el('assessment-next-question');
  if (submitBtn) submitBtn.disabled = nextBusy;
  if (restartBtn) restartBtn.disabled = nextBusy;
  if (closeBtn) closeBtn.disabled = nextBusy;
  if (answerEl) answerEl.disabled = nextBusy || Boolean(state?.awaitingNext);
  if (nextBtn) nextBtn.disabled = nextBusy;
}

function updateButtons() {
  const submitBtn = el('assessment-submit');
  const nextBtn = el('assessment-next-question');
  if (submitBtn) {
    submitBtn.textContent = state?.status === 'completed' ? '완료됨' : '답안 제출';
    submitBtn.disabled = busy || state?.status === 'completed' || Boolean(state?.awaitingNext);
  }
  if (nextBtn) {
    nextBtn.classList.toggle('hidden', !state?.awaitingNext || state?.status === 'completed');
    nextBtn.disabled = busy || !state?.awaitingNext || state?.status === 'completed';
  }
}

function renderSummary() {
  const results = Array.isArray(state?.results) ? state.results : [];
  const correctCount = results.filter((item) => item.judgment === 'correct').length;
  const partialCount = results.filter((item) => item.judgment === 'partial').length;
  const incorrectCount = results.filter((item) => item.judgment === 'incorrect').length;
  const total = results.length || 1;
  const score = Math.round(((correctCount + partialCount * 0.5) / total) * 100);
  return `
    <div class="assessment-summary-card">
      <div class="assessment-summary-score">${score}점</div>
      <div class="assessment-summary-meta">정답 ${correctCount} · 부분정답 ${partialCount} · 보완 필요 ${incorrectCount}</div>
    </div>
  `;
}

function renderResultList() {
  return (state?.results || [])
    .map((item, index) => {
      const label = item.judgment === 'correct'
        ? '정답'
        : item.judgment === 'partial'
          ? '부분정답'
          : item.judgment === 'incorrect'
            ? '보완 필요'
            : '미응시';
      return `
        <div class="assessment-result-item">
          <div class="assessment-result-head">
            <span>문항 ${index + 1}</span>
            <span class="assessment-chip ${item.judgment || 'idle'}">${label}</span>
          </div>
          <div class="assessment-result-feedback">${item.feedback || '아직 제출하지 않았습니다.'}</div>
        </div>
      `;
    })
    .join('');
}

function render() {
  const modal = el('assessment-modal');
  if (!modal || !state) return;

  const titleEl = el('assessment-modal-title');
  const progressEl = el('assessment-progress');
  const questionEl = el('assessment-question');
  const feedbackEl = el('assessment-feedback');
  const answerEl = el('assessment-answer');
  const hintEl = el('assessment-hint');
  const summaryEl = el('assessment-summary');
  const resultsEl = el('assessment-results');

  if (titleEl) titleEl.textContent = `${state.chapterTitle} 형성평가`;

  if (state.status === 'completed') {
    if (progressEl) progressEl.textContent = `총 ${state.questions.length}문항을 완료했습니다.`;
    if (questionEl) questionEl.textContent = '평가가 완료되었습니다. 결과를 확인하고 성찰일지로 이어갈 수 있습니다.';
    if (feedbackEl) feedbackEl.textContent = '';
    if (answerEl) {
      answerEl.value = '';
      answerEl.classList.add('hidden');
    }
    if (hintEl) {
      hintEl.textContent = '';
      hintEl.classList.add('hidden');
    }
    if (summaryEl) {
      summaryEl.innerHTML = renderSummary();
      summaryEl.classList.remove('hidden');
    }
    if (resultsEl) {
      resultsEl.innerHTML = renderResultList();
      resultsEl.classList.remove('hidden');
    }
    updateButtons();
    return;
  }

  const question = currentQuestion();
  const result = state.results[state.questionIdx];
  const displayedHint = result?.hint || '';

  const attempts = state.results[state.questionIdx]?.attempts ?? 0;
  const attemptsText = attempts > 0 ? ` · 시도 ${attempts}회` : '';
  const hintsLeft = MAX_HINTS - state.hintCount;
  const hintsText = state.hintCount > 0 ? ` · 힌트 ${state.hintCount}/${MAX_HINTS}회 사용` : '';
  if (progressEl) progressEl.textContent = `문항 ${state.questionIdx + 1} / ${state.questions.length}${attemptsText}${hintsText}`;
  if (questionEl) questionEl.textContent = question?.question || '문항을 불러오지 못했습니다.';
  if (feedbackEl) feedbackEl.textContent = state.feedback || '';
  if (answerEl) {
    answerEl.value = state.answerDraft || result?.answer || '';
    answerEl.classList.remove('hidden');
    answerEl.disabled = busy || Boolean(state?.awaitingNext);
  }
  if (hintEl) {
    hintEl.textContent = displayedHint ? `힌트: ${displayedHint}` : '';
    hintEl.classList.toggle('hidden', !displayedHint);
  }
  if (summaryEl) {
    summaryEl.innerHTML = '';
    summaryEl.classList.add('hidden');
  }
  if (resultsEl) {
    resultsEl.innerHTML = '';
    resultsEl.classList.add('hidden');
  }
  updateButtons();
}

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
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error(`All worker endpoints failed for ${path}`);
}

async function requestAssessmentDecision(payload) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const data = await workerRouteJson('/chat/respond', payload);
      const result = parseCompletionJson(data);
      if (result) return result;
      throw new Error('Invalid assessment response');
    } catch (err) {
      lastError = err;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }
  throw lastError || new Error('Assessment request failed');
}

function syncBadge(chapterId = state?.chapterId) {
  if (!chapterId) return;
  document.querySelectorAll(`.toc-assessment-btn[data-chapter-id="${chapterId}"]`).forEach((btn) => {
    const status = getAssessmentStatus(chapterId);
    btn.classList.toggle('has-entry', status === 'completed');
    btn.classList.toggle('has-progress', status === 'in_progress');
    btn.setAttribute('data-status', status);
    btn.title = status === 'completed'
      ? '형성평가 결과 보기'
      : status === 'in_progress'
        ? '형성평가 이어하기'
        : '형성평가 시작';
  });
}

async function submitCurrentAnswer() {
  if (!state || state.status === 'completed' || state.awaitingNext || busy) return;
  clearAdvanceTimer();
  const answerEl = el('assessment-answer');
  const answer = trim(answerEl?.value);
  if (!answer) {
    showToast('답안을 입력해 주세요.', 'error');
    return;
  }

  const question = currentQuestion();
  if (!question) {
    showToast('문항을 불러오지 못했습니다.', 'error');
    return;
  }

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
    current.judgment = trim(result.judgment) || 'incorrect';
    current.confidence = trim(result.confidence) || 'medium';
    current.answer = answer;
    current.feedback = trim(result.feedback) || '';
    current.hint = trim(result.hint) || current.hint || '';
    current.weakConcept = trim(result.weak_concept) || '';
    current.advanced = Boolean(result.advance);

    state.answerDraft = '';
    state.awaitingNext = false;
    state.feedback = current.feedback || '판정이 완료되었습니다.';

    if (!current.advanced && current.hint) {
      state.hintCount += 1;
    }

    if (current.advanced) {
      if (result.next_action === 'finish_assessment' || state.questionIdx >= state.questions.length - 1) {
        state.status = 'completed';
        state.completedAt = new Date().toISOString();
        state.feedback = '형성평가가 완료되었습니다.';
      } else {
        state.awaitingNext = true;
        state.feedback = `${current.feedback || '다음 문항으로 이동합니다.'}`;
      }
    } else if (state.hintCount >= MAX_HINTS) {
      // 힌트 3회 모두 소진 → 강제 다음 문항으로
      if (state.questionIdx >= state.questions.length - 1) {
        state.status = 'completed';
        state.completedAt = new Date().toISOString();
        state.feedback = '힌트를 모두 사용했습니다. 형성평가가 완료되었습니다.';
      } else {
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

function restartAssessment() {
  if (!currentChapter) return;
  clearAdvanceTimer();
  state = createInitialState(currentChapter);
  saveState();
  syncBadge();
  render();
}

function goToNextQuestion() {
  if (!state || !state.awaitingNext || state.status === 'completed') return;
  state.questionIdx += 1;
  state.hintCount = 0;
  state.feedback = '';
  state.answerDraft = '';
  state.awaitingNext = false;
  saveState();
  syncBadge();
  render();
}

function closeModal() {
  clearAdvanceTimer();
  el('assessment-modal')?.classList.add('hidden');
}

function bindModalEvents() {
  const modal = el('assessment-modal');
  if (!modal || modal.dataset.bound === 'true') return;
  modal.dataset.bound = 'true';

  el('assessment-modal-close')?.addEventListener('click', closeModal);
  el('assessment-modal-cancel')?.addEventListener('click', closeModal);
  el('assessment-submit')?.addEventListener('click', submitCurrentAnswer);
  el('assessment-next-question')?.addEventListener('click', goToNextQuestion);
  el('assessment-restart')?.addEventListener('click', () => {
    if (!confirm('현재 형성평가 진행 상태를 초기화하고 처음부터 다시 시작할까요?')) return;
    restartAssessment();
  });
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  });
  el('assessment-answer')?.addEventListener('input', (event) => {
    if (!state) return;
    state.answerDraft = event.target.value;
    saveState();
  });
}

export function initAssessmentFeature(options = {}) {
  showToast = typeof options.showToast === 'function' ? options.showToast : showToast;
  getStudentProfile = typeof options.getStudentProfile === 'function' ? options.getStudentProfile : getStudentProfile;
  openReflection = typeof options.openReflection === 'function' ? options.openReflection : null;
  bindModalEvents();
}

export async function openAssessmentModal(chapterData) {
  if (!chapterData?.id) {
    showToast('이 장에는 형성평가 문항이 아직 준비되지 않았습니다.', 'error');
    return;
  }

  let remotePayload = null;
  try {
    remotePayload = await fetchQuestions(chapterData.id);
  } catch {}

  const questions = normalizeQuestions(chapterData, remotePayload);
  if (questions.length === 0) {
    showToast('\uC774 \uC7A5\uC5D0\uB294 \uD615\uC131\uD3C9\uAC00 \uBB38\uD56D\uC774 \uC544\uC9C1 \uC900\uBE44\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.', 'error');
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
    ? saved
    : createInitialState(currentChapter);
  saveState();
  syncBadge(chapterData.id);
  render();
  el('assessment-modal')?.classList.remove('hidden');
  window.requestAnimationFrame(() => {
    el('assessment-answer')?.focus();
  });
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
