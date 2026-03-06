// ─── 진법 변환기 — 10 / 2 / 8 / 16진수 실시간 변환 ───

function toBase(value, base) {
  if (isNaN(value) || value === '') return '';
  const n = parseInt(value, 10);
  if (isNaN(n)) return '';
  if (n < 0) return '-' + Math.abs(n).toString(base).toUpperCase();
  return n.toString(base).toUpperCase();
}

function buildSteps(decimal) {
  const n = parseInt(decimal, 10);
  if (isNaN(n) || n < 0 || n > 4095) return '';

  const steps2 = [];
  let val = n;
  if (val === 0) {
    steps2.push('0 ÷ 2 = 0 ... 나머지 0');
  } else {
    while (val > 0) {
      steps2.push(`${val} ÷ 2 = ${Math.floor(val / 2)} ... 나머지 ${val % 2}`);
      val = Math.floor(val / 2);
    }
  }
  const result2 = n.toString(2);
  return steps2.join('\n') + `\n↑ 역순으로 읽으면: ${result2}₂`;
}

export function mountBaseConverter(container) {
  container.innerHTML = `
    <div class="unit-converter">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div>
          <div style="font-size:0.75rem;font-weight:700;color:var(--accent-blue);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;">10진수 (Decimal)</div>
          <input type="number" id="bc-dec" min="0" max="65535" value="75"
            style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);padding:8px 12px;font-size:0.95rem;font-family:monospace;" />
        </div>
        <div>
          <div style="font-size:0.75rem;font-weight:700;color:var(--accent-green);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;">2진수 (Binary)</div>
          <input type="text" id="bc-bin" placeholder="0"
            style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--accent-green);padding:8px 12px;font-size:0.9rem;font-family:monospace;" />
        </div>
        <div>
          <div style="font-size:0.75rem;font-weight:700;color:var(--accent-yellow);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;">8진수 (Octal)</div>
          <input type="text" id="bc-oct" placeholder="0"
            style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--accent-yellow);padding:8px 12px;font-size:0.95rem;font-family:monospace;" />
        </div>
        <div>
          <div style="font-size:0.75rem;font-weight:700;color:var(--accent-purple);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;">16진수 (Hex)</div>
          <input type="text" id="bc-hex" placeholder="0"
            style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--accent-purple);padding:8px 12px;font-size:0.95rem;font-family:monospace;" />
        </div>
      </div>

      <!-- 비트 시각화 -->
      <div id="bc-bits" style="display:flex;gap:2px;flex-wrap:wrap;margin-bottom:10px;min-height:32px;"></div>

      <!-- 2진수 변환 단계 -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        <button class="unit-example-btn" data-val="75">75₁₀</button>
        <button class="unit-example-btn" data-val="255">255₁₀</button>
        <button class="unit-example-btn" data-val="3400">3400₁₀</button>
        <button class="unit-example-btn" data-val="45">45₁₀</button>
      </div>
      <div class="unit-result-box" id="bc-steps-box" style="display:none;">
        <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">10진수 → 2진수 변환 과정 (나눗셈법)</div>
        <div class="unit-result-steps" id="bc-steps"></div>
      </div>
    </div>
  `;

  const decInput = document.getElementById('bc-dec');
  const binInput = document.getElementById('bc-bin');
  const octInput = document.getElementById('bc-oct');
  const hexInput = document.getElementById('bc-hex');
  const bitsEl = document.getElementById('bc-bits');
  const stepsBox = document.getElementById('bc-steps-box');
  const stepsEl = document.getElementById('bc-steps');

  function updateBits(n) {
    if (isNaN(n) || n < 0) { bitsEl.innerHTML = ''; return; }
    const bits = n.toString(2).padStart(Math.max(8, Math.ceil(n.toString(2).length / 4) * 4), '0');
    bitsEl.innerHTML = bits.split('').map((b, i) => {
      const groupColor = Math.floor(i / 4) % 2 === 0 ? 'var(--accent-blue)' : 'var(--accent-purple)';
      return `<span style="
        width:22px;height:28px;display:inline-flex;align-items:center;justify-content:center;
        background:${b === '1' ? groupColor : 'var(--bg-tertiary)'};
        color:${b === '1' ? 'white' : 'var(--text-muted)'};
        border-radius:3px;font-family:monospace;font-size:0.85rem;font-weight:700;
        border:1px solid var(--border);
        ${i > 0 && i % 4 === 0 ? 'margin-left:6px;' : ''}
      ">${b}</span>`;
    }).join('');
  }

  function fromDec() {
    const n = parseInt(decInput.value, 10);
    if (isNaN(n) || n < 0) return;
    binInput.value = toBase(decInput.value, 2);
    octInput.value = toBase(decInput.value, 8);
    hexInput.value = toBase(decInput.value, 16);
    updateBits(n);
    if (n <= 4095) {
      stepsEl.textContent = buildSteps(decInput.value);
      stepsBox.style.display = 'block';
    } else {
      stepsBox.style.display = 'none';
    }
  }

  function fromBin() {
    const n = parseInt(binInput.value, 2);
    if (isNaN(n)) return;
    decInput.value = n;
    octInput.value = n.toString(8).toUpperCase();
    hexInput.value = n.toString(16).toUpperCase();
    updateBits(n);
    stepsBox.style.display = 'none';
  }

  function fromOct() {
    const n = parseInt(octInput.value, 8);
    if (isNaN(n)) return;
    decInput.value = n;
    binInput.value = n.toString(2);
    hexInput.value = n.toString(16).toUpperCase();
    updateBits(n);
    stepsBox.style.display = 'none';
  }

  function fromHex() {
    const n = parseInt(hexInput.value, 16);
    if (isNaN(n)) return;
    decInput.value = n;
    binInput.value = n.toString(2);
    octInput.value = n.toString(8).toUpperCase();
    updateBits(n);
    stepsBox.style.display = 'none';
  }

  decInput.addEventListener('input', fromDec);
  binInput.addEventListener('input', fromBin);
  octInput.addEventListener('input', fromOct);
  hexInput.addEventListener('input', fromHex);

  container.querySelectorAll('.unit-example-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      decInput.value = btn.dataset.val;
      fromDec();
    });
  });

  fromDec();
}
