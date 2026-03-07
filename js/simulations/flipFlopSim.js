// ─── 플립플롭 인터랙티브 시뮬레이터 ───

export function mountFlipFlopSim(container) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${['SR 래치','D 플립플롭','JK 플립플롭','T 플립플롭'].map((t,i)=>
          `<button class="unit-example-btn ff-tab" data-tab="${i}" style="${i===0?'background:var(--accent-blue);color:white;':''}">${t}</button>`
        ).join('')}
      </div>
      <div id="ff-content"></div>
    </div>
  `;

  let activeTab = 0;

  function render() {
    const el = document.getElementById('ff-content');
    if (activeTab === 0) renderSR(el);
    else if (activeTab === 1) renderD(el);
    else if (activeTab === 2) renderJK(el);
    else renderT(el);
  }

  // 공통 타이밍 다이어그램 그리기
  function drawTimingCanvas(canvas, signals) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const labelW = 34;
    const sigH = Math.floor((H - 10) / signals.length);
    const stepW = (W - labelW) / signals[0].data.length;

    signals.forEach((sig, row) => {
      const y0 = 5 + row * sigH;
      const mid = y0 + sigH * 0.5;
      const hi = y0 + 4;
      const lo = y0 + sigH - 6;

      // label
      ctx.fillStyle = sig.color || '#94a3b8';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(sig.label, 2, mid + 4);

      // waveform
      ctx.strokeStyle = sig.color || '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      sig.data.forEach((v, i) => {
        const x = labelW + i * stepW;
        const y = v ? hi : lo;
        const xNext = labelW + (i + 1) * stepW;
        if (i === 0) ctx.moveTo(x, y);
        else {
          const prevY = sig.data[i-1] ? hi : lo;
          if (y !== prevY) { ctx.lineTo(x, prevY); ctx.lineTo(x, y); }
          else ctx.lineTo(x, y);
        }
        if (i === sig.data.length - 1) ctx.lineTo(xNext, y);
      });
      ctx.stroke();

      // divider
      if (row < signals.length - 1) {
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y0 + sigH);
        ctx.lineTo(W, y0 + sigH);
        ctx.stroke();
      }
    });
  }

  // ── SR 래치 ──
  function renderSR(el) {
    let S = 0, R = 0, Q = 0, Qn = 1;
    const history = { S:[], R:[], Q:[], Qn:[] };

    function apply() {
      const prevQ = Q;
      if (S === 0 && R === 0) { /* 유지 */ }
      else if (S === 1 && R === 0) { Q = 1; Qn = 0; }
      else if (S === 0 && R === 1) { Q = 0; Qn = 1; }
      else { Q = 'X'; Qn = 'X'; } // 금지 상태

      history.S.push(S); history.R.push(R);
      history.Q.push(typeof Q === 'number' ? Q : 0);
      history.Qn.push(typeof Qn === 'number' ? Qn : 0);
      if (history.S.length > 16) ['S','R','Q','Qn'].forEach(k => history[k].shift());
      draw();
    }

    function draw() {
      const isInvalid = S === 1 && R === 1;
      el.innerHTML = `
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;margin-bottom:8px;text-transform:uppercase;">SR 래치 (NOR 게이트 구현)</div>
        <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start;">
          <!-- 입력 -->
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${[['S','accent-green'],['R','accent-red']].map(([name, col])=>`
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-family:monospace;font-weight:700;color:var(--${col});min-width:18px;">${name}</span>
                <button class="unit-example-btn sr-in" data-v="${name}" style="min-width:40px;">${name==='S'?S:R}</button>
              </div>`).join('')}
            <button class="unit-example-btn" id="sr-apply" style="margin-top:4px;background:var(--accent-blue);color:white;">클록 ↑ 적용</button>
          </div>

          <!-- SVG 회로 -->
          <svg width="200" height="120">
            <!-- NOR1: Q -->
            <rect x="70" y="20" width="50" height="30" rx="4" fill="var(--bg-tertiary)" stroke="var(--accent-blue)" stroke-width="1.5"/>
            <text x="85" y="39" font-size="10" fill="var(--text-primary)" font-family="monospace">NOR</text>
            <!-- NOR2: Qn -->
            <rect x="70" y="70" width="50" height="30" rx="4" fill="var(--bg-tertiary)" stroke="var(--accent-blue)" stroke-width="1.5"/>
            <text x="85" y="89" font-size="10" fill="var(--text-primary)" font-family="monospace">NOR</text>
            <!-- S input -->
            <line x1="10" y1="30" x2="70" y2="30" stroke="var(--accent-green)" stroke-width="1.5"/>
            <text x="2" y="34" font-size="10" fill="var(--accent-green)" font-family="monospace">S</text>
            <!-- R input -->
            <line x1="10" y1="85" x2="70" y2="85" stroke="var(--accent-red)" stroke-width="1.5"/>
            <text x="2" y="89" font-size="10" fill="var(--accent-red)" font-family="monospace">R</text>
            <!-- Q output -->
            <line x1="120" y1="35" x2="190" y2="35" stroke="${Q?'var(--accent-green)':'var(--border)'}" stroke-width="2"/>
            <text x="150" y="30" font-size="10" fill="var(--accent-green)" font-family="monospace">Q=${Q}</text>
            <!-- Qn output -->
            <line x1="120" y1="85" x2="190" y2="85" stroke="${Qn?'var(--accent-green)':'var(--border)'}" stroke-width="2"/>
            <text x="140" y="80" font-size="10" fill="var(--accent-purple)" font-family="monospace">Q̄=${Qn}</text>
            <!-- Feedback -->
            <path d="M 160,35 L 160,55 L 55,55 L 55,75 L 70,75" fill="none" stroke="var(--border)" stroke-width="1" stroke-dasharray="3"/>
            <path d="M 160,85 L 160,105 L 55,105 L 55,42 L 70,42" fill="none" stroke="var(--border)" stroke-width="1" stroke-dasharray="3"/>
          </svg>

          <!-- 출력 -->
          <div style="display:flex;gap:12px;">
            ${[['Q',Q,'accent-green'],['Q̄',Qn,'accent-purple']].map(([label,val,col])=>`
              <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;">${label}</div>
                <div style="width:46px;height:46px;border-radius:50%;background:${val===1?`var(--${col})`:'var(--bg-tertiary)'};border:3px solid ${val===1?`var(--${col})`:'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:700;color:${val===1?'white':'var(--text-muted)'};">${val}</div>
              </div>`).join('')}
          </div>
        </div>
        ${isInvalid ? '<div style="color:var(--accent-red);font-weight:700;font-size:0.85rem;margin-top:8px;">⚠ 금지 상태: S=R=1은 허용되지 않습니다!</div>' : ''}

        <!-- 진리표 -->
        <div style="margin-top:10px;overflow-x:auto;">
          <table style="border-collapse:collapse;font-family:monospace;font-size:0.78rem;">
            <thead><tr style="background:var(--bg-secondary);">
              <th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-green);">S</th>
              <th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-red);">R</th>
              <th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-blue);">Q(t+1)</th>
              <th style="padding:3px 8px;border:1px solid var(--border);color:var(--text-muted);">비고</th>
            </tr></thead>
            <tbody>
              ${[[0,0,'Q(t)','유지'],[0,1,'0','리셋'],[1,0,'1','셋'],[1,1,'X','금지']].map(([s,r,q,note])=>`
                <tr style="background:${S===s&&R===r?'rgba(59,130,246,0.15)':'transparent'};">
                  <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);">${s}</td>
                  <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);">${r}</td>
                  <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);color:${q==='X'?'var(--accent-red)':'var(--accent-blue)'};">${q}</td>
                  <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);color:var(--text-muted);">${note}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <!-- 타이밍 -->
        <canvas id="sr-timing" width="480" height="120" style="width:100%;border-radius:4px;background:var(--bg-secondary);margin-top:8px;"></canvas>
      `;

      const cvs = document.getElementById('sr-timing');
      if (history.S.length > 1) {
        drawTimingCanvas(cvs, [
          {label:'S', data:history.S, color:'#10b981'},
          {label:'R', data:history.R, color:'#ef4444'},
          {label:'Q', data:history.Q, color:'#3b82f6'},
          {label:'Q̄', data:history.Qn, color:'#8b5cf6'},
        ]);
      }

      el.querySelectorAll('.sr-in').forEach(btn => btn.addEventListener('click', () => {
        if (btn.dataset.v === 'S') S ^= 1; else R ^= 1; draw();
      }));
      document.getElementById('sr-apply').addEventListener('click', apply);
    }

    apply();
  }

  // ── D 플립플롭 ──
  function renderD(el) {
    let D = 0, Q = 0, Qn = 1, clk = 0;
    const history = { D:[], CLK:[], Q:[], Qn:[] };

    function clock() {
      Q = D; Qn = 1 - D;
      history.D.push(D); history.CLK.push(1); history.Q.push(Q); history.Qn.push(Qn);
      history.D.push(D); history.CLK.push(0); history.Q.push(Q); history.Qn.push(Qn);
      if (history.D.length > 20) ['D','CLK','Q','Qn'].forEach(k => history[k].splice(0,2));
      draw();
    }

    function draw() {
      el.innerHTML = `
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;margin-bottom:8px;text-transform:uppercase;">D 플립플롭 — 상승 에지 트리거</div>
        <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start;">
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-family:monospace;font-weight:700;color:var(--accent-green);min-width:18px;">D</span>
              <button class="unit-example-btn" id="d-in" style="min-width:40px;">${D}</button>
            </div>
            <button class="unit-example-btn" id="d-clk" style="background:var(--accent-orange,#f97316);color:white;">CLK ↑ 펄스</button>
            <div style="font-size:0.72rem;color:var(--text-muted);">CLK 상승 에지에서<br>Q ← D</div>
          </div>

          <!-- D FF SVG -->
          <svg width="180" height="100">
            <rect x="50" y="10" width="80" height="80" rx="6" fill="var(--bg-tertiary)" stroke="var(--accent-blue)" stroke-width="2"/>
            <text x="80" y="42" font-size="12" fill="var(--text-primary)" font-family="monospace" font-weight="bold">D</text>
            <text x="75" y="58" font-size="10" fill="var(--text-muted)" font-family="monospace">FF</text>
            <!-- D input -->
            <line x1="5" y1="35" x2="50" y2="35" stroke="var(--accent-green)" stroke-width="2"/>
            <text x="2" y="31" font-size="10" fill="var(--accent-green)" font-family="monospace">D</text>
            <!-- CLK -->
            <line x1="5" y1="72" x2="50" y2="72" stroke="var(--accent-orange,#f97316)" stroke-width="2"/>
            <text x="2" y="68" font-size="9" fill="#f97316" font-family="monospace">CLK</text>
            <!-- Triangle for edge trigger -->
            <polygon points="50,68 58,72 50,76" fill="#f97316"/>
            <!-- Q output -->
            <line x1="130" y1="30" x2="178" y2="30" stroke="${Q?'var(--accent-green)':'var(--border)'}" stroke-width="2"/>
            <text x="148" y="26" font-size="10" fill="var(--accent-green)" font-family="monospace">Q=${Q}</text>
            <!-- Qn output -->
            <line x1="130" y1="70" x2="178" y2="70" stroke="${Qn?'var(--accent-purple)':'var(--border)'}" stroke-width="2"/>
            <text x="140" y="66" font-size="10" fill="var(--accent-purple)" font-family="monospace">Q̄=${Qn}</text>
          </svg>

          <div style="display:flex;gap:12px;">
            ${[['Q',Q,'accent-green'],['Q̄',Qn,'accent-purple']].map(([label,val,col])=>`
              <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;">${label}</div>
                <div style="width:44px;height:44px;border-radius:50%;background:${val?`var(--${col})`:'var(--bg-tertiary)'};border:3px solid ${val?`var(--${col})`:'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:700;color:${val?'white':'var(--text-muted)'};">${val}</div>
              </div>`).join('')}
          </div>
        </div>

        <!-- 진리표 -->
        <div style="margin-top:10px;overflow-x:auto;">
          <table style="border-collapse:collapse;font-family:monospace;font-size:0.78rem;">
            <thead><tr style="background:var(--bg-secondary);">
              <th style="padding:3px 8px;border:1px solid var(--border);color:#f97316;">CLK</th>
              <th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-green);">D</th>
              <th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-blue);">Q(t+1)</th>
            </tr></thead>
            <tbody>
              ${[['↑','0','0'],['↑','1','1'],['0/1','X','Q(t)']].map(([c,d,q])=>`
                <tr><td style="text-align:center;padding:3px 8px;border:1px solid var(--border);color:#f97316;">${c}</td>
                    <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);">${d}</td>
                    <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);color:var(--accent-blue);">${q}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>

        <canvas id="d-timing" width="480" height="100" style="width:100%;border-radius:4px;background:var(--bg-secondary);margin-top:8px;"></canvas>
      `;

      const cvs = document.getElementById('d-timing');
      if (history.D.length > 1) {
        drawTimingCanvas(cvs, [
          {label:'D', data:history.D, color:'#10b981'},
          {label:'CLK', data:history.CLK, color:'#f97316'},
          {label:'Q', data:history.Q, color:'#3b82f6'},
        ]);
      }

      document.getElementById('d-in').addEventListener('click', () => { D ^= 1; draw(); });
      document.getElementById('d-clk').addEventListener('click', clock);
    }
    draw();
  }

  // ── JK 플립플롭 ──
  function renderJK(el) {
    let J = 0, K = 0, Q = 0, Qn = 1;
    const history = { J:[], K:[], CLK:[], Q:[] };

    function clock() {
      if (J===0 && K===0) {} // hold
      else if (J===0 && K===1) { Q = 0; Qn = 1; }
      else if (J===1 && K===0) { Q = 1; Qn = 0; }
      else { Q ^= 1; Qn = 1 - Q; } // toggle

      history.J.push(J); history.K.push(K); history.CLK.push(1); history.Q.push(Q);
      history.J.push(J); history.K.push(K); history.CLK.push(0); history.Q.push(Q);
      if (history.J.length > 20) ['J','K','CLK','Q'].forEach(k => history[k].splice(0,2));
      draw();
    }

    function draw() {
      const mode = J===0&&K===0?'유지':J===0&&K===1?'리셋':J===1&&K===0?'셋':'토글';
      el.innerHTML = `
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;margin-bottom:8px;text-transform:uppercase;">JK 플립플롭 — 현재 모드: <span style="color:var(--accent-blue);">${mode}</span></div>
        <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start;">
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${[['J','accent-green'],['K','accent-red']].map(([name,col])=>`
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-family:monospace;font-weight:700;color:var(--${col});min-width:18px;">${name}</span>
                <button class="unit-example-btn jk-in" data-v="${name}" style="min-width:40px;">${name==='J'?J:K}</button>
              </div>`).join('')}
            <button class="unit-example-btn" id="jk-clk" style="background:var(--accent-orange,#f97316);color:white;">CLK ↑ 펄스</button>
          </div>

          <svg width="180" height="110">
            <rect x="50" y="10" width="80" height="90" rx="6" fill="var(--bg-tertiary)" stroke="var(--accent-blue)" stroke-width="2"/>
            <text x="80" y="46" font-size="12" fill="var(--text-primary)" font-family="monospace" font-weight="bold">JK</text>
            <text x="75" y="62" font-size="10" fill="var(--text-muted)" font-family="monospace">FF</text>
            <line x1="5" y1="28" x2="50" y2="28" stroke="var(--accent-green)" stroke-width="2"/>
            <text x="2" y="24" font-size="10" fill="var(--accent-green)" font-family="monospace">J</text>
            <line x1="5" y1="82" x2="50" y2="82" stroke="var(--accent-red)" stroke-width="2"/>
            <text x="2" y="78" font-size="10" fill="var(--accent-red)" font-family="monospace">K</text>
            <line x1="5" y1="55" x2="50" y2="55" stroke="#f97316" stroke-width="2"/>
            <polygon points="50,51 58,55 50,59" fill="#f97316"/>
            <line x1="130" y1="28" x2="178" y2="28" stroke="${Q?'var(--accent-green)':'var(--border)'}" stroke-width="2"/>
            <text x="148" y="24" font-size="10" fill="var(--accent-green)" font-family="monospace">Q=${Q}</text>
            <line x1="130" y1="82" x2="178" y2="82" stroke="${Qn?'var(--accent-purple)':'var(--border)'}" stroke-width="2"/>
            <text x="140" y="78" font-size="10" fill="var(--accent-purple)" font-family="monospace">Q̄=${Qn}</text>
          </svg>

          <div style="display:flex;gap:12px;">
            ${[['Q',Q,'accent-green'],['Q̄',Qn,'accent-purple']].map(([label,val,col])=>`
              <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;">${label}</div>
                <div style="width:44px;height:44px;border-radius:50%;background:${val?`var(--${col})`:'var(--bg-tertiary)'};border:3px solid ${val?`var(--${col})`:'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:700;color:${val?'white':'var(--text-muted)'};">${val}</div>
              </div>`).join('')}
          </div>
        </div>

        <div style="margin-top:10px;overflow-x:auto;">
          <table style="border-collapse:collapse;font-family:monospace;font-size:0.78rem;">
            <thead><tr style="background:var(--bg-secondary);">
              <th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-green);">J</th>
              <th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-red);">K</th>
              <th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-blue);">Q(t+1)</th>
              <th style="padding:3px 8px;border:1px solid var(--border);color:var(--text-muted);">동작</th>
            </tr></thead>
            <tbody>
              ${[[0,0,'Q(t)','유지'],[0,1,'0','리셋'],[1,0,'1','셋'],[1,1,'Q̄(t)','토글']].map(([j,k,q,note])=>`
                <tr style="background:${J===j&&K===k?'rgba(59,130,246,0.15)':'transparent'};">
                  <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);">${j}</td>
                  <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);">${k}</td>
                  <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);color:var(--accent-blue);">${q}</td>
                  <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);color:var(--text-muted);">${note}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <canvas id="jk-timing" width="480" height="100" style="width:100%;border-radius:4px;background:var(--bg-secondary);margin-top:8px;"></canvas>
      `;

      const cvs = document.getElementById('jk-timing');
      if (history.J.length > 1) {
        drawTimingCanvas(cvs, [
          {label:'J', data:history.J, color:'#10b981'},
          {label:'K', data:history.K, color:'#ef4444'},
          {label:'CLK', data:history.CLK, color:'#f97316'},
          {label:'Q', data:history.Q, color:'#3b82f6'},
        ]);
      }

      el.querySelectorAll('.jk-in').forEach(btn => btn.addEventListener('click', () => {
        if (btn.dataset.v === 'J') J ^= 1; else K ^= 1; draw();
      }));
      document.getElementById('jk-clk').addEventListener('click', clock);
    }
    draw();
  }

  // ── T 플립플롭 ──
  function renderT(el) {
    let T = 0, Q = 0, Qn = 1;
    const history = { T:[], CLK:[], Q:[] };

    function clock() {
      if (T) { Q ^= 1; Qn = 1 - Q; }
      history.T.push(T); history.CLK.push(1); history.Q.push(Q);
      history.T.push(T); history.CLK.push(0); history.Q.push(Q);
      if (history.T.length > 20) ['T','CLK','Q'].forEach(k => history[k].splice(0,2));
      draw();
    }

    function draw() {
      el.innerHTML = `
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;margin-bottom:8px;text-transform:uppercase;">T 플립플롭 — T=1이면 CLK마다 토글</div>
        <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start;">
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-family:monospace;font-weight:700;color:var(--accent-green);min-width:18px;">T</span>
              <button class="unit-example-btn" id="t-in" style="min-width:40px;">${T}</button>
            </div>
            <button class="unit-example-btn" id="t-clk" style="background:var(--accent-orange,#f97316);color:white;">CLK ↑ 펄스</button>
            <div style="font-size:0.72rem;color:var(--text-muted);">T=0: 유지<br>T=1: 토글</div>
          </div>

          <svg width="180" height="100">
            <rect x="50" y="10" width="80" height="80" rx="6" fill="var(--bg-tertiary)" stroke="var(--accent-blue)" stroke-width="2"/>
            <text x="82" y="46" font-size="12" fill="var(--text-primary)" font-family="monospace" font-weight="bold">T</text>
            <text x="75" y="62" font-size="10" fill="var(--text-muted)" font-family="monospace">FF</text>
            <line x1="5" y1="35" x2="50" y2="35" stroke="var(--accent-green)" stroke-width="2"/>
            <text x="2" y="31" font-size="10" fill="var(--accent-green)" font-family="monospace">T</text>
            <line x1="5" y1="72" x2="50" y2="72" stroke="#f97316" stroke-width="2"/>
            <polygon points="50,68 58,72 50,76" fill="#f97316"/>
            <line x1="130" y1="30" x2="178" y2="30" stroke="${Q?'var(--accent-green)':'var(--border)'}" stroke-width="2"/>
            <text x="148" y="26" font-size="10" fill="var(--accent-green)" font-family="monospace">Q=${Q}</text>
            <line x1="130" y1="72" x2="178" y2="72" stroke="${Qn?'var(--accent-purple)':'var(--border)'}" stroke-width="2"/>
            <text x="140" y="68" font-size="10" fill="var(--accent-purple)" font-family="monospace">Q̄=${Qn}</text>
          </svg>

          <div style="display:flex;gap:12px;">
            ${[['Q',Q,'accent-green'],['Q̄',Qn,'accent-purple']].map(([label,val,col])=>`
              <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;">${label}</div>
                <div style="width:44px;height:44px;border-radius:50%;background:${val?`var(--${col})`:'var(--bg-tertiary)'};border:3px solid ${val?`var(--${col})`:'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:700;color:${val?'white':'var(--text-muted)'};">${val}</div>
              </div>`).join('')}
          </div>
        </div>

        <div style="margin-top:10px;overflow-x:auto;">
          <table style="border-collapse:collapse;font-family:monospace;font-size:0.78rem;">
            <thead><tr style="background:var(--bg-secondary);">
              <th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-green);">T</th>
              <th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-blue);">Q(t+1)</th>
              <th style="padding:3px 8px;border:1px solid var(--border);color:var(--text-muted);">동작</th>
            </tr></thead>
            <tbody>
              ${[[0,'Q(t)','유지'],[1,'Q̄(t)','토글']].map(([t,q,note])=>`
                <tr style="background:${T===t?'rgba(59,130,246,0.15)':'transparent'};">
                  <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);">${t}</td>
                  <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);color:var(--accent-blue);">${q}</td>
                  <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);color:var(--text-muted);">${note}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <canvas id="t-timing" width="480" height="90" style="width:100%;border-radius:4px;background:var(--bg-secondary);margin-top:8px;"></canvas>
      `;

      const cvs = document.getElementById('t-timing');
      if (history.T.length > 1) {
        drawTimingCanvas(cvs, [
          {label:'T', data:history.T, color:'#10b981'},
          {label:'CLK', data:history.CLK, color:'#f97316'},
          {label:'Q', data:history.Q, color:'#3b82f6'},
        ]);
      }

      document.getElementById('t-in').addEventListener('click', () => { T ^= 1; draw(); });
      document.getElementById('t-clk').addEventListener('click', clock);
    }
    draw();
  }

  container.querySelectorAll('.ff-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = +btn.dataset.tab;
      container.querySelectorAll('.ff-tab').forEach(b => {
        b.style.background = b === btn ? 'var(--accent-blue)' : '';
        b.style.color = b === btn ? 'white' : '';
      });
      render();
    });
  });

  render();
}
