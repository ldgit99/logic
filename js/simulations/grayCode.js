// ─── 그레이 코드 변환기 ───

function binToGray(bin) {
  const n = parseInt(bin, 2);
  return (n ^ (n >> 1)).toString(2).padStart(bin.length, '0');
}

function grayToBin(gray) {
  let n = parseInt(gray[0]);
  let result = gray[0];
  for (let i = 1; i < gray.length; i++) {
    n = n ^ parseInt(gray[i]);
    result += n;
  }
  return result;
}

function renderBitRow(bits, color, label, changedIdx = -1) {
  const cells = bits.split('').map((b, i) => {
    const isChanged = i === changedIdx;
    return `<span style="
      width:28px;height:30px;display:inline-flex;align-items:center;justify-content:center;
      background:${isChanged ? 'var(--accent-yellow)' : b === '1' ? color : 'var(--bg-tertiary)'};
      color:${isChanged || b === '1' ? 'white' : 'var(--text-muted)'};
      border:1px solid ${isChanged ? 'var(--accent-yellow)' : 'var(--border)'};
      border-radius:3px;font-family:monospace;font-size:0.88rem;font-weight:700;
    ">${b}</span>`;
  }).join('');
  return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
    <span style="font-size:0.75rem;color:var(--text-muted);min-width:110px;">${label}</span>
    <div style="display:flex;gap:3px;">${cells}</div>
  </div>`;
}

function diffBits(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return i;
  }
  return -1;
}

export function mountGrayCode(container) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <!-- 입력 -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <div>
          <div style="font-size:0.72rem;color:var(--accent-blue);font-weight:700;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;">2진수 입력</div>
          <input type="text" id="gc-bin" value="1011" maxlength="8" pattern="[01]*"
            placeholder="0~1 입력"
            style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
            color:var(--accent-blue);padding:8px 14px;font-size:1rem;font-family:monospace;width:140px;" />
        </div>
        <div>
          <div style="font-size:0.72rem;color:var(--accent-green);font-weight:700;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;">그레이 코드 입력</div>
          <input type="text" id="gc-gray" value="1110" maxlength="8" pattern="[01]*"
            placeholder="0~1 입력"
            style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
            color:var(--accent-green);padding:8px 14px;font-size:1rem;font-family:monospace;width:140px;" />
        </div>
      </div>

      <!-- 변환 결과 -->
      <div id="gc-display" style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:14px 16px;"></div>

      <!-- 0~15 대조표 -->
      <div style="border-top:1px solid var(--border);padding-top:14px;">
        <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;
          letter-spacing:0.05em;margin-bottom:8px;">0~15 2진수 vs 그레이 코드 비교 (노란색 = 변화된 비트)</div>
        <div id="gc-table" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:4px;"></div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="unit-example-btn" data-bin="1001">1001₂</button>
        <button class="unit-example-btn" data-bin="1100011">1100011₂</button>
        <button class="unit-example-btn" data-bin="1001010">1001010₂</button>
      </div>
    </div>
  `;

  const binInput = document.getElementById('gc-bin');
  const grayInput = document.getElementById('gc-gray');
  const display = document.getElementById('gc-display');
  const tableEl = document.getElementById('gc-table');

  function updateFromBin() {
    const bin = binInput.value.replace(/[^01]/g, '');
    if (!bin) return;
    binInput.value = bin;
    const gray = binToGray(bin);
    grayInput.value = gray;

    const decimal = parseInt(bin, 2);
    display.innerHTML = `
      <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">
        변환 결과 (10진수 = ${decimal}₁₀)
      </div>
      ${renderBitRow(bin, 'var(--accent-blue)', '2진수 (Binary)')}
      ${renderBitRow(gray, 'var(--accent-green)', '그레이 코드 (Gray)')}
      <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:8px;line-height:1.7;">
        변환 규칙: MSB 그대로 → 나머지는 자신과 왼쪽 비트의 XOR<br>
        ${bin.split('').map((b, i) => i === 0 ? `<span style="color:var(--accent-blue);">${b}</span>` : `<span style="color:var(--accent-blue);">${bin[i-1]}</span>⊕<span style="color:var(--accent-blue);">${b}</span>=<span style="color:var(--accent-green);">${gray[i]}</span>`).join(' → ')}
      </div>
    `;
    buildTable(decimal);
  }

  function updateFromGray() {
    const gray = grayInput.value.replace(/[^01]/g, '');
    if (!gray) return;
    grayInput.value = gray;
    const bin = grayToBin(gray);
    binInput.value = bin;
    const decimal = parseInt(bin, 2);
    display.innerHTML = `
      <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">
        변환 결과 (10진수 = ${decimal}₁₀)
      </div>
      ${renderBitRow(gray, 'var(--accent-green)', '그레이 코드 (Gray)')}
      ${renderBitRow(bin, 'var(--accent-blue)', '2진수 (Binary)')}
      <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:8px;line-height:1.7;">
        변환 규칙: MSB 그대로 → 나머지는 자신과 왼쪽 2진 비트의 XOR
      </div>
    `;
    buildTable(decimal);
  }

  function buildTable(highlight = -1) {
    tableEl.innerHTML = Array.from({ length: 16 }, (_, i) => {
      const bin = i.toString(2).padStart(4, '0');
      const gray = binToGray(bin);
      const prevBin = i > 0 ? (i - 1).toString(2).padStart(4, '0') : null;
      const prevGray = prevBin ? binToGray(prevBin) : null;
      const changed = prevGray ? diffBits(prevGray, gray) : -1;

      const isHighlight = i === highlight;
      const grayBits = gray.split('').map((b, j) => `<span style="
        font-weight:700;font-family:monospace;
        color:${j === changed ? 'var(--accent-yellow)' : b === '1' ? 'var(--accent-green)' : 'var(--text-muted)'};
      ">${b}</span>`).join('');

      return `<div style="
        display:flex;align-items:center;gap:8px;padding:3px 8px;border-radius:4px;
        background:${isHighlight ? 'rgba(37,99,235,0.15)' : 'transparent'};
        border:1px solid ${isHighlight ? 'var(--accent-blue)' : 'transparent'};
      ">
        <span style="font-size:0.72rem;color:var(--text-muted);min-width:18px;">${i}</span>
        <span style="font-family:monospace;font-size:0.82rem;color:var(--accent-blue);">${bin}</span>
        <span style="color:var(--text-muted);font-size:0.8rem;">→</span>
        <span style="font-family:monospace;font-size:0.82rem;">${grayBits}</span>
        ${changed >= 0 ? `<span style="font-size:0.68rem;color:var(--accent-yellow);">1비트↑</span>` : ''}
      </div>`;
    }).join('');
  }

  binInput.addEventListener('input', updateFromBin);
  grayInput.addEventListener('input', updateFromGray);

  container.querySelectorAll('.unit-example-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      binInput.value = btn.dataset.bin;
      updateFromBin();
    });
  });

  updateFromBin();
}
