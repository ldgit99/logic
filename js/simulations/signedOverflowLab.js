function toTwosCompBits(value, bits) {
  const mask = (1 << bits) - 1;
  return ((value & mask) >>> 0).toString(2).padStart(bits, '0');
}

function fromTwosCompBits(bin) {
  const bits = bin.length;
  const unsigned = parseInt(bin, 2);
  const signBit = 1 << (bits - 1);
  return (unsigned & signBit) ? unsigned - (1 << bits) : unsigned;
}

function addWithCarry(aBits, bBits) {
  const n = aBits.length;
  const carry = new Array(n + 1).fill(0);
  const out = new Array(n).fill('0');

  for (let i = n - 1; i >= 0; i--) {
    const sum = Number(aBits[i]) + Number(bBits[i]) + carry[i + 1];
    out[i] = String(sum & 1);
    carry[i] = (sum >> 1) & 1;
  }

  return { bits: out.join(''), carry, carryOut: carry[0], carryIntoMSB: carry[1] };
}

function signedRange(bits) {
  return { min: -(1 << (bits - 1)), max: (1 << (bits - 1)) - 1 };
}

export function mountSignedOverflowLab(container) {
  container.innerHTML = `
    <div class="sim-controls" style="margin-bottom:14px;">
      <div class="sim-control-row">
        <span class="sim-label">비트 폭</span>
        <input type="range" class="sim-slider" id="ov-bits" min="4" max="12" step="1" value="8" />
        <span class="sim-value" id="ov-bits-val">8 bit</span>
      </div>

      <div class="sim-control-row">
        <span class="sim-label">A (signed 10진수)</span>
        <input type="number" id="ov-a" value="83" style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);padding:8px 12px;font-size:0.92rem;font-family:monospace;width:120px;" />
        <span class="sim-value" id="ov-a-bin" style="font-family:monospace;">0101 0011</span>
      </div>

      <div class="sim-control-row">
        <span class="sim-label">B (signed 10진수)</span>
        <input type="number" id="ov-b" value="74" style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);padding:8px 12px;font-size:0.92rem;font-family:monospace;width:120px;" />
        <span class="sim-value" id="ov-b-bin" style="font-family:monospace;">0100 1010</span>
      </div>
    </div>

    <div class="sim-info" style="margin-bottom:10px;">
      <div class="sim-info-item"><span class="sim-info-label">허용 범위</span><span class="sim-info-val" id="ov-range">-128 ~ +127</span></div>
      <div class="sim-info-item"><span class="sim-info-label">결과</span><span class="sim-info-val" id="ov-result">157</span></div>
      <div class="sim-info-item"><span class="sim-info-label">Carry out</span><span class="sim-info-val" id="ov-cout">0</span></div>
      <div class="sim-info-item"><span class="sim-info-label">Signed Overflow</span><span class="sim-info-val" id="ov-overflow">없음</span></div>
    </div>

    <div id="ov-steps" style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:12px;"></div>

    <div class="sim-warning" id="ov-warning">
      오버플로우 발생: 동일 부호끼리 더했는데 결과 부호가 바뀌었습니다.
      (carry-in to MSB ≠ carry-out from MSB)
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
      <button class="unit-example-btn" data-bits="8" data-a="83" data-b="74">83 + 74 (오버플로우)</button>
      <button class="unit-example-btn" data-bits="8" data-a="45" data-b="-19">45 + (-19)</button>
      <button class="unit-example-btn" data-bits="8" data-a="-98" data-b="-74">-98 + -74 (오버플로우)</button>
      <button class="unit-example-btn" data-bits="6" data-a="20" data-b="9">6bit 예시</button>
    </div>
  `;

  const bitsEl = container.querySelector('#ov-bits');
  const bitsValEl = container.querySelector('#ov-bits-val');
  const aEl = container.querySelector('#ov-a');
  const bEl = container.querySelector('#ov-b');
  const aBinEl = container.querySelector('#ov-a-bin');
  const bBinEl = container.querySelector('#ov-b-bin');
  const rangeEl = container.querySelector('#ov-range');
  const resultEl = container.querySelector('#ov-result');
  const coutEl = container.querySelector('#ov-cout');
  const overflowEl = container.querySelector('#ov-overflow');
  const stepsEl = container.querySelector('#ov-steps');
  const warningEl = container.querySelector('#ov-warning');

  function groupBits(bin) {
    return bin.replace(/(.{4})/g, '$1 ').trim();
  }

  function clampInput(v, bits) {
    const { min, max } = signedRange(bits);
    return Math.max(min, Math.min(max, v));
  }

  function render() {
    const bits = Number(bitsEl.value);
    const range = signedRange(bits);

    bitsValEl.textContent = `${bits} bit`;
    rangeEl.textContent = `${range.min} ~ +${range.max}`;

    const a = clampInput(Number(aEl.value || 0), bits);
    const b = clampInput(Number(bEl.value || 0), bits);
    aEl.value = a;
    bEl.value = b;

    const aBits = toTwosCompBits(a, bits);
    const bBits = toTwosCompBits(b, bits);
    const sum = addWithCarry(aBits, bBits);
    const result = fromTwosCompBits(sum.bits);

    const aSign = aBits[0];
    const bSign = bBits[0];
    const rSign = sum.bits[0];
    const signedOverflow = (aSign === bSign) && (aSign !== rSign);

    aBinEl.textContent = groupBits(aBits);
    bBinEl.textContent = groupBits(bBits);

    resultEl.textContent = `${a} + ${b} = ${result}`;
    coutEl.textContent = String(sum.carryOut);
    overflowEl.textContent = signedOverflow ? '발생' : '없음';
    overflowEl.style.color = signedOverflow ? 'var(--accent-red)' : 'var(--accent-green)';
    warningEl.classList.toggle('visible', signedOverflow);

    const carryRow = sum.carry.slice(1).map((c) => c).join(' ');
    stepsEl.innerHTML = `
      <div style="font-size:0.83rem;color:var(--text-secondary);line-height:1.7;">
        <div><strong>A</strong> = ${groupBits(aBits)} (${a})</div>
        <div><strong>B</strong> = ${groupBits(bBits)} (${b})</div>
        <div><strong>Carry row</strong> = ${carryRow}</div>
        <div><strong>Sum</strong> = ${groupBits(sum.bits)} (${result})</div>
        <div style="margin-top:6px;">
          규칙: <code>signed overflow = (A와 B의 부호가 같고, 결과 부호가 다를 때)</code><br />
          보조판정: <code>carry into MSB (${sum.carryIntoMSB}) ≠ carry out (${sum.carryOut})</code>
        </div>
      </div>
    `;
  }

  bitsEl.addEventListener('input', render);
  aEl.addEventListener('input', render);
  bEl.addEventListener('input', render);

  container.querySelectorAll('.unit-example-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      bitsEl.value = btn.dataset.bits;
      aEl.value = btn.dataset.a;
      bEl.value = btn.dataset.b;
      render();
    });
  });

  render();
}
