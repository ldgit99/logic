// ─── 시프트 레지스터 인터랙티브 시뮬레이터 ───

export function mountShiftRegister(container) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${['SISO','SIPO','PISO','PIPO','링 카운터','존슨 카운터'].map((t,i)=>
          `<button class="unit-example-btn sr-tab" data-tab="${i}" style="${i===0?'background:var(--accent-blue);color:white;':''}">${t}</button>`
        ).join('')}
      </div>
      <div id="sr-content"></div>
    </div>
  `;

  let activeTab = 0;

  function render() {
    const el = document.getElementById('sr-content');
    if (activeTab === 0) renderSISO(el);
    else if (activeTab === 1) renderSIPO(el);
    else if (activeTab === 2) renderPISO(el);
    else if (activeTab === 3) renderPIPO(el);
    else if (activeTab === 4) renderRing(el);
    else renderJohnson(el);
  }

  function drawBits(bits, label='', colors={}) {
    return `
      <div style="display:flex;flex-direction:column;align-items:flex-start;gap:4px;">
        ${label ? `<div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;">${label}</div>` : ''}
        <div style="display:flex;gap:6px;">
          ${bits.map((b,i) => {
            const col = colors[i] || (b ? 'var(--accent-blue)' : 'var(--bg-tertiary)');
            const border = b ? col : 'var(--border)';
            return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
              <span style="font-size:0.62rem;color:var(--text-muted);font-family:monospace;">D${bits.length-1-i}</span>
              <div style="width:36px;height:36px;border-radius:5px;background:${col};border:2px solid ${border};display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:700;color:${b?'white':'var(--text-muted)'};">${b}</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function drawArrow(direction='right') {
    return direction === 'right'
      ? `<div style="font-size:1.4rem;color:var(--accent-purple);align-self:center;">→</div>`
      : `<div style="font-size:1.4rem;color:var(--accent-purple);align-self:center;">←</div>`;
  }

  // ── SISO: Serial In, Serial Out ──
  function renderSISO(el) {
    let reg = [0,0,0,0], serialIn = 0, history = [];

    function clock() {
      const out = reg[3];
      reg = [serialIn, reg[0], reg[1], reg[2]];
      history.push({reg: [...reg], in: serialIn, out});
      if (history.length > 8) history.shift();
      draw();
    }

    function draw() {
      el.innerHTML = `
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;margin-bottom:8px;text-transform:uppercase;">SISO — 직렬 입력, 직렬 출력 (4비트)</div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
          <!-- Serial In -->
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
            <div style="font-size:0.72rem;color:var(--accent-green);font-weight:700;">직렬 입력</div>
            <button class="unit-example-btn" id="siso-in" style="width:42px;height:42px;font-size:1.2rem;${serialIn?'background:var(--accent-green);color:white;':''}">${serialIn}</button>
          </div>
          ${drawArrow('right')}
          <!-- Register -->
          ${drawBits(reg, '레지스터 (MSB→LSB)')}
          ${drawArrow('right')}
          <!-- Serial Out -->
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
            <div style="font-size:0.72rem;color:var(--accent-red);font-weight:700;">직렬 출력</div>
            <div style="width:42px;height:42px;border-radius:5px;background:${reg[3]?'var(--accent-red)':'var(--bg-tertiary)'};border:2px solid ${reg[3]?'var(--accent-red)':'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:700;color:${reg[3]?'white':'var(--text-muted)'};">${reg[3]}</div>
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:10px;">
          <button class="unit-example-btn" id="siso-clk" style="background:var(--accent-blue);color:white;">CLK ↑ 시프트</button>
          <button class="unit-example-btn" id="siso-reset">리셋</button>
        </div>

        ${history.length > 0 ? `
        <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:4px;">이력 (최근 ${history.length}회)</div>
        <div style="overflow-x:auto;">
          <table style="border-collapse:collapse;font-family:monospace;font-size:0.75rem;">
            <thead><tr style="background:var(--bg-secondary);">
              <th style="padding:3px 6px;border:1px solid var(--border);color:var(--accent-green);">IN</th>
              <th style="padding:3px 6px;border:1px solid var(--border);color:var(--accent-blue);" colspan="4">레지스터 D3..D0</th>
              <th style="padding:3px 6px;border:1px solid var(--border);color:var(--accent-red);">OUT</th>
            </tr></thead>
            <tbody>
              ${history.map(h => `<tr>
                <td style="text-align:center;padding:2px 6px;border:1px solid var(--border);color:var(--accent-green);">${h.in}</td>
                ${h.reg.map(b=>`<td style="text-align:center;padding:2px 6px;border:1px solid var(--border);color:${b?'var(--accent-blue)':'var(--text-muted)'};">${b}</td>`).join('')}
                <td style="text-align:center;padding:2px 6px;border:1px solid var(--border);color:var(--accent-red);">${h.out}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}
        <div style="margin-top:8px;font-size:0.72rem;color:var(--text-muted);">
          직렬 입력 비트를 4번 클록하면 4비트 데이터가 레지스터에 저장됩니다.
        </div>
      `;

      document.getElementById('siso-in').addEventListener('click', () => { serialIn ^= 1; draw(); });
      document.getElementById('siso-clk').addEventListener('click', clock);
      document.getElementById('siso-reset').addEventListener('click', () => { reg = [0,0,0,0]; history = []; draw(); });
    }
    draw();
  }

  // ── SIPO: Serial In, Parallel Out ──
  function renderSIPO(el) {
    let reg = [0,0,0,0], serialIn = 0;

    function clock() {
      reg = [serialIn, reg[0], reg[1], reg[2]];
      draw();
    }

    function draw() {
      el.innerHTML = `
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;margin-bottom:8px;text-transform:uppercase;">SIPO — 직렬 입력, 병렬 출력 (4비트)</div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
            <div style="font-size:0.72rem;color:var(--accent-green);font-weight:700;">직렬 입력</div>
            <button class="unit-example-btn" id="sipo-in" style="width:42px;height:42px;font-size:1.2rem;${serialIn?'background:var(--accent-green);color:white;':''}">${serialIn}</button>
          </div>
          ${drawArrow('right')}
          ${drawBits(reg, '레지스터')}
        </div>

        <!-- 병렬 출력 -->
        <div style="margin-bottom:10px;">
          <div style="font-size:0.72rem;color:var(--accent-purple);font-weight:700;margin-bottom:6px;">병렬 출력 Q3..Q0</div>
          <div style="display:flex;gap:10px;align-items:flex-end;">
            ${reg.map((b,i) => `
              <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
                <div style="height:${20+b*30}px;width:14px;background:${b?'var(--accent-purple)':'var(--bg-tertiary)'};border-radius:3px 3px 0 0;transition:height 0.2s;border:1px solid ${b?'var(--accent-purple)':'var(--border)'};">
                </div>
                <span style="font-family:monospace;font-size:0.72rem;color:${b?'var(--accent-purple)':'var(--text-muted)'};">Q${reg.length-1-i}=${b}</span>
              </div>`).join('')}
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:8px;">
          <button class="unit-example-btn" id="sipo-clk" style="background:var(--accent-blue);color:white;">CLK ↑ 시프트</button>
          <button class="unit-example-btn" id="sipo-reset">리셋</button>
        </div>
        <div style="font-size:0.72rem;color:var(--text-muted);">
          직렬 데이터가 클록마다 레지스터로 이동하고, 4비트 병렬 출력으로 동시에 읽힙니다.
          <br>활용: 직렬 통신(UART) 수신 → 병렬 처리
        </div>
      `;

      document.getElementById('sipo-in').addEventListener('click', () => { serialIn ^= 1; draw(); });
      document.getElementById('sipo-clk').addEventListener('click', clock);
      document.getElementById('sipo-reset').addEventListener('click', () => { reg = [0,0,0,0]; draw(); });
    }
    draw();
  }

  // ── PISO: Parallel In, Serial Out ──
  function renderPISO(el) {
    let reg = [1,0,1,1], serialOut = 0, loaded = false;

    function load() {
      loaded = true;
      draw();
    }
    function clock() {
      if (!loaded) return;
      serialOut = reg[3];
      reg = [0, reg[0], reg[1], reg[2]];
      draw();
    }

    function draw() {
      el.innerHTML = `
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;margin-bottom:8px;text-transform:uppercase;">PISO — 병렬 입력, 직렬 출력 (4비트)</div>

        <!-- 병렬 입력 -->
        <div style="margin-bottom:10px;">
          <div style="font-size:0.72rem;color:var(--accent-green);font-weight:700;margin-bottom:6px;">병렬 입력 (클릭으로 설정)</div>
          <div style="display:flex;gap:6px;">
            ${reg.map((b,i) => `
              <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
                <span style="font-size:0.65rem;color:var(--text-muted);font-family:monospace;">D${reg.length-1-i}</span>
                <button class="unit-example-btn piso-bit" data-i="${i}" style="width:36px;height:36px;font-size:1.1rem;${b?'background:var(--accent-green);color:white;':''}">${b}</button>
              </div>`).join('')}
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
          ${drawBits(reg, '레지스터 상태')}
          ${drawArrow('right')}
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
            <div style="font-size:0.72rem;color:var(--accent-red);font-weight:700;">직렬 출력</div>
            <div style="width:42px;height:42px;border-radius:5px;background:${serialOut?'var(--accent-red)':'var(--bg-tertiary)'};border:2px solid ${serialOut?'var(--accent-red)':'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:700;color:${serialOut?'white':'var(--text-muted)'};">${serialOut}</div>
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
          <button class="unit-example-btn" id="piso-load" style="background:var(--accent-green);color:white;">LOAD (병렬 로드)</button>
          <button class="unit-example-btn" id="piso-clk" style="background:var(--accent-blue);color:white;">CLK ↑ 시프트 출력</button>
          <button class="unit-example-btn" id="piso-reset">리셋</button>
        </div>
        <div style="font-size:0.72rem;color:var(--text-muted);">
          LOAD 후 CLK를 4번 누르면 D3→D2→D1→D0 순으로 직렬 출력됩니다.
          <br>활용: 병렬 데이터를 직렬 통신(SPI)으로 전송
        </div>
      `;

      el.querySelectorAll('.piso-bit').forEach(btn => btn.addEventListener('click', () => {
        reg[+btn.dataset.i] ^= 1; loaded = false; draw();
      }));
      document.getElementById('piso-load').addEventListener('click', load);
      document.getElementById('piso-clk').addEventListener('click', clock);
      document.getElementById('piso-reset').addEventListener('click', () => { reg = [1,0,1,1]; serialOut = 0; loaded = false; draw(); });
    }
    draw();
  }

  // ── PIPO: Parallel In, Parallel Out ──
  function renderPIPO(el) {
    let reg = [0,0,0,0], input = [1,0,1,1];

    function draw() {
      el.innerHTML = `
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;margin-bottom:8px;text-transform:uppercase;">PIPO — 병렬 입력, 병렬 출력 (4비트)</div>

        <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-end;margin-bottom:12px;">
          <div>
            <div style="font-size:0.72rem;color:var(--accent-green);font-weight:700;margin-bottom:6px;">입력 D3..D0</div>
            <div style="display:flex;gap:6px;">
              ${input.map((b,i) => `
                <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
                  <span style="font-size:0.65rem;color:var(--text-muted);font-family:monospace;">D${input.length-1-i}</span>
                  <button class="unit-example-btn pipo-in" data-i="${i}" style="width:36px;height:36px;font-size:1.1rem;${b?'background:var(--accent-green);color:white;':''}">${b}</button>
                </div>`).join('')}
            </div>
          </div>
          <div>
            <div style="font-size:0.72rem;color:var(--accent-purple);font-weight:700;margin-bottom:6px;">출력 Q3..Q0</div>
            <div style="display:flex;gap:6px;">
              ${reg.map((b,i) => `
                <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
                  <span style="font-size:0.65rem;color:var(--text-muted);font-family:monospace;">Q${reg.length-1-i}</span>
                  <div style="width:36px;height:36px;border-radius:5px;background:${b?'var(--accent-purple)':'var(--bg-tertiary)'};border:2px solid ${b?'var(--accent-purple)':'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:700;color:${b?'white':'var(--text-muted)'};">${b}</div>
                </div>`).join('')}
            </div>
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:8px;">
          <button class="unit-example-btn" id="pipo-clk" style="background:var(--accent-blue);color:white;">CLK ↑ (D→Q 전달)</button>
          <button class="unit-example-btn" id="pipo-reset">리셋</button>
        </div>
        <div style="font-size:0.72rem;color:var(--text-muted);">
          CLK 상승 에지에서 모든 입력 D가 동시에 출력 Q로 전달됩니다.
          <br>활용: 데이터 버스 버퍼링, 파이프라인 레지스터
        </div>
      `;

      el.querySelectorAll('.pipo-in').forEach(btn => btn.addEventListener('click', () => {
        input[+btn.dataset.i] ^= 1; draw();
      }));
      document.getElementById('pipo-clk').addEventListener('click', () => { reg = [...input]; draw(); });
      document.getElementById('pipo-reset').addEventListener('click', () => { reg = [0,0,0,0]; draw(); });
    }
    draw();
  }

  // ── 링 카운터 ──
  function renderRing(el) {
    let reg = [1,0,0,0];
    let autoTimer = null;

    function clock() {
      const last = reg[3];
      reg = [last, reg[0], reg[1], reg[2]];
      draw();
    }

    function draw() {
      el.innerHTML = `
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;margin-bottom:8px;text-transform:uppercase;">링 카운터 (Ring Counter) — 4비트</div>

        ${drawBits(reg, '레지스터 (1이 순환)')}

        <!-- Ring diagram -->
        <svg width="200" height="160" style="margin:12px 0;display:block;">
          ${reg.map((b,i) => {
            const angle = (i * 90 - 90) * Math.PI / 180;
            const cx = 100 + 65*Math.cos(angle), cy = 80 + 65*Math.sin(angle);
            return `<circle cx="${cx}" cy="${cy}" r="22" fill="${b?'var(--accent-blue)':'var(--bg-tertiary)'}" stroke="${b?'var(--accent-blue)':'var(--border)'}" stroke-width="2"/>
              <text x="${cx}" y="${cy+5}" font-size="14" font-weight="bold" text-anchor="middle" fill="${b?'white':'var(--text-muted)'}" font-family="monospace">${b}</text>
              <text x="${cx}" y="${cy-10}" font-size="9" text-anchor="middle" fill="var(--text-muted)" font-family="monospace">Q${i}</text>`;
          }).join('')}
          <!-- arrows between circles -->
          ${reg.map((_,i) => {
            const a1 = (i * 90 - 90) * Math.PI / 180;
            const a2 = ((i+1) * 90 - 90) * Math.PI / 180;
            const r = 65, inner = 24;
            const x1 = 100 + r*Math.cos(a1) + inner*Math.cos(a2), y1 = 80 + r*Math.sin(a1) + inner*Math.sin(a2);
            const x2 = 100 + r*Math.cos(a2) - inner*Math.cos(a2), y2 = 80 + r*Math.sin(a2) - inner*Math.sin(a2);
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--border)" stroke-width="1.5" marker-end="url(#ra)"/>`;
          }).join('')}
          <defs><marker id="ra" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="var(--border)"/></marker></defs>
        </svg>

        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="unit-example-btn" id="ring-clk" style="background:var(--accent-blue);color:white;">CLK ↑ 순환</button>
          <button class="unit-example-btn" id="ring-auto" style="background:var(--accent-green);color:white;">자동 ▶</button>
          <button class="unit-example-btn" id="ring-reset">리셋</button>
        </div>
        <div style="margin-top:8px;font-size:0.72rem;color:var(--text-muted);">
          최상위 비트(Q3)가 최하위(Q0)로 피드백됩니다. 1이 한 칸씩 순환하며 4개 상태를 순환합니다.
          <br>상태: 1000 → 0100 → 0010 → 0001 → 1000 ...
        </div>
      `;

      document.getElementById('ring-clk').addEventListener('click', clock);
      document.getElementById('ring-reset').addEventListener('click', () => { reg = [1,0,0,0]; if(autoTimer){clearInterval(autoTimer);autoTimer=null;} draw(); });
      const autoBtn = document.getElementById('ring-auto');
      autoBtn.addEventListener('click', () => {
        if (autoTimer) { clearInterval(autoTimer); autoTimer = null; autoBtn.textContent = '자동 ▶'; autoBtn.style.background = 'var(--accent-green)'; }
        else { autoBtn.textContent = '정지 ■'; autoBtn.style.background = 'var(--accent-red)'; autoTimer = setInterval(clock, 600); }
      });
    }
    draw();
  }

  // ── 존슨 카운터 ──
  function renderJohnson(el) {
    let reg = [0,0,0,0];
    let autoTimer = null;

    function clock() {
      const complement = 1 - reg[3];
      reg = [complement, reg[0], reg[1], reg[2]];
      draw();
    }

    const states8 = ['0000','1000','1100','1110','1111','0111','0011','0001'];

    function draw() {
      const current = reg.join('');
      el.innerHTML = `
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;margin-bottom:8px;text-transform:uppercase;">존슨 카운터 (Johnson Counter) — 4비트 8상태</div>

        ${drawBits(reg, '레지스터 상태')}

        <!-- 8 states display -->
        <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <span style="font-size:0.72rem;color:var(--text-muted);">8개 상태:</span>
          ${states8.map((s,i) => `
            <span style="font-family:monospace;font-size:0.78rem;background:${s===current?'var(--accent-blue)':'var(--bg-tertiary)'};color:${s===current?'white':'var(--text-muted)'};border:1px solid ${s===current?'var(--accent-blue)':'var(--border)'};border-radius:3px;padding:2px 6px;">${s}</span>
          `).join('')}
        </div>

        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
          <button class="unit-example-btn" id="joh-clk" style="background:var(--accent-blue);color:white;">CLK ↑ 순환</button>
          <button class="unit-example-btn" id="joh-auto" style="background:var(--accent-green);color:white;">자동 ▶</button>
          <button class="unit-example-btn" id="joh-reset">리셋</button>
        </div>
        <div style="margin-top:8px;font-size:0.72rem;color:var(--text-muted);">
          최상위 비트(Q3)의 <strong>보수</strong>가 Q0으로 피드백됩니다.
          <br>4비트로 8개 상태(2N)를 가집니다. 링 카운터의 2배 상태.
          <br>순환: 0000→1000→1100→1110→1111→0111→0011→0001→0000
        </div>
      `;

      document.getElementById('joh-clk').addEventListener('click', clock);
      document.getElementById('joh-reset').addEventListener('click', () => { reg = [0,0,0,0]; if(autoTimer){clearInterval(autoTimer);autoTimer=null;} draw(); });
      const autoBtn = document.getElementById('joh-auto');
      autoBtn.addEventListener('click', () => {
        if (autoTimer) { clearInterval(autoTimer); autoTimer = null; autoBtn.textContent = '자동 ▶'; autoBtn.style.background = 'var(--accent-green)'; }
        else { autoBtn.textContent = '정지 ■'; autoBtn.style.background = 'var(--accent-red)'; autoTimer = setInterval(clock, 600); }
      });
    }
    draw();
  }

  container.querySelectorAll('.sr-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = +btn.dataset.tab;
      container.querySelectorAll('.sr-tab').forEach(b => {
        b.style.background = b === btn ? 'var(--accent-blue)' : '';
        b.style.color = b === btn ? 'white' : '';
      });
      render();
    });
  });

  render();
}
