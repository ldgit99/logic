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
  const reflectionMap = buildReflectionMap(reflections);
  if (!list.length) {
    tbody.innerHTML = '';
    return;
  }

  tbody.innerHTML = list.map((submission, idx) => {
    const weakArr = Array.isArray(submission?.weak_concepts)
      ? submission.weak_concepts
      : (Array.isArray(submission?.weakConcepts) ? submission.weakConcepts : []);
    const scoreValue = submission?.score;
    const scoreClass = scoreColor(scoreValue);
    const hasScore = scoreValue !== null && scoreValue !== undefined && scoreValue !== '';
    const scoreNum = hasScore ? Number(scoreValue) : null;
    const scoreBar = hasScore
      ? `<div class="score-bar-wrap"><div class="score-bar ${scoreClass}-bar" style="width:${Math.min(Number(scoreNum || 0), 100)}%"></div></div>`
      : '';

    const weakTagsHtml = weakArr.length
      ? weakArr.slice(0, 3).map((weak) => `<span class="concept-tag">${escapeHtml(weak)}</span>`).join('')
      : '<span class="concept-tag concept-tag--none">없음</span>';

    const reflectionStatus = reflectionMap.has(makeStudentChapterKey(submission))
      ? '<span class="summary-status summary-status--ok">제출됨</span>'
      : '<span class="summary-status summary-status--warn">미제출</span>';

    const conversationTurns = countConversationTurns(submission);
    const conversationStatus = hasConversationLog(submission)
      ? `<span class="summary-status summary-status--ok">${conversationTurns}개</span>`
      : '<span class="summary-status summary-status--warn">없음</span>';

    return `
      <tr data-session="${escapeHtml(String(submission?.session_id || ''))}">
        <td>${escapeHtml(String(submission?.student_id || submission?.studentId || ''))}</td>
        <td>${escapeHtml(String(submission?.student_name || submission?.studentName || ''))}</td>
        <td>Ch.${escapeHtml(String(submission?.chapter_id || submission?.chapterId || ''))}</td>
        <td><span class="summary-status summary-status--primary">제출 완료</span></td>
        <td>${reflectionStatus}</td>
        <td>${conversationStatus}</td>
        <td class="score-cell">
          ${scoreBar}
          <span class="${scoreClass}">${hasScore ? `${scoreValue}점` : '-'}</span>
        </td>
        <td class="concept-cell">${weakTagsHtml}</td>
        <td>${formatDate(submission?.submitted_at || submission?.submittedAt || submission?.timestamp)}</td>
        <td>
          <button class="btn-detail" data-action="detail" data-idx="${idx}">상세보기</button>
          <button class="btn-delete" data-action="delete" data-idx="${idx}">삭제</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('button[data-action="detail"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      if (onRowClick) onRowClick(list[idx]);
    });
  });

  tbody.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      if (onDelete) onDelete(list[idx]);
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
