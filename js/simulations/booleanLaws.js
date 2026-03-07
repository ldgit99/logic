// ─── 불 대수 법칙 인터랙티브 증명기 ───

const LAWS = [
  { name: '동일법칙 (Idempotent)', laws: ['A + A = A', 'A · A = A'] },
  { name: '보수법칙 (Complement)', laws: ['A + Ā = 1', 'A · Ā = 0'] },
  { name: '항등법칙 (Identity)', laws: ['A + 0 = A', 'A · 1 = A'] },
  { name: '영법칙 (Null)', laws: ['A + 1 = 1', 'A · 0 = 0'] },
  { name: '이중부정 (Double Negation)', laws: ['Ā̄ = A'] },
  { name: '교환법칙 (Commutative)', laws: ['A + B = B + A', 'A · B = B · A'] },
  { name: '결합법칙 (Associative)', laws: ['(A+B)+C = A+(B+C)', '(AB)C = A(BC)'] },
  { name: '분배법칙 (Distributive)', laws: ['A(B+C) = AB + AC', 'A + BC = (A+B)(A+C)'] },
  { name: '흡수법칙 (Absorption)', laws: ['A + AB = A', 'A(A+B) = A'] },
  { name: '드모르간 (De Morgan)', laws: ['(AB)̄ = Ā + B̄', '(A+B)̄ = Ā · B̄'] },
];

function evalBool(expr, A, B, C) {
  const e = expr.replace(/Ā/g, `(1-${A})`).replace(/B̄/g, `(1-${B})`).replace(/C̄/g, `(1-${C})`)
    .replace(/\(AB\)̄/g, `(1-(${A}&${B}))`).replace(/\(A\+B\)̄/g, `(1-(${A}|${B}))`)
    .replace(/Ā̄/g, `${A}`)
    .replace(/A/g, `${A}`).replace(/B/g, `${B}`).replace(/C/g, `${C}`)
    .replace(/·/g, '&').replace(/\+/g, '|').replace(/\s/g, '');
  try { return eval(e) & 1; } catch { return null; }
}

function verifyLaw(lawStr) {
  const [left, right] = lawStr.split('=').map(s => s.trim());
  const results = [];
  for (let A = 0; A <= 1; A++)
    for (let B = 0; B <= 1; B++)
      for (let C = 0; C <= 1; C++) {
        const l = evalBool(left, A, B, C);
        const r = evalBool(right, A, B, C);
        if (l !== null && r !== null) results.push({A, B, C, l, r, ok: l === r});
      }
  return results;
}

export function mountBooleanLaws(container) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div>
        <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:6px;text-transform:uppercase;">법칙 선택</div>
        <select id="bl-law-group" style="background:var(--bg-tertiary);border:1px solid var(--border);
          border-radius:var(--radius-sm);color:var(--text-primary);padding:8px 12px;font-size:0.9rem;width:100%;">
          ${LAWS.map((l, i) => `<option value="${i}">${l.name}</option>`).join('')}
        </select>
      </div>
      <div id="bl-laws-list" style="display:flex;gap:8px;flex-wrap:wrap;"></div>
      <div id="bl-proof" style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:14px;"></div>

      <!-- 입력값 조작 -->
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <span style="font-size:0.75rem;color:var(--text-muted);font-weight:700;">직접 확인:</span>
        ${['A','B','C'].map(v => `
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-family:monospace;font-size:0.9rem;color:var(--accent-blue);font-weight:700;">${v}=</span>
            <button class="bl-var-btn unit-example-btn" data-var="${v}" data-val="0" style="min-width:36px;">0</button>
          </div>`).join('')}
        <div id="bl-live-result" style="font-size:0.9rem;font-family:monospace;color:var(--accent-green);font-weight:700;"></div>
      </div>
    </div>
  `;

  const groupSel = document.getElementById('bl-law-group');
  const lawsList = document.getElementById('bl-laws-list');
  const proofEl = document.getElementById('bl-proof');
  const liveEl = document.getElementById('bl-live-result');

  let selectedLawStr = '';
  let varVals = {A: 0, B: 0, C: 0};

  function selectLawGroup(idx) {
    const group = LAWS[idx];
    lawsList.innerHTML = group.laws.map((l, i) =>
      `<button class="unit-example-btn bl-law-item" data-law="${encodeURIComponent(l)}">${l}</button>`
    ).join('');
    lawsList.querySelectorAll('.bl-law-item').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedLawStr = decodeURIComponent(btn.dataset.law);
        lawsList.querySelectorAll('.bl-law-item').forEach(b => {
          b.style.background = b === btn ? 'var(--accent-blue)' : '';
          b.style.color = b === btn ? 'white' : '';
        });
        showProof(selectedLawStr);
        updateLive();
      });
    });
    // Auto-select first
    lawsList.querySelector('.bl-law-item').click();
  }

  function showProof(lawStr) {
    const [left, right] = lawStr.split('=').map(s => s.trim());
    const results = verifyLaw(lawStr);
    const uniq = results.filter((r, i, arr) => arr.findIndex(x => x.A===r.A && x.B===r.B) === i);
    const allOk = results.every(r => r.ok);

    // Build mini truth table
    const usesC = lawStr.includes('C');
    const usesB = lawStr.includes('B');

    let tableRows = '';
    results.forEach(r => {
      if (!usesB && (r.B > 0 || r.C > 0)) return;
      if (!usesC && r.C > 0) return;
      tableRows += `<tr>
        <td style="text-align:center;padding:3px 6px;border:1px solid var(--border);color:var(--accent-blue);">${r.A}</td>
        ${usesB ? `<td style="text-align:center;padding:3px 6px;border:1px solid var(--border);color:var(--accent-blue);">${r.B}</td>` : ''}
        ${usesC ? `<td style="text-align:center;padding:3px 6px;border:1px solid var(--border);color:var(--accent-blue);">${r.C}</td>` : ''}
        <td style="text-align:center;padding:3px 6px;border:1px solid var(--border);color:var(--accent-green);">${r.l}</td>
        <td style="text-align:center;padding:3px 6px;border:1px solid var(--border);color:var(--accent-purple);">${r.r}</td>
        <td style="text-align:center;padding:3px 6px;border:1px solid var(--border);">${r.ok?'✓':'✗'}</td>
      </tr>`;
    });

    proofEl.innerHTML = `
      <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;">
        진리표 검증: <span style="color:var(--accent-blue);">${lawStr}</span>
      </div>
      <div style="overflow-x:auto;">
        <table style="border-collapse:collapse;font-family:monospace;font-size:0.8rem;">
          <thead><tr style="background:var(--bg-secondary);">
            <th style="padding:4px 6px;border:1px solid var(--border);color:var(--accent-blue);">A</th>
            ${usesB ? '<th style="padding:4px 6px;border:1px solid var(--border);color:var(--accent-blue);">B</th>' : ''}
            ${usesC ? '<th style="padding:4px 6px;border:1px solid var(--border);color:var(--accent-blue);">C</th>' : ''}
            <th style="padding:4px 6px;border:1px solid var(--border);color:var(--accent-green);">${left}</th>
            <th style="padding:4px 6px;border:1px solid var(--border);color:var(--accent-purple);">${right}</th>
            <th style="padding:4px 6px;border:1px solid var(--border);">일치</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <div style="margin-top:10px;font-size:0.85rem;color:${allOk?'var(--accent-green)':'var(--accent-red)'};font-weight:700;">
        ${allOk?'✓ 법칙이 모든 입력 조합에서 성립합니다':'✗ 성립하지 않는 경우가 있습니다'}
      </div>
    `;
  }

  function updateLive() {
    if (!selectedLawStr) return;
    const [left, right] = selectedLawStr.split('=').map(s => s.trim());
    const {A, B, C} = varVals;
    const l = evalBool(left, A, B, C);
    const r = evalBool(right, A, B, C);
    if (l === null || r === null) return;
    liveEl.innerHTML = `A=${A} B=${B} C=${C}: &nbsp; ${left}=<span style="color:var(--accent-blue)">${l}</span> &nbsp; ${right}=<span style="color:var(--accent-purple)">${r}</span> &nbsp; → ${l===r?'<span style="color:var(--accent-green)">✓ 일치</span>':'<span style="color:var(--accent-red)">✗ 불일치</span>'}`;
  }

  container.querySelectorAll('.bl-var-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.var;
      varVals[v] ^= 1;
      btn.dataset.val = varVals[v];
      btn.textContent = varVals[v];
      btn.style.background = varVals[v] ? 'var(--accent-blue)' : '';
      btn.style.color = varVals[v] ? 'white' : '';
      updateLive();
    });
  });

  groupSel.addEventListener('change', () => selectLawGroup(parseInt(groupSel.value)));
  selectLawGroup(0);
}
