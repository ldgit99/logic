/**
 * views/submissionStatus.js
 * 제출 현황 — 학생 × 챕터 매트릭스
 *
 * 각 셀에서 형성평가 / 대화 / 성찰일지 3가지 제출 상태를 한눈에 확인합니다.
 * 행(학생)을 클릭하면 해당 학생의 챕터별 상세 현황을 펼쳐 볼 수 있습니다.
 */

import { escapeHtml, formatDate, scoreColor } from '../utils/format.js';

const CHAPTERS = ['01','02','03','04','05','06','07','08','09','10','11'];

const CH_LABELS = {
  '01': '들어가기', '02': '수 체계', '03': '코드 체계',
  '04': '불 대수', '05': '불 함수', '06': '논리회로 간소화',
  '07': '조합논리회로', '08': '플립플롭', '09': '순서논리회로',
  '10': '레지스터/카운터', '11': '기억장치',
};

// ── 진입점 ────────────────────────────────────────────────────────

export function renderSubmissionStatus(submissions, container, reflections = []) {
  if (!container) return;

  const rows = Array.isArray(submissions) ? submissions : [];
  if (!rows.length) {
    container.innerHTML = '<p class="empty-msg">제출 데이터가 없습니다.</p>';
    return;
  }

  const matrix = buildMatrix(rows, reflections);
  const stats = calcStats(matrix);

  container.innerHTML = `
    <div class="ss-page">

      <!-- 헤더 요약 -->
      <div class="ss-summary-row">
        ${buildSummaryCard('전체 학생', `${matrix.length}명`, '')}
        ${buildSummaryCard('형성평가 제출률', `${stats.assessRate}%`, stats.assessRate >= 80 ? 'ok' : stats.assessRate >= 60 ? 'warn' : 'bad')}
        ${buildSummaryCard('대화 제출률', `${stats.convRate}%`, stats.convRate >= 80 ? 'ok' : stats.convRate >= 60 ? 'warn' : 'bad')}
        ${buildSummaryCard('성찰일지 제출률', `${stats.reflRate}%`, stats.reflRate >= 80 ? 'ok' : stats.reflRate >= 60 ? 'warn' : 'bad')}
        ${buildSummaryCard('3종 완전 제출률', `${stats.fullRate}%`, stats.fullRate >= 80 ? 'ok' : stats.fullRate >= 60 ? 'warn' : 'bad')}
      </div>

      <!-- 범례 -->
      <div class="ss-legend">
        <span class="ss-legend-item"><span class="ss-dot ss-dot--ok"></span>제출 완료</span>
        <span class="ss-legend-item"><span class="ss-dot ss-dot--warn"></span>부분 제출</span>
        <span class="ss-legend-item"><span class="ss-dot ss-dot--miss"></span>미제출</span>
        <span class="ss-legend-sep">셀 아이콘:</span>
        <span class="ss-legend-item"><strong>평</strong> 형성평가</span>
        <span class="ss-legend-item"><strong>대</strong> 대화</span>
        <span class="ss-legend-item"><strong>성</strong> 성찰일지</span>
      </div>

      <!-- 매트릭스 테이블 -->
      <div class="ss-matrix-wrap">
        <table class="ss-matrix-table">
          <thead>
            <tr>
              <th class="ss-th-student">학생</th>
              <th class="ss-th-total">전체</th>
              ${CHAPTERS.map((ch) => `
                <th class="ss-th-ch">
                  <span class="ss-ch-num">Ch.${ch}</span>
                  <span class="ss-ch-name">${CH_LABELS[ch] || ''}</span>
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody id="ss-tbody">
            ${matrix.map((student) => renderStudentRow(student)).join('')}
          </tbody>
        </table>
      </div>

      <!-- 챕터별 요약 -->
      <div class="ss-ch-summary">
        <h3 class="ss-section-title">챕터별 제출 현황 요약</h3>
        <table class="dash-table">
          <thead>
            <tr>
              <th>챕터</th>
              <th>형성평가</th>
              <th>대화</th>
              <th>성찰일지</th>
              <th>3종 완전</th>
              <th>평균 점수</th>
            </tr>
          </thead>
          <tbody>
            ${CHAPTERS.map((ch) => renderChapterSummaryRow(ch, matrix)).join('')}
          </tbody>
        </table>
      </div>

    </div>
  `;

  // 행 클릭 → 상세 토글
  container.querySelectorAll('.ss-student-row[data-sid]').forEach((row) => {
    row.addEventListener('click', () => {
      const sid = row.dataset.sid;
      const detail = container.querySelector(`.ss-detail-row[data-sid="${sid}"]`);
      if (!detail) return;
      const isOpen = !detail.classList.contains('hidden');
      // 다른 열린 상세 닫기
      container.querySelectorAll('.ss-detail-row').forEach((r) => r.classList.add('hidden'));
      container.querySelectorAll('.ss-student-row').forEach((r) => r.classList.remove('ss-row-open'));
      if (!isOpen) {
        detail.classList.remove('hidden');
        row.classList.add('ss-row-open');
      }
    });
  });
}

// ── 매트릭스 구축 ─────────────────────────────────────────────────

function buildMatrix(submissions, reflections) {
  const reflMap = new Set(
    (Array.isArray(reflections) ? reflections : [])
      .filter((r) => !r?.is_deleted)
      .map((r) => `${r?.student_id}::${r?.chapter_id}`),
  );

  const studentMap = new Map();
  submissions.forEach((s) => {
    const sid = String(s?.student_id || s?.studentId || '').trim();
    if (!sid) return;
    if (!studentMap.has(sid)) {
      studentMap.set(sid, {
        studentId: sid,
        studentName: String(s?.student_name || s?.studentName || sid),
        chapters: {},
      });
    }
    const ch = String(s?.chapter_id || s?.chapterId || '').trim();
    if (!ch) return;
    const hasConv = hasConversation(s);
    const hasRefl = reflMap.has(`${sid}::${ch}`);
    studentMap.get(sid).chapters[ch] = {
      assessment: true,
      conversation: hasConv,
      reflection: hasRefl,
      score: s?.score != null ? Number(s.score) : null,
      submittedAt: s?.submitted_at || s?.submittedAt || '',
      turnCount: countTurns(s),
    };
  });

  return [...studentMap.values()]
    .sort((a, b) => a.studentId.localeCompare(b.studentId))
    .map((student) => {
      const chList = Object.entries(student.chapters);
      const fullCount = chList.filter(([, v]) => v.assessment && v.conversation && v.reflection).length;
      const assessCount = chList.filter(([, v]) => v.assessment).length;
      const convCount = chList.filter(([, v]) => v.conversation).length;
      const reflCount = chList.filter(([, v]) => v.reflection).length;
      const scores = chList.map(([, v]) => v.score).filter((v) => v != null && Number.isFinite(v));
      return {
        ...student,
        fullCount,
        assessCount,
        convCount,
        reflCount,
        chapterCount: chList.length,
        avgScore: scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length * 10) / 10 : null,
      };
    });
}

// ── 통계 계산 ─────────────────────────────────────────────────────

function calcStats(matrix) {
  const total = matrix.length * CHAPTERS.length;
  const assessTotal = matrix.reduce((s, p) => s + p.assessCount, 0);
  const convTotal = matrix.reduce((s, p) => s + p.convCount, 0);
  const reflTotal = matrix.reduce((s, p) => s + p.reflCount, 0);
  const fullTotal = matrix.reduce((s, p) => s + p.fullCount, 0);
  const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0;
  return {
    assessRate: pct(assessTotal),
    convRate: pct(convTotal),
    reflRate: pct(reflTotal),
    fullRate: pct(fullTotal),
  };
}

// ── 학생 행 렌더링 ────────────────────────────────────────────────

function renderStudentRow(student) {
  const scoreClass = student.avgScore != null ? scoreColor(student.avgScore) : '';

  const cellsHtml = CHAPTERS.map((ch) => {
    const d = student.chapters[ch];
    if (!d) return `<td class="ss-cell ss-cell--empty"><span class="ss-cell-empty">—</span></td>`;

    const allOk = d.assessment && d.conversation && d.reflection;
    const anyOk = d.assessment || d.conversation || d.reflection;
    const cellClass = allOk ? 'ss-cell--full' : anyOk ? 'ss-cell--partial' : 'ss-cell--miss';

    return `
      <td class="ss-cell ${cellClass}">
        <div class="ss-cell-icons">
          <span class="ss-icon ${d.assessment ? 'ss-icon--ok' : 'ss-icon--miss'}" title="형성평가">평</span>
          <span class="ss-icon ${d.conversation ? 'ss-icon--ok' : 'ss-icon--miss'}" title="대화(${d.turnCount}턴)">대</span>
          <span class="ss-icon ${d.reflection ? 'ss-icon--ok' : 'ss-icon--miss'}" title="성찰일지">성</span>
        </div>
        ${d.score != null ? `<div class="ss-cell-score ${scoreColor(d.score)}">${d.score}점</div>` : ''}
      </td>
    `;
  }).join('');

  const totalClass = student.fullCount === student.chapterCount && student.chapterCount > 0
    ? 'ss-total--full' : student.fullCount > 0 ? 'ss-total--partial' : 'ss-total--miss';

  // 상세 행 (클릭 시 표시)
  const detailHtml = renderDetailRow(student);

  return `
    <tr class="ss-student-row" data-sid="${escapeHtml(student.studentId)}" title="클릭하여 상세 보기">
      <td class="ss-td-student">
        <div class="ss-student-name">${escapeHtml(student.studentName)}</div>
        <div class="ss-student-id">${escapeHtml(student.studentId)}</div>
      </td>
      <td class="ss-td-total">
        <div class="ss-total-badge ${totalClass}">${student.fullCount}/${student.chapterCount}</div>
        ${student.avgScore != null ? `<div class="ss-avg-score ${scoreClass}">${student.avgScore}점</div>` : ''}
      </td>
      ${cellsHtml}
    </tr>
    <tr class="ss-detail-row hidden" data-sid="${escapeHtml(student.studentId)}">
      <td colspan="${CHAPTERS.length + 2}" class="ss-detail-td">
        ${detailHtml}
      </td>
    </tr>
  `;
}

function renderDetailRow(student) {
  const submittedChapters = Object.entries(student.chapters)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

  if (!submittedChapters.length) return '<p class="empty-msg">제출 데이터가 없습니다.</p>';

  return `
    <div class="ss-detail-wrap">
      <h4 class="ss-detail-title">${escapeHtml(student.studentName)} (${escapeHtml(student.studentId)}) — 챕터별 상세</h4>
      <div class="ss-detail-cards">
        ${submittedChapters.map(([ch, d]) => `
          <div class="ss-detail-card ${d.assessment && d.conversation && d.reflection ? 'ss-detail-card--full' : ''}">
            <div class="ss-detail-card-head">
              <span class="ss-detail-ch">Ch.${ch}</span>
              <span class="ss-detail-ch-name">${CH_LABELS[ch] || ''}</span>
              ${d.score != null ? `<span class="ss-detail-score ${scoreColor(d.score)}">${d.score}점</span>` : ''}
            </div>
            <div class="ss-detail-items">
              ${renderDetailItem('형성평가', d.assessment, d.submittedAt ? `제출: ${formatDate(d.submittedAt)}` : '')}
              ${renderDetailItem('대화 로그', d.conversation, `${d.turnCount}턴`)}
              ${renderDetailItem('성찰일지', d.reflection, '')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderDetailItem(label, ok, meta) {
  return `
    <div class="ss-detail-item ${ok ? 'ss-detail-item--ok' : 'ss-detail-item--miss'}">
      <span class="ss-detail-item-icon">${ok ? '✓' : '✗'}</span>
      <span class="ss-detail-item-label">${label}</span>
      ${meta ? `<span class="ss-detail-item-meta">${escapeHtml(meta)}</span>` : ''}
    </div>
  `;
}

function renderChapterSummaryRow(ch, matrix) {
  const submitted = matrix.filter((s) => s.chapters[ch]);
  if (!submitted.length) return `<tr><td>Ch.${ch} ${CH_LABELS[ch]}</td><td colspan="5" class="empty-msg" style="text-align:center;">제출 없음</td></tr>`;

  const n = submitted.length;
  const assessN = submitted.filter((s) => s.chapters[ch]?.assessment).length;
  const convN   = submitted.filter((s) => s.chapters[ch]?.conversation).length;
  const reflN   = submitted.filter((s) => s.chapters[ch]?.reflection).length;
  const fullN   = submitted.filter((s) => s.chapters[ch]?.assessment && s.chapters[ch]?.conversation && s.chapters[ch]?.reflection).length;
  const scores  = submitted.map((s) => s.chapters[ch]?.score).filter((v) => v != null && Number.isFinite(v));
  const avgSc   = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '-';

  const pct = (k) => `${Math.round((k / n) * 100)}% (${k}/${n}명)`;
  const pctClass = (k) => k / n >= 0.8 ? 'rate-good' : k / n >= 0.5 ? 'rate-warn' : 'rate-bad';

  return `
    <tr>
      <td><strong>Ch.${ch}</strong> <span style="color:var(--color-muted);font-size:11px">${CH_LABELS[ch]}</span></td>
      <td class="${pctClass(assessN)}">${pct(assessN)}</td>
      <td class="${pctClass(convN)}">${pct(convN)}</td>
      <td class="${pctClass(reflN)}">${pct(reflN)}</td>
      <td class="${pctClass(fullN)}">${pct(fullN)}</td>
      <td class="${scoreColor(parseFloat(avgSc))}">${avgSc !== '-' ? `${avgSc}점` : '-'}</td>
    </tr>
  `;
}

// ── 유틸 ──────────────────────────────────────────────────────────

function hasConversation(submission) {
  const msgs = Array.isArray(submission?.messages)
    ? submission.messages.filter((m) => String(m?.role || '').toLowerCase() === 'user').length
    : 0;
  const metrics = submission?.chat_metrics || {};
  const count = msgs || Number(metrics.user_message_count || metrics.turn_count || 0);
  return count > 0 || Boolean(submission?.chat_summary || submission?.chatSummary);
}

function countTurns(submission) {
  const msgs = Array.isArray(submission?.messages)
    ? submission.messages.filter((m) => String(m?.role || '').toLowerCase() === 'user').length
    : 0;
  const metrics = submission?.chat_metrics || {};
  return msgs || Number(metrics.user_message_count || metrics.turn_count || 0);
}

function buildSummaryCard(label, value, status) {
  const colorMap = { ok: 'var(--color-ok)', warn: 'var(--color-warn)', bad: 'var(--color-danger)', '': 'var(--color-primary)' };
  return `
    <div class="ss-summary-card">
      <span class="ss-summary-label">${label}</span>
      <strong class="ss-summary-value" style="color:${colorMap[status] || colorMap['']}">${value}</strong>
    </div>
  `;
}
