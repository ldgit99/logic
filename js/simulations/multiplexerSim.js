// ─── 멀티플렉서 / 디멀티플렉서 인터랙티브 시뮬레이터 ───

export function mountMultiplexerSim(container) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <!-- 탭 -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${['4:1 MUX','8:1 MUX','1:4 DEMUX','1:8 DEMUX'].map((t,i)=>
          `<button class="unit-example-btn mux-tab" data-tab="${i}" style="${i===0?'background:var(--accent-blue);color:white;':''}">${t}</button>`
        ).join('')}
      </div>
      <div id="mux-content"></div>
    </div>
  `;

  let activeTab = 0;

  function render() {
    const el = document.getElementById('mux-content');
    if (activeTab === 0) renderMux4(el);
    else if (activeTab === 1) renderMux8(el);
    else if (activeTab === 2) renderDemux4(el);
    else renderDemux8(el);
  }

  // ── 4:1 MUX ──
  function renderMux4(el) {
    let inputs = [0,0,0,0], sel = [0,0];
    function draw() {
      const s = sel[1]*2 + sel[0]; // S1S0
      const out = inputs[s];
      const selName = `I${s}`;
      el.innerHTML = `
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;margin-bottom:8px;text-transform:uppercase;">4:1 멀티플렉서 — 선택선 S1S0=${sel[1]}${sel[0]} → ${selName} 선택</div>
        <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start;">
          <!-- 입력 -->
          <div style="display:flex;flex-direction:column;gap:6px;">
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:2px;">데이터 입력</div>
            ${inputs.map((v,i)=>`
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-family:monospace;font-size:0.85rem;color:${i===s?'var(--accent-blue)':'var(--text-muted)'};font-weight:700;min-width:24px;">I${i}</span>
                <button class="unit-example-btn mux4-in" data-i="${i}" style="min-width:36px;${i===s?'border-color:var(--accent-blue);':''}">${v}</button>
                ${i===s?'<span style="color:var(--accent-blue);font-size:0.75rem;">← 선택됨</span>':''}
              </div>`).join('')}
            <div style="margin-top:4px;font-size:0.72rem;color:var(--text-muted);font-weight:700;">선택 입력</div>
            ${[0,1].map(k=>`
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-family:monospace;font-size:0.85rem;color:var(--accent-purple);font-weight:700;min-width:24px;">S${k}</span>
                <button class="unit-example-btn mux4-sel" data-k="${k}" style="min-width:36px;">${sel[k]}</button>
              </div>`).join('')}
          </div>
          <!-- SVG MUX -->
          <svg width="140" height="160" style="flex-shrink:0;">
            <!-- MUX body -->
            <polygon points="60,10 110,35 110,125 60,150" fill="var(--bg-tertiary)" stroke="var(--accent-blue)" stroke-width="2"/>
            <!-- Input lines -->
            ${inputs.map((v,i)=>`
              <line x1="10" y1="${30+i*30}" x2="60" y2="${35+i*28}" stroke="${i===s?'var(--accent-blue)':'var(--border)'}" stroke-width="${i===s?2:1}"/>
              <text x="5" y="${34+i*30}" font-size="10" fill="${i===s?'var(--accent-blue)':'var(--text-muted)'}" font-family="monospace">I${i}</text>
              <circle cx="60" cy="${35+i*28}" r="3" fill="${i===s?'var(--accent-blue)':'var(--border)'}"/>
            `).join('')}
            <!-- Output line -->
            <line x1="110" y1="80" x2="135" y2="80" stroke="${out?'var(--accent-green)':'var(--border)'}" stroke-width="2"/>
            <text x="118" y="76" font-size="10" fill="var(--text-muted)" font-family="monospace">Y</text>
            <!-- Sel lines -->
            <line x1="80" y1="150" x2="80" y2="165" stroke="var(--accent-purple)" stroke-width="1.5"/>
            <line x1="95" y1="150" x2="95" y2="165" stroke="var(--accent-purple)" stroke-width="1.5"/>
            <text x="71" y="175" font-size="9" fill="var(--accent-purple)" font-family="monospace">S1 S0</text>
            <!-- MUX label -->
            <text x="68" y="84" font-size="11" fill="var(--text-primary)" font-family="monospace" font-weight="bold">MUX</text>
          </svg>
          <!-- 출력 -->
          <div style="display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center;">
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;">출력 Y</div>
            <div style="width:60px;height:60px;border-radius:50%;background:${out?'var(--accent-green)':'var(--bg-tertiary)'};border:3px solid ${out?'var(--accent-green)':'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:700;color:${out?'white':'var(--text-muted)'};">${out}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">Y = I${s} = ${out}</div>
          </div>
        </div>
        <!-- 진리표 -->
        <div style="margin-top:12px;overflow-x:auto;">
          <table style="border-collapse:collapse;font-family:monospace;font-size:0.78rem;">
            <thead><tr style="background:var(--bg-secondary);">
              <th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-purple);">S1</th>
              <th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-purple);">S0</th>
              <th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-green);">Y</th>
            </tr></thead>
            <tbody>
              ${[[0,0,'I0'],[0,1,'I1'],[1,0,'I2'],[1,1,'I3']].map(([s1,s0,y])=>`
                <tr style="background:${sel[1]===s1&&sel[0]===s0?'rgba(59,130,246,0.15)':'transparent'};">
                  <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);">${s1}</td>
                  <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);">${s0}</td>
                  <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);color:var(--accent-green);">${y}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      `;
      el.querySelectorAll('.mux4-in').forEach(btn => btn.addEventListener('click', () => {
        inputs[+btn.dataset.i] ^= 1; draw();
      }));
      el.querySelectorAll('.mux4-sel').forEach(btn => btn.addEventListener('click', () => {
        sel[+btn.dataset.k] ^= 1; draw();
      }));
    }
    draw();
  }

  // ── 8:1 MUX ──
  function renderMux8(el) {
    let inputs = Array(8).fill(0), sel = [0,0,0];
    function draw() {
      const s = sel[2]*4 + sel[1]*2 + sel[0];
      const out = inputs[s];
      el.innerHTML = `
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;margin-bottom:8px;text-transform:uppercase;">8:1 멀티플렉서 — 선택선 S2S1S0=${sel[2]}${sel[1]}${sel[0]} → I${s} 선택</div>
        <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start;">
          <div>
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:4px;">데이터 입력</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;">
              ${inputs.map((v,i)=>`
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="font-family:monospace;font-size:0.82rem;color:${i===s?'var(--accent-blue)':'var(--text-muted)'};font-weight:700;min-width:20px;">I${i}</span>
                  <button class="unit-example-btn mux8-in" data-i="${i}" style="min-width:32px;padding:3px 8px;${i===s?'background:var(--accent-blue);color:white;':''}">${v}</button>
                </div>`).join('')}
            </div>
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-top:8px;margin-bottom:4px;">선택 입력</div>
            <div style="display:flex;gap:8px;">
              ${[0,1,2].map(k=>`
                <div style="display:flex;align-items:center;gap:4px;">
                  <span style="font-family:monospace;font-size:0.82rem;color:var(--accent-purple);font-weight:700;">S${k}</span>
                  <button class="unit-example-btn mux8-sel" data-k="${k}" style="min-width:32px;padding:3px 8px;">${sel[k]}</button>
                </div>`).join('')}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:8px;justify-content:center;padding-top:10px;">
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;">출력 Y</div>
            <div style="width:56px;height:56px;border-radius:50%;background:${out?'var(--accent-green)':'var(--bg-tertiary)'};border:3px solid ${out?'var(--accent-green)':'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:1.6rem;font-weight:700;color:${out?'white':'var(--text-muted)'};">${out}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">Y = I${s} = ${out}</div>
          </div>
        </div>
      `;
      el.querySelectorAll('.mux8-in').forEach(btn => btn.addEventListener('click', () => {
        inputs[+btn.dataset.i] ^= 1; draw();
      }));
      el.querySelectorAll('.mux8-sel').forEach(btn => btn.addEventListener('click', () => {
        sel[+btn.dataset.k] ^= 1; draw();
      }));
    }
    draw();
  }

  // ── 1:4 DEMUX ──
  function renderDemux4(el) {
    let input = 0, sel = [0,0];
    function draw() {
      const s = sel[1]*2 + sel[0];
      const outputs = Array(4).fill(0);
      outputs[s] = input;
      el.innerHTML = `
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;margin-bottom:8px;text-transform:uppercase;">1:4 디멀티플렉서 — S1S0=${sel[1]}${sel[0]} → Y${s}으로 출력</div>
        <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start;">
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div>
              <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:4px;">데이터 입력</div>
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-family:monospace;color:var(--accent-green);font-weight:700;">D</span>
                <button class="unit-example-btn" id="demux4-in" style="min-width:36px;">${input}</button>
              </div>
            </div>
            <div>
              <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:4px;">선택 입력</div>
              ${[0,1].map(k=>`
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                  <span style="font-family:monospace;color:var(--accent-purple);font-weight:700;">S${k}</span>
                  <button class="unit-example-btn demux4-sel" data-k="${k}" style="min-width:36px;">${sel[k]}</button>
                </div>`).join('')}
            </div>
          </div>
          <!-- DEMUX SVG -->
          <svg width="150" height="160" style="flex-shrink:0;">
            <polygon points="10,10 60,35 60,125 10,150" fill="var(--bg-tertiary)" stroke="var(--accent-purple)" stroke-width="2"/>
            <line x1="0" y1="80" x2="10" y2="80" stroke="${input?'var(--accent-green)':'var(--border)'}" stroke-width="2"/>
            <text x="2" y="76" font-size="10" fill="var(--text-muted)" font-family="monospace">D</text>
            ${outputs.map((v,i)=>`
              <line x1="60" y1="${35+i*28}" x2="145" y2="${35+i*28}" stroke="${v?'var(--accent-green)':'var(--border)'}" stroke-width="${i===s?2:1}"/>
              <text x="130" y="${31+i*28}" font-size="10" fill="${v?'var(--accent-green)':'var(--text-muted)'}" font-family="monospace">Y${i}</text>
              <circle cx="60" cy="${35+i*28}" r="3" fill="${i===s?'var(--accent-purple)':'var(--border)'}"/>
            `).join('')}
            <text x="18" y="84" font-size="10" fill="var(--text-primary)" font-family="monospace" font-weight="bold">DEMUX</text>
          </svg>
          <!-- 출력 표시 -->
          <div>
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:6px;">출력</div>
            ${outputs.map((v,i)=>`
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <span style="font-family:monospace;font-size:0.85rem;color:${i===s?'var(--accent-green)':'var(--text-muted)'};font-weight:700;min-width:24px;">Y${i}</span>
                <div style="width:28px;height:28px;border-radius:4px;background:${v?'var(--accent-green)':'var(--bg-tertiary)'};border:2px solid ${v?'var(--accent-green)':'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:0.9rem;font-weight:700;color:${v?'white':'var(--text-muted)'};">${v}</div>
                ${i===s?'<span style="font-size:0.72rem;color:var(--accent-purple);">← 선택</span>':''}
              </div>`).join('')}
          </div>
        </div>
      `;
      document.getElementById('demux4-in').addEventListener('click', () => { input ^= 1; draw(); });
      el.querySelectorAll('.demux4-sel').forEach(btn => btn.addEventListener('click', () => {
        sel[+btn.dataset.k] ^= 1; draw();
      }));
    }
    draw();
  }

  // ── 1:8 DEMUX ──
  function renderDemux8(el) {
    let input = 0, sel = [0,0,0];
    function draw() {
      const s = sel[2]*4 + sel[1]*2 + sel[0];
      const outputs = Array(8).fill(0);
      outputs[s] = input;
      el.innerHTML = `
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;margin-bottom:8px;text-transform:uppercase;">1:8 디멀티플렉서 — S2S1S0=${sel[2]}${sel[1]}${sel[0]} → Y${s}으로 출력</div>
        <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start;">
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div>
              <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:4px;">데이터 입력</div>
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-family:monospace;color:var(--accent-green);font-weight:700;">D</span>
                <button class="unit-example-btn" id="demux8-in" style="min-width:36px;">${input}</button>
              </div>
            </div>
            <div>
              <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:4px;">선택 입력</div>
              ${[0,1,2].map(k=>`
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                  <span style="font-family:monospace;color:var(--accent-purple);font-weight:700;">S${k}</span>
                  <button class="unit-example-btn demux8-sel" data-k="${k}" style="min-width:36px;">${sel[k]}</button>
                </div>`).join('')}
            </div>
          </div>
          <div>
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:6px;">출력</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;">
              ${outputs.map((v,i)=>`
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="font-family:monospace;font-size:0.82rem;color:${i===s?'var(--accent-green)':'var(--text-muted)'};font-weight:700;min-width:20px;">Y${i}</span>
                  <div style="width:26px;height:26px;border-radius:4px;background:${v?'var(--accent-green)':'var(--bg-tertiary)'};border:2px solid ${v?'var(--accent-green)':'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:0.85rem;font-weight:700;color:${v?'white':'var(--text-muted)'};">${v}</div>
                </div>`).join('')}
            </div>
          </div>
        </div>
      `;
      document.getElementById('demux8-in').addEventListener('click', () => { input ^= 1; draw(); });
      el.querySelectorAll('.demux8-sel').forEach(btn => btn.addEventListener('click', () => {
        sel[+btn.dataset.k] ^= 1; draw();
      }));
    }
    draw();
  }

  container.querySelectorAll('.mux-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = +btn.dataset.tab;
      container.querySelectorAll('.mux-tab').forEach(b => {
        b.style.background = b === btn ? 'var(--accent-blue)' : '';
        b.style.color = b === btn ? 'white' : '';
      });
      render();
    });
  });

  render();
}
