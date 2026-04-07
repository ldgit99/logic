import { escapeHtml, formatDate, scoreColor } from '../utils/format.js';
import { openStudentModal } from './studentModal.js';

let selectedConversationStudentId = null;
let conversationSearch = '';

export function renderInteractionAnalysis(submissions, container) {
  if (!container) return;

  const rows = Array.isArray(submissions) ? submissions : [];
  if (!rows.length) {
    container.innerHTML = '<p class="empty-msg">대화 로그가 없습니다.</p>';
    return;
  }

  const students = buildConversationStudents(rows);
  const filtered = filterStudents(students, conversationSearch);

  container.innerHTML = `
    <div class="cv-layout">
      <aside class="sr-sidebar">
        <div class="sr-search-wrap">
          <input
            type="text"
            id="cv-search"
            class="sr-search"
            placeholder="학번 또는 이름 검색"
            value="${escapeAttr(conversationSearch)}"
          />
        </div>
        <ul class="sr-student-list" id="cv-student-list"></ul>
      </aside>
      <section class="sr-detail cv-detail" id="cv-detail">
        <div class="sr-detail-empty">
          <p>왼쪽에서 학생을 선택하면 챕터별 대화 기록과 핵심 요약을 확인할 수 있습니다.</p>
        </div>
      </section>
    </div>
  `;

  const listEl = container.querySelector('#cv-student-list');
  const detailEl = container.querySelector('#cv-detail');
  renderConversationStudentList(filtered, listEl, detailEl);

  container.querySelector('#cv-search')?.addEventListener('input', (event) => {
    conversationSearch = String(event.target.value || '').trim();
    renderInteractionAnalysis(rows, container);
  });
}

function buildConversationStudents(submissions) {
  const map = new Map();
  submissions.forEach((submission) => {
    const studentId = String(submission?.student_id || submission?.studentId || '').trim();
    if (!studentId) return;
    if (!map.has(studentId)) {
      map.set(studentId, {
        studentId,
        studentName: String(submission?.student_name || submission?.studentName || '').trim() || studentId,
        submissions: [],
      });
    }
    map.get(studentId).submissions.push(submission);
  });

  return [...map.values()]
    .map((student) => {
      student.submissions = student.submissions
        .slice()
        .sort((a, b) => compareChapter(
          normalizeChapter(a?.chapter_id || a?.chapterId || a?.chapter),
          normalizeChapter(b?.chapter_id || b?.chapterId || b?.chapter),
        ));
      student.totalTurns = student.submissions.reduce((sum, submission) => sum + countTurns(submission), 0);
      student.activeChapters = student.submissions
        .filter((submission) => countTurns(submission) > 0)
        .map((submission) => normalizeChapter(submission?.chapter_id || submission?.chapterId || submission?.chapter))
        .filter(Boolean);
      const scores = student.submissions
        .map((submission) => Number(submission?.score))
        .filter((value) => Number.isFinite(value));
      student.avgScore = scores.length ? Math.round(scores.reduce((acc, value) => acc + value, 0) / scores.length) : null;
      return student;
    })
    .sort((a, b) => a.studentId.localeCompare(b.studentId));
}

function renderConversationStudentList(students, listEl, detailEl) {
  if (!listEl) return;

  if (!students.length) {
    listEl.innerHTML = '<li class="sr-student-item">검색 결과가 없습니다.</li>';
    if (detailEl) {
      detailEl.innerHTML = '<div class="sr-detail-empty"><p>조건에 맞는 학생이 없습니다.</p></div>';
    }
    return;
  }

  if (!students.some((student) => student.studentId === selectedConversationStudentId)) {
    selectedConversationStudentId = students[0].studentId;
  }

  listEl.innerHTML = students.map((student) => {
    const isSelected = student.studentId === selectedConversationStudentId;
    const scoreClass = student.avgScore != null ? scoreColor(student.avgScore) : '';
    return `
      <li class="sr-student-item ${isSelected ? 'selected' : ''}" data-student-id="${escapeAttr(student.studentId)}">
        <div class="sr-student-name">${escapeHtml(student.studentName)}</div>
        <div class="sr-student-meta">
          <span class="sr-student-id">${escapeHtml(student.studentId)}</span>
          <span class="${scoreClass} sr-student-score">${student.totalTurns}턴</span>
        </div>
        <div class="sr-student-chapters">
          ${[...new Set(student.activeChapters)].length
            ? [...new Set(student.activeChapters)].map((chapter) => `<span class="ch-tag">Ch.${escapeHtml(chapter)}</span>`).join('')
            : '<span class="ch-tag">대화 없음</span>'}
        </div>
      </li>
    `;
  }).join('');

  listEl.querySelectorAll('.sr-student-item[data-student-id]').forEach((item) => {
    item.addEventListener('click', () => {
      selectedConversationStudentId = String(item.dataset.studentId || '');
      renderConversationStudentList(students, listEl, detailEl);
    });
  });

  const selected = students.find((student) => student.studentId === selectedConversationStudentId) || students[0];
  renderConversationDetail(selected, detailEl);
}

function renderConversationDetail(student, detailEl) {
  if (!detailEl || !student) return;

  detailEl.innerHTML = `
    <div class="sr-detail-header">
      <div>
        <h2 class="sr-detail-name">${escapeHtml(student.studentName)}</h2>
        <span class="sr-detail-id">${escapeHtml(student.studentId)}</span>
      </div>
      <div class="sr-detail-summary">
        <span>대화 ${student.totalTurns}턴</span>
        <span class="${student.avgScore != null ? scoreColor(student.avgScore) : ''}">
          평균 ${student.avgScore != null ? `${student.avgScore}점` : '-'}
        </span>
        <span>챕터 ${[...new Set(student.activeChapters)].length}개</span>
      </div>
    </div>

    <section class="rv-section">
      <h3 class="chart-title">챕터별 대화 기록</h3>
      ${student.submissions.length
        ? student.submissions.map((submission, index) => renderConversationCard(submission, index)).join('')
        : '<p class="empty-msg">대화 기록이 없습니다.</p>'}
    </section>
  `;

  detailEl.querySelectorAll('.btn-detail-modal').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.idx || 0);
      openStudentModal(student.submissions[index]);
    });
  });
}

function renderConversationCard(submission, index) {
  const chapter = normalizeChapter(submission?.chapter_id || submission?.chapterId || submission?.chapter);
  const score = Number(submission?.score);
  const scoreClass = Number.isFinite(score) ? scoreColor(score) : '';
  const messages = getVisibleMessages(submission);
  const summary = submission?.chat_summary || submission?.chatSummary || {};
  const misconceptions = Array.isArray(summary?.misconceptions) ? summary.misconceptions : [];
  const highlights = [
    summary?.summary,
    summary?.learning_summary,
    summary?.teacher_note,
  ].filter(Boolean);

  return `
    <article class="rv-card">
      <div class="sr-sub-header">
        <span class="sr-sub-chapter">Ch.${escapeHtml(chapter || '-')}</span>
        <span class="rv-card-status ${messages.length ? 'good' : 'warn'}">${messages.length ? `${messages.length}턴` : '대화 없음'}</span>
        <span class="${scoreClass}">${Number.isFinite(score) ? `${score}점` : '-'}</span>
        <span class="sr-sub-date">${formatDate(submission?.submitted_at || submission?.submittedAt || submission?.timestamp)}</span>
        <button class="btn-detail btn-detail-modal" data-idx="${index}">상세 보기</button>
      </div>

      ${highlights.length ? `
        <div class="sr-sub-feedback">
          <div class="sr-fb-label">대화 요약</div>
          <div class="sr-fb-text">${highlights.map((item) => formatMultiline(item)).join('<br><br>')}</div>
        </div>
      ` : ''}

      ${misconceptions.length ? `
        <div class="sr-sub-feedback">
          <div class="sr-fb-label">오개념</div>
          <div class="sr-fb-text">${misconceptions.map((item) => escapeHtml(String(item))).join(', ')}</div>
        </div>
      ` : ''}

      ${messages.length ? `
        <div class="sr-sub-feedback">
          <div class="sr-fb-label">최근 대화</div>
          <div class="cv-message-list">
            ${messages.slice(-6).map((message) => `
              <div class="cv-message cv-message--${escapeAttr(String(message.role || 'assistant').toLowerCase())}">
                <span class="cv-message-role">${escapeHtml(readRoleLabel(message.role))}</span>
                <div class="cv-message-text">${formatMultiline(message.content)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </article>
  `;
}

function getVisibleMessages(submission) {
  return (Array.isArray(submission?.messages) ? submission.messages : [])
    .filter((message) => String(message?.role || '').toLowerCase() !== 'system')
    .map((message) => ({
      role: String(message?.role || 'assistant'),
      content: String(message?.content || '').trim(),
    }))
    .filter((message) => message.content);
}

function countTurns(submission) {
  const messages = getVisibleMessages(submission);
  if (messages.length) return messages.length;
  const metrics = submission?.chat_metrics || {};
  return Number(metrics.user_message_count || metrics.turn_count || 0);
}

function filterStudents(students, query) {
  const key = String(query || '').trim().toLowerCase();
  if (!key) return students;
  return students.filter((student) => (
    student.studentId.toLowerCase().includes(key)
    || student.studentName.toLowerCase().includes(key)
  ));
}

function compareChapter(a, b) {
  return String(a || '').localeCompare(String(b || ''), undefined, { numeric: true });
}

function normalizeChapter(value) {
  return String(value || '').trim();
}

function readRoleLabel(role) {
  const key = String(role || '').toLowerCase();
  if (key === 'user') return '학생';
  if (key === 'assistant') return 'AI';
  return role || '메시지';
}

function formatMultiline(value) {
  return escapeHtml(String(value || '')).replace(/\n/g, '<br>');
}

function escapeAttr(value) {
  return escapeHtml(String(value || '')).replace(/"/g, '&quot;');
}
