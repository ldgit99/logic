/**
 * views/reflectionAnalysis.js
 * Reflection journal management + research-focused analysis view.
 */

let showDeleted = false;
let localSearch = '';

export function renderReflectionAnalysis(container, ctx) {
  if (!container) return;

  const reflections = Array.isArray(ctx?.reflData?.reflections) ? ctx.reflData.reflections : [];
  const submissions = Array.isArray(ctx?.studData?.submissions) ? ctx.studData.submissions : [];
  const chapterId = String(ctx?.chapterId || '');
  const actions = ctx?.actions || {};
  const reload = typeof ctx?.reload === 'function' ? ctx.reload : () => {};

  const concepts = collectConcepts(ctx?.qData);
  const submissionMap = buildSubmissionMap(submissions);

  const withSearch = applySearch(reflections, localSearch);
  const visibleRows = withSearch.filter((r) => showDeleted || !r.is_deleted);

  const metrics = computeMetrics(visibleRows, submissions);
  const chapterStats = computeChapterStats(visibleRows);
  const conceptStats = computeConceptStats(visibleRows, submissionMap, concepts);
  const missingRows = computeMissingRows(visibleRows, submissions);

  container.innerHTML = `
    <div class="ra-root">
      <div class="ra-topbar">
        <div>
          <h2 class="ra-title">성찰일지 분석 ${chapterId ? `(Ch.${escapeHtml(chapterId)})` : '(전체)'}</h2>
          <p class="ra-subtitle">실명 기준, 학생-챕터 단위 연구 분석</p>
        </div>
        <div class="ra-actions">
          <label class="ra-checkbox"><input type="checkbox" id="ra-show-deleted" ${showDeleted ? 'checked' : ''}/> 삭제됨 보기</label>
          <input id="ra-local-search" class="ra-search" type="text" placeholder="이름/학번 검색" value="${escapeAttr(localSearch)}" />
          <button id="ra-export-csv" class="btn-secondary" type="button">CSV 내보내기</button>
          <button id="ra-copy-report" class="btn-secondary" type="button">요약 복사</button>
        </div>
      </div>

      <div class="ra-cards">
        <div class="ra-card"><div class="ra-card-k">표시 레코드</div><div class="ra-card-v">${metrics.visibleCount}</div></div>
        <div class="ra-card"><div class="ra-card-k">삭제 제외 활성</div><div class="ra-card-v">${metrics.activeCount}</div></div>
        <div class="ra-card"><div class="ra-card-k">삭제됨</div><div class="ra-card-v">${metrics.deletedCount}</div></div>
        <div class="ra-card"><div class="ra-card-k">평균 응답 길이</div><div class="ra-card-v">${metrics.avgLength}</div></div>
        <div class="ra-card"><div class="ra-card-k">실행계획성(Q3)</div><div class="ra-card-v">${metrics.actionRate}%</div></div>
      </div>

      <section class="ra-section">
        <h3 class="ra-section-title">챕터별 제출 분포</h3>
        ${renderChapterTable(chapterStats)}
      </section>

      <section class="ra-section">
        <h3 class="ra-section-title">Q2-취약개념 교차표</h3>
        ${renderConceptTable(conceptStats)}
      </section>

      <section class="ra-section">
        <h3 class="ra-section-title">형성평가 완료 후 성찰일지 미제출</h3>
        ${renderMissingList(missingRows)}
      </section>

      <section class="ra-section">
        <h3 class="ra-section-title">성찰일지 목록</h3>
        ${renderListTable(visibleRows, submissionMap)}
      </section>

      <section id="ra-detail" class="ra-detail hidden"></section>
    </div>
  `;

  bindEvents(container, {
    rows: visibleRows,
    submissionMap,
    actions,
    reload,
    metrics,
    chapterStats,
    conceptStats,
    missingRows,
  });
}

function bindEvents(container, state) {
  const showDeletedEl = container.querySelector('#ra-show-deleted');
  const searchEl = container.querySelector('#ra-local-search');
  const exportBtn = container.querySelector('#ra-export-csv');
  const copyBtn = container.querySelector('#ra-copy-report');

  showDeletedEl?.addEventListener('change', () => {
    showDeleted = !!showDeletedEl.checked;
    state.reload();
  });

  searchEl?.addEventListener('input', () => {
    localSearch = String(searchEl.value || '').trim();
    state.reload();
  });

  exportBtn?.addEventListener('click', () => {
    const headers = ['student_id', 'student_name', 'chapter_id', 'saved_at', 'is_deleted', 'delete_reason', 'q1', 'q2', 'q3', 'score', 'weak_concepts', 'q3_action_score'];
    const rows = state.rows.map((r) => {
      const sub = state.submissionMap[makeKey(r.student_id, r.chapter_id)]?.submission || null;
      return [
        r.student_id,
        r.student_name,
        r.chapter_id,
        r.saved_at || '',
        r.is_deleted ? '1' : '0',
        r.delete_reason || '',
        r.answers?.[0] || '',
        r.answers?.[1] || '',
        r.answers?.[2] || '',
        sub?.score ?? '',
        (sub?.weak_concepts || []).join('|'),
        calcActionPlanScore(r.answers?.[2] || ''),
      ];
    });
    downloadCsv('reflection_analysis.csv', [headers, ...rows]);
  });

  copyBtn?.addEventListener('click', async () => {
    const text = buildSummaryReport(state.metrics, state.chapterStats, state.conceptStats, state.missingRows);
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = '복사됨';
      setTimeout(() => { copyBtn.textContent = '요약 복사'; }, 1200);
    } catch {
      // ignore clipboard errors
    }
  });

  container.querySelectorAll('[data-ra-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = String(btn.getAttribute('data-ra-open') || '');
      const row = state.rows.find((r) => makeKey(r.student_id, r.chapter_id) === key);
      if (!row) return;
      const sub = state.submissionMap[key]?.submission || null;
      openDetail(container, row, sub);
    });
  });

  container.querySelectorAll('[data-ra-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!state.actions?.deleteReflection) return;
      const studentId = String(btn.getAttribute('data-student-id') || '');
      const chapterId = String(btn.getAttribute('data-chapter-id') || '');
      if (!studentId || !chapterId) return;
      const reason = window.prompt('삭제 사유를 입력하세요. (선택)') || '';
      btn.disabled = true;
      try {
        await state.actions.deleteReflection({ student_id: studentId, chapter_id: chapterId, reason });
        state.reload();
      } catch (e) {
        console.error('[reflection delete]', e);
      } finally {
        btn.disabled = false;
      }
    });
  });

  container.querySelectorAll('[data-ra-restore]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!state.actions?.restoreReflection) return;
      const studentId = String(btn.getAttribute('data-student-id') || '');
      const chapterId = String(btn.getAttribute('data-chapter-id') || '');
      if (!studentId || !chapterId) return;
      btn.disabled = true;
      try {
        await state.actions.restoreReflection({ student_id: studentId, chapter_id: chapterId });
        state.reload();
      } catch (e) {
        console.error('[reflection restore]', e);
      } finally {
        btn.disabled = false;
      }
    });
  });
}

function collectConcepts(qData) {
  const q = qData?.questions;
  const list = Array.isArray(q?.questions) ? q.questions : Array.isArray(q) ? q : [];
  return [...new Set(list.map((item) => String(item?.concept || '').trim()).filter(Boolean))];
}

function applySearch(reflections, q) {
  if (!q) return reflections;
  const key = q.toLowerCase();
  return reflections.filter((r) => {
    const sid = String(r.student_id || '').toLowerCase();
    const sname = String(r.student_name || '').toLowerCase();
    return sid.includes(key) || sname.includes(key);
  });
}

function buildSubmissionMap(submissions) {
  const out = {};
  submissions.forEach((s) => {
    const chapter = normalizeChapter(s.chapter_id || s.chapter);
    const key = makeKey(String(s.student_id || ''), chapter);
    out[key] = { submission: s, raw: s };
  });
  return out;
}

function computeMetrics(rows, submissions) {
  const active = rows.filter((r) => !r.is_deleted);
  const deleted = rows.filter((r) => r.is_deleted);
  const avgLength = active.length
    ? Math.round(active.reduce((acc, r) => acc + joinedText(r.answers).length, 0) / active.length)
    : 0;
  const actionCount = active.filter((r) => calcActionPlanScore(r.answers?.[2] || '') >= 1).length;
  const actionRate = active.length ? Math.round((actionCount / active.length) * 100) : 0;

  const seen = new Set(submissions.map((s) => makeKey(String(s.student_id || ''), normalizeChapter(s.chapter_id || s.chapter))));
  return {
    visibleCount: rows.length,
    activeCount: active.length,
    deletedCount: deleted.length,
    avgLength,
    actionRate,
    assessedPairs: seen.size,
  };
}

function computeChapterStats(rows) {
  const map = {};
  rows.filter((r) => !r.is_deleted).forEach((r) => {
    const ch = normalizeChapter(r.chapter_id);
    if (!map[ch]) map[ch] = { chapter_id: ch, count: 0, sumLength: 0 };
    map[ch].count += 1;
    map[ch].sumLength += joinedText(r.answers).length;
  });
  return Object.values(map)
    .map((v) => ({ chapter_id: v.chapter_id, count: v.count, avg_length: v.count ? Math.round(v.sumLength / v.count) : 0 }))
    .sort((a, b) => a.chapter_id.localeCompare(b.chapter_id));
}

function computeConceptStats(rows, submissionMap, concepts) {
  if (!concepts.length) return [];
  return concepts.map((concept) => {
    let q2Mention = 0;
    let weakMatch = 0;
    rows.filter((r) => !r.is_deleted).forEach((r) => {
      const q2 = String(r.answers?.[1] || '');
      if (!q2.includes(concept)) return;
      q2Mention += 1;
      const key = makeKey(r.student_id, r.chapter_id);
      const weak = submissionMap[key]?.submission?.weak_concepts || [];
      if (weak.some((w) => String(w).includes(concept) || concept.includes(String(w)))) {
        weakMatch += 1;
      }
    });
    return { concept, q2_mention: q2Mention, weak_match: weakMatch };
  }).sort((a, b) => b.weak_match - a.weak_match);
}

function computeMissingRows(rows, submissions) {
  const done = new Set(rows.filter((r) => !r.is_deleted).map((r) => makeKey(r.student_id, r.chapter_id)));
  return submissions
    .filter((s) => !done.has(makeKey(s.student_id, normalizeChapter(s.chapter_id || s.chapter))))
    .map((s) => ({
      student_id: String(s.student_id || ''),
      student_name: String(s.student_name || ''),
      chapter_id: normalizeChapter(s.chapter_id || s.chapter),
    }));
}

function renderChapterTable(rows) {
  if (!rows.length) return '<p class="ra-empty">데이터가 없습니다.</p>';
  const body = rows.map((r) => `<tr><td>${escapeHtml(r.chapter_id)}</td><td class="ra-num">${r.count}</td><td class="ra-num">${r.avg_length}</td></tr>`).join('');
  return `<table class="ra-table"><thead><tr><th>챕터</th><th class="ra-num">제출 수</th><th class="ra-num">평균 길이</th></tr></thead><tbody>${body}</tbody></table>`;
}

function renderConceptTable(rows) {
  if (!rows.length) return '<p class="ra-empty">문항 개념 데이터가 없습니다.</p>';
  const body = rows.map((r) => `<tr><td>${escapeHtml(r.concept)}</td><td class="ra-num">${r.q2_mention}</td><td class="ra-num">${r.weak_match}</td></tr>`).join('');
  return `<table class="ra-table"><thead><tr><th>개념</th><th class="ra-num">Q2 언급</th><th class="ra-num">취약개념 일치</th></tr></thead><tbody>${body}</tbody></table>`;
}

function renderMissingList(rows) {
  if (!rows.length) return '<p class="ra-empty">미제출 학생이 없습니다.</p>';
  const items = rows.slice(0, 50).map((r) => `<li>${escapeHtml(r.student_name || r.student_id)} (${escapeHtml(r.student_id)}) - Ch.${escapeHtml(r.chapter_id)}</li>`).join('');
  return `<ul class="ra-missing-list">${items}</ul>`;
}

function renderListTable(rows, submissionMap) {
  if (!rows.length) return '<p class="ra-empty">조회 결과가 없습니다.</p>';
  const body = rows.map((r) => {
    const key = makeKey(r.student_id, r.chapter_id);
    const sub = submissionMap[key]?.submission || null;
    const score = sub?.score ?? '-';
    const weak = (sub?.weak_concepts || []).join(', ') || '-';
    const status = r.is_deleted ? '<span class="ra-status deleted">삭제됨</span>' : '<span class="ra-status active">활성</span>';
    const actionBtn = r.is_deleted
      ? `<button class="btn-secondary" type="button" data-ra-restore data-student-id="${escapeAttr(r.student_id)}" data-chapter-id="${escapeAttr(r.chapter_id)}">복구</button>`
      : `<button class="btn-secondary" type="button" data-ra-delete data-student-id="${escapeAttr(r.student_id)}" data-chapter-id="${escapeAttr(r.chapter_id)}">삭제</button>`;
    return `<tr>
      <td>${escapeHtml(r.student_name || r.student_id)}</td>
      <td>${escapeHtml(r.student_id)}</td>
      <td>${escapeHtml(normalizeChapter(r.chapter_id))}</td>
      <td>${escapeHtml(formatDate(r.saved_at))}</td>
      <td class="ra-num">${score}</td>
      <td>${escapeHtml(weak)}</td>
      <td>${status}</td>
      <td><button class="btn-secondary" type="button" data-ra-open="${escapeAttr(key)}">상세</button> ${actionBtn}</td>
    </tr>`;
  }).join('');

  return `<div class="ra-table-wrap"><table class="ra-table"><thead><tr><th>이름</th><th>학번</th><th>챕터</th><th>작성시간</th><th class="ra-num">점수</th><th>취약개념</th><th>상태</th><th>관리</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function openDetail(container, reflection, submission) {
  const panel = container.querySelector('#ra-detail');
  if (!panel) return;
  const weak = (submission?.weak_concepts || []).join(', ') || '-';
  panel.innerHTML = `
    <div class="ra-detail-head">
      <strong>${escapeHtml(reflection.student_name || reflection.student_id)}</strong>
      <span>${escapeHtml(reflection.student_id)}</span>
      <span>Ch.${escapeHtml(normalizeChapter(reflection.chapter_id))}</span>
      <span>${escapeHtml(formatDate(reflection.saved_at))}</span>
      <button class="btn-secondary" id="ra-close-detail" type="button">닫기</button>
    </div>
    <div class="ra-detail-meta">형성평가 점수: ${escapeHtml(String(submission?.score ?? '-'))} / 취약개념: ${escapeHtml(weak)}</div>
    <div class="ra-qa"><h4>Q1</h4><p>${escapeHtml(reflection.answers?.[0] || '')}</p></div>
    <div class="ra-qa"><h4>Q2</h4><p>${escapeHtml(reflection.answers?.[1] || '')}</p></div>
    <div class="ra-qa"><h4>Q3</h4><p>${escapeHtml(reflection.answers?.[2] || '')}</p></div>
    ${reflection.is_deleted ? `<div class="ra-delete-log">삭제됨: ${escapeHtml(formatDate(reflection.deleted_at))} / 사유: ${escapeHtml(reflection.delete_reason || '-')}</div>` : ''}
  `;
  panel.classList.remove('hidden');
  panel.querySelector('#ra-close-detail')?.addEventListener('click', () => panel.classList.add('hidden'));
}

function buildSummaryReport(metrics, chapterStats, conceptStats, missingRows) {
  const lines = [
    '[성찰일지 연구 요약]',
    `- 표시 레코드: ${metrics.visibleCount}`,
    `- 활성 레코드: ${metrics.activeCount}`,
    `- 삭제 레코드: ${metrics.deletedCount}`,
    `- 평균 응답 길이: ${metrics.avgLength}`,
    `- 실행계획성 비율(Q3): ${metrics.actionRate}%`,
    '',
    '[챕터별 제출 분포]',
    ...chapterStats.map((r) => `- Ch.${r.chapter_id}: ${r.count}건 (평균길이 ${r.avg_length})`),
    '',
    '[오개념 교차 상위 10]',
    ...conceptStats.slice(0, 10).map((r) => `- ${r.concept}: Q2언급 ${r.q2_mention}, 취약일치 ${r.weak_match}`),
    '',
    `[미제출 학생 수] ${missingRows.length}`,
  ];
  return lines.join('\n');
}

function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function calcActionPlanScore(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return 0;
  const keywords = ['계획', '실천', '반복', '복습', '다음', '매일', '주', '시간', '문제풀이', '오답', '연습'];
  let score = 0;
  keywords.forEach((k) => { if (t.includes(k)) score += 1; });
  return score >= 4 ? 2 : score >= 1 ? 1 : 0;
}

function joinedText(answers) {
  return (Array.isArray(answers) ? answers : []).map((v) => String(v || '')).join(' ');
}

function normalizeChapter(ch) {
  const t = String(ch || '').trim();
  if (!t) return '';
  return t.padStart(2, '0');
}

function makeKey(studentId, chapterId) {
  return `${String(studentId || '')}::${normalizeChapter(chapterId)}`;
}

function formatDate(iso) {
  const t = String(iso || '');
  if (!t) return '-';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function escapeHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}
