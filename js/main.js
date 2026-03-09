let initChatbot = () => {};
let initExport = () => {};
let initAuthGate = async () => null;
let authModuleLoaded = false;

// ??? 梨뺥꽣 紐⑤뱢 ?덉??ㅽ듃由?(?숈쟻 ?꾪룷?? ???
const CHAPTER_MODULES = {
  '01': () => import('./chapters/chapter01.js?v=20260309d'),
  '02': () => import('./chapters/chapter02.js?v=20260309d'),
  '03': () => import('./chapters/chapter03.js?v=20260309d'),
  '04': () => import('./chapters/chapter04.js?v=20260309d'),
  '05': () => import('./chapters/chapter05.js?v=20260309d'),
  '06': () => import('./chapters/chapter06.js?v=20260309d'),
  '07': () => import('./chapters/chapter07.js?v=20260309d'),
  '08': () => import('./chapters/chapter08.js?v=20260309d'),
  '09': () => import('./chapters/chapter09.js?v=20260309d'),
  '10': () => import('./chapters/chapter10.js?v=20260309d'),
  '11': () => import('./chapters/chapter11.js?v=20260309d'),
};

let currentChapterId = null;
let scrollObserver = null;

// ??? ?쒖텧 ?꾨즺 ?곹깭 ???
const SUBMITTED_KEY_PREFIX = 'logic_submitted_';

export function markChapterSubmitted(chapterId) {
  localStorage.setItem(`${SUBMITTED_KEY_PREFIX}${chapterId}`, '1');
  // TOC 諭껋? ?낅뜲?댄듃
  const chapterEl = document.querySelector(`.toc-chapter[data-chapter-id="${chapterId}"]`);
  if (chapterEl && !chapterEl.querySelector('.toc-submitted-badge')) {
    const badge = document.createElement('span');
    badge.className = 'toc-submitted-badge';
    badge.textContent = '\u2713';
    chapterEl.querySelector('.chapter-title')?.after(badge);
  }
  // ?쒖텧 踰꾪듉 ?곹깭 ?낅뜲?댄듃
  if (chapterId === currentChapterId) {
    updateSubmitButtonState(true);
  }
}

function isChapterSubmitted(chapterId) {
  return localStorage.getItem(`${SUBMITTED_KEY_PREFIX}${chapterId}`) === '1';
}

export function updateSubmitButtonState(submitted) {
  const btn = document.getElementById('btn-submit-pdf');
  if (!btn) return;
  if (submitted) {
    btn.textContent = '?쒖텧 ?꾨즺';
    btn.classList.add('submitted');
    btn.disabled = true;
  } else {
    btn.textContent = '?뺤꽦?됯? ?쒖텧';
    btn.classList.remove('submitted');
    btn.disabled = false;
  }
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

async function loadRuntimeModules() {
  try {
    const authMod = await import('./auth.js?v=20260309d');
    if (typeof authMod.initAuthGate === 'function') {
      initAuthGate = authMod.initAuthGate;
      authModuleLoaded = true;
    }
  } catch (e) {
    console.error('auth module load failed:', e);
  }

  try {
    const exportMod = await import('./export.js?v=20260309d');
    if (typeof exportMod.initExport === 'function') {
      initExport = exportMod.initExport;
    }
  } catch (e) {
    console.error('export module load failed:', e);
  }

  try {
    const chatbotMod = await import('./chatbot.js?v=20260309d');
    if (typeof chatbotMod.initChatbot === 'function') {
      initChatbot = chatbotMod.initChatbot;
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
      setError('?대쫫怨??숇쾲???낅젰?섏꽭??');
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
    const submittedBadge = isChapterSubmitted(ch.id)
      ? '<span class="toc-submitted-badge">\u2713</span>'
      : '';
    label.innerHTML = `
      <span class="chapter-num">${ch.id}</span>
      <span class="chapter-title">${ch.title}</span>${submittedBadge}
      <span class="toc-arrow">??/span>
    `;
    label.addEventListener('click', () => loadChapter(ch.id));

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
      <div class="objectives-title">?숈뒿紐⑺몴</div>
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
async function loadChapter(id) {
  if (id === currentChapterId) return;
  currentChapterId = id;

  document.getElementById('content-inner').innerHTML =
    '<div id="loading-screen"><div class="spinner"></div><p>肄섑뀗痢좊? 遺덈윭?ㅻ뒗 以?..</p></div>';
  document.getElementById('content-area').scrollTop = 0;

  try {
    const chapterData = await fetchJsonWithTimeout(`./chapters/${id}.json?v=20260309d`);

    document.getElementById('chapter-indicator').textContent = chapterData.title;
    updateTOCSections(id, chapterData);

    const mod = await CHAPTER_MODULES[id]();
    await mod.renderChapter(chapterData);

    try {
      await initChatbot(chapterData);
    } catch (e) {
      console.error('chatbot init failed:', e);
    }
    updateSubmitButtonState(isChapterSubmitted(id));
    setTimeout(setupScrollSpy, 150);
  } catch (err) {
    console.error(`梨뺥꽣 ${id} 濡쒕뱶 ?ㅽ뙣:`, err);
    document.getElementById('content-inner').innerHTML =
      `<p style="color:var(--accent-red);padding:32px;">梨뺥꽣 ${id} 濡쒕뱶???ㅽ뙣?덉뒿?덈떎.</p>`;
  }
}

// ??? ?ъ씠?쒕컮 / 梨쀫큸 ?좉? ???
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

// ??? ??珥덇린?????
async function init() {
  try {
    await loadRuntimeModules();

    if (authModuleLoaded) {
      initAuthGate().catch((e) => {
        console.error('auth gate init failed:', e);
      });
    } else {
      initBasicLoginGateFallback();
    }

    const chapters = await fetchJsonWithTimeout('./chapters/index.json?v=20260309d');

    buildTOC(chapters);
    setupToggleHandlers();
    initExport();

    await loadChapter(chapters[0].id);
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}


