/**
 * views/roster.js
 * 수강생 명단 뷰 — 회원가입 기반 전체 학생 목록 (이메일, 가입일 포함)
 */

export function renderRoster(data, container) {
  const roster = data.roster || [];

  container.innerHTML = '';

  // 헤더
  const header = document.createElement('div');
  header.className = 'roster-header';
  header.innerHTML = `
    <div class="roster-title-row">
      <h2 class="roster-title">수강생 명단</h2>
      <span class="roster-count">${roster.length}명 가입</span>
      <button class="btn-secondary roster-csv-btn" id="roster-csv-btn">CSV 내보내기</button>
    </div>
    <input class="roster-search" id="roster-search" type="text" placeholder="학번 또는 이름으로 검색…" />
  `;
  container.appendChild(header);

  // 테이블 래퍼
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
      </tr>
    </thead>
    <tbody id="roster-tbody"></tbody>
  `;
  wrap.appendChild(table);
  container.appendChild(wrap);

  const empty = document.createElement('p');
  empty.className = 'empty-msg';
  empty.textContent = '가입된 수강생이 없습니다.';
  empty.id = 'roster-empty';
  container.appendChild(empty);

  function renderRows(list) {
    const tbody = document.getElementById('roster-tbody');
    tbody.innerHTML = '';
    empty.classList.toggle('hidden', list.length > 0);

    list.forEach((u, i) => {
      const tr = document.createElement('tr');
      const date = u.created_at
        ? new Date(u.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
        : '-';
      tr.innerHTML = `
        <td class="roster-num">${i + 1}</td>
        <td class="mono">${esc(u.student_id)}</td>
        <td>${esc(u.student_name)}</td>
        <td class="roster-email">${u.email ? `<a href="mailto:${esc(u.email)}">${esc(u.email)}</a>` : '<span class="no-email">미입력</span>'}</td>
        <td class="roster-date">${date}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  renderRows(roster);

  // 검색 필터
  document.getElementById('roster-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = roster.filter(
      (u) => u.student_id.toLowerCase().includes(q) || u.student_name.toLowerCase().includes(q),
    );
    renderRows(filtered);
  });

  // CSV 내보내기
  document.getElementById('roster-csv-btn').addEventListener('click', () => {
    const rows = [['학번', '이름', '이메일', '가입일시']];
    roster.forEach((u) => {
      const date = u.created_at
        ? new Date(u.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
        : '';
      rows.push([u.student_id, u.student_name, u.email || '', date]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `수강생명단_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
