/**
 * views/summary.js
 * Assessment-first summary cards + submission table
 */

import { escapeHtml, formatDate, scoreColor } from '../utils/format.js';

export function renderSummaryCards(summary, container, submissions = [], reflections = []) {
  if (!container) return;

  const rows = Array.isArray(submissions) ? submissions : [];
  const reflectionMap = buildReflectionMap(reflections);
  const totalCount = Number(summary?.totalSubmissions ?? rows.length);
  const avgScoreNum = Number(summary?.avgScore);
  const avgScoreDisplay = Number.isFinite(avgScoreNum) ? `${avgScoreNum.toFixed(1)}점` : '-';
  const uniqueStudents = new Set(
    rows
      .map((submission) => String(submission?.student_id || submission?.studentId || '').trim())
      .filter(Boolean),
  ).size || totalCount;

  const lastSubmittedAt = rows
    .map((submission) => String(submission?.submitted_at || submission?.submittedAt || submission?.timestamp || ''))
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))[0] || '';

  const reflectionLinked = rows.filter((submission) => reflectionMap.has(makeStudentChapterKey(submission))).length;
  const conversationLinked = rows.filter(hasConversationLog).length;
  const fullyLinked = rows.filter((submission) => (
    reflectionMap.has(makeStudentChapterKey(submission)) && hasConversationLog(submission)
  )).length;

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

function buildStatCard(label, value, meta, className = '') {
  return `
    <article class="summary-stat-card ${className}">
      <span class="summary-stat-card__label">${escapeHtml(label)}</span>
      <strong class="summary-stat-card__value">${escapeHtml(value)}</strong>
      <span class="summary-stat-card__meta">${escapeHtml(meta)}</span>
    </article>
  `;
}

export function renderSummaryTable(submissions, tbody, { onRowClick, onDelete } = {}, reflections = []) {
  if (!tbody) return;

  const list = Array.isArray(submissions) ? submissions : [];
  const reflMap = buildReflectionMap(reflections);
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

    // 각 유형별 제출 수
    const assessCount = subs.length;
    const convCount   = subs.filter((s) => hasConversationLog(s)).length;
    const reflCount   = subs.filter((s) => reflMap.has(makeStudentChapterKey(s))).length;
    const fullCount   = subs.filter((s) =>
      hasConversationLog(s) && reflMap.has(makeStudentChapterKey(s))
    ).length;

    const scores = subs.map((s) => Number(s?.score)).filter(Number.isFinite);
    const avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const avgScoreClass = avgScore != null ? scoreColor(avgScore) : '';
    const total = subs.length;

    const statusBadge = (n, t) => {
      const cls = n === t ? 'summary-status--ok' : n > 0 ? 'summary-status--warn' : 'summary-status--miss';
      return `<span class="summary-status ${cls}">${n}/${t}</span>`;
    };

    // 챕터 목록 (상세용)
    const sortedSubs = [...subs].sort((a, b) =>
      String(a?.chapter_id || a?.chapterId || '').localeCompare(
        String(b?.chapter_id || b?.chapterId || ''), undefined, { numeric: true }
      )
    );

    const chapterDetailHtml = sortedSubs.map((s, idx) => {
      const ch = String(s?.chapter_id || s?.chapterId || '');
      const hasConv = hasConversationLog(s);
      const hasRefl = reflMap.has(makeStudentChapterKey(s));
      const sc = s?.score != null ? Number(s.score) : null;
      const scClass = sc != null ? scoreColor(sc) : '';
      return `
        <div class="st-ch-row">
          <span class="st-ch-label">Ch.${escapeHtml(ch)}</span>
          <span class="st-ch-icon ${true ? 'st-ok' : 'st-miss'}" title="형성평가">평 ✓</span>
          <span class="st-ch-icon ${hasConv ? 'st-ok' : 'st-miss'}" title="대화">${hasConv ? '대 ✓' : '대 ✗'}</span>
          <span class="st-ch-icon ${hasRefl ? 'st-ok' : 'st-miss'}" title="성찰일지">${hasRefl ? '성 ✓' : '성 ✗'}</span>
          ${sc != null ? `<span class="st-ch-score ${scClass}">${sc}점</span>` : ''}
          <button class="btn-detail st-ch-detail-btn" data-sub-idx="${idx}" data-sid="${escapeHtml(student.studentId)}">상세</button>
          <button class="btn-delete st-ch-del-btn" data-sub-idx="${idx}" data-sid="${escapeHtml(student.studentId)}">삭제</button>
        </div>
      `;
    }).join('');

    return `
      <tr class="st-student-row" data-sid="${escapeHtml(student.studentId)}">
        <td>${escapeHtml(student.studentId)}</td>
        <td>
          <span class="st-name">${escapeHtml(student.studentName)}</span>
          <span class="st-expand-hint">▸ 클릭하여 챕터 상세</span>
        </td>
        <td>${statusBadge(assessCount, total)}</td>
        <td>${statusBadge(convCount, total)}</td>
        <td>${statusBadge(reflCount, total)}</td>
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
      <tr class="st-detail-row hidden" data-sid="${escapeHtml(student.studentId)}">
        <td colspan="7" class="st-detail-td">
          <div class="st-detail-body">
            <strong class="st-detail-heading">챕터별 제출 현황</strong>
            <div class="st-ch-list">${chapterDetailHtml}</div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // 행 클릭 → 챕터 상세 토글
  tbody.querySelectorAll('.st-student-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return; // 버튼 클릭 시 무시
      const sid = row.dataset.sid;
      const detail = tbody.querySelector(`.st-detail-row[data-sid="${sid}"]`);
      if (!detail) return;
      const isOpen = !detail.classList.contains('hidden');
      tbody.querySelectorAll('.st-detail-row').forEach((r) => r.classList.add('hidden'));
      tbody.querySelectorAll('.st-student-row').forEach((r) => r.classList.remove('st-row-open'));
      if (!isOpen) { detail.classList.remove('hidden'); row.classList.add('st-row-open'); }
    });
  });

  // 상세보기 버튼
  tbody.querySelectorAll('.st-ch-detail-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sid = btn.dataset.sid;
      const idx = Number(btn.dataset.subIdx);
      const student = students.find((s) => s.studentId === sid);
      if (student && onRowClick) {
        const sortedSubs = [...student.submissions].sort((a, b) =>
          String(a?.chapter_id || a?.chapterId || '').localeCompare(
            String(b?.chapter_id || b?.chapterId || ''), undefined, { numeric: true }
          )
        );
        onRowClick(sortedSubs[idx]);
      }
    });
  });

  // 삭제 버튼
  tbody.querySelectorAll('.st-ch-del-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sid = btn.dataset.sid;
      const idx = Number(btn.dataset.subIdx);
      const student = students.find((s) => s.studentId === sid);
      if (student && onDelete) {
        const sortedSubs = [...student.submissions].sort((a, b) =>
          String(a?.chapter_id || a?.chapterId || '').localeCompare(
            String(b?.chapter_id || b?.chapterId || ''), undefined, { numeric: true }
          )
        );
        onDelete(sortedSubs[idx]);
      }
    });
  });
}

function makeStudentChapterKey(item) {
  const studentId = String(item?.student_id || item?.studentId || '').trim();
  const chapterId = String(item?.chapter_id || item?.chapterId || '').trim();
  return `${studentId}::${chapterId}`;
}

function buildReflectionMap(reflections = []) {
  return new Set(
    (Array.isArray(reflections) ? reflections : [])
      .filter((item) => !item?.is_deleted)
      .map(makeStudentChapterKey)
      .filter((key) => key !== '::'),
  );
}

function countConversationTurns(submission) {
  const messages = Array.isArray(submission?.messages)
    ? submission.messages.filter((item) => String(item?.role || '').toLowerCase() !== 'system')
    : [];
  if (messages.length) return messages.length;
  const metrics = submission?.chat_metrics || {};
  return Number(metrics.user_message_count || metrics.turn_count || 0);
}

function hasConversationLog(submission) {
  return countConversationTurns(submission) > 0 || Boolean(submission?.chat_summary || submission?.chatSummary);
}
