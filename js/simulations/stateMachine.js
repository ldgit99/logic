// ─── 유한 상태 기계 (FSM) 인터랙티브 시뮬레이터 ───

export function mountStateMachine(container) {
  // Predefined FSMs
  const FSMS = [
    {
      name: '모드-3 업카운터',
      desc: '0→1→2→0 순환 (Moore FSM)',
      states: ['S0','S1','S2'],
      inputs: ['CLK'],
      initial: 'S0',
      outputs: {'S0':'00','S1':'01','S2':'10'},
      transitions: {
        'S0': {'1': 'S1'},
        'S1': {'1': 'S2'},
        'S2': {'1': 'S0'},
      },
      stateLabels: {'S0':'Q=00','S1':'Q=01','S2':'Q=10'},
    },
    {
      name: '1011 시퀀스 검출기',
      desc: '입력 X에서 "1011" 시퀀스 감지 시 Z=1 출력 (Mealy FSM)',
      states: ['A','B','C','D'],
      inputs: ['X'],
      initial: 'A',
      outputs: null, // Mealy: output on transition
      transitions: {
        'A': {'0': 'A', '1': 'B'},
        'B': {'0': 'A', '1': 'B'},  // wait for 10
        'C': {'0': 'A', '1': 'D'},
        'D': {'0': 'A', '1': 'B'},  // detected 1011
      },
      mealyOutputs: {
        'A,0':'0','A,1':'0',
        'B,0':'0','B,1':'0',
        'C,0':'0','C,1':'0',
        'D,0':'1','D,1':'0',
      },
      stateLabels: {'A':'초기','B':'1','C':'10','D':'101'},
    },
    {
      name: '자동판매기 (50원/100원)',
      desc: '50원 동전(A=1)과 100원 동전(B=1) 투입으로 150원 상품 판매 (Moore)',
      states: ['S0','S1','S2','S3'],
      inputs: ['A','B'],
      initial: 'S0',
      outputs: {'S0':'OUT=0','S1':'OUT=0','S2':'OUT=0','S3':'OUT=1'},
      transitions: {
        'S0': {'10': 'S1', '01': 'S2', '00': 'S0'},
        'S1': {'10': 'S2', '01': 'S3', '00': 'S1'},
        'S2': {'10': 'S3', '01': 'S3', '00': 'S2'},
        'S3': {'10': 'S0', '01': 'S0', '00': 'S0'},
      },
      stateLabels: {'S0':'0원','S1':'50원','S2':'100원','S3':'판매!'},
    },
  ];

  let activeFsm = 0;
  let fsmState = '';
  let inputVal = '';
  let log = [];

  function initFsm() {
    const fsm = FSMS[activeFsm];
    fsmState = fsm.initial;
    inputVal = fsm.inputs.length === 1 ? '0' : '00';
    log = [];
    render();
  }

  // SVG state diagram positions
  const statePos = {
    1: [[200,120]],
    2: [[100,120],[300,120]],
    3: [[200,60],[80,180],[320,180]],
    4: [[130,70],[330,70],[130,170],[330,170]],
  };

  function getStatePos(nStates, idx) {
    const positions = statePos[nStates] || statePos[4];
    return positions[idx] || [200,120];
  }

  function render() {
    const fsm = FSMS[activeFsm];
    const nStates = fsm.states.length;

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <!-- FSM 선택 -->
        <div>
          <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:4px;">FSM 예제 선택</div>
          <select id="fsm-sel" style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);padding:6px 10px;font-size:0.85rem;width:100%;">
            ${FSMS.map((f,i) => `<option value="${i}" ${i===activeFsm?'selected':''}>${f.name}</option>`).join('')}
          </select>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:3px;">${fsm.desc}</div>
        </div>

        <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start;">
          <!-- 상태 다이어그램 SVG -->
          <div>
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:4px;">상태 다이어그램</div>
            <svg width="420" height="240" style="background:var(--bg-tertiary);border-radius:6px;border:1px solid var(--border);">
              ${renderFsmSvg(fsm)}
            </svg>
          </div>

          <!-- 제어 패널 -->
          <div style="display:flex;flex-direction:column;gap:8px;min-width:160px;">
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;">현재 상태</div>
            <div style="font-size:1.4rem;font-weight:700;color:var(--accent-blue);font-family:monospace;">${fsmState}</div>
            <div style="font-size:0.78rem;color:var(--text-muted);">${fsm.stateLabels[fsmState] || ''}</div>
            ${fsm.outputs ? `<div style="font-size:0.82rem;color:var(--accent-green);font-weight:700;">출력: ${fsm.outputs[fsmState]||''}</div>` : ''}

            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-top:4px;">입력값</div>
            ${fsm.inputs.map((inp,idx) => `
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-family:monospace;font-weight:700;color:var(--accent-purple);min-width:24px;">${inp}</span>
                <button class="unit-example-btn fsm-inp" data-idx="${idx}" style="min-width:36px;">${inputVal[idx]||'0'}</button>
              </div>`).join('')}

            <button class="unit-example-btn" id="fsm-step" style="background:var(--accent-blue);color:white;margin-top:4px;">다음 상태 →</button>
            <button class="unit-example-btn" id="fsm-reset" style="margin-top:2px;">초기화</button>
          </div>
        </div>

        <!-- 상태 천이 이력 -->
        ${log.length > 0 ? `
        <div>
          <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:4px;">상태 천이 이력</div>
          <div style="background:var(--bg-tertiary);border-radius:4px;padding:8px;font-family:monospace;font-size:0.8rem;max-height:100px;overflow-y:auto;">
            ${log.map(e => `<div style="color:${e.out?'var(--accent-green)':'var(--text-primary)'};">${e.from} →<span style="color:var(--accent-purple);">[${e.input}]</span>→ ${e.to}${e.out?` (출력: ${e.out})`:''}${e.mout?` Z=${e.mout}`:''}</div>`).join('')}
          </div>
        </div>` : ''}

        <!-- 상태 전이 테이블 -->
        <div style="overflow-x:auto;">
          <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:4px;">상태 전이 표</div>
          ${renderTransitionTable(fsm)}
        </div>
      </div>
    `;

    document.getElementById('fsm-sel').addEventListener('change', e => {
      activeFsm = +e.target.value; initFsm();
    });

    container.querySelectorAll('.fsm-inp').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = +btn.dataset.idx;
        const arr = inputVal.split('');
        arr[idx] = arr[idx] === '0' ? '1' : '0';
        inputVal = arr.join('');
        render();
      });
    });

    document.getElementById('fsm-step').addEventListener('click', () => {
      const fsm = FSMS[activeFsm];
      const trans = fsm.transitions[fsmState];
      if (!trans) return;
      const nextState = trans[inputVal] || trans[Object.keys(trans)[0]];
      if (!nextState) return;
      const mout = fsm.mealyOutputs ? (fsm.mealyOutputs[`${fsmState},${inputVal}`]||'') : '';
      log.push({ from: fsmState, input: inputVal, to: nextState, out: fsm.outputs?.[nextState], mout });
      if (log.length > 12) log.shift();
      fsmState = nextState;
      render();
    });

    document.getElementById('fsm-reset').addEventListener('click', initFsm);
  }

  function renderFsmSvg(fsm) {
    const nStates = fsm.states.length;
    const positions = {};
    fsm.states.forEach((s, i) => {
      positions[s] = getStatePos(nStates, i);
    });

    let svg = '';

    // Draw transitions (arrows)
    Object.entries(fsm.transitions).forEach(([from, trans]) => {
      Object.entries(trans).forEach(([inp, to]) => {
        if (from === to) {
          // Self loop
          const [x,y] = positions[from];
          svg += `<path d="M${x-10},${y-28} Q${x},${y-55} ${x+10},${y-28}" fill="none" stroke="var(--border)" stroke-width="1.5" marker-end="url(#arrow)"/>`;
          svg += `<text x="${x}" y="${y-52}" font-size="10" fill="var(--text-muted)" text-anchor="middle" font-family="monospace">${inp}</text>`;
        } else {
          const [x1,y1] = positions[from];
          const [x2,y2] = positions[to];
          const dx = x2-x1, dy = y2-y1;
          const len = Math.sqrt(dx*dx+dy*dy);
          const r = 28;
          const sx = x1 + dx/len*r, sy = y1 + dy/len*r;
          const ex = x2 - dx/len*r, ey = y2 - dy/len*r;
          const mx = (sx+ex)/2 + dy/len*18, my = (sy+ey)/2 - dx/len*18;
          svg += `<path d="M${sx},${sy} Q${mx},${my} ${ex},${ey}" fill="none" stroke="${from===fsmState?'var(--accent-blue)':'var(--border)'}" stroke-width="${from===fsmState?2:1.5}" marker-end="url(#arrow)"/>`;
          const lx = (sx+mx)/2 + (mx+ex)/4 - (ex-sx)/len*0 + dy/len*3;
          const ly = (sy+my)/2 + (my+ey)/4 - (ey-sy)/len*0 - dx/len*3;
          const mout = fsm.mealyOutputs ? `/${fsm.mealyOutputs[`${from},${inp}`]||'?'}` : '';
          svg += `<text x="${(sx+ex)/2+dy/len*22}" y="${(sy+ey)/2-dx/len*22+4}" font-size="10" fill="${from===fsmState?'var(--accent-blue)':'var(--text-muted)'}" text-anchor="middle" font-family="monospace">${inp}${mout}</text>`;
        }
      });
    });

    // Draw states
    fsm.states.forEach((s, i) => {
      const [x,y] = positions[s];
      const isCurrent = s === fsmState;
      const isInitial = s === fsm.initial;
      svg += `<circle cx="${x}" cy="${y}" r="28" fill="${isCurrent?'var(--accent-blue)':'var(--bg-secondary)'}" stroke="${isCurrent?'var(--accent-blue)':'var(--border)'}" stroke-width="${isCurrent?3:2}"/>`;
      if (fsm.outputs && (fsm.outputs[s] === 'OUT=1' || fsm.outputs[s] === 'Q=10')) {
        svg += `<circle cx="${x}" cy="${y}" r="24" fill="none" stroke="${isCurrent?'white':'var(--border)'}" stroke-width="1" stroke-dasharray="3"/>`;
      }
      svg += `<text x="${x}" y="${y-4}" font-size="12" fill="${isCurrent?'white':'var(--text-primary)'}" text-anchor="middle" font-family="monospace" font-weight="bold">${s}</text>`;
      svg += `<text x="${x}" y="${y+12}" font-size="9" fill="${isCurrent?'rgba(255,255,255,0.8)':'var(--text-muted)'}" text-anchor="middle" font-family="monospace">${fsm.stateLabels[s]||''}</text>`;
      if (isInitial) {
        svg += `<line x1="${x-45}" y1="${y}" x2="${x-30}" y2="${y}" stroke="var(--accent-green)" stroke-width="2" marker-end="url(#arrow)"/>`;
      }
    });

    return `<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="var(--border)"/></marker></defs>${svg}`;
  }

  function renderTransitionTable(fsm) {
    const inputKeys = Object.values(fsm.transitions).flatMap(t => Object.keys(t));
    const uniqueInputs = [...new Set(inputKeys)].sort();

    return `<table style="border-collapse:collapse;font-family:monospace;font-size:0.78rem;">
      <thead><tr style="background:var(--bg-secondary);">
        <th style="padding:3px 8px;border:1px solid var(--border);color:var(--text-muted);">현재 상태</th>
        ${uniqueInputs.map(inp => `<th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-purple);">입력 ${inp}</th>`).join('')}
        ${fsm.outputs ? '<th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-green);">출력</th>' : ''}
      </tr></thead>
      <tbody>
        ${fsm.states.map(s => `
          <tr style="background:${s===fsmState?'rgba(59,130,246,0.15)':'transparent'};">
            <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);font-weight:700;color:${s===fsmState?'var(--accent-blue)':'var(--text-primary)'};">${s}</td>
            ${uniqueInputs.map(inp => {
              const next = fsm.transitions[s]?.[inp] || '-';
              const mout = fsm.mealyOutputs ? ` / Z=${fsm.mealyOutputs[`${s},${inp}`]||'0'}` : '';
              return `<td style="text-align:center;padding:3px 8px;border:1px solid var(--border);color:var(--accent-blue);">${next}${mout}</td>`;
            }).join('')}
            ${fsm.outputs ? `<td style="text-align:center;padding:3px 8px;border:1px solid var(--border);color:var(--accent-green);">${fsm.outputs[s]||''}</td>` : ''}
          </tr>`).join('')}
      </tbody>
    </table>`;
  }

  initFsm();
}
