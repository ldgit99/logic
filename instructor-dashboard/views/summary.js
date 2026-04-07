/**
 * views/summary.js
 * Assessment-first summary cards + submission table
 *
 * 테이블 구조:
 *  학번 | 이름 | 형성평가(N건) | 대화 내용(N건) | 성찰일지(N건) | 평균점수 | 완료 현황
 *
 * 형성평가/대화 내용/성찰일지 셀 클릭 → 챕터별 제출일시 목록 인라인 펼침
 * 각 챕터 행의 [보기] 버튼 → 상세 모달 또는 성찰일지 내용 패널
 */

import { escapeHtml, formatDate, scoreColor } from '../utils/format.js';

// ── 진입점: 요약 카드 ─────────────────────────────────────────────

export function renderSummaryCards(summary, container, submissions = [], reflections = []) {
  if (!container) return;

  const rows = Array.isArray(submissions) ? submissions : [];
  const reflectionMap = buildReflectionMap(reflections);
  const totalCount = Number(summary?.totalSubmissions ?? rows.length);
  const avgScoreNum = Number(summary?.avgScore);
  const avgScoreDisplay = Number.isFinite(avgScoreNum) ? `${avgScoreNum.toFixed(1)}점` : '-';
  const uniqueStudents = new Set(
    rows
      .map((s) => String(s?.student_id || s?.studentId || '').trim())
      .filter(Boolean),
  ).size || totalCount;

  const lastSubmittedAt = rows
    .map((s) => String(s?.submitted_at || s?.submittedAt || s?.timestamp || ''))
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))[0] || '';

  const reflectionLinked = rows.filter((s) => reflectionMap.has(makeStudentChapterKey(s))).length;
  const conversationLinked = rows.filter(hasConversationLog).length;
  const fullyLinked = rows.filter((s) =>
    reflectionMap.has(makeStudentChapterKey(s)) && hasConversationLog(s),
  ).length;

  container.innerHTML = `
    <div class="summary-shell">
      <section class="summary-banner">
        <div>
          <p class="summary-banner-kicker">Assessment-first dashboard</p>
          <h2 class="summary-banner-title">형성평가 제출을 기준으로 후속 제출 상태를 먼저 확인합니다.</h2>
          <p class="summary-banner-text">학생이 형성평가를 제출한 뒤 성찰일지와 대화 로그까지 제대로 남겼는지 한 줄에서 바로 확인할 수 있습니다.</p>
        </div>
        <div class="summary-banner-chips">
          <span class="summary-banner-chip">형성평가 ${totalCount}건</span>
          <span class="summary-banner-chip">학생 ${uniqueStudents}명</span>
          <span class="summary-banner-chip">최근 제출 ${lastSubmittedAt ? formatDate(lastSubmittedAt) : '기록 없음'}</span>
        </div>
      </section>

      <section class="summary-stat-row">
        ${buildStatCard('형성평가 제출', `${totalCount}건`, '현재 필터 기준 제출 건수')}
        ${buildStatCard('성찰일지 연결', `${reflectionLinked}건`, `${Math.max(totalCount - reflectionLinked, 0)}건 미연결`)}
        ${buildStatCard('대화 로그 연결', `${conversationLinked}건`, `${Math.max(totalCount - conversationLinked, 0)}건 미연결`)}
        ${buildStatCard('후속 제출 완료', `${fullyLinked}건`, '성찰일지와 대화 로그 모두 연결')}
        ${buildStatCard('평균 점수', avgScoreDisplay, '형성평가 제출 기준 평균')}
      </section>
    </div>
  `;
}

function buildStatCard(label, value, meta) {
  return `
    <article class="summary-stat-card">
      <span class="summary-stat-card__label">${escapeHtml(label)}</span>
      <strong class="summary-stat-card__value">${escapeHtml(value)}</strong>
      <span class="summary-stat-card__meta">${escapeHtml(meta)}</span>
    </article>
  `;
}

// ── 진입점: 제출 현황 테이블 ──────────────────────────────────────

export function renderSummaryTable(submissions, tbody, { onRowClick, onDelete } = {}, reflections = []) {
  if (!tbody) return;

  const list = Array.isArray(submissions) ? submissions : [];
  const reflMap = buildReflectionObjectMap(reflections); // key → reflection 객체
  if (!list.length) { tbody.innerHTML = ''; return; }

  // ── 학생별 집계 ──────────────────────────────────────────────────
  const studentMap = new Map();
  list.forEach((s) => {
    const sid = String(s?.student_id || s?.studentId || '').trim();
    if (!sid) return;
    if (!studentMap.has(sid)) {
      studentMap.set(sid, {
        studentId: sid,
        studentName: String(s?.student_name || s?.studentName || sid),
        submissions: [],
      });
    }
    studentMap.get(sid).submissions.push(s);
  });

  const students = [...studentMap.values()].sort((a, b) => a.studentId.localeCompare(b.studentId));

  tbody.innerHTML = students.map((student) => {
    const subs = student.submissions;

    const assessCount = subs.length;
    const convCount   = subs.filter(hasConversationLog).length;
    const reflCount   = subs.filter((s) => reflMap.has(makeStudentChapterKey(s))).length;
    const fullCount   = subs.filter((s) =>
      hasConversationLog(s) && reflMap.has(makeStudentChapterKey(s)),
    ).length;

    const scores = subs.map((s) => Number(s?.score)).filter(Number.isFinite);
    const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const avgScoreClass = avgScore != null ? scoreColor(avgScore) : '';
    const total = subs.length;

    const typeBadge = (n, t, type) => {
      const cls = n === t ? 'st-badge--ok' : n > 0 ? 'st-badge--warn' : 'st-badge--miss';
      return `<button class="st-type-badge ${cls}" data-sid="${escapeHtml(student.studentId)}" data-type="${type}">${n}/${t}건</button>`;
    };

    return `
      <tr class="st-student-row" data-sid="${escapeHtml(student.studentId)}">
        <td>${escapeHtml(student.studentId)}</td>
        <td>
          <span class="st-name">${escapeHtml(student.studentName)}</span>
          <span class="st-expand-hint">셀 클릭하여 상세 확인</span>
        </td>
        <td class="st-type-cell">${typeBadge(assessCount, total, 'assess')}</td>
        <td class="st-type-cell">${typeBadge(convCount, total, 'conv')}</td>
        <td class="st-type-cell">${typeBadge(reflCount, total, 'refl')}</td>
        <td class="${avgScoreClass}">
          ${avgScore != null
            ? `<div class="score-bar-wrap"><div class="score-bar ${avgScoreClass}-bar" style="width:${Math.min(avgScore, 100)}%"></div></div><strong>${avgScore.toFixed(1)}점</strong>`
            : '-'}
        </td>
        <td>
          ${fullCount === total && total > 0
            ? `<span class="summary-status summary-status--ok">완료 ${total}챕터</span>`
            : `<span class="summary-status summary-status--warn">${fullCount}/${total} 완료</span>`}
        </td>
      </tr>
      <tr class="st-expand-row hidden" data-sid="${escapeHtml(student.studentId)}">
        <td colspan="7" class="st-expand-td">
          <div class="st-expand-body" id="st-expand-${escapeHtml(student.studentId)}"></div>
        </td>
      </tr>
    `;
  }).join('');

  // ── 이벤트 바인딩 ─────────────────────────────────────────────────
  tbody.querySelectorAll('.st-type-badge').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sid = btn.dataset.sid;
      const type = btn.dataset.type;
      const expandRow = tbody.querySelector(`.st-expand-row[data-sid="${sid}"]`);
      const expandBody = document.getElementById(`st-expand-${sid}`);
      const student = students.find((s) => s.studentId === sid);
      if (!expandRow || !expandBody || !student) return;

      const isOpen = !expandRow.classList.contains('hidden');
      const currentType = expandRow.dataset.openType;

      // 같은 타입 재클릭 → 닫기
      if (isOpen && currentType === type) {
        expandRow.classList.add('hidden');
        expandRow.dataset.openType = '';
        btn.classList.remove('st-badge--active');
        return;
      }

      // 다른 행 닫기
      tbody.querySelectorAll('.st-expand-row').forEach((r) => {
        r.classList.add('hidden');
        r.dataset.openType = '';
      });
      tbody.querySelectorAll('.st-type-badge').forEach((b) => b.classList.remove('st-badge--active'));

      // 내용 렌더링
      expandBody.innerHTML = buildExpandContent(student, type, reflMap, { onRowClick, onDelete });
      expandRow.dataset.openType = type;
      expandRow.classList.remove('hidden');
      btn.classList.add('st-badge--active');

      // 펼쳐진 패널 내 버튼 바인딩
      bindExpandButtons(expandBody, student, type, reflMap, { onRowClick, onDelete });
    });
  });
}

// ── 펼침 패널 내용 생성 ───────────────────────────────────────────

function buildExpandContent(student, type, reflMap, { onRowClick, onDelete } = {}) {
  const sortedSubs = [...student.submissions].sort((a, b) =>
    String(a?.chapter_id || a?.chapterId || '').localeCompare(
      String(b?.chapter_id || b?.chapterId || ''), undefined, { numeric: true },
    ),
  );

  const typeLabels = { assess: '형성평가', conv: '대화 내용', refl: '성찰일지' };
  const title = typeLabels[type] || '';

  const rows = sortedSubs.map((s, idx) => {
    const ch = String(s?.chapter_id || s?.chapterId || '');
    const key = makeStudentChapterKey(s);

    if (type === 'assess') {
      const submittedAt = s?.submitted_at || s?.submittedAt || '';
      const sc = s?.score != null ? Number(s.score) : null;
      return `
        <div class="st-exp-row">
          <span class="st-exp-ch">Ch.${escapeHtml(ch)}</span>
          <span class="st-exp-date">${submittedAt ? formatDate(submittedAt) : '일시 미확인'}</span>
          ${sc != null ? `<span class="st-exp-score ${scoreColor(sc)}">${sc}점</span>` : ''}
          <span class="st-exp-ok">제출 완료</span>
          <button class="btn-detail st-exp-btn" data-idx="${idx}" data-sid="${escapeHtml(student.studentId)}">상세보기</button>
          <button class="btn-delete st-exp-del" data-idx="${idx}" data-sid="${escapeHtml(student.studentId)}">삭제</button>
        </div>
      `;
    }

    if (type === 'conv') {
      const hasConv = hasConversationLog(s);
      const submittedAt = s?.submitted_at || s?.submittedAt || '';
      const turns = countConversationTurns(s);
      if (!hasConv) {
        return `
          <div class="st-exp-row st-exp-row--miss">
            <span class="st-exp-ch">Ch.${escapeHtml(ch)}</span>
            <span class="st-exp-miss">미제출</span>
          </div>
        `;
      }
      return `
        <div class="st-exp-row">
          <span class="st-exp-ch">Ch.${escapeHtml(ch)}</span>
          <span class="st-exp-date">${submittedAt ? formatDate(submittedAt) : '일시 미확인'}</span>
          <span class="st-exp-ok">${turns > 0 ? `${turns}턴` : '제출 완료'}</span>
          <button class="btn-detail st-exp-btn" data-idx="${idx}" data-sid="${escapeHtml(student.studentId)}">대화 보기</button>
        </div>
      `;
    }

    if (type === 'refl') {
      const refl = reflMap.get(key);
      if (!refl) {
        return `
          <div class="st-exp-row st-exp-row--miss">
            <span class="st-exp-ch">Ch.${escapeHtml(ch)}</span>
            <span class="st-exp-miss">미제출</span>
          </div>
        `;
      }
      const submittedAt = refl?.submitted_at || refl?.submittedAt || '';
      const preview = String(refl?.content || refl?.reflection_text || '').slice(0, 60);
      return `
        <div class="st-exp-row">
          <span class="st-exp-ch">Ch.${escapeHtml(ch)}</span>
          <span class="st-exp-date">${submittedAt ? formatDate(submittedAt) : '일시 미확인'}</span>
          ${preview ? `<span class="st-exp-preview">${escapeHtml(preview)}…</span>` : ''}
          <button class="st-exp-btn st-exp-refl-btn" data-key="${escapeHtml(key)}" data-idx="${idx}" data-sid="${escapeHtml(student.studentId)}">내용 보기</button>
        </div>
      `;
    }

    return '';
  }).join('');

  return `
    <div class="st-exp-header">
      <strong class="st-exp-title">${escapeHtml(student.studentName)} — ${title} 제출 현황</strong>
      <span class="st-exp-close-hint">다시 클릭하면 닫힙니다</span>
    </div>
    <div class="st-exp-list">${rows || '<p class="empty-msg">데이터가 없습니다.</p>'}</div>
  `;
}

function bindExpandButtons(expandBody, student, type, reflMap, { onRowClick, onDelete } = {}) {
  const sortedSubs = [...student.submissions].sort((a, b) =>
    String(a?.chapter_id || a?.chapterId || '').localeCompare(
      String(b?.chapter_id || b?.chapterId || ''), undefined, { numeric: true },
    ),
  );

  // 상세보기 / 대화 보기 버튼
  expandBody.querySelectorAll('.st-exp-btn:not(.st-exp-refl-btn)').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.idx);
      if (onRowClick) onRowClick(sortedSubs[idx]);
    });
  });

  // 삭제 버튼
  expandBody.querySelectorAll('.st-exp-del').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.idx);
      if (onDelete) onDelete(sortedSubs[idx]);
    });
  });

  // 성찰일지 내용 보기 버튼
  expandBody.querySelectorAll('.st-exp-refl-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = btn.dataset.key;
      const refl = reflMap.get(key);
      if (!refl) return;
      showReflectionPanel(expandBody, btn, refl);
    });
  });
}

// ── 성찰일지 인라인 패널 ─────────────────────────────────────────

function showReflectionPanel(expandBody, triggerBtn, refl) {
  const existing = expandBody.querySelector('.st-refl-panel');
  if (existing) existing.remove();

  const content = String(refl?.content || refl?.reflection_text || '내용 없음');
  const submittedAt = refl?.submitted_at || refl?.submittedAt || '';

  const panel = document.createElement('div');
  panel.className = 'st-refl-panel';
  panel.innerHTML = `
    <div class="st-refl-panel-head">
      <strong>성찰일지 내용</strong>
      ${submittedAt ? `<span class="st-refl-date">${formatDate(submittedAt)}</span>` : ''}
      <button class="st-refl-close">✕</button>
    </div>
    <p class="st-refl-content">${escapeHtml(content)}</p>
  `;
  panel.querySelector('.st-refl-close').addEventListener('click', () => panel.remove());

  // 트리거 버튼 다음에 삽입
  const row = triggerBtn.closest('.st-exp-row');
  if (row) row.after(panel);
  else expandBody.appendChild(panel);
}

// ── 유틸 ──────────────────────────────────────────────────────────

function makeStudentChapterKey(item) {
  const studentId = String(item?.student_id || item?.studentId || '').trim();
  const chapterId = String(item?.chapter_id || item?.chapterId || '').trim();
  return `${studentId}::${chapterId}`;
}

/** key → boolean Set (카드 필터용) */
function buildReflectionMap(reflections = []) {
  return new Set(
    (Array.isArray(reflections) ? reflections : [])
      .filter((r) => !r?.is_deleted)
      .map(makeStudentChapterKey)
      .filter((k) => k !== '::'),
  );
}

/** key → reflection 객체 Map (내용 표시용) */
function buildReflectionObjectMap(reflections = []) {
  const map = new Map();
  (Array.isArray(reflections) ? reflections : [])
    .filter((r) => !r?.is_deleted)
    .forEach((r) => {
      const key = makeStudentChapterKey(r);
      if (key !== '::') map.set(key, r);
    });
  return map;
}

function countConversationTurns(submission) {
  const messages = Array.isArray(submission?.messages)
    ? submission.messages.filter((m) => String(m?.role || '').toLowerCase() !== 'system')
    : [];
  if (messages.length) return messages.length;
  const metrics = submission?.chat_metrics || {};
  return Number(metrics.user_message_count || metrics.turn_count || 0);
}

function hasConversationLog(submission) {
  return countConversationTurns(submission) > 0 || Boolean(submission?.chat_summary || submission?.chatSummary);
}
