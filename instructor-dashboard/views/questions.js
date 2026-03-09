/**
 * views/questions.js
 * 형성평가 문항 관리 뷰 — 교수가 챕터별 문항을 입력/수정/저장한다.
 */

const CHAPTERS = [
  { id: '01', title: '1장. 들어가기' },
  { id: '02', title: '2장. 수의 체계' },
  { id: '03', title: '3장. 디지털 코드' },
  { id: '04', title: '4장. 논리 게이트' },
  { id: '05', title: '5장. 불 대수' },
  { id: '06', title: '6장. 논리식의 간소화' },
  { id: '07', title: '7장. 조합논리회로' },
  { id: '08', title: '8장. 플립플롭' },
  { id: '09', title: '9장. 순서논리회로' },
  { id: '10', title: '10장. 카운터와 레지스터' },
  { id: '11', title: '11장. 메모리' },
];

const BLOOM_LEVELS = ['기억', '이해', '적용', '분석', '평가', '창조'];

let _container = null;
let _api = null;
let _currentChapterId = '01';
let _questions = [];
let _dirty = false;

export function renderQuestions(container, api) {
  _container = container;
  _api = api;
  _container.innerHTML = buildShell();
  bindEvents();
  loadChapter(_currentChapterId);
}

function buildShell() {
  const options = CHAPTERS.map(
    (ch) => `<option value="${ch.id}">${ch.title}</option>`
  ).join('');

  return `
    <div class="questions-header" style="display:flex;align-items:center;gap:12px;padding:16px 0 8px;flex-wrap:wrap;">
      <h2 style="margin:0;font-size:1.1rem;">형성평가 문항 관리</h2>
      <select id="q-chapter-select" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border);font-size:0.9rem;">
        ${options}
      </select>
      <span id="q-status" style="font-size:0.8rem;color:var(--text-secondary);margin-left:auto;"></span>
      <button id="q-save-btn" style="background:var(--accent-blue);color:#fff;border:none;border-radius:6px;padding:8px 18px;cursor:pointer;font-size:0.9rem;">저장</button>
    </div>
    <p style="font-size:0.8rem;color:var(--text-secondary);margin:0 0 16px;">
      여기서 저장한 문항이 챗봇 형성평가에 반영됩니다. 저장하지 않으면 기존 JSON 문항이 사용됩니다.
    </p>
    <div id="q-list" style="display:flex;flex-direction:column;gap:16px;"></div>
    <div style="display:flex;gap:8px;margin-top:16px;">
      <button id="q-add-btn" style="flex:1;padding:8px 18px;border-radius:6px;border:2px dashed var(--border);background:transparent;cursor:pointer;font-size:0.9rem;">+ 문항 추가</button>
      <button id="q-save-btn-bottom" style="padding:8px 24px;background:var(--accent-blue);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem;font-weight:600;">저장</button>
    </div>
  `;
}

function bindEvents() {
  _container.querySelector('#q-chapter-select').addEventListener('change', (e) => {
    if (_dirty && !confirm('저장하지 않은 변경사항이 있습니다. 이동하시겠습니까?')) return;
    _currentChapterId = e.target.value;
    loadChapter(_currentChapterId);
  });

  _container.querySelector('#q-save-btn').addEventListener('click', saveChapter);
  _container.querySelector('#q-add-btn').addEventListener('click', addQuestion);
  _container.querySelector('#q-save-btn-bottom').addEventListener('click', saveChapter);
}

async function loadChapter(chapterId) {
  setStatus('불러오는 중...');
  try {
    const result = await _api.fetchQuestions(chapterId);
    _questions = result?.questions?.questions
      ? result.questions.questions.map(normalizeQuestion)
      : [];
    _dirty = false;
    renderList();
    setStatus(_questions.length > 0 ? `${_questions.length}개 문항 (저장됨)` : 'KV에 없음 — JSON 기본값 사용 중');
  } catch {
    setStatus('불러오기 실패');
  }
}

async function saveChapter() {
  const btns = _container.querySelectorAll('#q-save-btn, #q-save-btn-bottom');
  btns.forEach((b) => { b.disabled = true; b.textContent = '저장 중...'; });
  try {
    collectFromDOM();
    await _api.saveQuestions(_currentChapterId, { questions: _questions });
    _dirty = false;
    setStatus(`${_questions.length}개 문항 저장됨`);
  } catch {
    setStatus('저장 실패');
  } finally {
    btns.forEach((b) => { b.disabled = false; b.textContent = '저장'; });
  }
}

function addQuestion() {
  collectFromDOM();
  _questions.push(normalizeQuestion({}));
  _dirty = true;
  renderList();
  // 마지막 카드로 스크롤
  const cards = _container.querySelectorAll('.q-card');
  if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deleteQuestion(index) {
  collectFromDOM();
  _questions.splice(index, 1);
  _dirty = true;
  renderList();
}

function collectFromDOM() {
  const cards = _container.querySelectorAll('.q-card');
  const updated = [];
  cards.forEach((card) => {
    updated.push({
      bloomLevel: card.querySelector('.q-bloom').value,
      concept: card.querySelector('.q-concept').value.trim(),
      question: card.querySelector('.q-question').value.trim(),
      keyAnswer: card.querySelector('.q-answer').value.trim(),
      hints: Array.from(card.querySelectorAll('.q-hint'))
        .map((el) => el.value.trim())
        .filter(Boolean),
    });
  });
  _questions = updated;
}

function renderList() {
  const list = _container.querySelector('#q-list');
  list.innerHTML = _questions.map((q, i) => buildCard(q, i)).join('');

  list.querySelectorAll('.q-delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (confirm(`Q${Number(btn.dataset.index) + 1}을 삭제하시겠습니까?`)) {
        deleteQuestion(Number(btn.dataset.index));
      }
    });
  });

  // 변경 감지
  list.querySelectorAll('input, textarea, select').forEach((el) => {
    el.addEventListener('input', () => { _dirty = true; });
  });
}

function buildCard(q, index) {
  const bloomOptions = BLOOM_LEVELS.map(
    (l) => `<option value="${l}" ${q.bloomLevel === l ? 'selected' : ''}>${l}</option>`
  ).join('');

  const hints = [...(q.hints || []), '', '', ''].slice(0, 3);

  return `
    <div class="q-card" style="border:1px solid var(--border);border-radius:8px;padding:16px;background:var(--bg-card, var(--bg-secondary));">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <strong style="min-width:32px;">Q${index + 1}</strong>
        <select class="q-bloom" style="padding:4px 8px;border-radius:4px;border:1px solid var(--border);font-size:0.85rem;">
          ${bloomOptions}
        </select>
        <input class="q-concept" type="text" placeholder="개념 (예: 보수 표현)" value="${esc(q.concept)}"
          style="flex:1;padding:4px 8px;border-radius:4px;border:1px solid var(--border);font-size:0.85rem;" />
        <button class="q-delete-btn" data-index="${index}"
          style="margin-left:auto;background:none;border:none;cursor:pointer;color:var(--accent-red);font-size:1rem;">✕</button>
      </div>

      <label style="display:block;font-size:0.8rem;color:var(--text-secondary);margin-bottom:4px;">질문</label>
      <textarea class="q-question" rows="2"
        style="width:100%;padding:8px;border-radius:4px;border:1px solid var(--border);font-size:0.9rem;resize:vertical;box-sizing:border-box;"
        placeholder="학생에게 물어볼 질문을 입력하세요.">${esc(q.question)}</textarea>

      <label style="display:block;font-size:0.8rem;color:var(--text-secondary);margin:8px 0 4px;">모범 답안</label>
      <textarea class="q-answer" rows="2"
        style="width:100%;padding:8px;border-radius:4px;border:1px solid var(--border);font-size:0.9rem;resize:vertical;box-sizing:border-box;"
        placeholder="AI가 채점 기준으로 사용할 모범 답안을 입력하세요.">${esc(q.keyAnswer)}</textarea>

      <label style="display:block;font-size:0.8rem;color:var(--text-secondary);margin:8px 0 4px;">힌트 (최대 3개)</label>
      <div style="display:flex;flex-direction:column;gap:4px;">
        ${hints.map((h, hi) => `
          <input class="q-hint" type="text" placeholder="힌트 ${hi + 1} (선택)" value="${esc(h)}"
            style="padding:4px 8px;border-radius:4px;border:1px solid var(--border);font-size:0.85rem;" />
        `).join('')}
      </div>
    </div>
  `;
}

function normalizeQuestion(q) {
  return {
    bloomLevel: q.bloomLevel || '기억',
    concept: q.concept || '',
    question: q.question || '',
    keyAnswer: q.keyAnswer || q.answer || '',
    hints: Array.isArray(q.hints) ? q.hints : [],
  };
}

function setStatus(msg) {
  const el = _container.querySelector('#q-status');
  if (el) el.textContent = msg;
}

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
