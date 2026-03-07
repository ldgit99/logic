import { initChatbot } from './chatbot.js?v=20260307c';
import { initExport } from './export.js?v=20260307c';

// ??? 梨뺥꽣 紐⑤뱢 ?덉??ㅽ듃由?(?숈쟻 ?꾪룷?? ???
const CHAPTER_MODULES = {
  '01': () => import('./chapters/chapter01.js?v=20260307c'),
  '02': () => import('./chapters/chapter02.js?v=20260307c'),
  '03': () => import('./chapters/chapter03.js'),
  '04': () => import('./chapters/chapter04.js'),
  '05': () => import('./chapters/chapter05.js'),
  '06': () => import('./chapters/chapter06.js'),
  '07': () => import('./chapters/chapter07.js'),
  '08': () => import('./chapters/chapter08.js'),
  '09': () => import('./chapters/chapter09.js'),
  '10': () => import('./chapters/chapter10.js'),
  '11': () => import('./chapters/chapter11.js'),
};

let currentChapterId = null;
let scrollObserver = null;

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
    label.innerHTML = `
      <span class="chapter-num">${ch.id}</span>
      <span class="chapter-title">${ch.title}</span>
      <span class="toc-arrow">▾</span>
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
    const res = await fetch(`./chapters/${id}.json`);
    if (!res.ok) throw new Error(`chapters/${id}.json not found`);
    const chapterData = await res.json();

    document.getElementById('chapter-indicator').textContent = chapterData.title;
    updateTOCSections(id, chapterData);

    const mod = await CHAPTER_MODULES[id]();
    await mod.renderChapter(chapterData);

    initChatbot(chapterData);
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

  document.addEventListener('click', e => {
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

// ??? ??珥덇린?????
async function init() {
  try {
    const res = await fetch('./chapters/index.json?v=20260307d');
    if (!res.ok) throw new Error('index.json not found');
    const chapters = await res.json();

    buildTOC(chapters);
    setupToggleHandlers();
    initExport();

    await loadChapter(chapters[0].id);
  } catch (err) {
    console.error('??珥덇린???ㅽ뙣:', err);
    document.getElementById('loading-screen').innerHTML = `
      <p style="color:var(--accent-red);text-align:center;">
        肄섑뀗痢?濡쒕뱶 ?ㅽ뙣.<br>
        <small>濡쒖뺄?먯꽌 ?ㅽ뻾 ??<code>python -m http.server</code> ?먮뒗 Live Server瑜??ъ슜?섏꽭??</small>
      </p>`;
  }
}

document.addEventListener('DOMContentLoaded', init);

