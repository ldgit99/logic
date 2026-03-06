// ─── 2진수 덧셈 시뮬레이터 — 캐리 전파 시각화 ───

export function mountBinaryArithmetic(container) {
  container.innerHTML = `
    <div class="sim-controls" style="margin-bottom:14px;">
      <div class="sim-control-row">
        <span class="sim-label">피연산자 A (10진)</span>
        <input type="number" id="ba-a" min="-128" max="127" value="83"
          style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
          color:var(--text-primary);padding:8px 14px;font-size:0.95rem;font-family:monospace;width:110px;" />
        <span class="sim-value" id="ba-a-bin" style="font-family:monospace;color:var(--accent-blue);">0101 0011</span>
      </div>
      <div class="sim-control-row">
        <span class="sim-label">피연산자 B (10진)</span>
        <input type="number" id="ba-b" min="-128" max="127" value="74"
          style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
          color:var(--text-primary);padding:8px 14px;font-size:0.95rem;font-family:monospace;width:110px;" />
        <span class="sim-value" id="ba-b-bin" style="font-family:monospace;color:var(--accent-green);">0100 1010</span>
      </div>
    </div>

    <div id="ba-display"></div>

    <div class="sim-info" style="margin-top:10px;">
      <div class="sim-info-item">
        <span class="sim-info-label">결과 (10진)</span>
        <span class="sim-info-val" id="ba-result-dec">-</span>
      </div>
      <div class="sim-info-item">
        <span class="sim-info-label">오버플로우</span>
        <span class="sim-info-val" id="ba-overflow">-</span>
      </div>
    </div>
    <div class="sim-warning" id="ba-warning">
      ⚠ 오버플로우 발생! 8비트 2의 보수 범위(−128~+127)를 벗어났습니다. 결과가 부정확합니다.
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
      <button class="unit-example-btn" data-a="83" data-b="74">83 + 74 (오버플로우)</button>
      <button class="unit-example-btn" data-a="-98" data-b="-74">−98 + −74</button>
      <button class="unit-example-btn" data-a="45" data-b="-19">45 + (−19) = 45 − 19</button>
      <button class="unit-example-btn" data-a="100" data-b="27">100 + 27</button>
    </div>
  `;

  const inputA = document.getElementById('ba-a');
  const inputB = document.getElementById('ba-b');
  const aBinEl = document.getElementById('ba-a-bin');
  const bBinEl = document.getElementById('ba-b-bin');
  const display = document.getElementById('ba-display');
  const resultDec = document.getElementById('ba-result-dec');
  const overflowEl = document.getElementById('ba-overflow');
  const warningEl = document.getElementById('ba-warning');

  function to8bit(n) {
    n = ((n % 256) + 256) % 256;
    return n.toString(2).padStart(8, '0');
  }

  function formatBin(bits) {
    return bits.slice(0, 4) + ' ' + bits.slice(4);
  }

  function renderCell(val, color, extra = '') {
    return `<td style="
      width:28px;height:32px;text-align:center;vertical-align:middle;
      background:${val === '1' ? color : 'var(--bg-tertiary)'};
      color:${val === '1' ? 'white' : 'var(--text-muted)'};
      border:1px solid var(--border);border-radius:3px;
      font-family:monospace;font-size:0.88rem;font-weight:700;
      padding:0 2px;${extra}
    ">${val}</td>`;
  }

  function update() {
    let a = parseInt(inputA.value, 10);
    let b = parseInt(inputB.value, 10);
    if (isNaN(a) || isNaN(b)) return;

    a = Math.max(-128, Math.min(127, a));
    b = Math.max(-128, Math.min(127, b));

    const aBits = to8bit(a);
    const bBits = to8bit(b);

    aBinEl.textContent = formatBin(aBits);
    bBinEl.textContent = formatBin(bBits);

    // 비트 단위 덧셈 계산
    const carries = new Array(9).fill(0);
    const result = new Array(8).fill(0);
    for (let i = 7; i >= 0; i--) {
      const sum = parseInt(aBits[i]) + parseInt(bBits[i]) + carries[i + 1];
      result[i] = sum % 2;
      carries[i] = Math.floor(sum / 2);
    }
    const resultBits = result.join('');
    const carryOut = carries[0];
    const carryIntoMSB = carries[1];

    // 오버플로우: 마지막 두 캐리(MSB 입력 캐리 vs 출력 캐리)가 다를 때
    const overflow = carryOut !== carryIntoMSB;

    // 결과 10진수 (2의 보수 해석)
    let resultDecVal;
    if (resultBits[0] === '1') {
      resultDecVal = parseInt(resultBits, 2) - 256;
    } else {
      resultDecVal = parseInt(resultBits, 2);
    }

    // 렌더링
    const buildRow = (bits, color, label) => {
      const cells = bits.split('').map(b => renderCell(b, color)).join('');
      return `<tr>
        <td style="padding-right:10px;font-size:0.78rem;color:var(--text-muted);white-space:nowrap;vertical-align:middle;">${label}</td>
        <td colspan="8" style="padding:2px 0;">
          <table style="border-collapse:separate;border-spacing:2px;"><tr>${cells}</tr></table>
        </td>
      </tr>`;
    };

    const carryRow = carries.slice(1).map((c, i) => {
      const isActive = c === 1;
      return `<td style="
        width:28px;height:22px;text-align:center;font-family:monospace;font-size:0.78rem;
        color:${isActive ? 'var(--accent-yellow)' : 'var(--text-muted)'};font-weight:${isActive ? '700' : '400'};
      ">${c}</td>`;
    }).join('');

    display.innerHTML = `
      <div style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:14px 16px;overflow-x:auto;">
        <table style="border-collapse:separate;border-spacing:0 4px;">
          <tbody>
            <tr>
              <td style="padding-right:10px;font-size:0.78rem;color:var(--accent-yellow);white-space:nowrap;">캐리 (C)</td>
              <td><table style="border-collapse:separate;border-spacing:2px;"><tr>${carryRow}</tr></table></td>
            </tr>
            ${buildRow(aBits, 'var(--accent-blue)', `A = ${a}₁₀`)}
            ${buildRow(bBits, 'var(--accent-green)', `B = ${b}₁₀`)}
            <tr><td colspan="9"><div style="border-top:2px solid var(--border);margin:4px 0;"></div></td></tr>
            ${buildRow(resultBits, overflow ? 'var(--accent-red)' : 'var(--accent-purple)', `결과 = ${resultDecVal}₁₀`)}
          </tbody>
        </table>
        ${carryOut ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:6px;">* 9번째 자리 올림(Carry out = 1) → 8비트 결과에서 버림</div>` : ''}
      </div>
    `;

    resultDec.textContent = `${a} + ${b} = ${resultDecVal}₁₀ (${resultBits}₂)`;
    const isOverflow = overflow;
    overflowEl.textContent = isOverflow ? '발생 ✗' : '없음 ✓';
    overflowEl.style.color = isOverflow ? 'var(--accent-red)' : 'var(--accent-green)';
    warningEl.classList.toggle('visible', isOverflow);
  }

  inputA.addEventListener('input', update);
  inputB.addEventListener('input', update);

  container.querySelectorAll('.unit-example-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      inputA.value = btn.dataset.a;
      inputB.value = btn.dataset.b;
      update();
    });
  });

  update();
}
