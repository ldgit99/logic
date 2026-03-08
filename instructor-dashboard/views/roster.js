/**
 * views/roster.js
 * Roster management view (add/delete student accounts) + chapter lock controls.
 */

import { apiGet, apiPost, addRosterMember, deleteRosterMember } from '../apiClient.js';

const CHAPTERS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'];

export function renderRoster(data, container) {
  let roster = Array.isArray(data?.roster) ? [...data.roster] : [];
  let searchQuery = '';

  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'roster-header';
  header.innerHTML = `
    <div class="roster-title-row">
      <h2 class="roster-title">수강생 명단</h2>
      <span class="roster-count" id="roster-count">${roster.length}명</span>
      <button class="btn-secondary roster-csv-btn" id="roster-csv-btn">CSV 내보내기</button>
    </div>
    <input class="roster-search" id="roster-search" type="text" placeholder="학번 또는 이름으로 검색" />
  `;
  container.appendChild(header);

  const manage = document.createElement('div');
  manage.className = 'roster-manage-panel';
  manage.innerHTML = `
    <h3 class="roster-manage-title">회원 추가</h3>
    <form id="roster-add-form" class="roster-add-form">
      <input id="add-student-id" type="text" maxlength="32" placeholder="학번 (4~32자)" required />
      <input id="add-student-name" type="text" maxlength="30" placeholder="이름 (2~30자)" required />
      <input id="add-student-email" type="email" maxlength="120" placeholder="이메일" required />
      <input id="add-student-password" type="password" minlength="8" maxlength="64" placeholder="초기 비밀번호 (8자 이상)" required />
      <button class="btn-primary" type="submit">회원 추가</button>
    </form>
    <p class="roster-manage-help">삭제된 계정은 즉시 로그인할 수 없습니다.</p>
    <p id="roster-manage-status" class="roster-manage-status"></p>
  `;
  container.appendChild(manage);

  const wrap = document.createElement('div');
  wrap.className = 'roster-table-wrap';

  const table = document.createElement('table');
  table.className = 'dash-table roster-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>#</th>
        <th>학번</th>
        <th>이름</th>
        <th>이메일</th>
        <th>가입일시</th>
        <th>관리</th>
      </tr>
    </thead>
    <tbody id="roster-tbody"></tbody>
  `;
  wrap.appendChild(table);
  container.appendChild(wrap);

  const empty = document.createElement('p');
  empty.className = 'empty-msg';
  empty.textContent = '등록된 수강생이 없습니다.';
  empty.id = 'roster-empty';
  container.appendChild(empty);

  function applySearch(list) {
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((u) => (
      String(u.student_id || '').toLowerCase().includes(q)
      || String(u.student_name || '').toLowerCase().includes(q)
    ));
  }

  function updateCount() {
    const countEl = document.getElementById('roster-count');
    if (countEl) countEl.textContent = `${roster.length}명`;
  }

  function setStatus(message, type = 'info') {
    const el = document.getElementById('roster-manage-status');
    if (!el) return;
    el.textContent = message || '';
    el.className = `roster-manage-status ${type}`;
  }

  function formatDate(value) {
    if (!value) return '-';
    try {
      return new Date(value).toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '-';
    }
  }

  function renderRows() {
    const tbody = document.getElementById('roster-tbody');
    if (!tbody) return;

    const list = applySearch(roster);
    tbody.innerHTML = '';
    empty.classList.toggle('hidden', list.length > 0);

    list.forEach((u, i) => {
      const tr = document.createElement('tr');
      const sid = String(u.student_id || '');
      const name = String(u.student_name || '');
      const email = String(u.email || '');

      tr.innerHTML = `
        <td class="roster-num">${i + 1}</td>
        <td class="mono">${esc(sid)}</td>
        <td>${esc(name)}</td>
        <td class="roster-email">${email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : '<span class="no-email">미입력</span>'}</td>
        <td class="roster-date">${formatDate(u.created_at)}</td>
        <td>
          <button class="btn-danger-mini" type="button" data-action="delete" data-student-id="${escAttr(sid)}" data-student-name="${escAttr(name)}">삭제</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const studentId = btn.getAttribute('data-student-id') || '';
        const studentName = btn.getAttribute('data-student-name') || '';
        if (!studentId) return;

        const ok = window.confirm(`[${studentId}] ${studentName} 계정을 삭제하시겠습니까?`);
        if (!ok) return;

        btn.disabled = true;
        try {
          await deleteRosterMember(studentId);
          roster = roster.filter((item) => String(item.student_id) !== studentId);
          updateCount();
          renderRows();
          setStatus(`삭제 완료: ${studentId}`, 'ok');
        } catch (err) {
          console.error('[roster delete]', err);
          setStatus(getApiErrorMessage(err, '삭제 실패'), 'error');
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  renderRows();

  document.getElementById('roster-search')?.addEventListener('input', (e) => {
    searchQuery = String(e.target.value || '').trim();
    renderRows();
  });

  document.getElementById('roster-csv-btn')?.addEventListener('click', () => {
    const rows = [['학번', '이름', '이메일', '가입일시']];
    roster.forEach((u) => {
      rows.push([
        u.student_id || '',
        u.student_name || '',
        u.email || '',
        formatDate(u.created_at),
      ]);
    });

    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `수강생명단_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('roster-add-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const studentId = String(document.getElementById('add-student-id')?.value || '').trim();
    const studentName = String(document.getElementById('add-student-name')?.value || '').trim();
    const email = String(document.getElementById('add-student-email')?.value || '').trim();
    const password = String(document.getElementById('add-student-password')?.value || '');

    if (!studentId || !studentName || !email || !password) {
      setStatus('모든 항목을 입력하세요.', 'error');
      return;
    }

    if (password.length < 8) {
      setStatus('비밀번호는 8자 이상이어야 합니다.', 'error');
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await addRosterMember({
        student_id: studentId,
        student_name: studentName,
        email,
        password,
      });

      if (res?.user) {
        roster.push(res.user);
        roster.sort((a, b) => String(a.student_id || '').localeCompare(String(b.student_id || '')));
      }

      updateCount();
      renderRows();
      e.target.reset();
      setStatus(`추가 완료: ${studentId}`, 'ok');
    } catch (err) {
      console.error('[roster add]', err);
      setStatus(getApiErrorMessage(err, '추가 실패'), 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  const lockPanel = document.createElement('div');
  lockPanel.className = 'lock-panel';
  lockPanel.innerHTML = `
    <h2 class="lock-panel-title">챕터 잠금 제어</h2>
    <p class="lock-panel-desc">잠긴 챕터는 학생 앱에서 AI 튜터 사용이 차단됩니다.</p>
    <div class="lock-grid" id="lock-grid"><div class="lock-loading">불러오는 중...</div></div>
  `;
  container.appendChild(lockPanel);

  apiGet('/dashboard/locks').then((locksData) => {
    const locks = locksData?.locks || {};
    const grid = document.getElementById('lock-grid');
    if (!grid) return;

    grid.innerHTML = CHAPTERS.map((ch) => {
      const locked = !!locks[ch];
      return `<div class="lock-item" data-ch="${ch}">
        <span class="lock-ch-label">Ch.${ch}</span>
        <button class="lock-toggle-btn ${locked ? 'locked' : 'open'}" data-ch="${ch}" data-locked="${locked}">
          ${locked ? '잠금' : '열림'}
        </button>
      </div>`;
    }).join('');

    grid.querySelectorAll('.lock-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ch = btn.dataset.ch;
        const isLocked = btn.dataset.locked === 'true';
        btn.disabled = true;
        try {
          const res = await apiPost('/dashboard/locks', { chapter_id: ch, locked: !isLocked });
          const newLocked = !!(res?.locks?.[ch]);
          btn.dataset.locked = String(newLocked);
          btn.textContent = newLocked ? '잠금' : '열림';
          btn.className = `lock-toggle-btn ${newLocked ? 'locked' : 'open'}`;
        } catch (err) {
          console.error('[lock]', err);
        } finally {
          btn.disabled = false;
        }
      });
    });
  }).catch(() => {
    const grid = document.getElementById('lock-grid');
    if (grid) grid.innerHTML = '<span class="empty-msg">불러오기 실패</span>';
  });
}

function getApiErrorMessage(err, fallback) {
  const text = String(err?.message || '').trim();
  if (!text) return fallback;
  if (text.includes('student already exists')) return '이미 존재하는 학번입니다.';
  if (text.includes('student not found')) return '존재하지 않는 학번입니다.';
  if (text.includes('invalid email')) return '이메일 형식이 올바르지 않습니다.';
  if (text.includes('invalid password length')) return '비밀번호는 8자 이상이어야 합니다.';
  return text.length < 120 ? text : fallback;
}

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(str) {
  return esc(str).replace(/"/g, '&quot;');
}