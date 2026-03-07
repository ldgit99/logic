// ─── 반가산기 / 전가산기 시뮬레이터 ───

export function mountHalfFullAdder(container) {
  let mode = 'half';
  let A = 0, B = 0, Cin = 0;

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <!-- 모드 선택 -->
      <div style="display:flex;gap:8px;">
        <button class="unit-example-btn ha-mode" data-mode="half" style="background:var(--accent-blue);color:white;border-color:var(--accent-blue);">반가산기 (Half Adder)</button>
        <button class="unit-example-btn ha-mode" data-mode="full">전가산기 (Full Adder)</button>
      </div>

      <!-- 입력 제어 -->
      <div style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:14px;">
        <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap;margin-bottom:14px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-family:monospace;font-size:1rem;color:var(--accent-blue);font-weight:700;min-width:20px;">A</span>
            <button class="ha-input-btn" data-var="A" style="width:52px;height:36px;border-radius:4px;font-family:monospace;font-size:1.1rem;font-weight:700;background:var(--bg-secondary);color:var(--text-muted);border:1px solid var(--border);cursor:pointer;">0</button>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-family:monospace;font-size:1rem;color:var(--accent-blue);font-weight:700;min-width:20px;">B</span>
            <button class="ha-input-btn" data-var="B" style="width:52px;height:36px;border-radius:4px;font-family:monospace;font-size:1.1rem;font-weight:700;background:var(--bg-secondary);color:var(--text-muted);border:1px solid var(--border);cursor:pointer;">0</button>
          </div>
          <div id="ha-cin-wrap" style="display:none;align-items:center;gap:10px;">
            <span style="font-family:monospace;font-size:1rem;color:var(--accent-yellow);font-weight:700;min-width:36px;">Cin</span>
            <button class="ha-input-btn" data-var="Cin" style="width:52px;height:36px;border-radius:4px;font-family:monospace;font-size:1.1rem;font-weight:700;background:var(--bg-secondary);color:var(--text-muted);border:1px solid var(--border);cursor:pointer;">0</button>
          </div>
        </div>

        <!-- 결과 -->
        <div id="ha-result" style="display:flex;gap:24px;align-items:center;flex-wrap:wrap;"></div>
      </div>

      <!-- 논리식 -->
      <div id="ha-formula" style="font-size:0.85rem;font-family:monospace;background:var(--bg-tertiary);padding:10px 14px;border-radius:var(--radius-sm);color:var(--text-secondary);line-height:1.8;"></div>

      <!-- 진리표 -->
      <div id="ha-table" style="overflow-x:auto;"></div>
    </div>
  `;

  container.querySelectorAll('.ha-mode').forEach(btn => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      container.querySelectorAll('.ha-mode').forEach(b => {
        b.style.background = b.dataset.mode === mode ? 'var(--accent-blue)' : '';
        b.style.color = b.dataset.mode === mode ? 'white' : '';
        b.style.borderColor = b.dataset.mode === mode ? 'var(--accent-blue)' : '';
      });
      document.getElementById('ha-cin-wrap').style.display = mode === 'full' ? 'flex' : 'none';
      render();
    });
  });

  container.querySelectorAll('.ha-input-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.var;
      if (v === 'A') A ^= 1;
      else if (v === 'B') B ^= 1;
      else Cin ^= 1;
      render();
    });
  });

  function render() {
    // Update input buttons
    container.querySelectorAll('.ha-input-btn').forEach(btn => {
      const v = btn.dataset.var;
      const val = v === 'A' ? A : v === 'B' ? B : Cin;
      btn.textContent = val;
      btn.style.background = val ? 'var(--accent-blue)' : 'var(--bg-secondary)';
      btn.style.color = val ? 'white' : 'var(--text-muted)';
      btn.style.borderColor = val ? 'var(--accent-blue)' : 'var(--border)';
    });

    let S, Cout;
    if (mode === 'half') {
      S = A ^ B;
      Cout = A & B;
    } else {
      S = A ^ B ^ Cin;
      Cout = (A & B) | (B & Cin) | (A & Cin);
    }

    const resultEl = document.getElementById('ha-result');
    resultEl.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
        <span style="font-size:0.7rem;color:var(--text-muted);">합 S</span>
        <span style="width:56px;height:56px;border-radius:8px;display:flex;align-items:center;justify-content:center;
          font-family:monospace;font-size:2rem;font-weight:700;
          background:${S?'var(--accent-green)':'var(--bg-secondary)'};
          color:${S?'white':'var(--text-muted)'};
          border:2px solid ${S?'var(--accent-green)':'var(--border)'};">${S}</span>
        <span style="font-size:0.65rem;color:var(--text-muted);">(Sum)</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
        <span style="font-size:0.7rem;color:var(--text-muted);">올림수 C</span>
        <span style="width:56px;height:56px;border-radius:8px;display:flex;align-items:center;justify-content:center;
          font-family:monospace;font-size:2rem;font-weight:700;
          background:${Cout?'var(--accent-red)':'var(--bg-secondary)'};
          color:${Cout?'white':'var(--text-muted)'};
          border:2px solid ${Cout?'var(--accent-red)':'var(--border)'};">${Cout}</span>
        <span style="font-size:0.65rem;color:var(--text-muted);">(Carry)</span>
      </div>
      <div style="font-size:0.85rem;color:var(--text-secondary);">
        ${A}+${B}${mode==='full'?'+'+Cin:''} = <strong style="color:var(--accent-green);">${Cout}${S}</strong>₂ = <strong>${(mode==='half'?A+B:A+B+Cin)}</strong>₁₀
      </div>
    `;

    const formulaEl = document.getElementById('ha-formula');
    if (mode === 'half') {
      formulaEl.innerHTML = `
        반가산기 논리식:<br>
        S = A ⊕ B = ${A}⊕${B} = <strong style="color:var(--accent-green);">${S}</strong><br>
        C = A · B = ${A}·${B} = <strong style="color:var(--accent-red);">${Cout}</strong>
      `;
    } else {
      formulaEl.innerHTML = `
        전가산기 논리식:<br>
        S = A ⊕ B ⊕ Cin = ${A}⊕${B}⊕${Cin} = <strong style="color:var(--accent-green);">${S}</strong><br>
        Cout = AB + BCin + ACin = ${A}&${B} | ${B}&${Cin} | ${A}&${Cin} = <strong style="color:var(--accent-red);">${Cout}</strong>
      `;
    }

    renderTruthTable();
  }

  function renderTruthTable() {
    const tableEl = document.getElementById('ha-table');
    const rows = mode === 'half' ? 4 : 8;
    const n = mode === 'half' ? 2 : 3;

    let html = `<table style="border-collapse:collapse;font-family:monospace;font-size:0.82rem;">
      <thead><tr style="background:var(--bg-secondary);">
        <th style="padding:4px 10px;border:1px solid var(--border);color:var(--accent-blue);">A</th>
        <th style="padding:4px 10px;border:1px solid var(--border);color:var(--accent-blue);">B</th>
        ${mode==='full'?'<th style="padding:4px 10px;border:1px solid var(--border);color:var(--accent-yellow);">Cin</th>':''}
        <th style="padding:4px 10px;border:1px solid var(--border);color:var(--accent-green);">S</th>
        <th style="padding:4px 10px;border:1px solid var(--border);color:var(--accent-red);">C${mode==='full'?'out':''}</th>
      </tr></thead><tbody>`;

    for (let i = 0; i < rows; i++) {
      const a = mode === 'half' ? (i >> 1) & 1 : (i >> 2) & 1;
      const b = mode === 'half' ? i & 1 : (i >> 1) & 1;
      const cin = mode === 'half' ? 0 : i & 1;
      const s = mode === 'half' ? a ^ b : a ^ b ^ cin;
      const c = mode === 'half' ? a & b : (a & b) | (b & cin) | (a & cin);
      const isCurrent = a===A && b===B && (mode==='half'||cin===Cin);
      html += `<tr style="background:${isCurrent?'rgba(37,99,235,0.2)':'transparent'};">
        <td style="text-align:center;padding:4px 10px;border:1px solid var(--border);color:${a?'var(--accent-blue)':'var(--text-muted)'};">${a}</td>
        <td style="text-align:center;padding:4px 10px;border:1px solid var(--border);color:${b?'var(--accent-blue)':'var(--text-muted)'};">${b}</td>
        ${mode==='full'?`<td style="text-align:center;padding:4px 10px;border:1px solid var(--border);color:${cin?'var(--accent-yellow)':'var(--text-muted)'};">${cin}</td>`:''}
        <td style="text-align:center;padding:4px 10px;border:1px solid var(--border);font-weight:700;color:${s?'var(--accent-green)':'var(--text-muted)'};">${s}</td>
        <td style="text-align:center;padding:4px 10px;border:1px solid var(--border);font-weight:700;color:${c?'var(--accent-red)':'var(--text-muted)'};">${c}</td>
      </tr>`;
    }
    html += '</tbody></table>';
    tableEl.innerHTML = html;
  }

  render();
}
