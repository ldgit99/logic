import { initChatbot } from './chatbot.js';
import { renderChapter } from './chapters/chapter01.js';
import { initExport } from './export.js';

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

// ─── TOC 구성 ───
function buildTOC(data) {
  const tocList = document.getElementById('toc-list');
  tocList.innerHTML = '';

  const chapterEl = document.createElement('li');
  chapterEl.className = 'toc-chapter';

  const label = document.createElement('div');
  label.className = 'toc-chapter-label';
  label.innerHTML = `
    <span class="chapter-num">${data.id}</span>
    <span class="chapter-title">${data.title}</span>
    <span class="toc-arrow">▾</span>
  `;
  label.addEventListener('click', () => chapterEl.classList.toggle('collapsed'));

  const sections = document.createElement('ul');
  sections.className = 'toc-sections';

  data.sections.forEach(sec => {
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
        document.getElementById('app-body').classList.add('sidebar-hidden');
      }
    });
    li.appendChild(a);
    sections.appendChild(li);
  });

  chapterEl.appendChild(label);
  chapterEl.appendChild(sections);
  tocList.appendChild(chapterEl);

  // 하단 푸터에 학습목표 표시
  const footer = document.getElementById('sidebar-footer');
  if (footer && data.objectives) {
    footer.innerHTML = `
      <div class="objectives-title">학습목표</div>
      ${data.objectives.map(o => `<div class="objective-item">${o}</div>`).join('')}
    `;
  }
}

// ─── 스크롤 스파이 ───
function setupScrollSpy() {
  const sections = document.querySelectorAll('.content-section');
  if (!sections.length) return;
  const contentArea = document.getElementById('content-area');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id.replace('section-', '');
        document.querySelectorAll('.toc-section-link').forEach(link => {
          link.classList.toggle('active', link.dataset.section === id);
        });
      }
    });
  }, { root: contentArea, rootMargin: '-5% 0px -60% 0px' });

  sections.forEach(el => observer.observe(el));
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

  // 모바일: 오버레이 영역 클릭 시 닫기
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
    const res = await fetch('./chapters/01.json');
    if (!res.ok) throw new Error('chapter data fetch failed');
    const chapterData = await res.json();

    buildTOC(chapterData);
    document.getElementById('chapter-indicator').textContent = chapterData.title;

    await renderChapter(chapterData);

    initChatbot(chapterData);
    initExport(chapterData);
    setupToggleHandlers();
    setTimeout(setupScrollSpy, 150);
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
