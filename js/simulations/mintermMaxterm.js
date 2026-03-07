// ─── 최소항/최대항 변환기 ───

export function mountMintermMaxterm(container) {
  let vars = 3;
  let outputs = [];

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <!-- 변수 수 선택 -->
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <div>
          <div style="font-size:0.72rem;color:var(--accent-blue);font-weight:700;margin-bottom:4px;text-transform:uppercase;">변수 수</div>
          <select id="mm-vars" style="background:var(--bg-tertiary);border:1px solid var(--border);
            border-radius:var(--radius-sm);color:var(--text-primary);padding:8px 12px;font-size:0.9rem;">
            <option value="2">2변수 (A,B)</option>
            <option value="3" selected>3변수 (A,B,C)</option>
            <option value="4">4변수 (A,B,C,D)</option>
          </select>
        </div>
        <div style="flex:1;"></div>
        <button class="unit-example-btn" id="mm-all0">전체 0</button>
        <button class="unit-example-btn" id="mm-all1">전체 1</button>
        <button class="unit-example-btn" id="mm-random">무작위</button>
      </div>

      <!-- 진리표 직접 편집 -->
      <div>
        <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:6px;text-transform:uppercase;">
          진리표 (F 열 클릭하여 0/1 전환)
        </div>
        <div id="mm-table" style="overflow-x:auto;"></div>
      </div>

      <!-- 결과 -->
      <div id="mm-result" style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:14px;"></div>
    </div>
  `;

  const varsSel = document.getElementById('mm-vars');
  const tableEl = document.getElementById('mm-table');
  const resultEl = document.getElementById('mm-result');

  function getVarLabels() {
    return ['A','B','C','D'].slice(0, vars);
  }

  function initOutputs() {
    outputs = new Array(1 << vars).fill(0);
    outputs[1] = 1; outputs[3] = 1; outputs[5] = 1; // default example
    if (vars >= 4) outputs[7] = 1;
  }

  function renderTable() {
    const labels = getVarLabels();
    const rows = 1 << vars;

    let html = `<table style="border-collapse:collapse;font-family:monospace;font-size:0.82rem;">
      <thead><tr style="background:var(--bg-secondary);">
        <th style="padding:4px 8px;border:1px solid var(--border);color:var(--text-muted);">m</th>
        ${labels.map(l => `<th style="padding:4px 8px;border:1px solid var(--border);color:var(--accent-blue);">${l}</th>`).join('')}
        <th style="padding:4px 8px;border:1px solid var(--border);color:var(--accent-green);">F</th>
      </tr></thead><tbody>`;

    for (let i = 0; i < rows; i++) {
      const bits = Array.from({length: vars}, (_, k) => (i >> (vars-1-k)) & 1);
      const out = outputs[i];
      html += `<tr style="background:${out?'rgba(16,185,129,0.08)':'transparent'};">
        <td style="text-align:center;padding:4px 8px;border:1px solid var(--border);color:var(--text-muted);font-size:0.75rem;">m${i}</td>
        ${bits.map(b => `<td style="text-align:center;padding:4px 8px;border:1px solid var(--border);color:${b?'var(--accent-blue)':'var(--text-muted)'};">${b}</td>`).join('')}
        <td data-idx="${i}" style="text-align:center;padding:4px 10px;border:1px solid var(--border);
          font-weight:700;cursor:pointer;
          color:${out?'var(--accent-green)':'var(--text-muted)'};
          background:${out?'rgba(16,185,129,0.15)':'transparent'};">${out}</td>
      </tr>`;
    }
    html += '</tbody></table>';
    tableEl.innerHTML = html;

    tableEl.querySelectorAll('td[data-idx]').forEach(td => {
      td.addEventListener('click', () => {
        const i = parseInt(td.dataset.idx);
        outputs[i] ^= 1;
        renderTable();
        renderResult();
      });
    });
  }

  function getMintermExpr(idx) {
    const labels = getVarLabels();
    const bits = Array.from({length: vars}, (_, k) => (idx >> (vars-1-k)) & 1);
    return bits.map((b, i) => b ? labels[i] : labels[i]+'̄').join('');
  }

  function getMaxtermExpr(idx) {
    const labels = getVarLabels();
    const bits = Array.from({length: vars}, (_, k) => (idx >> (vars-1-k)) & 1);
    return '(' + bits.map((b, i) => b ? labels[i]+'̄' : labels[i]).join('+') + ')';
  }

  function renderResult() {
    const rows = 1 << vars;
    const minterms = [], maxterms = [];
    for (let i = 0; i < rows; i++) {
      if (outputs[i]) minterms.push(i);
      else maxterms.push(i);
    }

    const sopFull = minterms.length === 0 ? 'F = 0' :
      minterms.length === rows ? 'F = 1' :
      minterms.map(getMintermExpr).join(' + ');

    const posFull = maxterms.length === 0 ? 'F = 1' :
      maxterms.length === rows ? 'F = 0' :
      maxterms.map(getMaxtermExpr).join('');

    resultEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="background:rgba(16,185,129,0.08);border:1px solid var(--accent-green);border-radius:4px;padding:10px 12px;">
          <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px;">최소항식 SOP — F = Σm(${minterms.join(',')})</div>
          <div style="font-family:monospace;font-size:0.9rem;color:var(--accent-green);font-weight:700;line-height:1.6;word-break:break-all;">
            F = ${minterms.length===0?'0':minterms.length===(1<<vars)?'1':sopFull}
          </div>
        </div>
        <div style="background:rgba(139,92,246,0.08);border:1px solid var(--accent-purple);border-radius:4px;padding:10px 12px;">
          <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px;">최대항식 POS — F = ΠM(${maxterms.join(',')})</div>
          <div style="font-family:monospace;font-size:0.9rem;color:var(--accent-purple);font-weight:700;line-height:1.6;word-break:break-all;">
            F = ${maxterms.length===0?'1':maxterms.length===(1<<vars)?'0':posFull}
          </div>
        </div>
        <div style="font-size:0.75rem;color:var(--text-secondary);">
          출력 1: ${minterms.length}개 항 | 출력 0: ${maxterms.length}개 항
          ${minterms.length + maxterms.length === (1<<vars) ? ' ✓' : ''}
        </div>
      </div>
    `;
  }

  varsSel.addEventListener('change', () => {
    vars = parseInt(varsSel.value);
    initOutputs();
    renderTable();
    renderResult();
  });

  document.getElementById('mm-all0').addEventListener('click', () => {
    outputs.fill(0); renderTable(); renderResult();
  });
  document.getElementById('mm-all1').addEventListener('click', () => {
    outputs.fill(1); renderTable(); renderResult();
  });
  document.getElementById('mm-random').addEventListener('click', () => {
    outputs = outputs.map(() => Math.random() > 0.5 ? 1 : 0);
    renderTable(); renderResult();
  });

  initOutputs();
  renderTable();
  renderResult();
}
