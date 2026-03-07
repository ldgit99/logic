// ─── 해밍 코드 시뮬레이터 ───

export function mountHammingCode(container) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <!-- 입력 -->
      <div>
        <div style="font-size:0.72rem;color:var(--accent-blue);font-weight:700;margin-bottom:4px;text-transform:uppercase;">데이터 비트 (8비트)</div>
        <input type="text" id="hm-data" value="00101110" maxlength="8" pattern="[01]*"
          style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
          color:var(--accent-blue);padding:8px 14px;font-size:1rem;font-family:monospace;width:180px;" />
      </div>

      <!-- 해밍 코드 생성 -->
      <div id="hm-gen" style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:14px 16px;"></div>

      <!-- 에러 주입 -->
      <div style="border-top:1px solid var(--border);padding-top:14px;">
        <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">
          에러 주입 (비트를 클릭해 반전 → 에러 위치 자동 검출)
        </div>
        <div id="hm-bits" style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:10px;"></div>
        <div id="hm-check" style="font-size:0.85rem;padding:10px 14px;border-radius:var(--radius-sm);"></div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="unit-example-btn" data-val="00101110">00101110</button>
        <button class="unit-example-btn" data-val="11010011">11010011</button>
        <button class="unit-example-btn" data-val="10110101">10110101</button>
      </div>
    </div>
  `;

  const dataInput = document.getElementById('hm-data');
  const genEl = document.getElementById('hm-gen');
  const bitsEl = document.getElementById('hm-bits');
  const checkEl = document.getElementById('hm-check');

  let hammingBits = []; // 1-indexed [0] unused

  // 8비트 데이터 → 12비트 해밍코드 (짝수 패리티)
  // 위치: 1,2,3,4,5,6,7,8,9,10,11,12
  // 패리티 위치: 1,2,4,8
  // 데이터 위치: 3,5,6,7,9,10,11,12
  function buildHamming(data8) {
    // data8: 8-char string MSB first
    const n = 12;
    const h = new Array(n + 1).fill(0); // 1-indexed

    const dataPositions = [3,5,6,7,9,10,11,12];
    for (let i = 0; i < 8; i++) {
      h[dataPositions[i]] = parseInt(data8[i]);
    }

    // calc parity bits (even parity)
    for (const p of [1,2,4,8]) {
      let xor = 0;
      for (let i = 1; i <= n; i++) {
        if (i !== p && (i & p)) xor ^= h[i];
      }
      h[p] = xor;
    }
    return h;
  }

  function parityPositions(p, n) {
    const pos = [];
    for (let i = 1; i <= n; i++) {
      if (i & p) pos.push(i);
    }
    return pos;
  }

  function checkHamming(h, n) {
    let syndrome = 0;
    for (const p of [1,2,4,8]) {
      let xor = 0;
      for (let i = 1; i <= n; i++) {
        if (i & p) xor ^= h[i];
      }
      if (xor) syndrome += p;
    }
    return syndrome; // 0 = no error, else = error position
  }

  function update() {
    const raw = dataInput.value.replace(/[^01]/g, '').slice(0, 8);
    dataInput.value = raw;
    if (raw.length < 8) {
      genEl.innerHTML = '<span style="color:var(--text-muted);font-size:0.85rem;">8비트를 입력하세요</span>';
      return;
    }

    const h = buildHamming(raw);
    hammingBits = [...h]; // copy

    const dataPositions = new Set([3,5,6,7,9,10,11,12]);
    const parityPos = new Set([1,2,4,8]);

    // Show generation steps
    const stepRows = [1,2,4,8].map(p => {
      const involved = parityPositions(p, 12).filter(i => i !== p);
      const vals = involved.map(i => h[i]);
      const xorResult = vals.reduce((a, b) => a ^ b, 0);
      return `<div style="font-size:0.78rem;color:var(--text-secondary);margin-top:4px;">
        P${p} (위치${p}): 위치 [${involved.join(',')}]의 XOR = ${vals.join('⊕')} = <span style="color:var(--accent-yellow);font-weight:700;">${xorResult}</span>
      </div>`;
    }).join('');

    genEl.innerHTML = `
      <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">
        12비트 해밍 코드 생성 (8비트 데이터)
      </div>
      <div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:8px;">
        ${Array.from({length:12}, (_,i) => {
          const pos = i+1;
          const isP = parityPos.has(pos);
          const b = h[pos];
          return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
            <span style="font-size:0.6rem;color:${isP?'var(--accent-yellow)':'var(--accent-blue)'};font-weight:700;">${isP?'P'+pos:'D'}</span>
            <span style="width:28px;height:30px;display:inline-flex;align-items:center;justify-content:center;
              background:${isP?'var(--accent-yellow)':b?'var(--accent-blue)':'var(--bg-secondary)'};
              color:${isP||b?'white':'var(--text-muted)'};
              border:1px solid ${isP?'var(--accent-yellow)':'var(--border)'};border-radius:3px;
              font-family:monospace;font-size:0.88rem;font-weight:700;">${b}</span>
            <span style="font-size:0.6rem;color:var(--text-muted);">${pos}</span>
          </div>`;
        }).join('')}
      </div>
      ${stepRows}
      <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:8px;">
        노란색 = 패리티 비트 (P1,P2,P4,P8), 파란색 = 데이터 비트
      </div>
    `;

    renderClickableBits(dataPositions, parityPos);
  }

  function renderClickableBits(dataPositions, parityPos) {
    if (!dataPositions) {
      dataPositions = new Set([3,5,6,7,9,10,11,12]);
      parityPos = new Set([1,2,4,8]);
    }
    bitsEl.innerHTML = hammingBits.slice(1).map((b, i) => {
      const pos = i+1;
      const isP = parityPos.has(pos);
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
        <span style="font-size:0.6rem;color:${isP?'var(--accent-yellow)':'var(--accent-blue)'};font-weight:700;">${isP?'P'+pos:'D'}</span>
        <span data-pos="${pos}" style="width:32px;height:34px;display:inline-flex;align-items:center;justify-content:center;
          background:${isP?'var(--accent-yellow)':b?'var(--accent-blue)':'var(--bg-secondary)'};
          color:${isP||b?'white':'var(--text-muted)'};
          border:2px solid ${isP?'var(--accent-yellow)':'var(--border)'};border-radius:4px;
          font-family:monospace;font-size:0.88rem;font-weight:700;cursor:pointer;user-select:none;">${b}</span>
        <span style="font-size:0.6rem;color:var(--text-muted);">${pos}</span>
      </div>`;
    }).join('');

    bitsEl.querySelectorAll('span[data-pos]').forEach(span => {
      span.addEventListener('click', () => {
        const pos = parseInt(span.dataset.pos);
        hammingBits[pos] ^= 1;
        renderClickableBits();
        checkError();
      });
    });
    checkError();
  }

  function checkError() {
    const syndrome = checkHamming(hammingBits, 12);
    if (syndrome === 0) {
      checkEl.style.background = 'rgba(16,185,129,0.12)';
      checkEl.style.border = '1px solid var(--accent-green)';
      checkEl.style.color = 'var(--accent-green)';
      checkEl.innerHTML = `✓ 에러 없음 — 모든 패리티 비트 검사 통과 (신드롬 = 0000)`;
    } else {
      const synBin = syndrome.toString(2).padStart(4, '0');
      checkEl.style.background = 'rgba(239,68,68,0.12)';
      checkEl.style.border = '1px solid var(--accent-red)';
      checkEl.style.color = 'var(--accent-red)';
      checkEl.innerHTML = `✗ 에러 감지! — 신드롬 = ${synBin}₂ = <strong>${syndrome}</strong>₁₀ → <strong>위치 ${syndrome}번 비트</strong>에 에러 → 자동 정정: ${syndrome}번 비트 반전`;
    }
  }

  dataInput.addEventListener('input', update);
  container.querySelectorAll('.unit-example-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      dataInput.value = btn.dataset.val;
      update();
    });
  });

  update();
}
