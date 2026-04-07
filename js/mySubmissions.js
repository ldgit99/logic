/**
 * js/mySubmissions.js
 * 학생 자신의 제출 현황 패널
 */

const WORKER_BASE = 'https://logic-proxy.dongkuklee99.workers.dev';

const CH_LABELS = {
  '01': '들어가기',
  '02': '수 체계',
  '03': '코드 체계',
  '04': '불 대수',
  '05': '불 함수',
  '06': '논리 회로 간소화',
  '07': '조합논리회로',
  '08': '플립플롭',
  '09': '동기 순서논리회로',
  '10': '레지스터/카운터',
  '11': '기억장치',
};
const ALL_CHAPTERS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'];

function fmt(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
      + ' · '
      + d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return String(isoStr).slice(0, 16).replace('T', ' ');
  }
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function ensurePanel() {
  if (document.getElementById('my-sub-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'my-sub-panel';
  panel.className = 'my-sub-panel hidden';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.innerHTML = `
    <div class="my-sub-inner">
      <div class="my-sub-head">
        <div class="my-sub-head-copy">
          <strong class="my-sub-title">내 제출 현황</strong>
          <span class="my-sub-sync-note">5분 안에 반영됩니다.</span>
        </div>
        <button class="my-sub-close" id="my-sub-close" aria-label="닫기">✕</button>
      </div>
      <div class="my-sub-legend">
        <span class="ms-ok">✓ 제출</span>
        <span class="ms-miss">✗ 미제출</span>
      </div>
      <div id="my-sub-body" class="my-sub-body">
        <div class="my-sub-loading">불러오는 중...</div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  document.getElementById('my-sub-close')?.addEventListener('click', closePanel);
  panel.addEventListener('click', (e) => {
    if (e.target === panel) closePanel();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.classList.contains('hidden')) closePanel();
  });
}

function openPanel() {
  ensurePanel();
  document.getElementById('my-sub-panel')?.classList.remove('hidden');
  loadAndRender();
}

function closePanel() {
  document.getElementById('my-sub-panel')?.classList.add('hidden');
}

async function loadAndRender() {
  const body = document.getElementById('my-sub-body');
  if (!body) return;
  body.innerHTML = '<div class="my-sub-loading">불러오는 중...</div>';

  let token = '';
  try {
    const authMod = await import('./auth.js?v=20260311c');
    token = authMod.getStudentProfile?.()?.token || '';
  } catch {
    // ignore
  }

  if (!token) {
    body.innerHTML = '<p class="my-sub-error">로그인이 필요합니다.</p>';
    return;
  }

  try {
    const res = await fetch(`${WORKER_BASE}/my/submissions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderResults(body, data);
  } catch (err) {
    renderLocalFallback(body, err);
  }
}

function renderResults(body, data) {
  const assessMap = new Map((data.assessments || []).map((item) => [String(item.chapter_id), item]));
  const reflMap = new Map((data.reflections || []).map((item) => [String(item.chapter_id), item]));

  const totalCh = ALL_CHAPTERS.length;
  const doneAssess = ALL_CHAPTERS.filter((ch) => assessMap.has(ch)).length;
  const doneConv = ALL_CHAPTERS.filter((ch) => assessMap.get(ch)?.has_conversation).length;
  const doneRefl = ALL_CHAPTERS.filter((ch) => reflMap.has(ch)).length;

  const rows = ALL_CHAPTERS.map((ch) => {
    const a = assessMap.get(ch);
    const r = reflMap.get(ch);
    const hasAssess = !!a;
    const hasConv = !!a?.has_conversation;
    const hasRefl = !!r;
    const allDone = hasAssess && hasConv && hasRefl;

    const rowCls = allDone
      ? 'ms-row ms-row--full'
      : (hasAssess || hasConv || hasRefl)
        ? 'ms-row ms-row--partial'
        : 'ms-row ms-row--empty';

    return `
      <div class="${rowCls}">
        <div class="ms-ch-head">
          <span class="ms-ch-num">Ch.${ch}</span>
          <span class="ms-ch-name">${esc(CH_LABELS[ch] || '')}</span>
          ${allDone ? '<span class="ms-done-badge">완료</span>' : ''}
        </div>
        <div class="ms-checks">
          <div class="ms-check ${hasAssess ? 'ms-ok' : 'ms-miss'}">
            <span class="ms-check-icon">${hasAssess ? '✓' : '✗'}</span>
            <span class="ms-check-label">형성평가</span>
            ${hasAssess ? `<span class="ms-check-date">${fmt(a.submitted_at)}</span>` : ''}
            ${hasAssess && a.score != null ? `<span class="ms-score">${a.score}점</span>` : ''}
          </div>
          <div class="ms-check ${hasConv ? 'ms-ok' : 'ms-miss'}">
            <span class="ms-check-icon">${hasConv ? '✓' : '✗'}</span>
            <span class="ms-check-label">대화 내용</span>
            ${hasConv && a?.messages_count > 0 ? `<span class="ms-check-date">${a.messages_count}턴 · ${fmt(a.submitted_at)}</span>` : ''}
          </div>
          <div class="ms-check ${hasRefl ? 'ms-ok' : 'ms-miss'}">
            <span class="ms-check-icon">${hasRefl ? '✓' : '✗'}</span>
            <span class="ms-check-label">성찰일지</span>
            ${hasRefl ? `<span class="ms-check-date">${fmt(r.saved_at)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  body.innerHTML = `
    <div class="ms-summary">
      <div class="ms-kpi">
        <span class="ms-kpi-val">${doneAssess}/${totalCh}</span>
        <span class="ms-kpi-label">형성평가</span>
      </div>
      <div class="ms-kpi">
        <span class="ms-kpi-val">${doneConv}/${totalCh}</span>
        <span class="ms-kpi-label">대화 내용</span>
      </div>
      <div class="ms-kpi">
        <span class="ms-kpi-val">${doneRefl}/${totalCh}</span>
        <span class="ms-kpi-label">성찰일지</span>
      </div>
    </div>
    <div class="ms-list">${rows}</div>
  `;
}

function renderLocalFallback(body, err) {
  body.innerHTML = `
    <p class="my-sub-error" style="margin-bottom:8px;">서버 조회에 실패했습니다 (${esc(err?.message || String(err))}).</p>
    <p class="my-sub-error" style="font-size:11px;">로컬에 저장된 성찰일지 정보만 표시합니다.</p>
    <div class="ms-list">
      ${ALL_CHAPTERS.map((ch) => {
        const hasRefl = Object.keys(localStorage)
          .filter((key) => key.startsWith(`logic_reflection_${ch}_`))
          .some((key) => {
            try {
              const item = JSON.parse(localStorage.getItem(key));
              return item?.answers?.some((answer) => answer?.trim());
            } catch {
              return false;
            }
          });

        return `
          <div class="ms-row ${hasRefl ? 'ms-row--partial' : 'ms-row--empty'}">
            <div class="ms-ch-head">
              <span class="ms-ch-num">Ch.${ch}</span>
              <span class="ms-ch-name">${esc(CH_LABELS[ch] || '')}</span>
            </div>
            <div class="ms-checks">
              <div class="ms-check ms-miss"><span class="ms-check-icon">?</span><span class="ms-check-label">형성평가 (확인 불가)</span></div>
              <div class="ms-check ms-miss"><span class="ms-check-icon">?</span><span class="ms-check-label">대화 내용 (확인 불가)</span></div>
              <div class="ms-check ${hasRefl ? 'ms-ok' : 'ms-miss'}">
                <span class="ms-check-icon">${hasRefl ? '✓' : '✗'}</span>
                <span class="ms-check-label">성찰일지 (로컬)</span>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

export function initMySubmissions() {
  ensurePanel();

  const header = document.getElementById('auth-user');
  if (header && !document.getElementById('btn-my-submissions')) {
    const btn = document.createElement('button');
    btn.id = 'btn-my-submissions';
    btn.className = 'btn-my-submissions';
    btn.title = '내 제출 현황';
    btn.textContent = '📋 제출 현황';
    header.insertBefore(btn, header.firstChild);
    btn.addEventListener('click', openPanel);
  }
}
