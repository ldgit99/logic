import { escapeHtml, formatDate, scoreColor } from '../utils/format.js';

let selectedReflectionStudentId = null;
let reflectionSearch = '';

export function renderReflectionAnalysis(container, ctx) {
  if (!container) return;

  const reflections = Array.isArray(ctx?.reflData?.reflections) ? ctx.reflData.reflections : [];
  const submissions = Array.isArray(ctx?.studData?.submissions) ? ctx.studData.submissions : [];
  const actions = ctx?.actions || {};
  const reload = typeof ctx?.reload === 'function' ? ctx.reload : () => {};

  const studentRows = buildReflectionStudents(reflections, submissions);
  const filteredRows = filterStudents(studentRows, reflectionSearch);

  container.innerHTML = `
    <div class="rv-layout">
      <aside class="sr-sidebar">
        <div class="sr-search-wrap">
          <input
            type="text"
            id="rv-search"
            class="sr-search"
            placeholder="학번 또는 이름 검색"
            value="${escapeAttr(reflectionSearch)}"
          />
        </div>
        <ul class="sr-student-list" id="rv-student-list"></ul>
      </aside>
      <section class="sr-detail rv-detail" id="rv-detail">
        <div class="sr-detail-empty">
          <p>왼쪽에서 학생을 선택하면 성찰일지 제출 여부와 내용을 확인할 수 있습니다.</p>
        </div>
      </section>
    </div>
  `;

  const listEl = container.querySelector('#rv-student-list');
  const detailEl = container.querySelector('#rv-detail');
  renderReflectionStudentList(filteredRows, listEl, detailEl, actions, reload);

  container.querySelector('#rv-search')?.addEventListener('input', (event) => {
    reflectionSearch = String(event.target.value || '').trim();
    renderReflectionAnalysis(container, ctx);
  });
}

function buildReflectionStudents(reflections, submissions) {
  const reflectionMap = new Map();
  reflections.forEach((row) => {
    const studentId = String(row?.student_id || '').trim();
    if (!studentId) return;
    if (!reflectionMap.has(studentId)) {
      reflectionMap.set(studentId, {
        studentId,
        studentName: String(row?.student_name || '').trim() || studentId,
        reflections: [],
      });
    }
    reflectionMap.get(studentId).reflections.push(row);
  });

  const submissionMap = new Map();
  submissions.forEach((submission) => {
    const studentId = String(submission?.student_id || submission?.studentId || '').trim();
    if (!studentId) return;
    if (!submissionMap.has(studentId)) {
      submissionMap.set(studentId, {
        studentId,
        studentName: String(submission?.student_name || submission?.studentName || '').trim() || studentId,
        submissions: [],
      });
    }
    submissionMap.get(studentId).submissions.push(submission);
  });

  const studentIds = new Set([...reflectionMap.keys(), ...submissionMap.keys()]);
  return [...studentIds]
    .map((studentId) => {
      const reflectionInfo = reflectionMap.get(studentId) || { reflections: [], studentName: studentId };
      const submissionInfo = submissionMap.get(studentId) || { submissions: [], studentName: reflectionInfo.studentName };
      const rows = reflectionInfo.reflections.slice().sort(sortByChapterThenDate);
      const activeRows = rows.filter((row) => !row?.is_deleted);
      const chapterSet = new Set(
        activeRows.map((row) => normalizeChapter(row?.chapter_id)).filter(Boolean),
      );
      const assessedChapters = submissionInfo.submissions
        .map((row) => normalizeChapter(row?.chapter_id || row?.chapterId || row?.chapter))
        .filter(Boolean);

      return {
        studentId,
        studentName: reflectionInfo.studentName || submissionInfo.studentName || studentId,
        reflections: rows,
        activeCount: activeRows.length,
        deletedCount: rows.length - activeRows.length,
        chapters: [...chapterSet].sort(compareChapter),
        missingReflectionChapters: assessedChapters.filter((chapter) => !chapterSet.has(chapter)),
      };
    })
    .sort((a, b) => a.studentId.localeCompare(b.studentId));
}

function filterStudents(students, query) {
  const key = String(query || '').trim().toLowerCase();
  if (!key) return students;
  return students.filter((student) => (
    student.studentId.toLowerCase().includes(key)
    || student.studentName.toLowerCase().includes(key)
  ));
}

function renderReflectionStudentList(students, listEl, detailEl, actions, reload) {
  if (!listEl) return;

  if (!students.length) {
    listEl.innerHTML = '<li class="sr-student-item">검색 결과가 없습니다.</li>';
    if (detailEl) {
      detailEl.innerHTML = '<div class="sr-detail-empty"><p>조건에 맞는 학생이 없습니다.</p></div>';
    }
    return;
  }

  if (!students.some((student) => student.studentId === selectedReflectionStudentId)) {
    selectedReflectionStudentId = students[0].studentId;
  }

  listEl.innerHTML = students.map((student) => {
    const isSelected = student.studentId === selectedReflectionStudentId;
    const statusClass = student.missingReflectionChapters.length ? 'bad' : 'good';
    const statusText = student.missingReflectionChapters.length
      ? `미제출 ${student.missingReflectionChapters.length}`
      : `완료 ${student.activeCount}`;

    return `
      <li class="sr-student-item ${isSelected ? 'selected' : ''}" data-student-id="${escapeAttr(student.studentId)}">
        <div class="sr-student-name">${escapeHtml(student.studentName)}</div>
        <div class="sr-student-meta">
          <span class="sr-student-id">${escapeHtml(student.studentId)}</span>
          <span class="rv-student-status ${statusClass}">${escapeHtml(statusText)}</span>
        </div>
        <div class="sr-student-chapters">
          ${student.chapters.length
            ? student.chapters.map((chapter) => `<span class="ch-tag">Ch.${escapeHtml(chapter)}</span>`).join('')
            : '<span class="ch-tag">제출 없음</span>'}
        </div>
      </li>
    `;
  }).join('');

  listEl.querySelectorAll('.sr-student-item[data-student-id]').forEach((item) => {
    item.addEventListener('click', () => {
      selectedReflectionStudentId = String(item.dataset.studentId || '');
      renderReflectionStudentList(students, listEl, detailEl, actions, reload);
    });
  });

  const selected = students.find((student) => student.studentId === selectedReflectionStudentId) || students[0];
  renderReflectionDetail(selected, detailEl, actions, reload);
}

function renderReflectionDetail(student, detailEl, actions, reload) {
  if (!detailEl || !student) return;

  const activeRows = student.reflections.filter((row) => !row?.is_deleted);
  const latestSavedAt = activeRows
    .map((row) => String(row?.saved_at || ''))
    .filter(Boolean)
    .sort()
    .at(-1);

  detailEl.innerHTML = `
    <div class="sr-detail-header">
      <div>
        <h2 class="sr-detail-name">${escapeHtml(student.studentName)}</h2>
        <span class="sr-detail-id">${escapeHtml(student.studentId)}</span>
      </div>
      <div class="sr-detail-summary">
        <span>성찰일지 ${student.activeCount}건</span>
        <span class="${student.missingReflectionChapters.length ? 'bad' : 'good'}">
          ${student.missingReflectionChapters.length ? `미제출 ${student.missingReflectionChapters.length}건` : '평가 제출 챕터 모두 작성'}
        </span>
        <span>${latestSavedAt ? `최근 작성 ${formatDate(latestSavedAt)}` : '작성 기록 없음'}</span>
      </div>
    </div>

    ${student.missingReflectionChapters.length ? `
      <section class="rv-section">
        <h3 class="chart-title">형성평가 후 미작성 챕터</h3>
        <div class="rv-chip-row">
          ${student.missingReflectionChapters.map((chapter) => `<span class="weak-tag">Ch.${escapeHtml(chapter)}</span>`).join('')}
        </div>
      </section>
    ` : ''}

    <section class="rv-section">
      <h3 class="chart-title">성찰일지 기록</h3>
      ${student.reflections.length
        ? student.reflections.map((row) => renderReflectionCard(row)).join('')
        : '<p class="empty-msg">성찰일지 기록이 없습니다.</p>'}
    </section>
  `;

  detailEl.querySelectorAll('[data-rv-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!actions?.deleteReflection) return;
      button.disabled = true;
      try {
        await actions.deleteReflection({
          student_id: String(button.dataset.studentId || ''),
          chapter_id: String(button.dataset.chapterId || ''),
          reason: window.prompt('삭제 사유를 입력하세요. (선택)') || '',
        });
        reload();
      } finally {
        button.disabled = false;
      }
    });
  });

  detailEl.querySelectorAll('[data-rv-restore]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!actions?.restoreReflection) return;
      button.disabled = true;
      try {
        await actions.restoreReflection({
          student_id: String(button.dataset.studentId || ''),
          chapter_id: String(button.dataset.chapterId || ''),
        });
        reload();
      } finally {
        button.disabled = false;
      }
    });
  });
}

function renderReflectionCard(row) {
  const chapterId = normalizeChapter(row?.chapter_id);
  const savedAt = formatDate(row?.saved_at);
  const answers = Array.isArray(row?.answers) ? row.answers : [];
  const isDeleted = Boolean(row?.is_deleted);
  const actionButton = isDeleted
    ? `<button class="btn-secondary" type="button" data-rv-restore data-student-id="${escapeAttr(row?.student_id)}" data-chapter-id="${escapeAttr(chapterId)}">복원</button>`
    : `<button class="btn-secondary" type="button" data-rv-delete data-student-id="${escapeAttr(row?.student_id)}" data-chapter-id="${escapeAttr(chapterId)}">삭제</button>`;

  return `
    <article class="rv-card ${isDeleted ? 'rv-card--deleted' : ''}">
      <div class="sr-sub-header">
        <span class="sr-sub-chapter">Ch.${escapeHtml(chapterId || '-')}</span>
        <span class="rv-card-status ${isDeleted ? 'warn' : 'good'}">${isDeleted ? '삭제됨' : '제출됨'}</span>
        <span class="sr-sub-date">${savedAt || '-'}</span>
        ${actionButton}
      </div>
      ${answers.map((answer, index) => `
        <div class="sr-sub-feedback">
          <div class="sr-fb-label">문항 ${index + 1}</div>
          <div class="sr-fb-text">${formatMultiline(answer)}</div>
        </div>
      `).join('')}
      ${row?.delete_reason ? `
        <div class="sr-sub-feedback">
          <div class="sr-fb-label">삭제 사유</div>
          <div class="sr-fb-text">${escapeHtml(String(row.delete_reason))}</div>
        </div>
      ` : ''}
    </article>
  `;
}

function sortByChapterThenDate(a, b) {
  const chapterDiff = compareChapter(normalizeChapter(a?.chapter_id), normalizeChapter(b?.chapter_id));
  if (chapterDiff !== 0) return chapterDiff;
  return String(b?.saved_at || '').localeCompare(String(a?.saved_at || ''));
}

function compareChapter(a, b) {
  return String(a || '').localeCompare(String(b || ''), undefined, { numeric: true });
}

function normalizeChapter(value) {
  return String(value || '').trim();
}

function formatMultiline(value) {
  return escapeHtml(String(value || '')).replace(/\n/g, '<br>');
}

function escapeAttr(value) {
  return escapeHtml(String(value || '')).replace(/"/g, '&quot;');
}
