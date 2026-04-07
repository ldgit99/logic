/**
 * views/summary.js
 * Assessment-first summary cards + submission table
 *
 * 테이블: 학생 행 클릭 → 전체 챕터 × 형성/대화/성찰 체크리스트 펼침
 */

import { escapeHtml, formatDate, scoreColor } from '../utils/format.js';

// ── 요약 카드 ────────────────────────────────────────────────────

export function renderSummaryCards(summary, container, submissions = [], reflections = []) {
  if (!container) return;

  const rows = Array.isArray(submissions) ? submissions : [];
  const reflSet = buildReflectionSet(reflections);
  const totalCount = Number(summary?.totalSubmissions ?? rows.length);
  const avgScoreNum = Number(summary?.avgScore);
  const avgScoreDisplay = Number.isFinite(avgScoreNum) ? `${avgScoreNum.toFixed(1)}점` : '-';
  const uniqueStudents = new Set(
    rows.map((s) => String(s?.student_id || s?.studentId || '').trim()).filter(Boolean),
  ).size || totalCount;

  const lastAt = rows
    .map((s) => String(s?.submitted_at || s?.submittedAt || s?.timestamp || ''))
    .filter(Boolean).sort((a, b) => b.localeCompare(a))[0] || '';

  const reflLinked = rows.filter((s) => reflSet.has(makeKey(s))).length;
  const convLinked = rows.filter(hasConv).length;
  const fullLinked = rows.filter((s) => reflSet.has(makeKey(s)) && hasConv(s)).length;

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
          <span class="summary-banner-chip">최근 제출 ${lastAt ? formatDate(lastAt) : '기록 없음'}</span>
        </div>
      </section>
      <section class="summary-stat-row">
        ${statCard('형성평가 제출', `${totalCount}건`, '현재 필터 기준 제출 건수')}
        ${statCard('성찰일지 연결', `${reflLinked}건`, `${Math.max(totalCount - reflLinked, 0)}건 미연결`)}
        ${statCard('대화 로그 연결', `${convLinked}건`, `${Math.max(totalCount - convLinked, 0)}건 미연결`)}
        ${statCard('후속 제출 완료', `${fullLinked}건`, '성찰일지와 대화 로그 모두 연결')}
        ${statCard('평균 점수', avgScoreDisplay, '형성평가 제출 기준 평균')}
      </section>
    </div>
  `;
}

function statCard(label, value, meta) {
  return `
    <article class="summary-stat-card">
      <span class="summary-stat-card__label">${escapeHtml(label)}</span>
      <strong class="summary-stat-card__value">${escapeHtml(value)}</strong>
      <span class="summary-stat-card__meta">${escapeHtml(meta)}</span>
    </article>`;
}

// ── 제출 현황 테이블 ─────────────────────────────────────────────

export function renderSummaryTable(submissions, tbody, { onRowClick, onDelete } = {}, reflections = []) {
  if (!tbody) return;

  const list = Array.isArray(submissions) ? submissions : [];
  const reflSet = buildReflectionSet(reflections);
  const reflMap = buildReflectionObjectMap(reflections);
  if (!list.length) { tbody.innerHTML = ''; return; }

  // 학생별 집계
  const studentMap = new Map();
  list.forEach((s) => {
    const sid = String(s?.student_id || s?.studentId || '').trim();
    if (!sid) return;
    if (!studentMap.has(sid)) {
      studentMap.set(sid, {
        sid,
        name: String(s?.student_name || s?.studentName || sid),
        subs: [],
      });
    }
    studentMap.get(sid).subs.push(s);
  });

  const students = [...studentMap.values()].sort((a, b) => a.sid.localeCompare(b.sid));

  tbody.innerHTML = students.map(({ sid, name, subs }) => {
    const total   = subs.length;
    const assessN = total;
    const convN   = subs.filter(hasConv).length;
    const reflN   = subs.filter((s) => reflSet.has(makeKey(s))).length;
    const fullN   = subs.filter((s) => hasConv(s) && reflSet.has(makeKey(s))).length;

    const scores  = subs.map((s) => Number(s?.score)).filter(Number.isFinite);
    const avg     = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const avgCls  = avg != null ? scoreColor(avg) : '';

    const pill = (n, t) => {
      const cls = n === t ? 'st-pill--ok' : n > 0 ? 'st-pill--warn' : 'st-pill--miss';
      return `<span class="st-pill ${cls}">${n}/${t}</span>`;
    };

    return `
      <tr class="st-student-row" data-sid="${escapeHtml(sid)}">
        <td>${escapeHtml(sid)}</td>
        <td>
          <span class="st-name">${escapeHtml(name)}</span>
          <span class="st-hint">▸ 클릭하여 챕터 현황</span>
        </td>
        <td class="tc">${pill(assessN, total)}</td>
        <td class="tc">${pill(convN, total)}</td>
        <td class="tc">${pill(reflN, total)}</td>
        <td class="${avgCls}">
          ${avg != null ? `<div class="score-bar-wrap"><div class="score-bar ${avgCls}-bar" style="width:${Math.min(avg,100)}%"></div></div><strong>${avg.toFixed(1)}점</strong>` : '-'}
        </td>
        <td class="tc">
          ${fullN === total && total > 0
            ? `<span class="summary-status summary-status--ok">완료 ${total}챕터</span>`
            : `<span class="summary-status summary-status--warn">${fullN}/${total} 완료</span>`}
        </td>
      </tr>
      <tr class="st-detail-row hidden" data-sid="${escapeHtml(sid)}">
        <td colspan="7" class="st-detail-td">
          ${buildChecklist(sid, name, subs, reflSet, reflMap)}
        </td>
      </tr>`;
  }).join('');

  // 행 클릭 → 체크리스트 토글
  tbody.querySelectorAll('.st-student-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
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
  tbody.querySelectorAll('.st-btn-view').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sid = btn.dataset.sid;
      const idx = Number(btn.dataset.idx);
      const student = students.find((s) => s.sid === sid);
      if (!student || !onRowClick) return;
      onRowClick(sortedSubs(student.subs)[idx]);
    });
  });

  // 삭제 버튼
  tbody.querySelectorAll('.st-btn-del').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sid = btn.dataset.sid;
      const idx = Number(btn.dataset.idx);
      const student = students.find((s) => s.sid === sid);
      if (!student || !onDelete) return;
      onDelete(sortedSubs(student.subs)[idx]);
    });
  });

  // 성찰일지 내용 보기
  tbody.querySelectorAll('.st-btn-refl').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = btn.dataset.key;
      const refl = reflMap.get(key);
      if (!refl) return;
      const panel = btn.closest('tr').querySelector('.st-refl-panel');
      if (panel) { panel.remove(); return; }
      showReflPanel(btn, refl);
    });
  });
}

// ── 체크리스트 패널 ───────────────────────────────────────────────

function buildChecklist(sid, name, subs, reflSet, reflMap) {
  const sorted = sortedSubs(subs);

  const rows = sorted.map((s, idx) => {
    const ch         = String(s?.chapter_id || s?.chapterId || '');
    const submittedAt = s?.submitted_at || s?.submittedAt || '';
    const sc         = s?.score != null ? Number(s.score) : null;
    const scCls      = sc != null ? scoreColor(sc) : '';
    const key        = makeKey(s);
    const okConv     = hasConv(s);
    const okRefl     = reflSet.has(key);
    const turns      = countTurns(s);
    const refl       = reflMap.get(key);
    const reflAt     = refl?.submitted_at || refl?.submittedAt || '';

    const check = (ok, label, sub = '') => `
      <span class="cl-item ${ok ? 'cl-ok' : 'cl-miss'}">
        <span class="cl-icon">${ok ? '✓' : '✗'}</span>
        <span class="cl-label">${label}</span>
        ${sub ? `<span class="cl-sub">${sub}</span>` : ''}
      </span>`;

    return `
      <div class="cl-row">
        <span class="cl-ch">Ch.${escapeHtml(ch)}</span>
        <span class="cl-date">${submittedAt ? formatDate(submittedAt) : ''}</span>
        ${sc != null ? `<span class="cl-score ${scCls}">${sc}점</span>` : ''}
        <div class="cl-checks">
          ${check(true,  '형성평가', submittedAt ? formatDate(submittedAt) : '')}
          ${check(okConv, '대화 내용', okConv && turns > 0 ? `${turns}턴` : '')}
          ${check(okRefl, '성찰일지', okRefl && reflAt ? formatDate(reflAt) : '')}
        </div>
        <div class="cl-actions">
          <button class="st-btn-view" data-sid="${escapeHtml(sid)}" data-idx="${idx}">대화 보기</button>
          ${okRefl ? `<button class="st-btn-refl" data-sid="${escapeHtml(sid)}" data-key="${escapeHtml(key)}" data-idx="${idx}">성찰 보기</button>` : ''}
          <button class="st-btn-del"  data-sid="${escapeHtml(sid)}" data-idx="${idx}">삭제</button>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="cl-wrap">
      <div class="cl-head">
        <strong>${escapeHtml(name)}</strong>의 챕터별 제출 체크리스트
        <span class="cl-hint">다시 클릭하면 닫힙니다</span>
      </div>
      <div class="cl-legend">
        <span class="cl-ok cl-item"><span class="cl-icon">✓</span><span class="cl-label">제출 완료</span></span>
        <span class="cl-miss cl-item"><span class="cl-icon">✗</span><span class="cl-label">미제출</span></span>
      </div>
      <div class="cl-list">${rows || '<p class="empty-msg">데이터가 없습니다.</p>'}</div>
    </div>`;
}

// ── 성찰일지 인라인 패널 ─────────────────────────────────────────

function showReflPanel(btn, refl) {
  const content   = String(refl?.content || refl?.reflection_text || '내용 없음');
  const reflAt    = refl?.submitted_at || refl?.submittedAt || '';
  const clRow     = btn.closest('.cl-row');

  const panel = document.createElement('div');
  panel.className = 'st-refl-panel';
  panel.innerHTML = `
    <div class="st-refl-head">
      <strong>성찰일지</strong>
      ${reflAt ? `<span class="st-refl-date">${formatDate(reflAt)}</span>` : ''}
      <button class="st-refl-close">✕ 닫기</button>
    </div>
    <p class="st-refl-body">${escapeHtml(content)}</p>`;
  panel.querySelector('.st-refl-close').addEventListener('click', () => panel.remove());

  if (clRow) clRow.after(panel);
  else btn.closest('.cl-list')?.appendChild(panel);
}

// ── 유틸 ──────────────────────────────────────────────────────────

function makeKey(item) {
  return `${String(item?.student_id || item?.studentId || '').trim()}::${String(item?.chapter_id || item?.chapterId || '').trim()}`;
}

function buildReflectionSet(reflections = []) {
  return new Set(
    (Array.isArray(reflections) ? reflections : [])
      .filter((r) => !r?.is_deleted)
      .map(makeKey)
      .filter((k) => k !== '::'),
  );
}

function buildReflectionObjectMap(reflections = []) {
  const map = new Map();
  (Array.isArray(reflections) ? reflections : [])
    .filter((r) => !r?.is_deleted)
    .forEach((r) => { const k = makeKey(r); if (k !== '::') map.set(k, r); });
  return map;
}

function countTurns(s) {
  const msgs = Array.isArray(s?.messages)
    ? s.messages.filter((m) => String(m?.role || '').toLowerCase() !== 'system').length
    : 0;
  const m = s?.chat_metrics || {};
  return msgs || Number(m.user_message_count || m.turn_count || 0);
}

function hasConv(s) {
  return countTurns(s) > 0 || Boolean(s?.chat_summary || s?.chatSummary);
}

function sortedSubs(subs) {
  return [...subs].sort((a, b) =>
    String(a?.chapter_id || a?.chapterId || '').localeCompare(
      String(b?.chapter_id || b?.chapterId || ''), undefined, { numeric: true },
    ),
  );
}
