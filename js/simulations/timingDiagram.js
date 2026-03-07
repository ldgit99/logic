// ─── 게이트 타이밍 다이어그램 시뮬레이터 ───

const GATE_DEFS = {
  NOT:  { label: 'NOT',  inputs: 1, fn: (a) => 1-a },
  AND:  { label: 'AND',  inputs: 2, fn: (a,b) => a & b },
  OR:   { label: 'OR',   inputs: 2, fn: (a,b) => a | b },
  NAND: { label: 'NAND', inputs: 2, fn: (a,b) => 1-(a&b) },
  NOR:  { label: 'NOR',  inputs: 2, fn: (a,b) => 1-(a|b) },
  XOR:  { label: 'XOR',  inputs: 2, fn: (a,b) => a^b },
  XNOR: { label: 'XNOR', inputs: 2, fn: (a,b) => 1-(a^b) },
};

const STEPS = 16;

function drawWaveform(canvasId, signals, labels, colors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const rowH = H / signals.length;
  const labelW = 52;
  const waveW = W - labelW - 8;
  const stepW = waveW / STEPS;

  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-tertiary').trim() || '#1e293b';
  ctx.fillRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= STEPS; i++) {
    const x = labelW + i * stepW;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }

  signals.forEach((sig, row) => {
    const y0 = row * rowH;
    const hi = y0 + rowH * 0.15;
    const lo = y0 + rowH * 0.75;
    const color = colors[row] || '#60a5fa';

    // Label
    ctx.fillStyle = color;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(labels[row], labelW - 4, y0 + rowH * 0.5 + 4);

    // Waveform
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let prev = sig[0];
    ctx.moveTo(labelW, prev ? hi : lo);
    for (let i = 0; i < STEPS; i++) {
      const x = labelW + i * stepW;
      const xn = labelW + (i+1) * stepW;
      const cur = sig[i];
      const y = cur ? hi : lo;
      if (i > 0 && sig[i] !== sig[i-1]) {
        ctx.lineTo(x, sig[i-1] ? hi : lo);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(xn, y);
    }
    ctx.stroke();

    // Fill area under Hi
    ctx.fillStyle = color + '18';
    ctx.beginPath();
    ctx.moveTo(labelW, lo);
    for (let i = 0; i < STEPS; i++) {
      const x = labelW + i * stepW;
      const xn = labelW + (i+1) * stepW;
      const cur = sig[i];
      const y = cur ? hi : lo;
      if (i > 0 && sig[i] !== sig[i-1]) {
        ctx.lineTo(x, sig[i-1] ? hi : lo);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(xn, y);
    }
    ctx.lineTo(labelW + STEPS*stepW, lo);
    ctx.closePath();
    ctx.fill();
  });
}

export function mountTimingDiagram(container) {
  // Default pattern: A alternates every 1, B alternates every 2
  const defaultA = Array.from({length: STEPS}, (_, i) => i % 2);
  const defaultB = Array.from({length: STEPS}, (_, i) => Math.floor(i/2) % 2);

  let sigA = [...defaultA];
  let sigB = [...defaultB];
  let selectedGate = 'AND';

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <!-- 게이트 선택 -->
      <div>
        <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:6px;text-transform:uppercase;">게이트 선택</div>
        <div id="td-btns" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
      </div>

      <!-- 입력 파형 편집 -->
      <div>
        <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:6px;text-transform:uppercase;">
          입력 파형 편집 (비트 클릭하여 반전)
        </div>
        <div id="td-input-a" style="display:flex;align-items:center;gap:4px;margin-bottom:6px;">
          <span style="font-family:monospace;font-size:0.9rem;color:var(--accent-blue);font-weight:700;min-width:20px;">A</span>
        </div>
        <div id="td-input-b" style="display:flex;align-items:center;gap:4px;">
          <span style="font-family:monospace;font-size:0.9rem;color:var(--accent-green);font-weight:700;min-width:20px;">B</span>
        </div>
      </div>

      <!-- 타이밍 다이어그램 캔버스 -->
      <div style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:4px;">
        <canvas id="td-canvas" width="560" height="160" style="width:100%;border-radius:4px;"></canvas>
      </div>

      <!-- 프리셋 -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="unit-example-btn" id="td-preset-alt">A: 교번 B: 느린교번</button>
        <button class="unit-example-btn" id="td-preset-same">A=B (동일)</button>
        <button class="unit-example-btn" id="td-preset-opp">A=B̄ (반대)</button>
      </div>
    </div>
  `;

  const btnsEl = document.getElementById('td-btns');
  const aRow = document.getElementById('td-input-a');
  const bRow = document.getElementById('td-input-b');

  Object.keys(GATE_DEFS).forEach(key => {
    const btn = document.createElement('button');
    btn.className = 'unit-example-btn';
    btn.textContent = key;
    btn.dataset.gate = key;
    btn.addEventListener('click', () => {
      selectedGate = key;
      updateBtnStyles();
      render();
    });
    btnsEl.appendChild(btn);
  });

  function updateBtnStyles() {
    btnsEl.querySelectorAll('.unit-example-btn').forEach(b => {
      const active = b.dataset.gate === selectedGate;
      b.style.background = active ? 'var(--accent-blue)' : '';
      b.style.color = active ? 'white' : '';
      b.style.borderColor = active ? 'var(--accent-blue)' : '';
    });
  }

  function buildBitEditor(rowEl, sig, color, labelChar) {
    const bits = rowEl.querySelectorAll('.td-bit');
    if (bits.length === STEPS) {
      bits.forEach((bit, i) => {
        bit.style.background = sig[i] ? color : 'var(--bg-secondary)';
        bit.style.color = sig[i] ? 'white' : 'var(--text-muted)';
      });
      return;
    }
    // Build bits
    while (rowEl.children.length > 1) rowEl.removeChild(rowEl.lastChild);
    sig.forEach((v, i) => {
      const span = document.createElement('span');
      span.className = 'td-bit';
      span.style.cssText = `width:22px;height:24px;display:inline-flex;align-items:center;justify-content:center;
        background:${v?color:'var(--bg-secondary)'};color:${v?'white':'var(--text-muted)'};
        border:1px solid var(--border);border-radius:3px;font-family:monospace;font-size:0.8rem;font-weight:700;cursor:pointer;`;
      span.textContent = v;
      span.addEventListener('click', () => {
        if (labelChar === 'A') sigA[i] ^= 1;
        else sigB[i] ^= 1;
        render();
      });
      rowEl.appendChild(span);
    });
  }

  function computeOutput() {
    const gate = GATE_DEFS[selectedGate];
    return Array.from({length: STEPS}, (_, i) => {
      if (gate.inputs === 1) return gate.fn(sigA[i]);
      return gate.fn(sigA[i], sigB[i]);
    });
  }

  function render() {
    const gate = GATE_DEFS[selectedGate];
    buildBitEditor(aRow, sigA, '#60a5fa', 'A');

    if (gate.inputs === 2) {
      document.getElementById('td-input-b').style.display = 'flex';
      buildBitEditor(bRow, sigB, '#34d399', 'B');
    } else {
      document.getElementById('td-input-b').style.display = 'none';
    }

    const out = computeOutput();
    const signals = gate.inputs === 2 ? [sigA, sigB, out] : [sigA, out];
    const labels  = gate.inputs === 2 ? ['A', 'B', 'F='+gate.label] : ['A', 'F='+gate.label];
    const colors  = gate.inputs === 2 ? ['#60a5fa','#34d399','#f59e0b'] : ['#60a5fa','#f59e0b'];

    drawWaveform('td-canvas', signals, labels, colors);
    updateBtnStyles();
  }

  document.getElementById('td-preset-alt').addEventListener('click', () => {
    sigA = Array.from({length: STEPS}, (_, i) => i % 2);
    sigB = Array.from({length: STEPS}, (_, i) => Math.floor(i/2) % 2);
    render();
  });
  document.getElementById('td-preset-same').addEventListener('click', () => {
    sigA = Array.from({length: STEPS}, (_, i) => i % 2);
    sigB = [...sigA];
    render();
  });
  document.getElementById('td-preset-opp').addEventListener('click', () => {
    sigA = Array.from({length: STEPS}, (_, i) => i % 2);
    sigB = sigA.map(v => 1-v);
    render();
  });

  // Resize canvas
  const resizeObs = new ResizeObserver(() => {
    const canvas = document.getElementById('td-canvas');
    if (!canvas) return;
    canvas.width = canvas.offsetWidth * devicePixelRatio || 560;
    render();
  });
  resizeObs.observe(container);

  render();
}
