import { initChatbot } from './chatbot.js?v=20260308a';
import { initExport } from './export.js?v=20260308a';

// ─── 챕터 모듈 레지스트리 (동적 임포트) ───
const CHAPTER_MODULES = {
  '01': () => import('./chapters/chapter01.js?v=20260307j'),
  '02': () => import('./chapters/chapter02.js?v=20260307j'),
  '03': () => import('./chapters/chapter03.js?v=20260307j'),
  '04': () => import('./chapters/chapter04.js?v=20260307j'),
  '05': () => import('./chapters/chapter05.js?v=20260307j'),
  '06': () => import('./chapters/chapter06.js?v=20260307j'),
  '07': () => import('./chapters/chapter07.js?v=20260307j'),
  '08': () => import('./chapters/chapter08.js?v=20260307j'),
  '09': () => import('./chapters/chapter09.js?v=20260307j'),
  '10': () => import('./chapters/chapter10.js?v=20260307j'),
  '11': () => import('./chapters/chapter11.js?v=20260307j'),
};

let currentChapterId = null;
let scrollObserver = null;

// ─── 토스트 알림 ───
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

// ─── TOC 전체 빌드 (index.json 기반) ───
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

// ─── 활성 챕터의 섹션 목록 업데이트 ───
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
      <div class="objectives-title">학습목표</div>
      ${chapterData.objectives.map(o => `<div class="objective-item">${o}</div>`).join('')}
    `;
  }
}

// ─── 스크롤 스파이 ───
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

// ─── 챕터 로드 ───
async function loadChapter(id) {
  if (id === currentChapterId) return;
  currentChapterId = id;

  document.getElementById('content-inner').innerHTML =
    '<div id="loading-screen"><div class="spinner"></div><p>콘텐츠를 불러오는 중...</p></div>';
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
    console.error(`챕터 ${id} 로드 실패:`, err);
    document.getElementById('content-inner').innerHTML =
      `<p style="color:var(--accent-red);padding:32px;">챕터 ${id} 로드에 실패했습니다.</p>`;
  }
}

// ─── 사이드바 / 챗봇 토글 ───
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

// ─── 앱 초기화 ───
async function init() {
  try {
    const res = await fetch('./chapters/index.json?v=20260307j');
    if (!res.ok) throw new Error('index.json not found');
    const chapters = await res.json();

    buildTOC(chapters);
    setupToggleHandlers();
    initExport();

    await loadChapter(chapters[0].id);
  } catch (err) {
    console.error('앱 초기화 실패:', err);
    document.getElementById('loading-screen').innerHTML = `
      <p style="color:var(--accent-red);text-align:center;">
        콘텐츠 로드 실패.<br>
        <small>로컬에서 실행 시 <code>python -m http.server</code> 또는 Live Server를 사용하세요.</small>
      </p>`;
  }
}

document.addEventListener('DOMContentLoaded', init);
