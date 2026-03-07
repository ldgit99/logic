// ─── 논리 게이트 인터랙티브 시뮬레이터 ───

const GATES = {
  NOT:  { label: 'NOT',  inputs: 1, fn: ([a]) => +!a,              sym: '¬A',     color: 'var(--accent-blue)' },
  BUF:  { label: 'BUF',  inputs: 1, fn: ([a]) => a,                sym: 'A',      color: 'var(--accent-green)' },
  AND:  { label: 'AND',  inputs: 2, fn: ([a,b]) => a & b,           sym: 'A·B',    color: 'var(--accent-blue)' },
  OR:   { label: 'OR',   inputs: 2, fn: ([a,b]) => a | b,           sym: 'A+B',    color: 'var(--accent-green)' },
  NAND: { label: 'NAND', inputs: 2, fn: ([a,b]) => +(!(a & b)),     sym: '(A·B)\'', color: 'var(--accent-yellow)' },
  NOR:  { label: 'NOR',  inputs: 2, fn: ([a,b]) => +(!(a | b)),     sym: '(A+B)\'', color: 'var(--accent-purple)' },
  XOR:  { label: 'XOR',  inputs: 2, fn: ([a,b]) => a ^ b,           sym: 'A⊕B',    color: 'var(--accent-red)' },
  XNOR: { label: 'XNOR', inputs: 2, fn: ([a,b]) => +(!(a ^ b)),     sym: '(A⊕B)\'', color: 'var(--text-secondary)' },
  AND3: { label: 'AND3', inputs: 3, fn: ([a,b,c]) => a & b & c,     sym: 'A·B·C',  color: 'var(--accent-blue)' },
  OR3:  { label: 'OR3',  inputs: 3, fn: ([a,b,c]) => a | b | c,     sym: 'A+B+C',  color: 'var(--accent-green)' },
};

function drawGateSVG(type, inputs, output, w=120, h=90) {
  const mid = h / 2;
  const inSpacing = inputs === 1 ? 0 : h / (inputs + 1);

  let body = '';
  const inX = 30, outX = w - 14;

  // Input lines
  const inYs = inputs === 1 ? [mid] : Array.from({length: inputs}, (_, i) => (i+1) * inSpacing);
  inYs.forEach(y => {
    body += `<line x1="0" y1="${y}" x2="${inX}" y2="${y}" stroke="var(--accent-blue)" stroke-width="2"/>`;
  });

  // Output line
  body += `<line x1="${outX}" y1="${mid}" x2="${w}" y2="${mid}" stroke="${output ? 'var(--accent-green)' : 'var(--border)'}" stroke-width="2.5"/>`;

  // Gate shape
  const gx = inX, gy = 10, gw = outX - inX - 4, gh = h - 20;
  const gm = gy + gh / 2;

  if (type === 'NOT' || type === 'BUF') {
    // Triangle
    body += `<polygon points="${gx},${gy} ${gx+gw-8},${gm} ${gx},${gy+gh}" fill="var(--bg-secondary)" stroke="var(--border)" stroke-width="1.5"/>`;
    if (type === 'NOT') body += `<circle cx="${gx+gw-4}" cy="${gm}" r="4" fill="var(--bg-secondary)" stroke="var(--border)" stroke-width="1.5"/>`;
  } else {
    const isAnd = type.startsWith('AND') || type === 'NAND';
    const isOr  = type.startsWith('OR') || type === 'NOR' || type === 'XOR' || type === 'XNOR';
    const hasNot = type === 'NAND' || type === 'NOR' || type === 'XNOR';

    if (isAnd) {
      body += `<path d="M${gx},${gy} L${gx + gw*0.55},${gy} Q${gx+gw},${gy} ${gx+gw},${gm} Q${gx+gw},${gy+gh} ${gx+gw*0.55},${gy+gh} L${gx},${gy+gh} Z"
        fill="var(--bg-secondary)" stroke="var(--border)" stroke-width="1.5"/>`;
    } else {
      // OR-family curved
      body += `<path d="M${gx},${gy} Q${gx+gw*0.45},${gy} ${gx+gw},${gm} Q${gx+gw*0.45},${gy+gh} ${gx},${gy+gh} Q${gx+gw*0.25},${gm} ${gx},${gy} Z"
        fill="var(--bg-secondary)" stroke="var(--border)" stroke-width="1.5"/>`;
      if (type === 'XOR' || type === 'XNOR') {
        body += `<path d="M${gx-8},${gy} Q${gx+gw*0.17},${gm} ${gx-8},${gy+gh}" fill="none" stroke="var(--border)" stroke-width="1.5"/>`;
      }
    }
    if (hasNot) {
      body += `<circle cx="${outX}" cy="${mid}" r="4" fill="var(--bg-secondary)" stroke="var(--border)" stroke-width="1.5"/>`;
    }
  }

  // Input & output dots
  inYs.forEach((y, i) => {
    const v = inputs[i] !== undefined ? inputs[i] : 0;
    body += `<circle cx="0" cy="${y}" r="5" fill="${v ? 'var(--accent-blue)' : 'var(--bg-tertiary)'}" stroke="var(--border)" stroke-width="1.5"/>`;
  });
  body += `<circle cx="${w}" cy="${mid}" r="5" fill="${output ? 'var(--accent-green)' : 'var(--bg-tertiary)'}" stroke="var(--border)" stroke-width="1.5"/>`;

  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="overflow:visible">${body}</svg>`;
}

function buildTruthTable(type, gate) {
  const n = gate.inputs;
  const rows = 1 << n;
  const labels = n === 1 ? ['A'] : n === 2 ? ['A','B'] : ['A','B','C'];

  let html = `<table style="width:100%;border-collapse:collapse;font-family:monospace;font-size:0.82rem;">
    <thead><tr style="background:var(--bg-secondary);">
      ${labels.map(l => `<th style="padding:4px 8px;border:1px solid var(--border);color:var(--accent-blue);">${l}</th>`).join('')}
      <th style="padding:4px 8px;border:1px solid var(--border);color:var(--accent-green);">F = ${gate.sym}</th>
    </tr></thead><tbody>`;

  for (let i = 0; i < rows; i++) {
    const bits = Array.from({length: n}, (_, k) => (i >> (n-1-k)) & 1);
    const out = gate.fn(bits);
    html += `<tr style="background:${out ? 'rgba(16,185,129,0.08)' : 'transparent'};">
      ${bits.map(b => `<td style="text-align:center;padding:4px 8px;border:1px solid var(--border);color:${b?'var(--accent-blue)':'var(--text-muted)'};">${b}</td>`).join('')}
      <td style="text-align:center;padding:4px 8px;border:1px solid var(--border);
        font-weight:700;color:${out?'var(--accent-green)':'var(--text-muted)'};">${out}</td>
    </tr>`;
  }

  return html + '</tbody></table>';
}

export function mountGateSimulator(container) {
  let selectedGate = 'AND';
  let inputVals = [0, 0];

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <!-- 게이트 선택 -->
      <div>
        <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:6px;text-transform:uppercase;">게이트 선택</div>
        <div id="gs-btns" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
      </div>

      <!-- 시뮬레이터 영역 -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;">
        <!-- 입력 & 회로도 -->
        <div style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:14px;">
          <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:10px;text-transform:uppercase;">입력 제어</div>
          <div id="gs-inputs" style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;"></div>
          <div id="gs-svg" style="display:flex;justify-content:center;margin-bottom:8px;"></div>
          <div id="gs-output" style="text-align:center;font-size:1.1rem;font-family:monospace;font-weight:700;"></div>
        </div>
        <!-- 진리표 -->
        <div>
          <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:6px;text-transform:uppercase;">진리표</div>
          <div id="gs-table" style="overflow-x:auto;"></div>
        </div>
      </div>
    </div>
  `;

  const btnsEl = document.getElementById('gs-btns');
  const inputsEl = document.getElementById('gs-inputs');
  const svgEl = document.getElementById('gs-svg');
  const outputEl = document.getElementById('gs-output');
  const tableEl = document.getElementById('gs-table');

  // Build gate buttons
  Object.keys(GATES).forEach(key => {
    const btn = document.createElement('button');
    btn.className = 'unit-example-btn';
    btn.textContent = GATES[key].label;
    btn.dataset.gate = key;
    btn.addEventListener('click', () => selectGate(key));
    btnsEl.appendChild(btn);
  });

  function selectGate(key) {
    selectedGate = key;
    const gate = GATES[key];
    inputVals = Array(gate.inputs).fill(0);

    // Update button styles
    btnsEl.querySelectorAll('.unit-example-btn').forEach(b => {
      b.style.background = b.dataset.gate === key ? gate.color : '';
      b.style.color = b.dataset.gate === key ? 'white' : '';
      b.style.borderColor = b.dataset.gate === key ? gate.color : '';
    });

    renderAll();
  }

  function renderAll() {
    const gate = GATES[selectedGate];
    const labels = gate.inputs === 1 ? ['A'] : gate.inputs === 2 ? ['A','B'] : ['A','B','C'];
    const out = gate.fn(inputVals);

    // Inputs
    inputsEl.innerHTML = labels.map((lbl, i) => `
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-family:monospace;font-size:0.9rem;color:var(--accent-blue);font-weight:700;width:16px;">${lbl}</span>
        <button data-idx="${i}" style="
          width:48px;height:32px;border-radius:4px;font-family:monospace;font-size:1rem;font-weight:700;
          background:${inputVals[i]?'var(--accent-blue)':'var(--bg-secondary)'};
          color:${inputVals[i]?'white':'var(--text-muted)'};
          border:1px solid ${inputVals[i]?'var(--accent-blue)':'var(--border)'};cursor:pointer;">
          ${inputVals[i]}
        </button>
        <span style="font-size:0.78rem;color:var(--text-muted);">클릭하여 전환</span>
      </div>
    `).join('');

    inputsEl.querySelectorAll('button[data-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.idx);
        inputVals[i] ^= 1;
        renderAll();
      });
    });

    // SVG
    svgEl.innerHTML = drawGateSVG(selectedGate, inputVals, out);

    // Output
    outputEl.innerHTML = `출력 F = <span style="color:${out?'var(--accent-green)':'var(--accent-red)'};font-size:1.4rem;">${out}</span>
      <span style="font-size:0.8rem;color:var(--text-muted);margin-left:8px;">(${out?'High / ON':'Low / OFF'})</span>`;

    // Truth table
    tableEl.innerHTML = buildTruthTable(selectedGate, gate);
  }

  selectGate('AND');
}
