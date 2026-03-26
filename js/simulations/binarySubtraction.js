// ─── 2진수 뺄셈 시뮬레이터 — A − B = A + (B의 2의 보수) 시각화 ───

export function mountBinarySubtraction(container) {
  container.innerHTML = `
    <div class="sim-controls" style="margin-bottom:14px;">
      <div class="sim-control-row">
        <span class="sim-label">피감수 A (10진)</span>
        <input type="number" id="bs-a" min="-128" max="127" value="45"
          style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
          color:var(--text-primary);padding:8px 14px;font-size:0.95rem;font-family:monospace;width:110px;" />
        <span class="sim-value" id="bs-a-bin" style="font-family:monospace;color:var(--accent-blue);">0010 1101</span>
      </div>
      <div class="sim-control-row">
        <span class="sim-label">감수 B (10진)</span>
        <input type="number" id="bs-b" min="-128" max="127" value="19"
          style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
          color:var(--text-primary);padding:8px 14px;font-size:0.95rem;font-family:monospace;width:110px;" />
        <span class="sim-value" id="bs-b-bin" style="font-family:monospace;color:var(--accent-green);">0001 0011</span>
      </div>
    </div>

    <div id="bs-steps" style="margin-bottom:10px;"></div>
    <div id="bs-display"></div>

    <div class="sim-info" style="margin-top:10px;">
      <div class="sim-info-item">
        <span class="sim-info-label">결과 (10진)</span>
        <span class="sim-info-val" id="bs-result-dec">-</span>
      </div>
      <div class="sim-info-item">
        <span class="sim-info-label">오버플로우</span>
        <span class="sim-info-val" id="bs-overflow">-</span>
      </div>
    </div>
    <div class="sim-warning" id="bs-warning">
      ⚠ 오버플로우 발생! 8비트 2의 보수 범위(−128~+127)를 벗어났습니다. 결과가 부정확합니다.
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
      <button class="unit-example-btn" data-a="45" data-b="19">45 − 19</button>
      <button class="unit-example-btn" data-a="74" data-b="83">74 − 83</button>
      <button class="unit-example-btn" data-a="-45" data-b="45">−45 − 45 (오버플로우)</button>
      <button class="unit-example-btn" data-a="127" data-b="-1">127 − (−1) (오버플로우)</button>
    </div>
  `;

  const inputA = document.getElementById('bs-a');
  const inputB = document.getElementById('bs-b');
  const aBinEl = document.getElementById('bs-a-bin');
  const bBinEl = document.getElementById('bs-b-bin');
  const stepsEl = document.getElementById('bs-steps');
  const display = document.getElementById('bs-display');
  const resultDec = document.getElementById('bs-result-dec');
  const overflowEl = document.getElementById('bs-overflow');
  const warningEl = document.getElementById('bs-warning');

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

  function renderBitRow(bits, color, highlightMask) {
    return bits.split('').map((b, i) => {
      const highlighted = highlightMask && highlightMask[i];
      const bg = b === '1'
        ? (highlighted ? 'var(--accent-yellow)' : color)
        : (highlighted ? 'rgba(255,200,0,0.15)' : 'var(--bg-tertiary)');
      return `<td style="
        width:28px;height:32px;text-align:center;vertical-align:middle;
        background:${bg};
        color:${b === '1' ? 'white' : (highlighted ? 'var(--accent-yellow)' : 'var(--text-muted)')};
        border:1px solid ${highlighted ? 'var(--accent-yellow)' : 'var(--border)'};border-radius:3px;
        font-family:monospace;font-size:0.88rem;font-weight:700;padding:0 2px;
      ">${b}</td>`;
    }).join('');
  }

  function buildBitTable(bits, color, highlightMask) {
    return `<table style="border-collapse:separate;border-spacing:2px;"><tr>${renderBitRow(bits, color, highlightMask)}</tr></table>`;
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

    // B의 1의 보수 (비트 반전)
    const bOnesComp = bBits.split('').map(bit => bit === '0' ? '1' : '0').join('');

    // 변경된 비트 마스크
    const flipMask = bBits.split('').map((bit, i) => bit !== bOnesComp[i]);

    // B의 2의 보수 (+1)
    let carry = 1;
    const bTwosCompArr = bOnesComp.split('').reverse().map(bit => {
      const sum = parseInt(bit) + carry;
      carry = Math.floor(sum / 2);
      return (sum % 2).toString();
    }).reverse();
    const bTwosComp = bTwosCompArr.join('');

    // 변경된 비트 마스크 (1의 보수 vs 2의 보수)
    const twosChangeMask = bOnesComp.split('').map((bit, i) => bit !== bTwosComp[i]);

    // A + B의 2의 보수 덧셈
    const carries = new Array(9).fill(0);
    const result = new Array(8).fill(0);
    for (let i = 7; i >= 0; i--) {
      const sum = parseInt(aBits[i]) + parseInt(bTwosComp[i]) + carries[i + 1];
      result[i] = sum % 2;
      carries[i] = Math.floor(sum / 2);
    }
    const resultBits = result.join('');
    const carryOut = carries[0];
    const carryIntoMSB = carries[1];
    const overflow = carryOut !== carryIntoMSB;

    let resultDecVal;
    if (resultBits[0] === '1') {
      resultDecVal = parseInt(resultBits, 2) - 256;
    } else {
      resultDecVal = parseInt(resultBits, 2);
    }

    // 3단계 변환 과정 렌더링
    stepsEl.innerHTML = `
      <div style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:14px 16px;overflow-x:auto;">
        <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">
          B의 2의 보수 변환 과정 (A − B = A + (−B))
        </div>
        <table style="border-collapse:separate;border-spacing:0 6px;">
          <tbody>
            <tr>
              <td style="padding-right:12px;font-size:0.78rem;color:var(--text-muted);white-space:nowrap;vertical-align:middle;">
                <span style="color:var(--accent-green);">① B = ${b}₁₀ (원래 값)</span>
              </td>
              <td>${buildBitTable(bBits, 'var(--accent-green)', null)}</td>
            </tr>
            <tr>
              <td style="padding-right:12px;font-size:0.78rem;color:var(--text-muted);white-space:nowrap;vertical-align:middle;">
                <span style="color:var(--accent-yellow);">② B의 1의 보수 (비트 반전)</span>
              </td>
              <td>${buildBitTable(bOnesComp, 'var(--accent-yellow)', flipMask)}</td>
            </tr>
            <tr>
              <td style="padding-right:12px;font-size:0.78rem;color:var(--text-muted);white-space:nowrap;vertical-align:middle;">
                <span style="color:var(--accent-purple);">③ B의 2의 보수 (+1) = −B</span>
              </td>
              <td>${buildBitTable(bTwosComp, 'var(--accent-purple)', twosChangeMask)}</td>
            </tr>
          </tbody>
        </table>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;">
          * 노란색 강조: 변경된 비트
        </div>
      </div>
    `;

    // 덧셈 캐리 테이블 렌더링
    const buildRow = (bits, color, label) => {
      const cells = bits.split('').map(b => renderCell(b, color)).join('');
      return `<tr>
        <td style="padding-right:10px;font-size:0.78rem;color:var(--text-muted);white-space:nowrap;vertical-align:middle;">${label}</td>
        <td colspan="8" style="padding:2px 0;">
          <table style="border-collapse:separate;border-spacing:2px;"><tr>${cells}</tr></table>
        </td>
      </tr>`;
    };

    const carryRow = carries.slice(1).map(c => {
      const isActive = c === 1;
      return `<td style="
        width:28px;height:22px;text-align:center;font-family:monospace;font-size:0.78rem;
        color:${isActive ? 'var(--accent-yellow)' : 'var(--text-muted)'};font-weight:${isActive ? '700' : '400'};
      ">${c}</td>`;
    }).join('');

    display.innerHTML = `
      <div style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:14px 16px;overflow-x:auto;margin-top:10px;">
        <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">
          ④ A + (B의 2의 보수) 덧셈
        </div>
        <table style="border-collapse:separate;border-spacing:0 4px;">
          <tbody>
            <tr>
              <td style="padding-right:10px;font-size:0.78rem;color:var(--accent-yellow);white-space:nowrap;">캐리 (C)</td>
              <td><table style="border-collapse:separate;border-spacing:2px;"><tr>${carryRow}</tr></table></td>
            </tr>
            ${buildRow(aBits, 'var(--accent-blue)', `A = ${a}₁₀`)}
            ${buildRow(bTwosComp, 'var(--accent-purple)', `−B = ${-b}₁₀`)}
            <tr><td colspan="9"><div style="border-top:2px solid var(--border);margin:4px 0;"></div></td></tr>
            ${buildRow(resultBits, overflow ? 'var(--accent-red)' : 'var(--accent-purple)', `결과 = ${resultDecVal}₁₀`)}
          </tbody>
        </table>
        ${carryOut ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:6px;">* 9번째 자리 올림(Carry out = 1) → 8비트 결과에서 버림</div>` : ''}
      </div>
    `;

    resultDec.textContent = `${a} − ${b} = ${resultDecVal}₁₀ (${resultBits}₂)`;
    overflowEl.textContent = overflow ? '발생 ✗' : '없음 ✓';
    overflowEl.style.color = overflow ? 'var(--accent-red)' : 'var(--accent-green)';
    warningEl.classList.toggle('visible', overflow);
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
