// ─── NAND/NOR 게이트 변환 시뮬레이터 ───

const CONVERSIONS = {
  NOT_NAND:  { title: 'NOT → NAND', desc: '입출력 연결 NAND', formula: 'Ā = NAND(A,A)' },
  AND_NAND:  { title: 'AND → NAND', desc: 'NAND + NAND(NOT)', formula: 'AB = NAND(NAND(A,B), NAND(A,B))' },
  OR_NAND:   { title: 'OR → NAND',  desc: '각 입력 NOT 후 NAND', formula: 'A+B = NAND(Ā,B̄) = NAND(NAND(A,A), NAND(B,B))' },
  NOT_NOR:   { title: 'NOT → NOR',  desc: '입출력 연결 NOR', formula: 'Ā = NOR(A,A)' },
  OR_NOR:    { title: 'OR → NOR',   desc: 'NOR + NOR(NOT)', formula: 'A+B = NOR(NOR(A,B), NOR(A,B))' },
  AND_NOR:   { title: 'AND → NOR',  desc: '각 입력 NOT 후 NOR', formula: 'AB = NOR(Ā,B̄) = NOR(NOR(A,A), NOR(B,B))' },
};

function drawConvSVG(type, A, B) {
  const W = 340, H = 100;
  const nand = (a, b) => +(!(a & b));
  const nor  = (a, b) => +(!(a | b));

  let shapes = '', result = 0;
  const gateColor = type.includes('NAND') ? 'var(--accent-blue)' : 'var(--accent-purple)';
  const fn = type.includes('NAND') ? nand : nor;
  const gName = type.includes('NAND') ? 'NAND' : 'NOR';

  if (type === 'NOT_NAND' || type === 'NOT_NOR') {
    result = fn(A, A);
    // Single gate, inputs tied
    shapes = `
      <text x="10" y="55" font-family="monospace" font-size="13" fill="${A?'#60a5fa':'#64748b'}">A=${A}</text>
      <line x1="50" y1="40" x2="100" y2="40" stroke="${A?'#60a5fa':'#475569'}" stroke-width="2"/>
      <line x1="50" y1="60" x2="100" y2="60" stroke="${A?'#60a5fa':'#475569'}" stroke-width="2"/>
      <line x1="50" y1="50" x2="50" y2="40" stroke="${A?'#60a5fa':'#475569'}" stroke-width="1.5"/>
      <line x1="50" y1="50" x2="50" y2="60" stroke="${A?'#60a5fa':'#475569'}" stroke-width="1.5"/>
      ${drawGateShape(gName, 100, 25, 80, 50, gateColor)}
      <line x1="200" y1="50" x2="260" y2="50" stroke="${result?'#34d399':'#475569'}" stroke-width="2.5"/>
      <text x="265" y="55" font-family="monospace" font-size="13" fill="${result?'#34d399':'#64748b'}">F=${result}</text>
    `;
  } else if (type === 'AND_NAND' || type === 'OR_NOR') {
    // NAND-NAND for AND, NOR-NOR for OR
    const mid = fn(A, B);
    result = fn(mid, mid);
    shapes = `
      <text x="2" y="38" font-family="monospace" font-size="12" fill="${A?'#60a5fa':'#64748b'}">A=${A}</text>
      <text x="2" y="70" font-family="monospace" font-size="12" fill="${B?'#60a5fa':'#64748b'}">B=${B}</text>
      <line x1="38" y1="35" x2="70" y2="35" stroke="${A?'#60a5fa':'#475569'}" stroke-width="2"/>
      <line x1="38" y1="65" x2="70" y2="65" stroke="${B?'#60a5fa':'#475569'}" stroke-width="2"/>
      ${drawGateShape(gName, 70, 20, 70, 50, gateColor)}
      <line x1="158" y1="50" x2="190" y2="50" stroke="${mid?'#f59e0b':'#475569'}" stroke-width="2"/>
      <line x1="190" y1="50" x2="190" y2="35" stroke="${mid?'#f59e0b':'#475569'}" stroke-width="1.5"/>
      <line x1="190" y1="50" x2="190" y2="65" stroke="${mid?'#f59e0b':'#475569'}" stroke-width="1.5"/>
      ${drawGateShape(gName, 190, 20, 70, 50, gateColor)}
      <line x1="278" y1="50" x2="310" y2="50" stroke="${result?'#34d399':'#475569'}" stroke-width="2.5"/>
      <text x="314" y="55" font-family="monospace" font-size="12" fill="${result?'#34d399':'#64748b'}">F=${result}</text>
    `;
  } else {
    // OR_NAND or AND_NOR: each input NOTed first
    const notA = fn(A, A), notB = fn(B, B);
    result = fn(notA, notB);
    shapes = `
      <text x="2" y="32" font-family="monospace" font-size="11" fill="${A?'#60a5fa':'#64748b'}">A=${A}</text>
      <text x="2" y="80" font-family="monospace" font-size="11" fill="${B?'#60a5fa':'#64748b'}">B=${B}</text>
      <line x1="30" y1="28" x2="60" y2="28" stroke="${A?'#60a5fa':'#475569'}" stroke-width="2"/>
      <line x1="60" y1="28" x2="60" y2="20" stroke="${A?'#60a5fa':'#475569'}" stroke-width="1.5"/>
      <line x1="60" y1="28" x2="60" y2="36" stroke="${A?'#60a5fa':'#475569'}" stroke-width="1.5"/>
      ${drawGateShape(gName, 60, 5, 60, 30, gateColor)}
      <line x1="30" y1="75" x2="60" y2="75" stroke="${B?'#60a5fa':'#475569'}" stroke-width="2"/>
      <line x1="60" y1="75" x2="60" y2="67" stroke="${B?'#60a5fa':'#475569'}" stroke-width="1.5"/>
      <line x1="60" y1="75" x2="60" y2="83" stroke="${B?'#60a5fa':'#475569'}" stroke-width="1.5"/>
      ${drawGateShape(gName, 60, 60, 60, 75, gateColor)}
      <line x1="133" y1="30" x2="195" y2="30" stroke="${notA?'#f59e0b':'#475569'}" stroke-width="2"/>
      <line x1="133" y1="75" x2="195" y2="75" stroke="${notB?'#f59e0b':'#475569'}" stroke-width="2"/>
      ${drawGateShape(gName, 195, 15, 80, 52, gateColor)}
      <line x1="290" y1="52" x2="320" y2="52" stroke="${result?'#34d399':'#475569'}" stroke-width="2.5"/>
      <text x="322" y="56" font-family="monospace" font-size="12" fill="${result?'#34d399':'#64748b'}">F=${result}</text>
    `;
  }

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" style="overflow:visible;max-width:${W}px">${shapes}</svg>`;
}

function drawGateShape(type, x, y, w, midY, color) {
  const isNand = type === 'NAND';
  const gMid = y + (midY - y);
  const gh = (midY - y) * 2;
  const gy = y;
  const outX = x + w;
  const hasNot = true;

  // Simplified AND/OR shape
  return `<path d="M${x},${gy} L${x+w*0.6},${gy} Q${outX-8},${gy} ${outX-8},${gMid} Q${outX-8},${gy+gh} ${x+w*0.6},${gy+gh} L${x},${gy+gh} Z"
    fill="var(--bg-secondary)" stroke="${color}" stroke-width="1.5"/>
    <circle cx="${outX}" cy="${gMid}" r="4" fill="var(--bg-secondary)" stroke="${color}" stroke-width="1.5"/>`;
}

export function mountNandNorConvert(container) {
  let selectedType = 'NOT_NAND';
  let A = 1, B = 0;

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <!-- 변환 선택 -->
      <div>
        <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:6px;text-transform:uppercase;">
          변환 방식 선택
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;" id="nnc-btns"></div>
      </div>

      <!-- 설명 -->
      <div id="nnc-desc" style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:12px;font-size:0.85rem;"></div>

      <!-- 회로도 -->
      <div id="nnc-svg" style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:12px;overflow:hidden;"></div>

      <!-- 입력 조작 -->
      <div style="display:flex;gap:12px;align-items:center;">
        <span style="font-size:0.75rem;color:var(--text-muted);font-weight:700;">입력:</span>
        <button class="unit-example-btn" id="nnc-a" style="min-width:50px;">A = 1</button>
        <button class="unit-example-btn" id="nnc-b" style="min-width:50px;">B = 0</button>
        <div style="display:flex;gap:8px;margin-left:8px;">
          <button class="unit-example-btn nnc-combo" data-a="0" data-b="0">A=0,B=0</button>
          <button class="unit-example-btn nnc-combo" data-a="0" data-b="1">A=0,B=1</button>
          <button class="unit-example-btn nnc-combo" data-a="1" data-b="0">A=1,B=0</button>
          <button class="unit-example-btn nnc-combo" data-a="1" data-b="1">A=1,B=1</button>
        </div>
      </div>

      <!-- 진리표 검증 -->
      <div id="nnc-verify" style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:12px;"></div>
    </div>
  `;

  const btnsEl = document.getElementById('nnc-btns');
  const descEl = document.getElementById('nnc-desc');
  const svgEl = document.getElementById('nnc-svg');
  const verifyEl = document.getElementById('nnc-verify');
  const btnA = document.getElementById('nnc-a');
  const btnB = document.getElementById('nnc-b');

  Object.entries(CONVERSIONS).forEach(([key, val]) => {
    const btn = document.createElement('button');
    btn.className = 'unit-example-btn';
    btn.textContent = val.title;
    btn.dataset.key = key;
    btn.addEventListener('click', () => { selectedType = key; render(); });
    btnsEl.appendChild(btn);
  });

  btnA.addEventListener('click', () => { A ^= 1; render(); });
  btnB.addEventListener('click', () => { B ^= 1; render(); });
  container.querySelectorAll('.nnc-combo').forEach(btn => {
    btn.addEventListener('click', () => {
      A = parseInt(btn.dataset.a); B = parseInt(btn.dataset.b); render();
    });
  });

  function buildVerify(type) {
    const fn = type.includes('NAND') ? (a,b) => +(!(a&b)) : (a,b) => +(!(a|b));
    const isNot = type.includes('NOT_');
    const isAnd = type === 'AND_NAND' || type === 'AND_NOR';
    const isOr  = type === 'OR_NAND' || type === 'OR_NOR';

    let header = `<th>A</th>${!isNot?'<th>B</th>':''}`;
    let expected = '', rows = '';

    if (isNot) {
      header += '<th>Ā (기대)</th><th>회로 출력</th><th>✓</th>';
      for (let a=0; a<=1; a++) {
        const exp = 1-a, got = type==='NOT_NAND'?fn(a,a):fn(a,a);
        const ok = exp===got;
        rows += `<tr><td>${a}</td><td>${exp}</td><td style="color:${got?'var(--accent-green)':'var(--text-muted)'};">${got}</td><td>${ok?'✓':'✗'}</td></tr>`;
      }
    } else {
      const label = isAnd ? 'A·B (기대)' : 'A+B (기대)';
      header += `<th>${label}</th><th>회로 출력</th><th>✓</th>`;
      for (let a=0; a<=1; a++) for (let b=0; b<=1; b++) {
        const exp = isAnd ? a&b : a|b;
        let got;
        if (type === 'AND_NAND') { const m = fn(a,b); got = fn(m,m); }
        else if (type === 'OR_NOR') { const m = fn(a,b); got = fn(m,m); }
        else if (type === 'OR_NAND') { got = fn(fn(a,a), fn(b,b)); }
        else { got = fn(fn(a,a), fn(b,b)); }
        const ok = exp===got;
        rows += `<tr><td>${a}</td><td>${b}</td><td style="font-weight:700;color:${exp?'var(--accent-blue)':'var(--text-muted)'};">${exp}</td><td style="color:${got?'var(--accent-green)':'var(--text-muted)'};">${got}</td><td style="color:${ok?'var(--accent-green)':'var(--accent-red)'};">${ok?'✓':'✗'}</td></tr>`;
      }
    }
    return `<div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:6px;text-transform:uppercase;">진리표 검증</div>
    <table style="border-collapse:collapse;font-family:monospace;font-size:0.82rem;">
      <thead><tr style="background:var(--bg-secondary);">${header.split('<th>').slice(1).map(h => `<th style="padding:4px 10px;border:1px solid var(--border);">${h.replace('</th>','')}</th>`).join('')}</tr></thead>
      <tbody>${rows.replace(/<td>/g,'<td style="text-align:center;padding:4px 10px;border:1px solid var(--border);">').replace(/<td style="([^"]+)">/g,'<td style="text-align:center;padding:4px 10px;border:1px solid var(--border);$1">')}</tbody>
    </table>`;
  }

  function render() {
    const conv = CONVERSIONS[selectedType];
    const needsB = !selectedType.includes('NOT_');

    // Button styles
    btnsEl.querySelectorAll('.unit-example-btn').forEach(btn => {
      const active = btn.dataset.key === selectedType;
      btn.style.background = active ? 'var(--accent-blue)' : '';
      btn.style.color = active ? 'white' : '';
      btn.style.borderColor = active ? 'var(--accent-blue)' : '';
    });

    // Input buttons
    btnA.textContent = `A = ${A}`;
    btnA.style.background = A ? 'var(--accent-blue)' : '';
    btnA.style.color = A ? 'white' : '';
    btnB.textContent = `B = ${B}`;
    btnB.style.background = B ? 'var(--accent-blue)' : '';
    btnB.style.color = B ? 'white' : '';
    btnB.style.display = needsB ? '' : 'none';

    descEl.innerHTML = `<strong style="color:var(--accent-blue);">${conv.title}</strong> — ${conv.desc}<br>
      <span style="font-family:monospace;color:var(--accent-green);">${conv.formula}</span>`;

    svgEl.innerHTML = drawConvSVG(selectedType, A, B);
    verifyEl.innerHTML = buildVerify(selectedType);
  }

  render();
}
