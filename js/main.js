import { resetChatbot } from './chatbot.js?v=20260307b';
import { initExport } from './export.js?v=20260307b';

const CHAPTER_MODULES = {
  '01': () => import('./chapters/chapter01.js?v=20260307b'),
  '02': () => import('./chapters/chapter02.js?v=20260307b'),
};

let currentChapterId = null;
let scrollObserver = null;

async function fetchJsonWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!res.ok) {
      throw new Error(`${url} HTTP ${res.status}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function showFatalLoadError(message) {
  const loading = document.getElementById('loading-screen');
  if (!loading) return;

  loading.innerHTML = `
    <p style="color:var(--accent-red);text-align:center;padding:24px;white-space:pre-wrap;">
      肄섑뀗痢?濡쒕뵫 ?ㅻ쪟\n${message}
    </p>
  `;
}

window.addEventListener('error', (e) => {
  const msg = e?.message || 'Unknown script error';
  showFatalLoadError(msg);
});

window.addEventListener('unhandledrejection', (e) => {
  const reason = e?.reason;
  const msg = typeof reason === 'string' ? reason : (reason?.message || 'Unhandled Promise rejection');
  showFatalLoadError(msg);
});

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

function buildTOC(chapters) {
  const tocList = document.getElementById('toc-list');
  tocList.innerHTML = '';

  chapters.forEach((ch) => {
    const chapterEl = document.createElement('li');
    chapterEl.className = 'toc-chapter collapsed';
    chapterEl.dataset.chapterId = ch.id;

    const label = document.createElement('div');
    label.className = 'toc-chapter-label';
    label.innerHTML = `
      <span class="chapter-num">${ch.id}</span>
      <span class="chapter-title">${ch.title}</span>
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

function updateTOCSections(chapterId, chapterData) {
  document.querySelectorAll('.toc-chapter').forEach((el) => {
    el.classList.add('collapsed');
    el.querySelector('.toc-sections').innerHTML = '';
  });

  const chapterEl = document.querySelector(`.toc-chapter[data-chapter-id="${chapterId}"]`);
  if (!chapterEl) return;

  chapterEl.classList.remove('collapsed');
  const sections = chapterEl.querySelector('.toc-sections');

  chapterData.sections.forEach((sec) => {
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
      ${chapterData.objectives.map((o) => `<div class="objective-item">${o}</div>`).join('')}
    `;
  }
}

function setupScrollSpy() {
  if (scrollObserver) scrollObserver.disconnect();

  const sections = document.querySelectorAll('.content-section');
  if (!sections.length) return;

  const contentArea = document.getElementById('content-area');

  scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.id.replace('section-', '');
        document.querySelectorAll('.toc-section-link').forEach((link) => {
          link.classList.toggle('active', link.dataset.section === id);
        });
      }
    });
  }, { root: contentArea, rootMargin: '-5% 0px -60% 0px' });

  sections.forEach((el) => scrollObserver.observe(el));
}

async function loadChapter(id) {
  if (id === currentChapterId) return;
  currentChapterId = id;

  document.getElementById('content-inner').innerHTML = `
    <div id="loading-screen">
      <div class="spinner"></div>
      <p>肄섑뀗痢좊? 遺덈윭?ㅻ뒗 以?..</p>
    </div>
  `;
  document.getElementById('content-area').scrollTop = 0;

  try {
    const chapterData = await fetchJsonWithTimeout(`./chapters/${id}.json`);

    document.getElementById('chapter-indicator').textContent = chapterData.title;
    updateTOCSections(id, chapterData);

    const mod = await CHAPTER_MODULES[id]();
    await mod.renderChapter(chapterData);

    resetChatbot(chapterData);
    setTimeout(setupScrollSpy, 150);
  } catch (err) {
    console.error(`梨뺥꽣 ${id} 濡쒕뱶 ?ㅽ뙣:`, err);
    document.getElementById('content-inner').innerHTML = `
      <p style="color:var(--accent-red);padding:32px;">梨뺥꽣 ${id} 濡쒕뱶???ㅽ뙣?덉뒿?덈떎.</p>
    `;
  }
}

function setupToggleHandlers() {
  const appBody = document.getElementById('app-body');
  const sidebar = document.getElementById('sidebar');
  const chatbotPanel = document.getElementById('chatbot-panel');

  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('open');
    } else {
      appBody.classList.toggle('sidebar-hidden');
    }
  });

  document.getElementById('chatbot-toggle').addEventListener('click', () => {
    if (window.innerWidth <= 1024) {
      chatbotPanel.classList.toggle('open');
    } else {
      appBody.classList.toggle('chatbot-hidden');
    }
  });

  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
      if (!sidebar.contains(e.target) && !e.target.closest('#sidebar-toggle')) {
        sidebar.classList.remove('open');
      }
    }

    if (window.innerWidth <= 1024 && chatbotPanel.classList.contains('open')) {
      if (!chatbotPanel.contains(e.target) && !e.target.closest('#chatbot-toggle')) {
        chatbotPanel.classList.remove('open');
      }
    }
  });
}

async function init() {
  try {
    const chapters = await fetchJsonWithTimeout('./chapters/index.json');

    buildTOC(chapters);
    setupToggleHandlers();
    initExport();
    await loadChapter(chapters[0].id);
  } catch (err) {
    console.error('??珥덇린???ㅽ뙣:', err);
    document.getElementById('loading-screen').innerHTML = `
      <p style="color:var(--accent-red);text-align:center;">
        肄섑뀗痢?濡쒕뱶 ?ㅽ뙣.<br>
        <small>?좎떆 ???ㅼ떆 ?쒕룄?댁＜?몄슂.</small>
      </p>
    `;
  }
}

document.addEventListener('DOMContentLoaded', init);
