/**
 * main.js
 * 교수용 대시보드 진입점 — 인증, 뷰 전환, 필터 적용을 조율한다.
 */

import {
  verifyToken,
  fetchSummary,
  fetchStudents,
  fetchConcepts,
  fetchInterventions,
  clearToken,
  ApiError,
} from './apiClient.js';

import { renderSummaryCards, renderSummaryTable } from './views/summary.js';
import { renderInterventions } from './views/interventions.js';
import { renderAchievement } from './views/achievement.js';
import { renderConcepts } from './views/concepts.js';
import { renderFeedbackQuality } from './views/feedbackQuality.js';
import { openStudentModal } from './views/studentModal.js';
import { exportCSV } from './utils/csv.js';

// ── 상태 ─────────────────────────────────────────────────────────

let currentView = 'summary';
let currentFilters = {};
let allSubmissions = [];

// ── 초기화 ────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const savedToken = sessionStorage.getItem('dash_token');
  if (savedToken) {
    showDashboard(savedToken);
  } else {
    showAuthScreen();
  }

  bindAuthForm();
  bindNavTabs();
  bindFilters();
  bindLogout();
  bindModal();
});

// ── 인증 화면 ─────────────────────────────────────────────────────

function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('dashboard-screen').classList.add('hidden');
}

function bindAuthForm() {
  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = document.getElementById('auth-token').value.trim();
    const errorEl = document.getElementById('auth-error');
    errorEl.classList.add('hidden');

    try {
      const ok = await verifyToken(token);
      if (ok) {
        sessionStorage.setItem('dash_token', token);
        showDashboard(token);
      } else {
        errorEl.classList.remove('hidden');
      }
    } catch {
      errorEl.classList.remove('hidden');
    }
  });
}

// ── 대시보드 화면 ─────────────────────────────────────────────────

async function showDashboard(token) {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('dashboard-screen').classList.remove('hidden');
  await loadView(currentView);
}

// ── 네비게이션 탭 ─────────────────────────────────────────────────

function bindNavTabs() {
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentView = tab.dataset.view;
      loadView(currentView);
    });
  });
}

// ── 필터 ─────────────────────────────────────────────────────────

function bindFilters() {
  document.getElementById('btn-filter-apply').addEventListener('click', () => {
    currentFilters = readFilters();
    loadView(currentView);
  });

  document.getElementById('btn-export-csv').addEventListener('click', () => {
    if (allSubmissions.length === 0) return;
    exportCSV(allSubmissions);
  });
}

function readFilters() {
  return {
    chapter: document.getElementById('filter-chapter').value,
    from: document.getElementById('filter-from').value,
    to: document.getElementById('filter-to').value,
    studentId: document.getElementById('filter-student-id').value.trim(),
  };
}

// ── 뷰 로딩 ──────────────────────────────────────────────────────

async function loadView(view) {
  // 모든 뷰 숨김
  document.querySelectorAll('.dash-view').forEach((el) => el.classList.add('hidden'));
  const viewEl = document.getElementById(`view-${view}`);
  if (viewEl) viewEl.classList.remove('hidden');

  try {
    switch (view) {
      case 'summary': {
        const [summary, students] = await Promise.all([
          fetchSummary(currentFilters),
          fetchStudents(currentFilters),
        ]);
        allSubmissions = students.submissions || [];
        renderSummaryCards(summary, document.getElementById('summary-cards'));
        renderSummaryTable(allSubmissions, document.getElementById('summary-table-body'), {
          onRowClick: (submission) => openStudentModal(submission),
        });
        document.getElementById('summary-empty').classList.toggle('hidden', allSubmissions.length > 0);
        break;
      }

      case 'interventions': {
        const data = await fetchInterventions(currentFilters);
        renderInterventions(data.interventions || [], document.getElementById('interventions-list'), {
          onStudentClick: (submission) => openStudentModal(submission),
        });
        break;
      }

      case 'achievement': {
        const data = await fetchStudents(currentFilters);
        renderAchievement(data.submissions || [], document.getElementById('achievement-chart-wrap'));
        break;
      }

      case 'concepts': {
        const data = await fetchConcepts(currentFilters);
        renderConcepts(data.concepts || [], document.getElementById('concepts-list'), {
          onConceptClick: (concept) => loadConceptStudents(concept),
        });
        break;
      }

      case 'feedback-quality': {
        const data = await fetchStudents(currentFilters);
        renderFeedbackQuality(data.submissions || [], document.getElementById('feedback-quality-wrap'));
        break;
      }
    }
  } catch (err) {
    handleApiError(err);
  }
}

async function loadConceptStudents(concept) {
  try {
    const data = await fetchStudents({ ...currentFilters, concept });
    renderSummaryTable(data.submissions || [], document.getElementById('concepts-list'), {
      onRowClick: (s) => openStudentModal(s),
    });
  } catch (err) {
    handleApiError(err);
  }
}

// ── 로그아웃 ──────────────────────────────────────────────────────

function bindLogout() {
  document.getElementById('btn-logout').addEventListener('click', () => {
    sessionStorage.removeItem('dash_token');
    clearToken();
    showAuthScreen();
  });
}

// ── 모달 닫기 ─────────────────────────────────────────────────────

function bindModal() {
  document.getElementById('modal-close').addEventListener('click', () => {
    document.getElementById('student-modal').classList.add('hidden');
  });
  document.getElementById('student-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.classList.add('hidden');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.getElementById('student-modal').classList.add('hidden');
    }
  });
}

// ── 오류 처리 ─────────────────────────────────────────────────────

function handleApiError(err) {
  if (err instanceof ApiError && err.status === 401) {
    sessionStorage.removeItem('dash_token');
    clearToken();
    showAuthScreen();
  } else {
    console.error('[Dashboard]', err);
  }
}
