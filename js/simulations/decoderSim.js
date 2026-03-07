// ─── 디코더/인코더 + 7세그먼트 시뮬레이터 ───

const SEG7 = {
  //     a,b,c,d,e,f,g  (1=ON)
  0: [1,1,1,1,1,1,0],
  1: [0,1,1,0,0,0,0],
  2: [1,1,0,1,1,0,1],
  3: [1,1,1,1,0,0,1],
  4: [0,1,1,0,0,1,1],
  5: [1,0,1,1,0,1,1],
  6: [1,0,1,1,1,1,1],
  7: [1,1,1,0,0,0,0],
  8: [1,1,1,1,1,1,1],
  9: [1,1,1,1,0,1,1],
};

function drawSevenSeg(segs, size=80) {
  const [a,b,c,d,e,f,g] = segs;
  const on = 'var(--accent-green)', off = 'rgba(100,116,139,0.15)';
  const sw = size*0.12, sl = size*0.38, R = 3;
  const cx = size/2, top = 6, bot = size - 6;
  const mid = size/2;

  const hSeg = (x, y, seg) => `<rect x="${x}" y="${y-sw/2}" width="${sl}" height="${sw}" rx="${R}" fill="${seg?on:off}"/>`;
  const vSeg = (x, y, seg) => `<rect x="${x-sw/2}" y="${y}" width="${sw}" height="${sl}" rx="${R}" fill="${seg?on:off}"/>`;

  const lx = cx - sl/2;
  return `<svg width="${size}" height="${size+10}" style="display:block;">
    ${hSeg(lx, top, a)}
    ${vSeg(cx + sl/2, top+2, b)}
    ${vSeg(cx + sl/2, mid+2, c)}
    ${hSeg(lx, mid, g)}
    ${vSeg(cx - sl/2, top+2, f)}
    ${vSeg(cx - sl/2, mid+2, e)}
    ${hSeg(lx, bot, d)}
  </svg>`;
}

export function mountDecoderSim(container) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <!-- 탭 -->
      <div style="display:flex;gap:6px;">
        <button class="unit-example-btn ds-tab" data-tab="decoder2x4" style="background:var(--accent-blue);color:white;border-color:var(--accent-blue);">2×4 디코더</button>
        <button class="unit-example-btn ds-tab" data-tab="decoder3x8">3×8 디코더</button>
        <button class="unit-example-btn ds-tab" data-tab="encoder4x2">4×2 인코더</button>
        <button class="unit-example-btn ds-tab" data-tab="seg7">7세그먼트</button>
      </div>

      <div id="ds-content"></div>
    </div>
  `;

  let activeTab = 'decoder2x4';

  container.querySelectorAll('.ds-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      container.querySelectorAll('.ds-tab').forEach(b => {
        b.style.background = b.dataset.tab === activeTab ? 'var(--accent-blue)' : '';
        b.style.color = b.dataset.tab === activeTab ? 'white' : '';
        b.style.borderColor = b.dataset.tab === activeTab ? 'var(--accent-blue)' : '';
      });
      renderTab();
    });
  });

  function renderTab() {
    const el = document.getElementById('ds-content');
    if (activeTab === 'decoder2x4') renderDecoder2x4(el);
    else if (activeTab === 'decoder3x8') renderDecoder3x8(el);
    else if (activeTab === 'encoder4x2') renderEncoder4x2(el);
    else renderSeg7(el);
  }

  function renderDecoder2x4(el) {
    let A=0, B=0, EN=1;
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="font-size:0.75rem;color:var(--text-muted);">2×4 디코더: n=2 입력 → 2²=4 출력 중 하나 선택</div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;">
          ${['A','B','EN'].map(v => `<div style="display:flex;align-items:center;gap:8px;">
            <span style="font-family:monospace;font-weight:700;color:${v==='EN'?'var(--accent-yellow)':'var(--accent-blue)'};">${v}=</span>
            <button class="d24-btn unit-example-btn" data-var="${v}" style="min-width:42px;">${v==='EN'?1:0}</button>
          </div>`).join('')}
        </div>
        <div id="d24-outputs" style="display:flex;gap:8px;flex-wrap:wrap;"></div>
        <div id="d24-table" style="overflow-x:auto;"></div>
      </div>`;

    function upd() {
      el.querySelectorAll('.d24-btn').forEach(b => {
        const v = b.dataset.var;
        const val = v==='A'?A:v==='B'?B:EN;
        b.textContent = val;
        b.style.background = val ? 'var(--accent-blue)' : '';
        b.style.color = val ? 'white' : '';
      });
      const idx = A*2 + B;
      const outputs = EN ? [0,0,0,0].map((_,i) => i===idx?1:0) : [0,0,0,0];
      document.getElementById('d24-outputs').innerHTML = outputs.map((v,i) =>
        `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
          <span style="font-size:0.7rem;color:var(--text-muted);">Y${i}</span>
          <span style="width:38px;height:38px;border-radius:6px;display:flex;align-items:center;justify-content:center;
            font-family:monospace;font-size:1.1rem;font-weight:700;
            background:${v?'var(--accent-green)':'var(--bg-secondary)'};
            color:${v?'white':'var(--text-muted)'};
            border:2px solid ${v?'var(--accent-green)':'var(--border)'};">${v}</span>
        </div>`
      ).join('');

      // Truth table
      let t = `<table style="border-collapse:collapse;font-family:monospace;font-size:0.78rem;margin-top:8px;">
        <thead><tr style="background:var(--bg-secondary);">
          <th style="padding:3px 8px;border:1px solid var(--border);">EN</th>
          <th style="padding:3px 8px;border:1px solid var(--border);">A</th>
          <th style="padding:3px 8px;border:1px solid var(--border);">B</th>
          ${[0,1,2,3].map(i=>`<th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-green);">Y${i}</th>`).join('')}
        </tr></thead><tbody>`;
      for(let e=1;e>=0;e-=1) for(let a=0;a<=1;a++) for(let b=0;b<=1;b++) {
        const outs = e ? [0,1,2,3].map(i=>i===a*2+b?1:0) : [0,0,0,0];
        const cur = e===EN&&a===A&&b===B;
        t += `<tr style="background:${cur?'rgba(37,99,235,0.2)':'transparent'};">
          <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);">${e}</td>
          <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);">${a}</td>
          <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);">${b}</td>
          ${outs.map(v=>`<td style="text-align:center;padding:3px 8px;border:1px solid var(--border);color:${v?'var(--accent-green)':'var(--text-muted)'};">${v}</td>`).join('')}
        </tr>`;
        if(!e) break;
      }
      t += '</tbody></table>';
      document.getElementById('d24-table').innerHTML = t;
    }

    el.querySelectorAll('.d24-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.var;
        if (v==='A') A^=1; else if(v==='B') B^=1; else EN^=1;
        upd();
      });
    });
    upd();
  }

  function renderDecoder3x8(el) {
    let state = [0,0,0];
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="font-size:0.75rem;color:var(--text-muted);">3×8 디코더: 3비트 입력 → 8개 출력 중 하나 선택 (IC 74138)</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
          ${['A','B','C'].map((v,i) => `<div style="display:flex;align-items:center;gap:6px;">
            <span style="font-family:monospace;font-weight:700;color:var(--accent-blue);">${v}=</span>
            <button class="d38-btn unit-example-btn" data-idx="${i}" style="min-width:40px;">0</button>
          </div>`).join('')}
        </div>
        <div id="d38-out" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
      </div>`;
    function upd() {
      el.querySelectorAll('.d38-btn').forEach((b,i) => {
        b.textContent = state[i];
        b.style.background = state[i] ? 'var(--accent-blue)' : '';
        b.style.color = state[i] ? 'white' : '';
      });
      const idx = state[0]*4 + state[1]*2 + state[2];
      document.getElementById('d38-out').innerHTML = Array.from({length:8},(_,i) => {
        const v = i===idx?1:0;
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
          <span style="font-size:0.65rem;color:var(--text-muted);">Y${i}</span>
          <span style="width:34px;height:34px;border-radius:5px;display:flex;align-items:center;justify-content:center;
            font-family:monospace;font-size:1rem;font-weight:700;
            background:${v?'var(--accent-green)':'var(--bg-secondary)'};color:${v?'white':'var(--text-muted)'};
            border:2px solid ${v?'var(--accent-green)':'var(--border)'};">${v}</span>
        </div>`;
      }).join('');
    }
    el.querySelectorAll('.d38-btn').forEach((btn,i) => {
      btn.addEventListener('click', () => { state[i]^=1; upd(); });
    });
    upd();
  }

  function renderEncoder4x2(el) {
    let active = 1;
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="font-size:0.75rem;color:var(--text-muted);">4×2 인코더: 4개 입력 중 하나 활성 → 2비트 출력</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${[0,1,2,3].map(i => `<button class="enc-btn unit-example-btn" data-i="${i}" style="min-width:48px;">I${i}=0</button>`).join('')}
        </div>
        <div id="enc-out" style="display:flex;gap:12px;align-items:center;font-family:monospace;font-size:1.1rem;"></div>
        <div id="enc-table" style="overflow-x:auto;"></div>
      </div>`;
    function upd() {
      el.querySelectorAll('.enc-btn').forEach((b,i) => {
        const on = i===active;
        b.textContent = `I${i}=${on?1:0}`;
        b.style.background = on ? 'var(--accent-blue)' : '';
        b.style.color = on ? 'white' : '';
      });
      const Y1 = (active>>1)&1, Y0 = active&1;
      document.getElementById('enc-out').innerHTML = `
        <span style="color:var(--text-muted);">I${active}=1 →</span>
        <span style="color:var(--accent-green);font-weight:700;">Y₁Y₀ = ${Y1}${Y0}</span>
        <span style="color:var(--text-muted);font-size:0.85rem;">(10진 ${active})</span>`;
      let t = `<table style="border-collapse:collapse;font-family:monospace;font-size:0.8rem;margin-top:6px;">
        <thead><tr style="background:var(--bg-secondary);">
          ${[0,1,2,3].map(i=>`<th style="padding:3px 8px;border:1px solid var(--border);">I${i}</th>`).join('')}
          <th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-green);">Y₁</th>
          <th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-green);">Y₀</th>
        </tr></thead><tbody>`;
      for(let i=0;i<4;i++) {
        const inputs = [0,0,0,0]; inputs[i]=1;
        const cur = i===active;
        t += `<tr style="background:${cur?'rgba(37,99,235,0.2)':'transparent'};">
          ${inputs.map(v=>`<td style="text-align:center;padding:3px 8px;border:1px solid var(--border);color:${v?'var(--accent-blue)':'var(--text-muted)'};">${v}</td>`).join('')}
          <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);font-weight:700;">${(i>>1)&1}</td>
          <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);font-weight:700;">${i&1}</td>
        </tr>`;
      }
      t += '</tbody></table>';
      document.getElementById('enc-table').innerHTML = t;
    }
    el.querySelectorAll('.enc-btn').forEach((b,i) => {
      b.addEventListener('click', () => { active=i; upd(); });
    });
    upd();
  }

  function renderSeg7(el) {
    let digit = 5;
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="font-size:0.75rem;color:var(--text-muted);">BCD → 7세그먼트 디코더: 0~9 선택</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;" id="seg-btns">
          ${Array.from({length:10},(_,i)=>`<button class="unit-example-btn seg-dg" data-d="${i}">${i}</button>`).join('')}
        </div>
        <div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap;">
          <div id="seg-display" style="background:var(--bg-secondary);padding:12px 16px;border-radius:8px;border:1px solid var(--border);"></div>
          <div id="seg-info" style="font-family:monospace;font-size:0.85rem;"></div>
        </div>
      </div>`;
    function upd() {
      el.querySelectorAll('.seg-dg').forEach(b => {
        const on = parseInt(b.dataset.d)===digit;
        b.style.background = on ? 'var(--accent-blue)' : '';
        b.style.color = on ? 'white' : '';
      });
      const segs = SEG7[digit];
      document.getElementById('seg-display').innerHTML = drawSevenSeg(segs, 90);
      const labels = ['a','b','c','d','e','f','g'];
      document.getElementById('seg-info').innerHTML = `
        <div style="margin-bottom:6px;color:var(--accent-blue);font-weight:700;">숫자 ${digit}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${labels.map((l,i) => `<span style="background:${segs[i]?'rgba(16,185,129,0.2)':'transparent'};
            border:1px solid ${segs[i]?'var(--accent-green)':'var(--border)'};
            border-radius:4px;padding:2px 8px;color:${segs[i]?'var(--accent-green)':'var(--text-muted)'};">
            ${l}=${segs[i]}</span>`).join('')}
        </div>
        <div style="margin-top:6px;font-size:0.78rem;color:var(--text-secondary);">
          BCD: ${digit.toString(2).padStart(4,'0')}₂ = ${digit}₁₀
        </div>`;
    }
    el.querySelectorAll('.seg-dg').forEach(b => {
      b.addEventListener('click', () => { digit=parseInt(b.dataset.d); upd(); });
    });
    upd();
  }

  renderTab();
}
