// ─── 카운터 인터랙티브 시뮬레이터 ───

export function mountCounterSim(container) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${['비동기 2진','동기 2진','BCD(0-9)','업/다운'].map((t,i)=>
          `<button class="unit-example-btn cnt-tab" data-tab="${i}" style="${i===0?'background:var(--accent-blue);color:white;':''}">${t}</button>`
        ).join('')}
      </div>
      <div id="cnt-content"></div>
    </div>
  `;

  let activeTab = 0;

  function render() {
    const el = document.getElementById('cnt-content');
    if (activeTab === 0) renderRipple(el);
    else if (activeTab === 1) renderSync(el);
    else if (activeTab === 2) renderBCD(el);
    else renderUpDown(el);
  }

  function drawCounter(el, bits, count, maxCount, options = {}) {
    const { mode = 'up', clkHistory = [] } = options;
    const pct = (count / (maxCount)) * 100;

    return `
      <!-- 카운터 표시 -->
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
        <!-- 비트 표시 -->
        <div style="display:flex;gap:6px;">
          ${[...Array(bits)].map((_,i) => {
            const bitPos = bits - 1 - i;
            const val = (count >> bitPos) & 1;
            return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
              <span style="font-size:0.65rem;color:var(--text-muted);font-family:monospace;">Q${bitPos}</span>
              <div style="width:38px;height:38px;border-radius:6px;background:${val?'var(--accent-blue)':'var(--bg-tertiary)'};border:2px solid ${val?'var(--accent-blue)':'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:700;color:${val?'white':'var(--text-muted)'};">${val}</div>
            </div>`;
          }).join('')}
        </div>
        <!-- 10진 / 진행바 -->
        <div style="display:flex;flex-direction:column;gap:6px;min-width:100px;">
          <div style="font-size:1.8rem;font-weight:700;font-family:monospace;color:var(--accent-green);">${count}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);">10진수 / ${maxCount-1} 최대</div>
          <div style="height:8px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden;width:100px;">
            <div style="height:100%;width:${pct}%;background:var(--accent-blue);transition:width 0.2s;border-radius:4px;"></div>
          </div>
        </div>
        <!-- 16진 -->
        <div style="font-family:monospace;font-size:1.1rem;color:var(--accent-purple);">0x${count.toString(16).toUpperCase()}</div>
      </div>
    `;
  }

  // ── 비동기 리플 카운터 ──
  function renderRipple(el) {
    let count = 0, clkHistory = [];
    const BITS = 4, MAX = 16;

    function clock() {
      count = (count + 1) % MAX;
      clkHistory.push(count);
      if (clkHistory.length > 18) clkHistory.shift();
      draw();
    }
    function reset() { count = 0; clkHistory = []; draw(); }

    function draw() {
      el.innerHTML = `
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;margin-bottom:8px;text-transform:uppercase;">4비트 비동기 리플 카운터 (Mod-16)</div>
        ${drawCounter(el, BITS, count, MAX)}

        <!-- 플립플롭 구조 설명 -->
        <div style="margin-top:10px;background:var(--bg-tertiary);border-radius:4px;padding:10px;font-size:0.78rem;color:var(--text-muted);">
          <span style="color:var(--accent-blue);font-weight:700;">구조:</span> T=1인 JK FF 4개를 직렬 연결.
          FF0의 출력 Q0가 FF1의 CLK, Q1→FF2의 CLK, Q2→FF3의 CLK.
          <br><span style="color:var(--accent-red);">단점:</span> 각 FF가 차례로 트리거되어 지연(ripple delay) 발생 → 높은 주파수에서 오동작 가능
        </div>

        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="unit-example-btn" id="ripple-clk" style="background:var(--accent-blue);color:white;">CLK ↑ 펄스</button>
          <button class="unit-example-btn" id="ripple-auto" style="background:var(--accent-green);color:white;">자동 ▶</button>
          <button class="unit-example-btn" id="ripple-reset">리셋</button>
        </div>

        ${clkHistory.length > 1 ? `
        <div style="margin-top:8px;font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:4px;">카운팅 이력</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;">
          ${clkHistory.map(c => `<span style="font-family:monospace;font-size:0.78rem;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:3px;padding:1px 6px;color:${c===count?'var(--accent-blue)':'var(--text-muted)'};">${c}</span>`).join('')}
        </div>` : ''}
      `;

      let autoTimer = null;
      document.getElementById('ripple-clk').addEventListener('click', clock);
      document.getElementById('ripple-reset').addEventListener('click', reset);
      const autoBtn = document.getElementById('ripple-auto');
      autoBtn.addEventListener('click', () => {
        if (autoTimer) { clearInterval(autoTimer); autoTimer = null; autoBtn.textContent = '자동 ▶'; autoBtn.style.background = 'var(--accent-green)'; }
        else { autoBtn.textContent = '정지 ■'; autoBtn.style.background = 'var(--accent-red)'; autoTimer = setInterval(clock, 500); }
      });
    }
    draw();
  }

  // ── 동기 카운터 ──
  function renderSync(el) {
    let count = 0, clkHistory = [];
    const BITS = 4, MAX = 16;

    function clock() {
      count = (count + 1) % MAX;
      clkHistory.push(count);
      if (clkHistory.length > 18) clkHistory.shift();
      draw();
    }
    function reset() { count = 0; clkHistory = []; draw(); }

    function draw() {
      const bits = [...Array(BITS)].map((_,i) => (count >> (BITS-1-i)) & 1);
      // JK excitation table for sync counter
      const nextCount = (count + 1) % MAX;
      const nextBits = [...Array(BITS)].map((_,i) => (nextCount >> (BITS-1-i)) & 1);

      el.innerHTML = `
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;margin-bottom:8px;text-transform:uppercase;">4비트 동기 2진 카운터 (Mod-16)</div>
        ${drawCounter(el, BITS, count, MAX)}

        <!-- JK 여기 테이블 -->
        <div style="margin-top:10px;overflow-x:auto;">
          <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:4px;">현재 → 다음 상태 (JK 여기)</div>
          <table style="border-collapse:collapse;font-family:monospace;font-size:0.78rem;">
            <thead><tr style="background:var(--bg-secondary);">
              ${['Q3','Q2','Q1','Q0'].map(q=>`<th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-blue);">${q}</th>`).join('')}
              <th style="padding:3px 8px;border:1px solid var(--border);color:var(--border);">→</th>
              ${['Q3+','Q2+','Q1+','Q0+'].map(q=>`<th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-green);">${q}</th>`).join('')}
            </tr></thead>
            <tbody>
              <tr>
                ${bits.map(b=>`<td style="text-align:center;padding:3px 8px;border:1px solid var(--border);color:var(--accent-blue);">${b}</td>`).join('')}
                <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);color:var(--text-muted);">→</td>
                ${nextBits.map(b=>`<td style="text-align:center;padding:3px 8px;border:1px solid var(--border);color:var(--accent-green);">${b}</td>`).join('')}
              </tr>
            </tbody>
          </table>
        </div>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:6px;">
          <span style="color:var(--accent-blue);font-weight:700;">장점:</span> 모든 FF이 동시에 CLK를 받음 → 리플 지연 없음, 고속 동작 가능
        </div>

        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="unit-example-btn" id="sync-clk" style="background:var(--accent-blue);color:white;">CLK ↑ 펄스</button>
          <button class="unit-example-btn" id="sync-auto" style="background:var(--accent-green);color:white;">자동 ▶</button>
          <button class="unit-example-btn" id="sync-reset">리셋</button>
        </div>
      `;

      let autoTimer = null;
      document.getElementById('sync-clk').addEventListener('click', clock);
      document.getElementById('sync-reset').addEventListener('click', reset);
      const autoBtn = document.getElementById('sync-auto');
      autoBtn.addEventListener('click', () => {
        if (autoTimer) { clearInterval(autoTimer); autoTimer = null; autoBtn.textContent = '자동 ▶'; autoBtn.style.background = 'var(--accent-green)'; }
        else { autoBtn.textContent = '정지 ■'; autoBtn.style.background = 'var(--accent-red)'; autoTimer = setInterval(clock, 500); }
      });
    }
    draw();
  }

  // ── BCD 카운터 ──
  function renderBCD(el) {
    let count = 0;
    const BITS = 4, MAX = 10;

    function clock() { count = (count + 1) % MAX; draw(); }
    function reset() { count = 0; draw(); }

    function draw() {
      const bits = [...Array(BITS)].map((_,i) => (count >> (BITS-1-i)) & 1);
      el.innerHTML = `
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;margin-bottom:8px;text-transform:uppercase;">BCD 카운터 (Mod-10: 0~9)</div>
        ${drawCounter(el, BITS, count, 10)}

        <!-- 7-세그먼트 표시 -->
        <div style="margin-top:10px;">
          <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:6px;">7-세그먼트 표시</div>
          ${renderSevenSeg(count)}
        </div>

        <!-- BCD 카운팅 순서 -->
        <div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap;align-items:center;">
          <span style="font-size:0.72rem;color:var(--text-muted);">순서:</span>
          ${[...Array(10)].map((_,i) => `<span style="font-family:monospace;font-size:0.82rem;background:${i===count?'var(--accent-blue)':'var(--bg-tertiary)'};color:${i===count?'white':'var(--text-muted)'};border:1px solid ${i===count?'var(--accent-blue)':'var(--border)'};border-radius:3px;padding:1px 7px;">${i}</span>`).join(' → ')}
          <span style="color:var(--text-muted);font-size:0.82rem;">→ 0</span>
        </div>

        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:6px;">
          카운트가 9(1001)에서 CLK를 받으면 0000으로 리셋. 1010~1111은 사용하지 않는 상태.
        </div>

        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="unit-example-btn" id="bcd-clk" style="background:var(--accent-blue);color:white;">CLK ↑ 펄스</button>
          <button class="unit-example-btn" id="bcd-auto" style="background:var(--accent-green);color:white;">자동 ▶</button>
          <button class="unit-example-btn" id="bcd-reset">리셋</button>
        </div>
      `;

      let autoTimer = null;
      document.getElementById('bcd-clk').addEventListener('click', clock);
      document.getElementById('bcd-reset').addEventListener('click', reset);
      const autoBtn = document.getElementById('bcd-auto');
      autoBtn.addEventListener('click', () => {
        if (autoTimer) { clearInterval(autoTimer); autoTimer = null; autoBtn.textContent = '자동 ▶'; autoBtn.style.background = 'var(--accent-green)'; }
        else { autoBtn.textContent = '정지 ■'; autoBtn.style.background = 'var(--accent-red)'; autoTimer = setInterval(clock, 600); }
      });
    }
    draw();
  }

  function renderSevenSeg(digit) {
    // segments: a,b,c,d,e,f,g
    const segs = [
      [1,1,1,1,1,1,0], // 0
      [0,1,1,0,0,0,0], // 1
      [1,1,0,1,1,0,1], // 2
      [1,1,1,1,0,0,1], // 3
      [0,1,1,0,0,1,1], // 4
      [1,0,1,1,0,1,1], // 5
      [1,0,1,1,1,1,1], // 6
      [1,1,1,0,0,0,0], // 7
      [1,1,1,1,1,1,1], // 8
      [1,1,1,1,0,1,1], // 9
    ];
    const s = segs[digit] || segs[0];
    const on = 'var(--accent-green)', off = 'var(--bg-secondary)';
    return `<svg width="60" height="90" viewBox="0 0 60 90">
      <!-- a -->
      <rect x="12" y="4" width="36" height="6" rx="3" fill="${s[0]?on:off}"/>
      <!-- b -->
      <rect x="50" y="8" width="6" height="32" rx="3" fill="${s[1]?on:off}"/>
      <!-- c -->
      <rect x="50" y="50" width="6" height="32" rx="3" fill="${s[2]?on:off}"/>
      <!-- d -->
      <rect x="12" y="80" width="36" height="6" rx="3" fill="${s[3]?on:off}"/>
      <!-- e -->
      <rect x="4" y="50" width="6" height="32" rx="3" fill="${s[4]?on:off}"/>
      <!-- f -->
      <rect x="4" y="8" width="6" height="32" rx="3" fill="${s[5]?on:off}"/>
      <!-- g -->
      <rect x="12" y="42" width="36" height="6" rx="3" fill="${s[6]?on:off}"/>
    </svg>`;
  }

  // ── 업/다운 카운터 ──
  function renderUpDown(el) {
    let count = 0, mode = 'up', history = [];
    const BITS = 4, MAX = 16;

    function clock() {
      if (mode === 'up') count = (count + 1) % MAX;
      else count = (count - 1 + MAX) % MAX;
      history.push({val: count, mode});
      if (history.length > 18) history.shift();
      draw();
    }
    function reset() { count = 0; history = []; draw(); }

    function draw() {
      el.innerHTML = `
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;margin-bottom:8px;text-transform:uppercase;">
          4비트 업/다운 카운터 — 현재 방향: <span style="color:${mode==='up'?'var(--accent-green)':'var(--accent-red)'}">${mode==='up'?'▲ 업':'▼ 다운'}</span>
        </div>
        ${drawCounter(el, BITS, count, MAX)}

        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
          <button class="unit-example-btn" id="ud-up" style="${mode==='up'?'background:var(--accent-green);color:white;':''}">▲ 업 모드</button>
          <button class="unit-example-btn" id="ud-down" style="${mode==='down'?'background:var(--accent-red);color:white;':''}">▼ 다운 모드</button>
          <button class="unit-example-btn" id="ud-clk" style="background:var(--accent-blue);color:white;">CLK ↑ 펄스</button>
          <button class="unit-example-btn" id="ud-auto" style="background:var(--accent-purple);color:white;">자동 ▶</button>
          <button class="unit-example-btn" id="ud-reset">리셋</button>
        </div>

        ${history.length > 0 ? `
        <div style="margin-top:8px;display:flex;gap:3px;flex-wrap:wrap;">
          ${history.map(h => `<span style="font-family:monospace;font-size:0.78rem;background:${h.val===count?'var(--accent-blue)':'var(--bg-tertiary)'};color:${h.val===count?'white':'var(--text-muted)'};border:1px solid ${h.mode==='up'?'var(--accent-green)':'var(--accent-red)'};border-radius:3px;padding:1px 6px;">${h.val}</span>`).join(' ')}
        </div>` : ''}
      `;

      let autoTimer = null;
      document.getElementById('ud-up').addEventListener('click', () => { mode = 'up'; draw(); });
      document.getElementById('ud-down').addEventListener('click', () => { mode = 'down'; draw(); });
      document.getElementById('ud-clk').addEventListener('click', clock);
      document.getElementById('ud-reset').addEventListener('click', reset);
      const autoBtn = document.getElementById('ud-auto');
      autoBtn.addEventListener('click', () => {
        if (autoTimer) { clearInterval(autoTimer); autoTimer = null; autoBtn.textContent = '자동 ▶'; }
        else { autoBtn.textContent = '정지 ■'; autoTimer = setInterval(clock, 400); }
      });
    }
    draw();
  }

  container.querySelectorAll('.cnt-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = +btn.dataset.tab;
      container.querySelectorAll('.cnt-tab').forEach(b => {
        b.style.background = b === btn ? 'var(--accent-blue)' : '';
        b.style.color = b === btn ? 'white' : '';
      });
      render();
    });
  });

  render();
}
