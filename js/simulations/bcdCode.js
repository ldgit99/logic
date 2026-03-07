// ─── BCD 코드 변환기 + 덧셈 6보정 시각화 ───

function toBCD(decimal) {
  if (decimal < 0 || decimal > 9999) return null;
  return String(decimal).split('').map(d => parseInt(d).toString(2).padStart(4, '0')).join(' ');
}

function renderBCDDigit(digit, label, isInvalid = false) {
  const bits = digit.toString(2).padStart(4, '0');
  const cells = bits.split('').map((b, i) => {
    const weights = ['8', '4', '2', '1'];
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
      <span style="font-size:0.62rem;color:var(--text-muted);">${weights[i]}</span>
      <span style="
        width:26px;height:28px;display:flex;align-items:center;justify-content:center;
        background:${b === '1' ? (isInvalid ? 'var(--accent-red)' : 'var(--accent-blue)') : 'var(--bg-tertiary)'};
        color:${b === '1' ? 'white' : 'var(--text-muted)'};
        border:1px solid ${isInvalid ? 'rgba(239,68,68,0.4)' : 'var(--border)'};
        border-radius:3px;font-family:monospace;font-size:0.85rem;font-weight:700;
      ">${b}</span>
    </div>`;
  }).join('');
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
    <div style="display:flex;gap:3px;">${cells}</div>
    <span style="font-size:0.72rem;color:${isInvalid ? 'var(--accent-red)' : 'var(--text-secondary)'};">
      ${isInvalid ? '⚠ 무효' : `${digit}₁₀`} = ${bits}
    </span>
    ${label ? `<span style="font-size:0.7rem;color:var(--text-muted);">${label}</span>` : ''}
  </div>`;
}

export function mountBcdCode(container) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <!-- 변환기 -->
      <div class="sim-control-row">
        <span class="sim-label">10진수 (0~9999)</span>
        <input type="number" id="bcd-input" min="0" max="9999" value="96"
          style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
          color:var(--text-primary);padding:8px 14px;font-size:0.95rem;font-family:monospace;width:120px;" />
      </div>

      <div id="bcd-display" style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:14px 16px;"></div>

      <!-- 덧셈 섹션 -->
      <div style="border-top:1px solid var(--border);padding-top:14px;">
        <div style="font-size:0.78rem;font-weight:700;color:var(--accent-yellow);text-transform:uppercase;
          letter-spacing:0.05em;margin-bottom:10px;">BCD 덧셈 — 9 초과 시 6(0110) 보정</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
          <div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px;">피연산자 A</div>
            <input type="number" id="bcd-add-a" min="0" max="99" value="96"
              style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
              color:var(--text-primary);padding:6px 10px;font-size:0.9rem;font-family:monospace;width:90px;" />
          </div>
          <div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px;">피연산자 B</div>
            <input type="number" id="bcd-add-b" min="0" max="99" value="57"
              style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
              color:var(--text-primary);padding:6px 10px;font-size:0.9rem;font-family:monospace;width:90px;" />
          </div>
        </div>
        <div id="bcd-add-display" style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:14px;"></div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="unit-example-btn" data-val="38">38</button>
        <button class="unit-example-btn" data-val="96">96</button>
        <button class="unit-example-btn" data-val="153">153</button>
        <button class="unit-example-btn" data-val="2024">2024</button>
      </div>
    </div>
  `;

  const input = document.getElementById('bcd-input');
  const display = document.getElementById('bcd-display');
  const addA = document.getElementById('bcd-add-a');
  const addB = document.getElementById('bcd-add-b');
  const addDisplay = document.getElementById('bcd-add-display');

  function updateDisplay() {
    const n = parseInt(input.value, 10);
    if (isNaN(n) || n < 0 || n > 9999) { display.innerHTML = '<span style="color:var(--accent-red)">0~9999 범위로 입력하세요</span>'; return; }
    const digits = String(n).split('').map(Number);
    const digitHtml = digits.map(d => renderBCDDigit(d, `${n}의 자릿수`)).join(
      '<span style="color:var(--text-muted);font-size:1.2rem;margin:0 8px;align-self:center;">|</span>'
    );
    display.innerHTML = `
      <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">
        ${n}₁₀ = BCD: ${toBCD(n)}
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start;">${digitHtml}</div>
      <div style="margin-top:10px;font-size:0.78rem;color:var(--text-secondary);">
        무효 코드(1010~1111): <span style="color:var(--accent-red);">사용하지 않음</span>
      </div>
    `;
  }

  function updateAddition() {
    const a = parseInt(addA.value, 10);
    const b = parseInt(addB.value, 10);
    if (isNaN(a) || isNaN(b) || a < 0 || a > 99 || b < 0 || b > 99) return;

    const result = a + b;
    const aHigh = Math.floor(a / 10), aLow = a % 10;
    const bHigh = Math.floor(b / 10), bLow = b % 10;

    // BCD 덧셈
    const aRaw = (aHigh << 4) | aLow;
    const bRaw = (bHigh << 4) | bLow;
    let rawSum = aRaw + bRaw;
    const rawHigh = (rawSum >> 4) & 0xF;
    const rawLow = rawSum & 0xF;

    const needCorrectLow = rawLow > 9;
    const needCorrectHigh = rawHigh > 9 || rawSum > 0xFF;

    const corrected = rawSum + (needCorrectLow ? 0x06 : 0) + (needCorrectHigh ? 0x60 : 0);

    const rows = [
      { label: `A = ${a}₁₀`, bits: aRaw.toString(2).padStart(8, '0'), color: 'var(--accent-blue)' },
      { label: `B = ${b}₁₀`, bits: bRaw.toString(2).padStart(8, '0'), color: 'var(--accent-green)' },
    ];

    const renderRow = ({ label, bits, color }) => {
      const cells = bits.split('').map((b, i) => `
        <span style="
          width:22px;height:26px;display:inline-flex;align-items:center;justify-content:center;
          background:${b === '1' ? color : 'var(--bg-card)'};
          color:${b === '1' ? 'white' : 'var(--text-muted)'};
          border:1px solid var(--border);border-radius:3px;
          font-family:monospace;font-size:0.82rem;font-weight:700;
          ${i === 4 ? 'margin-left:6px;' : ''}
        ">${b}</span>`).join('');
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
        <span style="font-size:0.75rem;color:var(--text-muted);min-width:90px;">${label}</span>
        <div style="display:flex;gap:2px;">${cells}</div>
      </div>`;
    };

    const sumBits = rawSum.toString(2).padStart(8, '0');
    const corrBits = (corrected & 0xFF).toString(2).padStart(8, '0');

    addDisplay.innerHTML = `
      ${rows.map(renderRow).join('')}
      <div style="border-top:1px solid var(--border);margin:6px 0 6px 100px;"></div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
        <span style="font-size:0.75rem;color:var(--text-muted);min-width:90px;">합계 (BCD 전)</span>
        <div style="display:flex;gap:2px;">${sumBits.split('').map((b, i) => {
          const isInv = (i < 4 && rawHigh > 9) || (i >= 4 && rawLow > 9);
          return `<span style="width:22px;height:26px;display:inline-flex;align-items:center;justify-content:center;
            background:${b === '1' ? (isInv ? 'var(--accent-red)' : 'var(--accent-purple)') : 'var(--bg-card)'};
            color:${b === '1' ? 'white' : 'var(--text-muted)'};border:1px solid var(--border);border-radius:3px;
            font-family:monospace;font-size:0.82rem;font-weight:700;${i === 4 ? 'margin-left:6px;' : ''}">${b}</span>`;
        }).join('')}</div>
        ${(needCorrectLow || needCorrectHigh) ? `<span style="font-size:0.72rem;color:var(--accent-red);">← 무효 자리 존재!</span>` : ''}
      </div>
      ${(needCorrectLow || needCorrectHigh) ? `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
        <span style="font-size:0.75rem;color:var(--accent-yellow);min-width:90px;">+ 6 보정</span>
        <span style="font-size:0.82rem;font-family:monospace;color:var(--accent-yellow);">
          ${needCorrectHigh ? '+0110' : '+0000'} ${needCorrectLow ? '+0110' : '+0000'}
        </span>
      </div>
      <div style="border-top:1px dashed var(--accent-yellow);margin:4px 0 4px 100px;"></div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:0.75rem;color:var(--accent-green);min-width:90px;">보정 결과</span>
        <div style="display:flex;gap:2px;">${corrBits.split('').map((b, i) => `
          <span style="width:22px;height:26px;display:inline-flex;align-items:center;justify-content:center;
            background:${b === '1' ? 'var(--accent-green)' : 'var(--bg-card)'};
            color:${b === '1' ? 'white' : 'var(--text-muted)'};border:1px solid var(--border);border-radius:3px;
            font-family:monospace;font-size:0.82rem;font-weight:700;${i === 4 ? 'margin-left:6px;' : ''}">${b}</span>`).join('')}</div>
        <span style="font-size:0.78rem;color:var(--accent-green);">= ${result}₁₀ ✓</span>
      </div>` : `
      <div style="font-size:0.78rem;color:var(--accent-green);margin-top:4px;">
        ✓ 보정 불필요 — ${result}₁₀ (모든 자리가 0~9 범위)
      </div>`}
    `;
  }

  input.addEventListener('input', updateDisplay);
  addA.addEventListener('input', updateAddition);
  addB.addEventListener('input', updateAddition);
  container.querySelectorAll('.unit-example-btn').forEach(btn => {
    btn.addEventListener('click', () => { input.value = btn.dataset.val; updateDisplay(); });
  });

  updateDisplay();
  updateAddition();
}
