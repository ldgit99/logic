// ─── 부호 표현 시각화 — 절댓값 / 1의 보수 / 2의 보수 ───

function toBin8(n) {
  const abs = Math.abs(n);
  return abs.toString(2).padStart(8, '0');
}

function renderBitRow(label, bits, color, highlights = []) {
  const cells = bits.split('').map((b, i) => {
    const isSign = i === 0;
    const isHighlight = highlights.includes(i);
    let bg = b === '1' ? color : 'var(--bg-tertiary)';
    if (isSign && b === '1') bg = 'var(--accent-red)';
    if (isHighlight) bg = 'var(--accent-yellow)';
    return `<span style="
      width:26px;height:30px;display:inline-flex;align-items:center;justify-content:center;
      background:${bg};
      color:${b === '1' || isHighlight ? '#fff' : 'var(--text-muted)'};
      border-radius:3px;font-family:monospace;font-size:0.88rem;font-weight:700;
      border:1px solid ${isSign ? 'rgba(239,68,68,0.5)' : 'var(--border)'};
      ${i === 1 ? 'margin-left:6px;' : ''}
    ">${b}</span>`;
  }).join('');

  return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
    <span style="font-size:0.75rem;color:var(--text-muted);min-width:120px;font-weight:600;">${label}</span>
    <div style="display:flex;gap:2px;">${cells}</div>
  </div>`;
}

export function mountTwosComplement(container) {
  container.innerHTML = `
    <div class="sim-controls" style="margin-bottom:14px;">
      <div class="sim-control-row">
        <span class="sim-label">10진수 입력 (−128 ~ 127)</span>
        <input type="number" id="tc-input" min="-128" max="127" value="-45"
          style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
          color:var(--text-primary);padding:8px 14px;font-size:0.95rem;font-family:monospace;width:120px;" />
      </div>
    </div>

    <div id="tc-display"></div>

    <div class="sim-info" style="margin-top:10px;">
      <div class="sim-info-item">
        <span class="sim-info-label">부호 비트 (MSB)</span>
        <span class="sim-info-val" style="color:var(--accent-red);" id="tc-sign-info">-</span>
      </div>
      <div class="sim-info-item">
        <span class="sim-info-label">10진수 검증</span>
        <span class="sim-info-val" id="tc-verify">-</span>
      </div>
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
      <button class="unit-example-btn" data-val="-45">−45</button>
      <button class="unit-example-btn" data-val="83">+83</button>
      <button class="unit-example-btn" data-val="-128">−128 (최솟값)</button>
      <button class="unit-example-btn" data-val="127">+127 (최댓값)</button>
      <button class="unit-example-btn" data-val="-1">−1</button>
    </div>
  `;

  const input = document.getElementById('tc-input');
  const display = document.getElementById('tc-display');
  const signInfo = document.getElementById('tc-sign-info');
  const verifyEl = document.getElementById('tc-verify');

  function update() {
    let n = parseInt(input.value, 10);
    if (isNaN(n)) return;
    n = Math.max(-128, Math.min(127, n));

    const isNeg = n < 0;
    const abs = Math.abs(n);
    const absBits = abs.toString(2).padStart(8, '0');

    // 부호와 절댓값
    const signMag = (isNeg ? '1' : '0') + absBits.slice(1);

    // 1의 보수 (음수면 비트 반전, 양수면 그대로)
    let onesComp;
    if (isNeg) {
      onesComp = absBits.split('').map(b => b === '0' ? '1' : '0').join('');
    } else {
      onesComp = absBits;
    }

    // 2의 보수
    let twosComp;
    if (isNeg) {
      const raw = (256 - abs).toString(2).padStart(8, '0');
      twosComp = raw;
    } else {
      twosComp = absBits;
    }

    // 바뀐 비트 하이라이트 (1의 보수에서 2의 보수로)
    const highlights = [];
    if (isNeg) {
      // 오른쪽부터 첫 번째 1까지의 비트 위치 (2의 보수에서 바뀐 부분)
      let found = false;
      for (let i = 7; i >= 0; i--) {
        if (!found && twosComp[i] !== onesComp[i]) {
          highlights.push(i);
          found = true;
        }
      }
    }

    display.innerHTML = `
      <div style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:14px 16px;">
        <div style="font-size:0.7rem;font-weight:700;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.06em;">
          8비트 표현 (MSB = 부호 비트)
        </div>
        ${renderBitRow('부호와 절댓값', signMag, 'var(--accent-blue)')}
        ${renderBitRow('1의 보수', onesComp, 'var(--accent-green)')}
        ${renderBitRow('2의 보수', twosComp, 'var(--accent-purple)', highlights)}
        ${isNeg ? `
        <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">
          <span style="color:var(--accent-green);">1의 보수</span> (비트 전체 반전)
          → <span style="color:var(--accent-purple);">2의 보수</span> (+1 추가,
          <span style="color:var(--accent-yellow);">노란 비트</span>가 변경됨)
        </div>` : '<div style="font-size:0.78rem;color:var(--text-muted);margin-top:8px;">양수: 세 표현 모두 동일합니다.</div>'}
      </div>
    `;

    signInfo.textContent = isNeg ? '1 (음수)' : '0 (양수)';

    // 2의 보수 → 10진수 검증
    if (isNeg) {
      const verify = -((parseInt(twosComp, 2) ^ 0xFF) + 1);
      verifyEl.textContent = `2의 보수 ${twosComp}₂ = ${n}₁₀ ✓`;
    } else {
      verifyEl.textContent = `${twosComp}₂ = ${n}₁₀ ✓`;
    }
  }

  input.addEventListener('input', update);
  container.querySelectorAll('.unit-example-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      input.value = btn.dataset.val;
      update();
    });
  });

  update();
}
