// ─── SI / IEC 단위 변환기 ───

const UNITS = {
  SI: {
    label: 'SI (십진, 저장장치 표기)',
    levels: [
      { name: 'B',  factor: 1n },
      { name: 'kB', factor: 1000n },
      { name: 'MB', factor: 1000n ** 2n },
      { name: 'GB', factor: 1000n ** 3n },
      { name: 'TB', factor: 1000n ** 4n },
    ],
  },
  IEC: {
    label: 'IEC (이진, OS/메모리 표기)',
    levels: [
      { name: 'B',   factor: 1n },
      { name: 'KiB', factor: 1024n },
      { name: 'MiB', factor: 1024n ** 2n },
      { name: 'GiB', factor: 1024n ** 3n },
      { name: 'TiB', factor: 1024n ** 4n },
    ],
  },
};

function convert(value, fromSystem, fromUnit, toSystem, toUnit) {
  const fromFactor = UNITS[fromSystem].levels.find(u => u.name === fromUnit)?.factor ?? 1n;
  const toFactor = UNITS[toSystem].levels.find(u => u.name === toUnit)?.factor ?? 1n;

  // BigInt로 바이트 환산 후 부동소수점으로 결과 계산
  const bytes = BigInt(Math.round(value)) * fromFactor;
  const result = Number(bytes) / Number(toFactor);
  return result;
}

function buildSteps(value, fromSystem, fromUnit, toSystem, toUnit) {
  const fromFactor = UNITS[fromSystem].levels.find(u => u.name === fromUnit)?.factor;
  const toFactor = UNITS[toSystem].levels.find(u => u.name === toUnit)?.factor;
  if (!fromFactor || !toFactor) return '';

  const bytes = BigInt(Math.round(value)) * fromFactor;
  const toFactorNum = Number(toFactor);
  const result = Number(bytes) / toFactorNum;

  const fromBase = fromSystem === 'SI' ? '10 기반' : '2 기반';
  const toBase = toSystem === 'SI' ? '10 기반' : '2 기반';

  return [
    `① ${value} ${fromUnit} → 바이트 환산: ${value} × ${fromFactor.toLocaleString()} = ${Number(bytes).toLocaleString()} B`,
    `② ${toFactorNum.toLocaleString()} B = 1 ${toUnit} (${toBase})`,
    `③ ${Number(bytes).toLocaleString()} ÷ ${toFactorNum.toLocaleString()} ≈ ${result.toFixed(4)} ${toUnit}`,
  ].join('\n');
}

export function mountUnitConverter(container) {
  const siOptions = UNITS.SI.levels.map(u => `<option value="${u.name}">${u.name}</option>`).join('');
  const iecOptions = UNITS.IEC.levels.map(u => `<option value="${u.name}">${u.name}</option>`).join('');

  container.innerHTML = `
    <div class="unit-converter">
      <div class="unit-input-row">
        <input type="number" id="uc-value" value="1" min="0" step="any" style="max-width:120px;" />
        <select id="uc-from-unit">${siOptions}${iecOptions}</select>
        <span style="color:var(--text-muted);font-size:0.9rem;">→</span>
        <select id="uc-to-unit">${iecOptions}${siOptions}</select>
      </div>

      <div class="unit-result-box">
        <div class="unit-result-main" id="uc-result-main">계산 결과</div>
        <div class="unit-result-steps" id="uc-result-steps"></div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="unit-example-btn" data-example="ssd">
          📦 1TB SSD → Windows 표시
        </button>
        <button class="unit-example-btn" data-example="ram">
          🖥 8GiB RAM → GB 환산
        </button>
        <button class="unit-example-btn" data-example="bit256">
          🔢 256B → KiB 환산
        </button>
      </div>
    </div>
  `;

  const valueInput = document.getElementById('uc-value');
  const fromSelect = document.getElementById('uc-from-unit');
  const toSelect = document.getElementById('uc-to-unit');
  const resultMain = document.getElementById('uc-result-main');
  const resultSteps = document.getElementById('uc-result-steps');

  // from/to select에 system 정보 포함한 옵션 재구성
  function rebuildSelects() {
    const allOptions = [
      ...UNITS.SI.levels.map(u => ({ system: 'SI', name: u.name, label: `${u.name} (SI)` })),
      ...UNITS.IEC.levels.map(u => ({ system: 'IEC', name: u.name, label: `${u.name} (IEC)` })),
    ];

    [fromSelect, toSelect].forEach(sel => {
      const prev = sel.value;
      sel.innerHTML = allOptions.map(o =>
        `<option value="${o.system}:${o.name}">${o.label}</option>`
      ).join('');
      const match = allOptions.find(o => o.label.startsWith(prev.split(':')[1] || ''));
      if (match) sel.value = `${match.system}:${match.name}`;
    });
  }

  rebuildSelects();
  fromSelect.value = 'SI:TB';
  toSelect.value = 'IEC:GiB';

  function parseSelect(sel) {
    const [sys, unit] = sel.value.split(':');
    return { system: sys, unit };
  }

  function calculate() {
    const val = parseFloat(valueInput.value);
    if (isNaN(val) || val < 0) { resultMain.textContent = '유효한 값을 입력하세요'; return; }

    const from = parseSelect(fromSelect);
    const to = parseSelect(toSelect);

    const result = convert(val, from.system, from.unit, to.system, to.unit);
    const formatted = result >= 1000
      ? result.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
      : result.toPrecision(6).replace(/\.?0+$/, '');

    resultMain.textContent = `${val} ${from.unit} ≈ ${formatted} ${to.unit}`;
    resultSteps.textContent = buildSteps(val, from.system, from.unit, to.system, to.unit);
  }

  valueInput.addEventListener('input', calculate);
  fromSelect.addEventListener('change', calculate);
  toSelect.addEventListener('change', calculate);

  // 예제 버튼
  container.querySelectorAll('.unit-example-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ex = btn.dataset.example;
      if (ex === 'ssd') {
        valueInput.value = '1';
        fromSelect.value = 'SI:TB';
        toSelect.value = 'IEC:GiB';
      } else if (ex === 'ram') {
        valueInput.value = '8';
        fromSelect.value = 'IEC:GiB';
        toSelect.value = 'SI:GB';
      } else if (ex === 'bit256') {
        valueInput.value = '256';
        fromSelect.value = 'SI:B';
        toSelect.value = 'IEC:KiB';
      }
      calculate();
    });
  });

  calculate();
}
