/**
 * main.js
 * 교수용 대시보드 진입점 — 인증, 뷰 전환, 필터 적용을 조율한다.
 */

import {
  setToken,
  verifyToken,
  fetchSummary,
  fetchStudents,
  fetchConcepts,
  fetchInterventions,
  fetchResearchExport,
  fetchRoster,
  fetchQuestions,
  fetchReflections,
  deleteSubmission,
  deleteReflection,
  restoreReflection,
  saveQuestions,
  clearToken,
  ApiError,
} from './apiClient.js?v=20260326a';

import { renderSummaryCards, renderSummaryTable } from './views/summary.js?v=20260326a';
import { renderInterventions } from './views/interventions.js?v=20260326a';
import { renderAchievement } from './views/achievement.js?v=20260326a';
import { renderConcepts } from './views/concepts.js?v=20260326a';
import { renderFeedbackQuality } from './views/feedbackQuality.js?v=20260326a';
import { renderInteractionAnalysis } from './views/interactionAnalysis.js?v=20260326c';
import { renderStudentReport } from './views/studentReport.js?v=20260326a';
import { renderRoster } from './views/roster.js?v=20260326a';
import { renderQuestions } from './views/questions.js?v=20260326a';
import { renderReflectionAnalysis } from './views/reflectionAnalysis.js?v=20260326a';
import { openStudentModal } from './views/studentModal.js?v=20260326a';
import { exportCSV } from './utils/csv.js?v=20260326a';
import { escapeHtml } from './utils/format.js?v=20260326a';

// ── 상태 ─────────────────────────────────────────────────────────

let currentView = 'summary';
let currentFilters = {};
let allSubmissions = [];
let pollingTimer = null;
let lastKnownCount = null;

// ── 초기화 ────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  applyTheme(localStorage.getItem('dash_theme') || 'auto');

  const savedToken = sessionStorage.getItem('dash_token');
  if (savedToken) {
    showDashboard(savedToken);
  } else {
    showAuthScreen();
  }

  bindAuthForm();
  bindNavTabs();
  bindQuickSearch();
  bindFilters();
  bindDatePresets();
  bindLogout();
  bindModal();
  bindThemeToggle();
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
        errorEl.textContent = '인증에 실패했습니다. 토큰을 확인하세요.';
        errorEl.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Login error:', err);
      errorEl.textContent = `오류: ${err?.message || String(err)}`;
      errorEl.classList.remove('hidden');
    }
  });
}

// ── 대시보드 화면 ─────────────────────────────────────────────────

async function showDashboard(token) {
  setToken(token);
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('dashboard-screen').classList.remove('hidden');
  await loadView(currentView);
  startPolling();
}

// ── 신규 제출 폴링 (30초) ─────────────────────────────────────────

function startPolling() {
  if (pollingTimer) clearInterval(pollingTimer);
  pollingTimer = setInterval(async () => {
    try {
      const data = await fetchSummary({});
      const count = data?.totalSubmissions ?? 0;
      if (lastKnownCount !== null && count > lastKnownCount) {
        const diff = count - lastKnownCount;
        showNewSubmissionBadge(diff);
      }
      lastKnownCount = count;
    } catch {
      // 폴링 실패는 무시
    }
  }, 30000);
}

function showNewSubmissionBadge(count) {
  const summaryTab = document.querySelector('.nav-tab[data-view="summary"]');
  if (!summaryTab) return;
  let badge = summaryTab.querySelector('.new-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'new-badge';
    summaryTab.appendChild(badge);
  }
  const existing = parseInt(badge.dataset.count || '0', 10);
  badge.dataset.count = String(existing + count);
  badge.textContent = `+${badge.dataset.count}`;
}

function clearNewBadge() {
  document.querySelector('.nav-tab[data-view="summary"] .new-badge')?.remove();
}

// ── 네비게이션 탭 ─────────────────────────────────────────────────

function bindNavTabs() {
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentView = tab.dataset.view;
      if (currentView === 'summary') clearNewBadge();
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

function bindQuickSearch() {
  const quickSearchEl = document.getElementById('dash-quick-search');
  const studentFilterEl = document.getElementById('filter-student-id');
  if (!quickSearchEl || !studentFilterEl) return;

  quickSearchEl.value = studentFilterEl.value;

  quickSearchEl.addEventListener('input', () => {
    studentFilterEl.value = quickSearchEl.value;
  });

  studentFilterEl.addEventListener('input', () => {
    if (quickSearchEl.value !== studentFilterEl.value) {
      quickSearchEl.value = studentFilterEl.value;
    }
  });

  quickSearchEl.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    currentFilters = readFilters();
    loadView(currentView);
  });
}

function bindDatePresets() {
  document.querySelectorAll('.btn-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      const today = new Date();
      const fmt = (d) => d.toISOString().slice(0, 10);
      const fromEl = document.getElementById('filter-from');
      const toEl = document.getElementById('filter-to');

      if (btn.dataset.preset === 'today') {
        fromEl.value = fmt(today);
        toEl.value = fmt(today);
      } else if (btn.dataset.preset === 'week') {
        const mon = new Date(today);
        mon.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
        fromEl.value = fmt(mon);
        toEl.value = fmt(today);
      } else {
        fromEl.value = '';
        toEl.value = '';
      }

      document.querySelectorAll('.btn-preset').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function updateResultCount(count) {
  const el = document.getElementById('filter-result-count');
  if (el) el.textContent = count != null ? `${count}건 검색됨` : '';
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
        lastKnownCount = summary?.totalSubmissions ?? allSubmissions.length;
        clearNewBadge();
        renderSummaryCards(summary, document.getElementById('summary-cards'), allSubmissions);
        renderSummaryTable(allSubmissions, document.getElementById('summary-table-body'), {
          onRowClick: (submission) => openStudentModal(submission),
          onDelete: async (submission) => {
            const studentId = String(submission.student_id || submission.studentId || '');
            const studentName = String(submission.student_name || submission.studentName || '');
            const chapterId = String(submission.chapter_id || submission.chapterId || '');
            const sessionId = String(submission.session_id || '');
            const submittedAt = String(submission.submitted_at || submission.submittedAt || '');
            if (!studentId || !chapterId || !sessionId) return;

            const ok = window.confirm(`[${studentId}] ${studentName}의 Ch.${chapterId} 제출 기록을 삭제하시겠습니까?`);
            if (!ok) return;

            try {
              await deleteSubmission({
                student_id: studentId,
                chapter_id: chapterId,
                session_id: sessionId,
                submitted_at: submittedAt,
              });
              await loadView('summary');
            } catch (e) {
              console.error('[summary delete]', e);
            }
          },
        });
        document.getElementById('summary-empty').classList.toggle('hidden', allSubmissions.length > 0);
        updateResultCount(allSubmissions.length);
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

      case 'interaction-analysis': {
        const wrap = document.getElementById('interaction-analysis-wrap');
        try {
          const [data, researchResult] = await Promise.allSettled([
            fetchStudents(currentFilters),
            fetchResearchExport(currentFilters),
          ]);
          const studentPayload = data.status === 'fulfilled'
            ? data.value
            : { submissions: Array.isArray(allSubmissions) ? allSubmissions : [] };
          const warnings = [];
          if (data.status !== 'fulfilled' && studentPayload.submissions.length) {
            warnings.push('Student dataset API failed. Showing cached submissions.');
          }
          if (researchResult.status !== 'fulfilled') {
            warnings.push('Research export data is unavailable. Showing base interaction metrics only.');
          }
          if (data.status !== 'fulfilled' && !studentPayload.submissions.length) {
            renderInteractionAnalysisLoadError(wrap, {
              studentError: data.reason,
              researchError: researchResult.status === 'rejected' ? researchResult.reason : null,
              filters: currentFilters,
            });
            break;
          }
          const research = researchResult.status === 'fulfilled'
            ? researchResult.value
            : {
                warning: warnings.join(' '),
              };
          if (researchResult.status === 'fulfilled' && warnings.length) {
            research.warning = [research.warning, ...warnings].filter(Boolean).join(' ');
          }
          try {
            renderInteractionAnalysis(
              studentPayload.submissions || [],
              wrap,
              research,
            );
          } catch (renderErr) {
            console.error('[interaction-analysis:render]', renderErr);
            renderInteractionAnalysisFallback(studentPayload.submissions || [], wrap, renderErr, research);
          }
        } catch (err) {
          console.error('[interaction-analysis]', err);
          if (wrap) {
            wrap.innerHTML = `<div class="ia-card"><p class="empty-msg">상호작용 분석을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.</p><p class="ia-footnote">${escapeHtml(err?.message || String(err))}</p></div>`;
          }
        }
        break;
      }

      case 'student-report': {
        const data = await fetchStudents(currentFilters);
        renderStudentReport(data.submissions || [], document.getElementById('student-report-wrap'));
        break;
      }

      case 'roster': {
        const data = await fetchRoster();
        renderRoster(data, document.getElementById('roster-wrap'));
        break;
      }
      case 'questions': {
        renderQuestions(document.getElementById('view-questions'), { fetchQuestions, saveQuestions });
        break;
      }
      case 'reflection-analysis': {
        const chapterId = currentFilters.chapter || '';
        const [reflData, studData, qData] = await Promise.all([
          fetchReflections({
            chapter_id: chapterId,
            student_id: currentFilters.studentId || '',
            from: currentFilters.from || '',
            to: currentFilters.to || '',
            include_deleted: '1',
          }),
          fetchStudents(currentFilters),
          chapterId ? fetchQuestions(chapterId) : Promise.resolve({ questions: null }),
        ]);
        renderReflectionAnalysis(
          document.getElementById('reflection-analysis-wrap'),
          {
            reflData,
            studData,
            qData,
            chapterId,
            actions: { deleteReflection, restoreReflection },
            reload: () => loadView('reflection-analysis'),
          },
        );
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

// ── 테마 ──────────────────────────────────────────────────────────

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else if (theme === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
  } else {
    root.classList.remove('dark', 'light'); // auto: 시스템 설정 따름
  }
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : theme === 'light' ? '🌙' : '🌗';
}

function bindThemeToggle() {
  document.getElementById('btn-theme')?.addEventListener('click', () => {
    const current = localStorage.getItem('dash_theme') || 'auto';
    const next = current === 'auto' ? 'dark' : current === 'dark' ? 'light' : 'auto';
    localStorage.setItem('dash_theme', next);
    applyTheme(next);
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

function renderInteractionAnalysisFallback(submissions, wrap, err, research = {}) {
  if (!wrap) return;
  const rows = Array.isArray(submissions) ? submissions : [];
  const avgScore = rows.length
    ? (rows.reduce((sum, row) => sum + Number(row?.score || 0), 0) / rows.length).toFixed(1)
    : '0.0';
  const chapterCounts = rows.reduce((acc, row) => {
    const chapterId = String(row?.chapter_id || row?.chapterId || '').trim() || '-';
    acc[chapterId] = (acc[chapterId] || 0) + 1;
    return acc;
  }, {});
  const chapterSummary = Object.entries(chapterCounts)
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .map(([chapterId, count]) => `<tr><td>${escapeHtml(chapterId)}</td><td>${count}</td></tr>`)
    .join('');
  const warning = research?.warning ? `<p class="ia-footnote">${escapeHtml(research.warning)}</p>` : '';

  wrap.innerHTML = `
    <div class="ia-card">
      <h3 class="chart-title">Interaction Analysis Fallback</h3>
      <p class="empty-msg">상세 시각화 렌더링에 실패해 기본 요약만 표시합니다.</p>
      <p class="ia-footnote">${escapeHtml(err?.message || String(err))}</p>
      ${warning}
      <div class="ia-stat-grid">
        <div class="ia-mini-stat"><span class="ia-mini-stat__label">Submissions</span><strong class="ia-mini-stat__value">${rows.length}</strong></div>
        <div class="ia-mini-stat"><span class="ia-mini-stat__label">Average score</span><strong class="ia-mini-stat__value">${avgScore}</strong></div>
      </div>
      <table class="dash-table" style="margin-top:16px;">
        <thead><tr><th>Chapter</th><th>Count</th></tr></thead>
        <tbody>${chapterSummary || '<tr><td colspan="2">No data</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

function renderInteractionAnalysisLoadError(wrap, details = {}) {
  if (!wrap) return;
  const filters = details.filters || {};
  const studentMessage = details.studentError?.message || String(details.studentError || 'Unknown student dataset error');
  const researchMessage = details.researchError?.message || String(details.researchError || 'Not requested or no error');
  const activeFilters = Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `<tr><td>${escapeHtml(key)}</td><td>${escapeHtml(String(value))}</td></tr>`)
    .join('');

  wrap.innerHTML = `
    <div class="ia-card">
      <h3 class="chart-title">Interaction Analysis Diagnostics</h3>
      <p class="empty-msg">학생 상호작용 데이터를 불러오지 못했습니다.</p>
      <table class="dash-table" style="margin-top:16px;">
        <thead><tr><th>Check</th><th>Result</th></tr></thead>
        <tbody>
          <tr><td>Student dataset API</td><td>${escapeHtml(studentMessage)}</td></tr>
          <tr><td>Research export API</td><td>${escapeHtml(researchMessage)}</td></tr>
          <tr><td>Cached submissions</td><td>0</td></tr>
        </tbody>
      </table>
      <table class="dash-table" style="margin-top:16px;">
        <thead><tr><th>Active filter</th><th>Value</th></tr></thead>
        <tbody>${activeFilters || '<tr><td colspan="2">No active filters</td></tr>'}</tbody>
      </table>
    </div>
  `;
}
