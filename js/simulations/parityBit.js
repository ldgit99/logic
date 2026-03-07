// ─── 패리티 비트 시뮬레이터 ───

export function mountParityBit(container) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <!-- 설정 -->
      <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end;">
        <div>
          <div style="font-size:0.72rem;color:var(--accent-blue);font-weight:700;margin-bottom:4px;text-transform:uppercase;">데이터 비트 (7비트)</div>
          <input type="text" id="pb-data" value="1001011" maxlength="7" pattern="[01]*"
            style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
            color:var(--accent-blue);padding:8px 14px;font-size:1rem;font-family:monospace;width:140px;" />
        </div>
        <div>
          <div style="font-size:0.72rem;color:var(--accent-green);font-weight:700;margin-bottom:4px;text-transform:uppercase;">패리티 방식</div>
          <select id="pb-type" style="background:var(--bg-tertiary);border:1px solid var(--border);
            border-radius:var(--radius-sm);color:var(--text-primary);padding:8px 12px;font-size:0.9rem;">
            <option value="even">짝수 패리티 (Even)</option>
            <option value="odd">홀수 패리티 (Odd)</option>
          </select>
        </div>
      </div>

      <!-- 패리티 결과 -->
      <div id="pb-result" style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:14px 16px;"></div>

      <!-- 에러 주입 -->
      <div id="pb-error-section" style="border-top:1px solid var(--border);padding-top:14px;">
        <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">
          에러 주입 시뮬레이션 (비트를 클릭해 반전)
        </div>
        <div id="pb-bits-clickable" style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px;"></div>
        <div id="pb-check-result" style="font-size:0.85rem;padding:10px 14px;border-radius:var(--radius-sm);"></div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="unit-example-btn" data-val="1001011">1001011</button>
        <button class="unit-example-btn" data-val="1101001">1101001</button>
        <button class="unit-example-btn" data-val="0110101">0110101</button>
      </div>
    </div>
  `;

  const dataInput = document.getElementById('pb-data');
  const typeSelect = document.getElementById('pb-type');
  const resultEl = document.getElementById('pb-result');
  const bitsEl = document.getElementById('pb-bits-clickable');
  const checkEl = document.getElementById('pb-check-result');

  let transmittedBits = [];

  function countOnes(bits) {
    return bits.split('').filter(b => b === '1').length;
  }

  function calcParityBit(data, type) {
    const ones = countOnes(data);
    if (type === 'even') return ones % 2 === 0 ? '0' : '1';
    else return ones % 2 === 1 ? '0' : '1';
  }

  function update() {
    const raw = dataInput.value.replace(/[^01]/g, '').slice(0, 7);
    dataInput.value = raw;
    if (!raw) return;

    const type = typeSelect.value;
    const pBit = calcParityBit(raw, type);
    const full = raw + pBit;
    transmittedBits = full.split('');

    const ones = countOnes(raw);
    const typeLabel = type === 'even' ? '짝수' : '홀수';
    const typeTgt = type === 'even' ? '짝수(짝수)' : '홀수(홀수)';

    // render result
    resultEl.innerHTML = `
      <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">
        패리티 비트 생성
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <span style="font-size:0.75rem;color:var(--text-muted);min-width:110px;">데이터 (7비트)</span>
        <div style="display:flex;gap:3px;">
          ${raw.split('').map(b => `<span style="width:28px;height:30px;display:inline-flex;align-items:center;justify-content:center;
            background:${b==='1'?'var(--accent-blue)':'var(--bg-secondary)'};
            color:${b==='1'?'white':'var(--text-muted)'};
            border:1px solid var(--border);border-radius:3px;font-family:monospace;font-size:0.88rem;font-weight:700;">${b}</span>`).join('')}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <span style="font-size:0.75rem;color:var(--text-muted);min-width:110px;">패리티 비트 (P)</span>
        <span style="width:28px;height:30px;display:inline-flex;align-items:center;justify-content:center;
          background:var(--accent-yellow);color:white;
          border:1px solid var(--accent-yellow);border-radius:3px;font-family:monospace;font-size:0.88rem;font-weight:700;">${pBit}</span>
        <span style="font-size:0.78rem;color:var(--text-secondary);">1의 개수=${ones} → ${typeLabel} ${type==='even'?'(1의 개수가 '+ones+'개이므로 P='+pBit+')':'(1의 개수가 '+ones+'개이므로 P='+pBit+')'}</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:0.75rem;color:var(--text-muted);min-width:110px;">전송 데이터 (8비트)</span>
        <div style="display:flex;gap:3px;">
          ${full.split('').map((b, i) => `<span style="width:28px;height:30px;display:inline-flex;align-items:center;justify-content:center;
            background:${i===7?'var(--accent-yellow)':b==='1'?'var(--accent-blue)':'var(--bg-secondary)'};
            color:${i===7||b==='1'?'white':'var(--text-muted)'};
            border:1px solid ${i===7?'var(--accent-yellow)':'var(--border)'};border-radius:3px;font-family:monospace;font-size:0.88rem;font-weight:700;">${b}</span>`).join('')}
        </div>
      </div>
      <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:6px;">
        총 1의 개수: ${countOnes(full)}개 → ${typeLabel} 패리티 ✓
      </div>
    `;

    renderClickableBits();
  }

  function renderClickableBits() {
    const type = typeSelect.value;
    bitsEl.innerHTML = transmittedBits.map((b, i) => {
      const isP = i === 7;
      return `<span data-idx="${i}" style="
        width:34px;height:36px;display:inline-flex;align-items:center;justify-content:center;
        background:${isP?'var(--accent-yellow)':b==='1'?'var(--accent-blue)':'var(--bg-secondary)'};
        color:${isP||b==='1'?'white':'var(--text-muted)'};
        border:2px solid ${isP?'var(--accent-yellow)':'var(--border)'};
        border-radius:4px;font-family:monospace;font-size:0.9rem;font-weight:700;
        cursor:pointer;user-select:none;transition:transform 0.1s;
        position:relative;
      " title="${isP?'패리티 비트':'비트 '+(i+1)}">${b}</span>`;
    }).join('') + `<span style="font-size:0.75rem;color:var(--text-muted);margin-left:8px;align-self:center;">← 클릭하여 비트 반전</span>`;

    bitsEl.querySelectorAll('span[data-idx]').forEach(span => {
      span.addEventListener('click', () => {
        const idx = parseInt(span.dataset.idx);
        transmittedBits[idx] = transmittedBits[idx] === '1' ? '0' : '1';
        renderClickableBits();
        checkParity();
      });
    });

    checkParity();
  }

  function checkParity() {
    const type = typeSelect.value;
    const str = transmittedBits.join('');
    const ones = countOnes(str);
    const isEvenOnes = ones % 2 === 0;
    const isOk = type === 'even' ? isEvenOnes : !isEvenOnes;

    if (isOk) {
      checkEl.style.background = 'rgba(16,185,129,0.12)';
      checkEl.style.border = '1px solid var(--accent-green)';
      checkEl.style.color = 'var(--accent-green)';
      checkEl.innerHTML = `✓ 에러 없음 — 수신된 8비트의 1의 개수: ${ones}개 (${type==='even'?'짝수':'홀수'} 패리티 OK)`;
    } else {
      checkEl.style.background = 'rgba(239,68,68,0.12)';
      checkEl.style.border = '1px solid var(--accent-red)';
      checkEl.style.color = 'var(--accent-red)';
      checkEl.innerHTML = `✗ 에러 감지! — 수신된 8비트의 1의 개수: ${ones}개 (${type==='even'?'짝수':'홀수'} 패리티 위반) ⚠ 단, 짝수 비트 에러는 감지 불가`;
    }
  }

  dataInput.addEventListener('input', update);
  typeSelect.addEventListener('change', update);
  container.querySelectorAll('.unit-example-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      dataInput.value = btn.dataset.val;
      update();
    });
  });

  update();
}
