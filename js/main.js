let initChatbot = () => {};
let initExport = () => {};
let resetChatSession = () => {};
let initAuthGate = async () => null;
let getStudentProfile = () => null;
let authModuleLoaded = false;
let chapterCurationMap = {};
const LAST_CHAPTER_KEY = 'logic_last_chapter_v1';

// ??? 梨뺥꽣 紐⑤뱢 ?덉??ㅽ듃由?(?숈쟻 ?꾪룷?? ???
const CHAPTER_MODULES = {
  '01': () => import('./chapters/chapter01.js?v=20260309e'),
  '02': () => import('./chapters/chapter02.js?v=20260309e'),
  '03': () => import('./chapters/chapter03.js?v=20260309e'),
  '04': () => import('./chapters/chapter04.js?v=20260309e'),
  '05': () => import('./chapters/chapter05.js?v=20260309e'),
  '06': () => import('./chapters/chapter06.js?v=20260309e'),
  '07': () => import('./chapters/chapter07.js?v=20260309e'),
  '08': () => import('./chapters/chapter08.js?v=20260309e'),
  '09': () => import('./chapters/chapter09.js?v=20260309e'),
  '10': () => import('./chapters/chapter10.js?v=20260309e'),
  '11': () => import('./chapters/chapter11.js?v=20260309e'),
};

let currentChapterId = null;
let scrollObserver = null;

// ??? ?쒖텧 ?꾨즺 ?곹깭 ???

// ─── 성찰일지 저장/불러오기 ───
let reflectionCurrentChapterId = null;

function getReflectionKey(chapterId) {
  const uid = getStudentProfile()?.studentId || 'default';
  return `logic_reflection_${chapterId}_${uid}`;
}

function loadReflection(chapterId) {
  try {
    const raw = localStorage.getItem(getReflectionKey(chapterId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function getLastChapterStorageKey() {
  const uid = getStudentProfile()?.studentId || 'default';
  return `${LAST_CHAPTER_KEY}_${uid}`;
}

function saveLastChapterId(chapterId) {
  if (!chapterId) return;
  try {
    localStorage.setItem(getLastChapterStorageKey(), chapterId);
  } catch { /* ignore */ }
}

function loadLastChapterId(chapters = []) {
  try {
    const saved = String(localStorage.getItem(getLastChapterStorageKey()) || '').trim();
    if (!saved) return '';
    if (Array.isArray(chapters) && chapters.length > 0) {
      return chapters.some((chapter) => String(chapter.id) === saved) ? saved : '';
    }
    return saved;
  } catch {
    return '';
  }
}

const REFLECTION_WORKER_URLS = Array.from(new Set([
  'https://logic.dongkuklee99.workers.dev',
  'https://logic-proxy.dongkuklee99.workers.dev',
  'https://logic-proxy.ldgit99.workers.dev',
  ...((window.location.origin.includes('localhost')
    || window.location.origin.includes('127.0.0.1')
    || /(^|\.)workers\.dev$/i.test(window.location.hostname || ''))
      ? [window.location.origin]
      : []),
].filter(Boolean)));

async function postReflectionToServer(token, chapterId, answers) {
  let lastError = null;
  for (const base of REFLECTION_WORKER_URLS) {
    try {
      const res = await fetch(`${base}/reflections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ chapter_id: chapterId, answers }),
      });
      if (!res.ok) {
        let errMsg = `request failed: ${res.status}`;
        try {
          const data = await res.json();
          if (data?.error) errMsg = String(data.error);
        } catch { /* ignore */ }
        throw new Error(errMsg);
      }
      return true;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error('network error');
}

async function saveReflectionData(chapterId, answers) {
  try {
    localStorage.setItem(getReflectionKey(chapterId), JSON.stringify({
      answers,
      savedAt: new Date().toISOString(),
    }));
  } catch { /* ignore */ }

  const profile = getStudentProfile();
  if (!profile?.token) {
    return { localSaved: true, serverSaved: false, reason: 'no_token' };
  }

  try {
    await postReflectionToServer(profile.token, chapterId, answers);
    return { localSaved: true, serverSaved: true, reason: '' };
  } catch (e) {
    return { localSaved: true, serverSaved: false, reason: String(e?.message || 'network error') };
  }
}

function hasReflection(chapterId) {
  const data = loadReflection(chapterId);
  return !!(data?.answers?.some(a => a && a.trim()));
}

function refreshTocReflectionBadges() {
  document.querySelectorAll('.toc-reflection-btn').forEach(btn => {
    const id = btn.dataset.chapterId;
    if (id) btn.classList.toggle('has-entry', hasReflection(id));
  });
}

function openReflectionModal(chapterId, chapterTitle) {
  reflectionCurrentChapterId = chapterId;
  const titleEl = document.getElementById('reflection-modal-title');
  if (titleEl) titleEl.textContent = `\uc81c${chapterId}\uc7a5 \uc131\ucc30\uc77c\uc9c0`;

  const data = loadReflection(chapterId);
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById(`reflection-a${i}`);
    if (el) el.value = data?.answers?.[i - 1] || '';
  }

  const savedEl = document.getElementById('reflection-saved-at');
  if (savedEl) {
    if (data?.savedAt) {
      const d = new Date(data.savedAt);
      savedEl.textContent = `\ub9c8\uc9c0\ub9c9 \uc800\uc7a5: ${d.toLocaleDateString('ko-KR')} ${d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      savedEl.textContent = '';
    }
  }

  document.getElementById('reflection-modal')?.classList.remove('hidden');
  document.getElementById('reflection-a1')?.focus();
}

function bindReflectionModal() {
  const modal = document.getElementById('reflection-modal');
  const closeBtn = document.getElementById('reflection-modal-close');
  const cancelBtn = document.getElementById('reflection-modal-cancel');
  const saveBtn = document.getElementById('reflection-modal-save');

  function close() { modal?.classList.add('hidden'); }

  closeBtn?.addEventListener('click', close);
  cancelBtn?.addEventListener('click', close);
  modal?.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal?.classList.contains('hidden')) close();
  });

  saveBtn?.addEventListener('click', async () => {
    if (!reflectionCurrentChapterId) return;
    const answers = [1, 2, 3].map(i => {
      return document.getElementById(`reflection-a${i}`)?.value.trim() || '';
    });
    saveBtn.disabled = true;
    const result = await saveReflectionData(reflectionCurrentChapterId, answers);

    const savedEl = document.getElementById('reflection-saved-at');
    if (savedEl) {
      const d = new Date();
      savedEl.textContent = `\ub9c8\uc9c0\ub9c9 \uc800\uc7a5: ${d.toLocaleDateString('ko-KR')} ${d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // TOC 배지 업데이트
    const btn = document.querySelector(`.toc-reflection-btn[data-chapter-id="${reflectionCurrentChapterId}"]`);
    if (btn) btn.classList.toggle('has-entry', answers.some(a => a));

    if (result.serverSaved) {
      showToast('\uc131\ucc30\uc77c\uc9c0\uac00 \uc81c\ucd9c\ub418\uc5c8\uc2b5\ub2c8\ub2e4. (\uad50\uc218 \ub300\uc2dc\ubcf4\ub4dc \ubc18\uc601)', 'success');
      close();
    } else {
      const msg = result.reason === 'no_token'
        ? '\ub85c\uadf8\uc778 \uc815\ubcf4\uac00 \uc5c6\uc5b4 \ub85c\uceec\uc5d0\ub9cc \uc800\uc7a5\ub418\uc5c8\uc2b5\ub2c8\ub2e4. \ub2e4\uc2dc \ub85c\uadf8\uc778 \ud6c4 \uc81c\ucd9c\ud574\uc8fc\uc138\uc694.'
        : `\uc11c\ubc84 \uc81c\ucd9c\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4: ${result.reason}`;
      showToast(msg, 'error');
    }
    saveBtn.disabled = false;
  });
}


const FETCH_TIMEOUT_MS = 10000;
const AUTH_FALLBACK_KEY = 'logic_basic_auth_v1';

async function fetchJsonWithTimeout(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function mergeChapterCuration(chapterData, curationMap, chapterId) {
  const extra = curationMap?.[chapterId];
  if (!extra || typeof extra !== 'object') return chapterData;
  return {
    ...chapterData,
    curatedKnowledge: Array.isArray(extra.curatedKnowledge) ? extra.curatedKnowledge : [],
    teachingNotes: Array.isArray(extra.teachingNotes) ? extra.teachingNotes : [],
    commonMisconceptions: Array.isArray(extra.commonMisconceptions) ? extra.commonMisconceptions : [],
    canonicalExamples: Array.isArray(extra.canonicalExamples) ? extra.canonicalExamples : [],
    gradingRubric: Array.isArray(extra.gradingRubric) ? extra.gradingRubric : [],
  };
}

async function loadRuntimeModules() {
  try {
    const authMod = await import('./auth.js?v=20260311c');
    if (typeof authMod.initAuthGate === 'function') {
      initAuthGate = authMod.initAuthGate;
      authModuleLoaded = true;
    }
    if (typeof authMod.getStudentProfile === 'function') {
      getStudentProfile = authMod.getStudentProfile;
    }
  } catch (e) {
    console.error('auth module load failed:', e);
  }

  try {
    const exportMod = await import('./export.js?v=20260326b');
    if (typeof exportMod.initExport === 'function') {
      initExport = exportMod.initExport;
    }
  } catch (e) {
    console.error('export module load failed:', e);
  }

  try {
    const chatbotMod = await import('./chatbot.js?v=20260326b');
    if (typeof chatbotMod.initChatbot === 'function') {
      initChatbot = chatbotMod.initChatbot;
    }
    if (typeof chatbotMod.resetChatSession === 'function') {
      resetChatSession = chatbotMod.resetChatSession;
    }
  } catch (e) {
    console.error('chatbot module load failed:', e);
  }
}

function initBasicLoginGateFallback() {
  const gate = document.getElementById('login-gate');
  if (!gate) return;

  const nameInput = document.getElementById('login-name');
  const idInput = document.getElementById('login-student-id');
  const errorEl = document.getElementById('login-error');
  const loginBtn = document.getElementById('login-submit');
  const signupBtn = document.getElementById('signup-submit');
  const logoutBtn = document.getElementById('auth-logout');
  const labelEl = document.getElementById('auth-student-label');

  const emailGroup = document.getElementById('login-email')?.closest('.form-group');
  const pwGroup = document.getElementById('login-password')?.closest('.form-group');
  const pw2Group = document.getElementById('login-password-confirm')?.closest('.form-group');
  if (emailGroup) emailGroup.style.display = 'none';
  if (pwGroup) pwGroup.style.display = 'none';
  if (pw2Group) pw2Group.style.display = 'none';

  function setError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg || '';
    errorEl.classList.toggle('hidden', !msg);
  }

  function applyProfile(profile) {
    if (!profile) return;
    if (labelEl) labelEl.textContent = `${profile.studentName} (${profile.studentId})`;
    gate.classList.add('hidden');
    localStorage.setItem(AUTH_FALLBACK_KEY, JSON.stringify(profile));
  }

  try {
    const saved = JSON.parse(localStorage.getItem(AUTH_FALLBACK_KEY) || 'null');
    if (saved?.studentName && saved?.studentId) {
      applyProfile(saved);
    } else {
      gate.classList.remove('hidden');
    }
  } catch {
    gate.classList.remove('hidden');
  }

  const onSubmit = () => {
    const studentName = String(nameInput?.value || '').trim();
    const studentId = String(idInput?.value || '').trim();
    if (!studentName || !studentId) {
      setError('\uc774\ub984\uacfc \ud559\ubc88\uc744 \uc785\ub825\ud574\uc8fc\uc138\uc694');
      return;
    }
    setError('');
    applyProfile({ studentName, studentId });
  };

  if (loginBtn && !loginBtn.dataset.fallbackBound) {
    loginBtn.dataset.fallbackBound = 'true';
    loginBtn.addEventListener('click', onSubmit);
  }
  if (signupBtn && !signupBtn.dataset.fallbackBound) {
    signupBtn.dataset.fallbackBound = 'true';
    signupBtn.addEventListener('click', onSubmit);
  }
  if (logoutBtn && !logoutBtn.dataset.fallbackBound) {
    logoutBtn.dataset.fallbackBound = 'true';
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem(AUTH_FALLBACK_KEY);
      location.reload();
    });
  }
}
// ??? ?좎뒪???뚮┝ ???
export function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ??? TOC ?꾩껜 鍮뚮뱶 (index.json 湲곕컲) ???
function buildTOC(chapters) {
  const tocList = document.getElementById('toc-list');
  tocList.innerHTML = '';

  chapters.forEach(ch => {
    const chapterEl = document.createElement('li');
    chapterEl.className = 'toc-chapter collapsed';
    chapterEl.dataset.chapterId = ch.id;

    const label = document.createElement('div');
    label.className = 'toc-chapter-label';
    const hasEntry = hasReflection(ch.id);
    label.innerHTML = `
      <span class="chapter-num">${ch.id}</span>
      <span class="chapter-title">${ch.title}</span>
      <button class="toc-reflection-btn${hasEntry ? ' has-entry' : ''}" data-chapter-id="${ch.id}" title="\uc131\ucc30\uc77c\uc9c0 \uc791\uc131" type="button">\ud83d\udcdd</button>
      <span class="toc-arrow">\u203a</span>
    `;
    label.addEventListener('click', () => loadChapter(ch.id));
    label.querySelector('.toc-reflection-btn').addEventListener('click', e => {
      e.stopPropagation();
      openReflectionModal(ch.id, ch.title);
    });

    const sections = document.createElement('ul');
    sections.className = 'toc-sections';

    chapterEl.appendChild(label);
    chapterEl.appendChild(sections);
    tocList.appendChild(chapterEl);
  });
}

// ??? ?쒖꽦 梨뺥꽣???뱀뀡 紐⑸줉 ?낅뜲?댄듃 ???
function updateTOCSections(chapterId, chapterData) {
  document.querySelectorAll('.toc-chapter').forEach(el => {
    el.classList.add('collapsed');
    el.querySelector('.toc-sections').innerHTML = '';
  });

  const chapterEl = document.querySelector(`.toc-chapter[data-chapter-id="${chapterId}"]`);
  if (!chapterEl) return;

  chapterEl.classList.remove('collapsed');
  const sections = chapterEl.querySelector('.toc-sections');

  chapterData.sections.forEach(sec => {
    const li = document.createElement('li');
    li.className = 'toc-section-item';
    const a = document.createElement('a');
    a.className = 'toc-section-link';
    a.dataset.section = sec.id;
    a.textContent = sec.title;
    a.addEventListener('click', () => {
      const el = document.getElementById(`section-${sec.id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
      }
    });
    li.appendChild(a);
    sections.appendChild(li);
  });

  const footer = document.getElementById('sidebar-footer');
  if (footer && chapterData.objectives) {
    footer.innerHTML = `
      <div class="objectives-title">\ud559\uc2b5\ubaa9\ud45c</div>
      ${chapterData.objectives.map(o => `<div class="objective-item">${o}</div>`).join('')}
    `;
  }
}

// ??? ?ㅽ겕濡??ㅽ뙆?????
function setupScrollSpy() {
  if (scrollObserver) scrollObserver.disconnect();
  const sections = document.querySelectorAll('.content-section');
  if (!sections.length) return;
  const contentArea = document.getElementById('content-area');

  scrollObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id.replace('section-', '');
        document.querySelectorAll('.toc-section-link').forEach(link => {
          link.classList.toggle('active', link.dataset.section === id);
        });
      }
    });
  }, { root: contentArea, rootMargin: '-5% 0px -60% 0px' });

  sections.forEach(el => scrollObserver.observe(el));
}

// ??? 梨뺥꽣 濡쒕뱶 ???
async function loadChapter(id, { force = false } = {}) {
  if (id === currentChapterId && !force) return;
  currentChapterId = id;

  document.getElementById('content-inner').innerHTML =
    '<div id="loading-screen"><div class="spinner"></div><p>\ucf58\ud150\uce20\ub97c \ubd88\ub7ec\uc624\ub294 \uc911...</p></div>';
  document.getElementById('content-area').scrollTop = 0;

  try {
    const chapterRaw = await fetchJsonWithTimeout(`./chapters/${id}.json?v=20260309e`);
    const chapterData = mergeChapterCuration(chapterRaw, chapterCurationMap, id);
    saveLastChapterId(id);

    document.getElementById('chapter-indicator').textContent = chapterData.title;
    updateTOCSections(id, chapterData);

    const mod = await CHAPTER_MODULES[id]();
    await mod.renderChapter(chapterData);

    try {
      await initChatbot(chapterData);
    } catch (e) {
      console.error('chatbot init failed:', e);
    }
    setTimeout(setupScrollSpy, 150);
  } catch (err) {
    console.error(`챕터 ${id} 로\ub529 실패:`, err);
    currentChapterId = null;
    document.getElementById('content-inner').innerHTML =
      `<div style="padding:32px;text-align:center;">
         <p style="color:var(--accent-red);">\ucc55\ud130 ${id} \ub85c\ub529\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4.</p>
         <button onclick="window.loadChapter('${id}')" style="margin-top:12px;padding:8px 20px;cursor:pointer;">\ub2e4\uc2dc \uc2dc\ub3c4</button>
       </div>`;
  }
}

// ??? ?ъ씠?쒕컮 / 梨쀫큸 ?좉? ???
function bindChatResetButton() {
  const btn = document.getElementById('btn-reset-chat');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!currentChapterId) return;
    if (!confirm('현재 장의 AI 튜터 대화를 초기화합니다. 계속하시겠습니까?')) return;
    resetChatSession();
  });
}

function setupToggleHandlers() {
  const appBody = document.getElementById('app-body');
  const sidebar = document.getElementById('sidebar');
  const chatbotPanel = document.getElementById('chatbot-panel');
  const backdrop = document.getElementById('panel-backdrop');

  function isMobile() { return window.innerWidth <= 768; }
  function isTablet() { return window.innerWidth <= 1024; }

  function showBackdrop() {
    if (backdrop) backdrop.style.display = 'block';
  }
  function hideBackdrop() {
    if (backdrop) backdrop.style.display = 'none';
  }
  function closeAllPanels() {
    sidebar.classList.remove('open');
    chatbotPanel.classList.remove('open');
    hideBackdrop();
  }

  // backdrop ?????⑤꼸 ?リ린 (iOS "click ?녿뒗 div" 臾몄젣 ?닿껐)
  if (backdrop) {
    backdrop.addEventListener('click', closeAllPanels);
    backdrop.addEventListener('touchend', (e) => { e.preventDefault(); closeAllPanels(); });
  }

  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    if (isMobile()) {
      const opening = !sidebar.classList.contains('open');
      closeAllPanels();
      if (opening) { sidebar.classList.add('open'); showBackdrop(); }
    } else {
      appBody.classList.toggle('sidebar-hidden');
    }
  });

  document.getElementById('chatbot-toggle').addEventListener('click', () => {
    if (isTablet()) {
      const opening = !chatbotPanel.classList.contains('open');
      closeAllPanels();
      if (opening) { chatbotPanel.classList.add('open'); showBackdrop(); }
    } else {
      appBody.classList.toggle('chatbot-hidden');
    }
  });

  // ?곗뒪?ы깙: 諛붽묑 ?대┃ ???⑤꼸 ?リ린 (document click 諛⑹떇 ?좎?)
  document.addEventListener('click', e => {
    if (!isMobile() && window.innerWidth <= 1024 && chatbotPanel.classList.contains('open')) {
      if (!chatbotPanel.contains(e.target) && !e.target.closest('#chatbot-toggle')) {
        chatbotPanel.classList.remove('open');
      }
    }
  });
}

function bindAuthRefreshHandler() {
  if (window.__logicAuthRefreshBound) return;
  window.__logicAuthRefreshBound = true;

  window.addEventListener('logic:auth-changed', async () => {
    refreshTocReflectionBadges();
    const targetChapterId = loadLastChapterId() || currentChapterId;
    if (!targetChapterId) return;
    try {
      await loadChapter(targetChapterId, { force: true });
    } catch (e) {
      console.error('chapter reload after auth failed:', e);
    }
  });
}

// ??? ??珥덇린?????
async function init() {
  try {
    await loadRuntimeModules();
    bindAuthRefreshHandler();

    if (authModuleLoaded) {
      initAuthGate()
        .then(() => refreshTocReflectionBadges())
        .catch((e) => {
          console.error('auth gate init failed:', e);
        });
    } else {
      initBasicLoginGateFallback();
    }

    const chapters = await fetchJsonWithTimeout('./chapters/index.json?v=20260309e');
    try {
      chapterCurationMap = await fetchJsonWithTimeout('./chapters/curation.json?v=20260326b');
    } catch (e) {
      console.warn('chapter curation load failed:', e);
      chapterCurationMap = {};
    }

    buildTOC(chapters);
    bindReflectionModal();
    setupToggleHandlers();
    bindChatResetButton();
    initExport();

    const initialChapterId = loadLastChapterId(chapters) || chapters[0].id;
    await loadChapter(initialChapterId);
  } catch (err) {
    console.error('앱 초기화 실패:', err);
    const inner = document.getElementById('content-inner');
    if (inner) {
      inner.innerHTML = `
        <div style="padding:48px 32px;text-align:center;color:var(--text-primary)">
          <p style="font-size:1.1rem;color:var(--accent-red);margin-bottom:16px;">콘텐츠를 불러오지 못했습니다.</p>
          <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:24px;font-family:monospace;">${String(err?.message || err)}</p>
          <button onclick="location.reload()" style="background:var(--accent-blue);color:#fff;border:none;border-radius:var(--radius);padding:10px 24px;font-size:0.9rem;cursor:pointer;">새로고침</button>
        </div>`;
    }
  }
}

window.loadChapter = loadChapter;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}


