// ─── IEEE 754 단정도 부동소수점 변환기 ───

function decToIEEE754(value) {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setFloat32(0, value, false); // big-endian
  const bits = Array.from(new Uint8Array(buf))
    .map(b => b.toString(2).padStart(8, '0'))
    .join('');
  return bits;
}

function ieee754ToInfo(bits) {
  const sign = bits[0];
  const expBits = bits.slice(1, 9);
  const mantBits = bits.slice(9, 32);
  const expVal = parseInt(expBits, 2);
  const actualExp = expVal - 127;
  const signNum = sign === '1' ? -1 : 1;

  let category;
  if (expVal === 0 && mantBits === '00000000000000000000000') category = 'zero';
  else if (expVal === 255 && mantBits === '00000000000000000000000') category = 'infinity';
  else if (expVal === 255) category = 'nan';
  else if (expVal === 0) category = 'denormal';
  else category = 'normal';

  return { sign, expBits, mantBits, expVal, actualExp, signNum, category };
}

function renderBitGroup(bits, color, label, tooltips = []) {
  const cells = bits.split('').map((b, i) => {
    const tip = tooltips[i] ? `title="${tooltips[i]}"` : '';
    return `<span ${tip} style="
      width:22px;height:28px;display:inline-flex;align-items:center;justify-content:center;
      background:${b === '1' ? color : 'var(--bg-tertiary)'};
      color:${b === '1' ? '#fff' : 'var(--text-muted)'};
      border:1px solid var(--border);border-radius:3px;
      font-family:monospace;font-size:0.78rem;font-weight:700;cursor:default;
    ">${b}</span>`;
  }).join('');
  return `<div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start;">
    <div style="font-size:0.68rem;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.06em;">${label}</div>
    <div style="display:flex;gap:2px;flex-wrap:wrap;">${cells}</div>
  </div>`;
}

export function mountIeee754(container) {
  container.innerHTML = `
    <div class="sim-controls" style="margin-bottom:14px;">
      <div class="sim-control-row">
        <span class="sim-label">10진수 입력</span>
        <input type="number" id="ieee-input" value="-0.2" step="any"
          style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
          color:var(--text-primary);padding:8px 14px;font-size:0.95rem;font-family:monospace;width:150px;" />
      </div>
    </div>

    <div id="ieee-display"></div>

    <div class="sim-info" style="margin-top:10px;" id="ieee-info"></div>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
      <button class="unit-example-btn" data-val="-0.2">−0.2</button>
      <button class="unit-example-btn" data-val="1.0">1.0</button>
      <button class="unit-example-btn" data-val="3.14">π ≈ 3.14</button>
      <button class="unit-example-btn" data-val="-83.0">−83</button>
      <button class="unit-example-btn" data-val="0.1">0.1 (무한소수)</button>
    </div>
  `;

  const input = document.getElementById('ieee-input');
  const display = document.getElementById('ieee-display');
  const infoEl = document.getElementById('ieee-info');

  function update() {
    const val = parseFloat(input.value);
    if (isNaN(val)) return;

    const bits = decToIEEE754(val);
    const { sign, expBits, mantBits, expVal, actualExp, signNum, category } = ieee754ToInfo(bits);

    // 비트 그룹 렌더링
    const signColor = sign === '1' ? 'var(--accent-red)' : 'var(--accent-green)';
    const signLabel = `부호 (S) — ${sign === '1' ? '음수' : '양수'}`;
    const expLabel = `지수부 (E) — 저장값: ${expVal} → 실제: ${expVal}−127 = ${actualExp}`;
    const mantLabel = `가수부 (M) — 정규화: 1.${mantBits}`;

    // 가수부 툴팁: 소수점 자릿값
    const mantTips = mantBits.split('').map((_, i) => `2^${-(i + 1)} = ${(Math.pow(2, -(i + 1))).toFixed(6)}`);

    display.innerHTML = `
      <div style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:16px;display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start;">
          ${renderBitGroup(sign, signColor, signLabel)}
          ${renderBitGroup(expBits, 'var(--accent-blue)', expLabel)}
          ${renderBitGroup(mantBits, 'var(--accent-purple)', mantLabel, mantTips)}
        </div>

        <div style="font-family:monospace;font-size:0.82rem;padding:10px 14px;
          background:var(--bg-card);border-radius:var(--radius-sm);border:1px solid var(--border);">
          <span style="color:${signColor};">${sign}</span>
          <span style="color:var(--accent-blue);"> ${expBits.slice(0,4)} ${expBits.slice(4)}</span>
          <span style="color:var(--accent-purple);"> ${mantBits.slice(0,4)} ${mantBits.slice(4,8)} ${mantBits.slice(8,12)} ${mantBits.slice(12,16)} ${mantBits.slice(16,20)} ${mantBits.slice(20)}</span>
          <span style="color:var(--text-muted);margin-left:12px;">= ${val}₁₀</span>
        </div>

        ${category === 'normal' ? `
        <div style="font-size:0.82rem;color:var(--text-secondary);line-height:1.8;">
          <strong style="color:var(--text-primary);">계산 검증:</strong><br>
          (−1)^<span style="color:${signColor};">${sign}</span>
          × 1.<span style="color:var(--accent-purple);">${mantBits}</span>₂
          × 2^<span style="color:var(--accent-blue);">${actualExp}</span>
          ≈ ${val}
        </div>` : `<div style="font-size:0.82rem;color:var(--accent-yellow);">특수값: ${category.toUpperCase()}</div>`}
      </div>
    `;

    infoEl.innerHTML = `
      <div class="sim-info-item">
        <span class="sim-info-label">부호</span>
        <span class="sim-info-val" style="color:${signColor};">${sign === '0' ? '+ (0)' : '− (1)'}</span>
      </div>
      <div class="sim-info-item">
        <span class="sim-info-label">지수 저장값</span>
        <span class="sim-info-val">${expVal} (= ${actualExp} + 127)</span>
      </div>
      <div class="sim-info-item">
        <span class="sim-info-label">실제 지수</span>
        <span class="sim-info-val">2^${actualExp}</span>
      </div>
    `;
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
