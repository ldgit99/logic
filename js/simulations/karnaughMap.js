// ─── 카르노 맵 인터랙티브 시뮬레이터 (2/3/4변수) ───

// Gray code order for K-map axes
const GRAY2 = [0, 1, 3, 2]; // 00,01,11,10
const GRAY1 = [0, 1];

// K-map cell positions: (row, col) → minterm index
function buildKmapIndex(vars) {
  if (vars === 2) {
    // 2×2: rows=A, cols=B
    const map = [[],[]]
    GRAY1.forEach((a, r) => GRAY1.forEach((b, c) => { map[r][c] = a*2 + b; }));
    return map;
  }
  if (vars === 3) {
    // 2×4: rows=A, cols=BC
    const map = [[],[]]
    GRAY1.forEach((a, r) => GRAY2.forEach((bc, c) => { map[r][c] = a*4 + bc; }));
    return map;
  }
  // 4 vars: 4×4: rows=AB, cols=CD
  const map = [[],[],[],[]]
  GRAY2.forEach((ab, r) => GRAY2.forEach((cd, c) => { map[r][c] = ab*4 + cd; }));
  return map;
}

const GROUPS_COLORS = [
  'rgba(239,68,68,0.35)', 'rgba(59,130,246,0.35)',
  'rgba(16,185,129,0.35)', 'rgba(245,158,11,0.35)',
  'rgba(139,92,246,0.35)', 'rgba(236,72,153,0.35)',
];

export function mountKarnaughMap(container) {
  let vars = 3;
  let cells = [];
  let kmapIdx = [];

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <!-- Controls -->
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <div>
          <div style="font-size:0.72rem;color:var(--accent-blue);font-weight:700;margin-bottom:4px;text-transform:uppercase;">변수 수</div>
          <select id="km-vars" style="background:var(--bg-tertiary);border:1px solid var(--border);
            border-radius:var(--radius-sm);color:var(--text-primary);padding:7px 10px;font-size:0.9rem;">
            <option value="2">2변수</option>
            <option value="3" selected>3변수</option>
            <option value="4">4변수</option>
          </select>
        </div>
        <div style="flex:1"></div>
        <button class="unit-example-btn" id="km-clear">초기화</button>
        <button class="unit-example-btn" id="km-random">무작위</button>
      </div>

      <!-- K-map grid -->
      <div style="overflow-x:auto;">
        <div id="km-grid" style="display:inline-block;"></div>
      </div>

      <!-- Result -->
      <div id="km-result" style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:12px;"></div>

      <!-- Presets -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="unit-example-btn km-preset" data-vars="3" data-ones="1,3,5,7">Σm(1,3,5,7)</button>
        <button class="unit-example-btn km-preset" data-vars="3" data-ones="0,1,2,3">Σm(0,1,2,3)</button>
        <button class="unit-example-btn km-preset" data-vars="4" data-ones="0,1,4,5,10,11,14,15">4var 예제</button>
        <button class="unit-example-btn km-preset" data-vars="4" data-ones="0,2,5,7,8,10,13,15">XOR패턴</button>
      </div>
    </div>
  `;

  const varsSel = document.getElementById('km-vars');
  const gridEl = document.getElementById('km-grid');
  const resultEl = document.getElementById('km-result');

  function init() {
    kmapIdx = buildKmapIndex(vars);
    cells = new Array(1 << vars).fill(0);
  }

  function getVarLabels() { return ['A','B','C','D'].slice(0, vars); }

  function renderGrid() {
    const labels = getVarLabels();
    const rows = kmapIdx.length;
    const cols = kmapIdx[0].length;

    let rowLabels, colLabels, rowHeader, colHeader;
    if (vars === 2) {
      rowHeader = labels[0]; colHeader = labels[1];
      rowLabels = GRAY1.map(v => v.toString());
      colLabels = GRAY1.map(v => v.toString());
    } else if (vars === 3) {
      rowHeader = labels[0]; colHeader = labels[1]+labels[2];
      rowLabels = GRAY1.map(v => v.toString());
      colLabels = GRAY2.map(v => v.toString(2).padStart(2,'0'));
    } else {
      rowHeader = labels[0]+labels[1]; colHeader = labels[2]+labels[3];
      rowLabels = GRAY2.map(v => v.toString(2).padStart(2,'0'));
      colLabels = GRAY2.map(v => v.toString(2).padStart(2,'0'));
    }

    const cellSize = 52;
    const headerSize = 40;
    const totalW = headerSize + cols * cellSize;
    const totalH = headerSize + rows * cellSize;

    let html = `<div style="position:relative;width:${totalW}px;height:${totalH}px;">`;

    // Corner
    html += `<div style="position:absolute;left:0;top:0;width:${headerSize}px;height:${headerSize}px;
      display:flex;align-items:flex-end;justify-content:flex-end;
      font-size:0.72rem;color:var(--text-muted);padding:2px 4px;border-bottom:2px solid var(--border);border-right:2px solid var(--border);">
      <span style="color:var(--accent-blue)">${rowHeader}</span><span style="color:var(--text-muted)">\\</span><span style="color:var(--accent-green)">${colHeader}</span>
    </div>`;

    // Col headers
    colLabels.forEach((lbl, c) => {
      html += `<div style="position:absolute;left:${headerSize + c*cellSize}px;top:0;width:${cellSize}px;height:${headerSize}px;
        display:flex;align-items:center;justify-content:center;
        font-family:monospace;font-size:0.8rem;font-weight:700;color:var(--accent-green);
        border-bottom:2px solid var(--border);">${lbl}</div>`;
    });

    // Row headers
    rowLabels.forEach((lbl, r) => {
      html += `<div style="position:absolute;left:0;top:${headerSize + r*cellSize}px;width:${headerSize}px;height:${cellSize}px;
        display:flex;align-items:center;justify-content:center;
        font-family:monospace;font-size:0.8rem;font-weight:700;color:var(--accent-blue);
        border-right:2px solid var(--border);">${lbl}</div>`;
    });

    // Cells
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const mIdx = kmapIdx[r][c];
        const val = cells[mIdx];
        html += `<div data-r="${r}" data-c="${c}" data-midx="${mIdx}" style="
          position:absolute;left:${headerSize + c*cellSize}px;top:${headerSize + r*cellSize}px;
          width:${cellSize}px;height:${cellSize}px;
          display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
          border:1px solid var(--border);cursor:pointer;user-select:none;
          background:${val?'rgba(16,185,129,0.2)':'transparent'};
          transition:background 0.1s;
        ">
          <span style="font-family:monospace;font-size:1.1rem;font-weight:700;
            color:${val?'var(--accent-green)':'var(--text-muted)'};">${val}</span>
          <span style="font-size:0.6rem;color:var(--text-muted);">m${mIdx}</span>
        </div>`;
      }
    }

    html += '</div>';
    gridEl.innerHTML = html;

    gridEl.querySelectorAll('[data-midx]').forEach(cell => {
      cell.addEventListener('click', () => {
        const mIdx = parseInt(cell.dataset.midx);
        cells[mIdx] ^= 1;
        renderGrid();
        computeAndShow();
      });
    });
  }

  // Simple grouping: find prime implicants using greedy approach
  function findGroups() {
    const ones = cells.map((v, i) => v ? i : -1).filter(i => i >= 0);
    if (ones.length === 0) return [];
    if (ones.length === (1 << vars)) return [{cells: ones, size: ones.length, term: '1'}];

    const groups = [];
    const covered = new Set();

    // Try sizes 8, 4, 2, 1
    for (const size of [8, 4, 2, 1]) {
      if (size > ones.length) continue;
      for (let start of ones) {
        const group = findGroup(start, size, ones);
        if (group && !group.every(i => covered.has(i))) {
          groups.push(group);
          group.forEach(i => covered.add(i));
        }
      }
    }

    return groups;
  }

  function findGroup(start, size, ones) {
    // Try to find a valid rectangular group of 'size' containing start
    // For simplicity, try all subsets of adjacent cells
    if (size === 1) return [start];
    // Try pairs
    const neighbors = getNeighbors(start);
    for (const nb of neighbors) {
      if (!ones.includes(nb)) continue;
      if (size === 2) return [start, nb];
      // Try quads
      const nb2 = getNeighbors(nb).filter(n => ones.includes(n) && n !== start);
      for (const n2 of nb2) {
        const nb3 = getNeighbors(n2).filter(n => ones.includes(n) && n !== nb && n !== start);
        for (const n3 of nb3) {
          if (size === 4) return [start, nb, n2, n3];
          // Try octets (simplification: just combine two quads)
          if (size === 8 && vars >= 4) {
            const group4a = [start, nb, n2, n3];
            const extraNeighbors = group4a.flatMap(getNeighbors).filter(n => !group4a.includes(n) && ones.includes(n));
            if (extraNeighbors.length >= 4) {
              const extra = [...new Set(extraNeighbors)].slice(0, 4);
              return [...group4a, ...extra];
            }
          }
        }
      }
    }
    return null;
  }

  function getNeighbors(mIdx) {
    // Adjacent minterms (1 bit flip in vars-bit space + wrap-around)
    const result = [];
    for (let bit = 0; bit < vars; bit++) {
      result.push(mIdx ^ (1 << bit));
    }
    return result;
  }

  function groupToTerm(group) {
    const labels = getVarLabels();
    // Find common bits across all indices in group
    let common1 = (1 << vars) - 1; // bits that are always 1
    let common0 = (1 << vars) - 1; // bits that are always 0
    for (const idx of group) {
      common1 &= idx;
      common0 &= ~idx;
    }
    common0 &= (1 << vars) - 1;

    let term = '';
    for (let bit = vars - 1; bit >= 0; bit--) {
      const mask = 1 << bit;
      const labelIdx = vars - 1 - bit;
      if (common1 & mask) term += labels[labelIdx];
      else if (common0 & mask) term += labels[labelIdx] + '̄';
    }
    return term || '1';
  }

  function computeAndShow() {
    const ones = cells.map((v,i) => v ? i : -1).filter(i => i >= 0);
    const zeros = cells.map((v,i) => v ? -1 : i).filter(i => i >= 0);

    if (ones.length === 0) {
      resultEl.innerHTML = '<div style="color:var(--text-muted);">F = 0 (1인 항 없음)</div>';
      return;
    }
    if (ones.length === (1 << vars)) {
      resultEl.innerHTML = '<div style="color:var(--accent-green);font-weight:700;">F = 1 (모든 항이 1)</div>';
      return;
    }

    const groups = findGroups();
    const terms = [...new Set(groups.map(g => groupToTerm(g)).filter(t => t))];

    resultEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div>
          <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:2px;">1인 최소항: Σm(${ones.join(',')})</div>
          <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:6px;">0인 최대항: ΠM(${zeros.join(',')})</div>
        </div>
        <div style="background:rgba(16,185,129,0.1);border:1px solid var(--accent-green);border-radius:4px;padding:10px 12px;">
          <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px;">간소화 결과 (SOP)</div>
          <div style="font-family:monospace;font-size:1rem;color:var(--accent-green);font-weight:700;">
            F = ${terms.join(' + ')}
          </div>
        </div>
        <div style="font-size:0.72rem;color:var(--text-secondary);">
          * 완전한 간소화를 위해 카르노 맵 셀을 직접 확인하고 묶음을 조정하세요.
        </div>
      </div>
    `;
  }

  varsSel.addEventListener('change', () => {
    vars = parseInt(varsSel.value);
    init();
    renderGrid();
    computeAndShow();
  });

  document.getElementById('km-clear').addEventListener('click', () => {
    cells.fill(0); renderGrid(); computeAndShow();
  });

  document.getElementById('km-random').addEventListener('click', () => {
    cells = cells.map(() => Math.random() > 0.5 ? 1 : 0);
    renderGrid(); computeAndShow();
  });

  container.querySelectorAll('.km-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      vars = parseInt(btn.dataset.vars);
      varsSel.value = vars;
      init();
      const ones = btn.dataset.ones.split(',').map(Number);
      ones.forEach(i => { if (i < cells.length) cells[i] = 1; });
      renderGrid(); computeAndShow();
    });
  });

  init();
  renderGrid();
  computeAndShow();
}
