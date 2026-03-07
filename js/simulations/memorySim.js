// ─── 메모리 인터랙티브 시뮬레이터 ───

export function mountMemorySim(container) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${['ROM','SRAM','DRAM 개념','메모리 계층'].map((t,i)=>
          `<button class="unit-example-btn mem-tab" data-tab="${i}" style="${i===0?'background:var(--accent-blue);color:white;':''}">${t}</button>`
        ).join('')}
      </div>
      <div id="mem-content"></div>
    </div>
  `;

  let activeTab = 0;

  function render() {
    const el = document.getElementById('mem-content');
    if (activeTab === 0) renderROM(el);
    else if (activeTab === 1) renderSRAM(el);
    else if (activeTab === 2) renderDRAMConcept(el);
    else renderHierarchy(el);
  }

  // ── ROM 시뮬레이터 ──
  function renderROM(el) {
    // 4x4 ROM: 2-bit address, 4-bit data word
    const ROM_DATA = [
      [1,0,1,0], // addr 00
      [0,1,1,0], // addr 01
      [1,1,0,1], // addr 10
      [0,0,1,1], // addr 11
    ];
    let addr = [0,0];

    function draw() {
      const addrVal = addr[0]*2 + addr[1];
      const data = ROM_DATA[addrVal];

      el.innerHTML = `
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;margin-bottom:8px;text-transform:uppercase;">ROM 시뮬레이터 (4워드 × 4비트)</div>
        <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start;">
          <!-- 주소 입력 -->
          <div style="display:flex;flex-direction:column;gap:6px;">
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;">주소 (Address)</div>
            ${addr.map((b,i) => `
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-family:monospace;font-weight:700;color:var(--accent-purple);min-width:24px;">A${1-i}</span>
                <button class="unit-example-btn rom-addr" data-i="${i}" style="min-width:36px;">${b}</button>
              </div>`).join('')}
            <div style="font-size:0.85rem;font-family:monospace;color:var(--accent-purple);font-weight:700;margin-top:4px;">
              주소: ${addrVal} (${addr.join('')}₂)
            </div>
          </div>

          <!-- ROM 내용 -->
          <div>
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:6px;">ROM 내용 (읽기 전용)</div>
            <table style="border-collapse:collapse;font-family:monospace;font-size:0.8rem;">
              <thead><tr style="background:var(--bg-secondary);">
                <th style="padding:4px 10px;border:1px solid var(--border);color:var(--accent-purple);">주소</th>
                <th style="padding:4px 10px;border:1px solid var(--border);color:var(--accent-blue);" colspan="4">데이터 (D3..D0)</th>
              </tr></thead>
              <tbody>
                ${ROM_DATA.map((row, i) => `
                  <tr style="background:${i===addrVal?'rgba(59,130,246,0.2)':'transparent'};">
                    <td style="text-align:center;padding:4px 10px;border:1px solid var(--border);color:${i===addrVal?'var(--accent-purple)':'var(--text-muted)'};">${i} (${i.toString(2).padStart(2,'0')})</td>
                    ${row.map(b=>`<td style="text-align:center;padding:4px 10px;border:1px solid var(--border);color:${i===addrVal&&b?'var(--accent-green)':i===addrVal?'var(--text-muted)':'var(--text-muted)'};background:${i===addrVal&&b?'rgba(16,185,129,0.15)':''};">${b}</td>`).join('')}
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>

          <!-- 출력 데이터 -->
          <div style="display:flex;flex-direction:column;gap:6px;">
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;">출력 데이터</div>
            <div style="display:flex;gap:5px;">
              ${data.map((b,i) => `
                <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
                  <span style="font-size:0.65rem;color:var(--text-muted);font-family:monospace;">D${3-i}</span>
                  <div style="width:34px;height:34px;border-radius:5px;background:${b?'var(--accent-green)':'var(--bg-tertiary)'};border:2px solid ${b?'var(--accent-green)':'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:700;color:${b?'white':'var(--text-muted)'};">${b}</div>
                </div>`).join('')}
            </div>
            <div style="font-size:0.85rem;font-family:monospace;color:var(--accent-green);font-weight:700;">
              0x${parseInt(data.join(''),2).toString(16).toUpperCase()}
            </div>
          </div>
        </div>

        <div style="margin-top:10px;background:var(--bg-tertiary);border-radius:4px;padding:10px;font-size:0.78rem;color:var(--text-muted);">
          <span style="color:var(--accent-blue);font-weight:700;">ROM 특징:</span>
          비휘발성(전원 꺼져도 데이터 유지), 읽기 전용(OE=0에서 읽기),
          마스크 ROM / PROM / EPROM / EEPROM / Flash ROM 등 종류 다양
        </div>
      `;

      el.querySelectorAll('.rom-addr').forEach(btn => btn.addEventListener('click', () => {
        addr[+btn.dataset.i] ^= 1; draw();
      }));
    }
    draw();
  }

  // ── SRAM 시뮬레이터 ──
  function renderSRAM(el) {
    // 8x4 SRAM: 3-bit address, 4-bit data
    const sram = Array(8).fill(null).map(() => [0,0,0,0]);
    let addr = [0,0,0], dataIn = [0,0,0,0], we = 0, oe = 1;

    function draw() {
      const addrVal = addr[0]*4 + addr[1]*2 + addr[2];
      const dataOut = oe && !we ? sram[addrVal] : ['-','-','-','-'];

      el.innerHTML = `
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;margin-bottom:8px;text-transform:uppercase;">SRAM 시뮬레이터 (8워드 × 4비트)</div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start;">
          <!-- 제어 패널 -->
          <div style="display:flex;flex-direction:column;gap:6px;min-width:140px;">
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;">주소 (A2..A0)</div>
            ${addr.map((b,i) => `
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-family:monospace;font-weight:700;color:var(--accent-purple);min-width:24px;">A${2-i}</span>
                <button class="unit-example-btn sram-addr" data-i="${i}" style="min-width:32px;">${b}</button>
              </div>`).join('')}
            <div style="font-size:0.82rem;font-family:monospace;color:var(--accent-purple);">주소: ${addrVal}</div>

            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-top:4px;">제어 신호</div>
            <div style="display:flex;gap:6px;">
              <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
                <span style="font-size:0.68rem;color:var(--text-muted);">WE</span>
                <button class="unit-example-btn" id="sram-we" style="min-width:36px;${we?'background:var(--accent-red);color:white;':''}">${we}</button>
              </div>
              <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
                <span style="font-size:0.68rem;color:var(--text-muted);">OE</span>
                <button class="unit-example-btn" id="sram-oe" style="min-width:36px;${oe?'background:var(--accent-green);color:white;':''}">${oe}</button>
              </div>
            </div>
            <div style="font-size:0.7rem;color:var(--text-muted);">WE=1: 쓰기, OE=1: 읽기</div>

            ${we ? `
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-top:4px;">쓸 데이터</div>
            <div style="display:flex;gap:4px;">
              ${dataIn.map((b,i) => `
                <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                  <span style="font-size:0.62rem;color:var(--text-muted);">D${3-i}</span>
                  <button class="unit-example-btn sram-din" data-i="${i}" style="width:30px;height:30px;${b?'background:var(--accent-blue);color:white;':''}">${b}</button>
                </div>`).join('')}
            </div>
            <button class="unit-example-btn" id="sram-write" style="background:var(--accent-red);color:white;margin-top:4px;">쓰기 실행</button>
            ` : ''}
          </div>

          <!-- SRAM 내용 -->
          <div>
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:6px;">SRAM 내용</div>
            <table style="border-collapse:collapse;font-family:monospace;font-size:0.78rem;">
              <thead><tr style="background:var(--bg-secondary);">
                <th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-purple);">주소</th>
                <th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-blue);" colspan="4">데이터</th>
                <th style="padding:3px 8px;border:1px solid var(--border);color:var(--text-muted);">Hex</th>
              </tr></thead>
              <tbody>
                ${sram.map((row, i) => `
                  <tr style="background:${i===addrVal?'rgba(59,130,246,0.2)':'transparent'};">
                    <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);color:${i===addrVal?'var(--accent-purple)':'var(--text-muted)'};">${i.toString(2).padStart(3,'0')}</td>
                    ${row.map(b=>`<td style="text-align:center;padding:3px 8px;border:1px solid var(--border);color:${i===addrVal?'var(--accent-green)':'var(--text-muted)'};">${b}</td>`).join('')}
                    <td style="text-align:center;padding:3px 8px;border:1px solid var(--border);color:var(--text-muted);">0x${parseInt(row.join(''),2).toString(16).toUpperCase()}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>

          <!-- 출력 -->
          <div>
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:6px;">출력 데이터</div>
            <div style="display:flex;gap:5px;">
              ${dataOut.map((b,i) => `
                <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
                  <span style="font-size:0.65rem;color:var(--text-muted);">D${3-i}</span>
                  <div style="width:34px;height:34px;border-radius:5px;background:${b===1?'var(--accent-green)':'var(--bg-tertiary)'};border:2px solid ${b===1?'var(--accent-green)':'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:700;color:${b===1?'white':'var(--text-muted)'};">${b}</div>
                </div>`).join('')}
            </div>
            <div style="margin-top:6px;font-size:0.72rem;color:${oe&&!we?'var(--accent-green)':'var(--text-muted)'};">${oe&&!we?'읽기 중...':'출력 비활성'}</div>
          </div>
        </div>
      `;

      el.querySelectorAll('.sram-addr').forEach(btn => btn.addEventListener('click', () => {
        addr[+btn.dataset.i] ^= 1; draw();
      }));
      document.getElementById('sram-we').addEventListener('click', () => { we ^= 1; if(we) oe = 0; draw(); });
      document.getElementById('sram-oe').addEventListener('click', () => { oe ^= 1; if(oe) we = 0; draw(); });
      el.querySelectorAll('.sram-din').forEach(btn => btn.addEventListener('click', () => {
        dataIn[+btn.dataset.i] ^= 1; draw();
      }));
      const writeBtn = document.getElementById('sram-write');
      if (writeBtn) writeBtn.addEventListener('click', () => {
        sram[addrVal] = [...dataIn]; draw();
      });
    }
    draw();
  }

  // ── DRAM 개념 ──
  function renderDRAMConcept(el) {
    let refreshTimer = 100; // ms counter
    let interval = null;

    function draw() {
      el.innerHTML = `
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;margin-bottom:8px;text-transform:uppercase;">DRAM 동작 원리</div>

        <div style="display:flex;gap:18px;flex-wrap:wrap;">
          <!-- SRAM vs DRAM 비교 -->
          <div style="overflow-x:auto;">
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:6px;">SRAM vs DRAM 비교</div>
            <table style="border-collapse:collapse;font-family:monospace;font-size:0.78rem;">
              <thead><tr style="background:var(--bg-secondary);">
                <th style="padding:4px 10px;border:1px solid var(--border);color:var(--text-muted);">특성</th>
                <th style="padding:4px 10px;border:1px solid var(--border);color:var(--accent-blue);">SRAM</th>
                <th style="padding:4px 10px;border:1px solid var(--border);color:var(--accent-green);">DRAM</th>
              </tr></thead>
              <tbody>
                ${[
                  ['기억 소자', 'FF (6트랜지스터)', '커패시터 (1트랜지스터)'],
                  ['리프레시', '불필요', '필요 (주기적)'],
                  ['속도', '빠름', '느림'],
                  ['밀도', '낮음', '높음'],
                  ['소비전력', '높음', '낮음'],
                  ['비용', '비쌈', '저렴'],
                  ['용도', 'CPU 캐시', '메인 메모리(RAM)'],
                ].map(([f,s,d]) => `
                  <tr>
                    <td style="padding:3px 10px;border:1px solid var(--border);color:var(--text-muted);">${f}</td>
                    <td style="padding:3px 10px;border:1px solid var(--border);color:var(--accent-blue);">${s}</td>
                    <td style="padding:3px 10px;border:1px solid var(--border);color:var(--accent-green);">${d}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>

          <!-- DRAM 셀 모델 -->
          <div>
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:8px;">DRAM 셀 모델 (커패시터 누설)</div>
            <svg width="220" height="160">
              <!-- 워드선 -->
              <line x1="20" y1="30" x2="200" y2="30" stroke="var(--accent-purple)" stroke-width="2"/>
              <text x="2" y="34" font-size="10" fill="var(--accent-purple)" font-family="monospace">WL</text>
              <!-- 비트선 -->
              <line x1="100" y1="0" x2="100" y2="160" stroke="var(--accent-blue)" stroke-width="2"/>
              <text x="104" y="12" font-size="10" fill="var(--accent-blue)" font-family="monospace">BL</text>
              <!-- 트랜지스터 (NMOS) -->
              <rect x="82" y="20" width="36" height="20" rx="3" fill="var(--bg-tertiary)" stroke="var(--accent-green)" stroke-width="1.5"/>
              <text x="88" y="34" font-size="9" fill="var(--text-muted)" font-family="monospace">NMOS</text>
              <!-- 커패시터 -->
              <line x1="80" y1="60" x2="120" y2="60" stroke="var(--accent-orange,#f97316)" stroke-width="3"/>
              <line x1="80" y1="70" x2="120" y2="70" stroke="var(--accent-orange,#f97316)" stroke-width="3"/>
              <line x1="100" y1="40" x2="100" y2="60" stroke="var(--border)" stroke-width="1.5"/>
              <line x1="100" y1="70" x2="100" y2="90" stroke="var(--border)" stroke-width="1.5"/>
              <line x1="90" y1="90" x2="110" y2="90" stroke="var(--border)" stroke-width="1.5"/>
              <text x="125" y="67" font-size="10" fill="#f97316" font-family="monospace">C</text>
              <!-- 누설 화살표 -->
              <path d="M105,65 L130,95" stroke="var(--accent-red)" stroke-width="1.5" stroke-dasharray="3" marker-end="url(#larrow)"/>
              <text x="132" y="98" font-size="9" fill="var(--accent-red)" font-family="monospace">누설</text>
              <!-- 리프레시 -->
              <text x="10" y="130" font-size="9" fill="var(--accent-green)" font-family="monospace">리프레시 필요!</text>
              <text x="10" y="145" font-size="8" fill="var(--text-muted)" font-family="monospace">주기: ~64ms</text>
              <defs><marker id="larrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="var(--accent-red)"/></marker></defs>
            </svg>
          </div>
        </div>

        <!-- DRAM 발전 -->
        <div style="margin-top:10px;">
          <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:6px;">DRAM 발전 역사</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
            ${['DRAM','FPM DRAM','EDO DRAM','SDRAM','DDR SDRAM','DDR2','DDR3','DDR4','DDR5'].map((type,i)=>`
              <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
                <div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;padding:4px 8px;font-family:monospace;font-size:0.72rem;color:var(--accent-blue);white-space:nowrap;">${type}</div>
                ${i < 8 ? `<div style="width:1px;height:8px;background:var(--border);"></div>` : ''}
              </div>
              ${i < 8 ? '<span style="color:var(--border);font-size:1rem;align-self:flex-start;margin-top:4px;">→</span>' : ''}
            `).join('')}
          </div>
        </div>
      `;
    }
    draw();
  }

  // ── 메모리 계층 ──
  function renderHierarchy(el) {
    const levels = [
      { name: '레지스터', size: '< 1KB', speed: '< 1ns', cost: '매우 높음', color: 'var(--accent-blue)', width: 60 },
      { name: 'L1 캐시', size: '32~64KB', speed: '~1ns', cost: '높음', color: 'var(--accent-green)', width: 100 },
      { name: 'L2 캐시', size: '256KB~1MB', speed: '~5ns', cost: '높음', color: '#10b981', width: 145 },
      { name: 'L3 캐시', size: '4~32MB', speed: '~20ns', cost: '중간', color: 'var(--accent-purple)', width: 200 },
      { name: '주 메모리(DRAM)', size: '4~64GB', speed: '~100ns', cost: '낮음', color: '#8b5cf6', width: 260 },
      { name: '플래시/SSD', size: '256GB~4TB', speed: '~0.1ms', cost: '매우 낮음', color: 'var(--accent-orange,#f97316)', width: 320 },
      { name: 'HDD', size: '1~20TB', speed: '~10ms', cost: '최저', color: '#64748b', width: 380 },
    ];

    el.innerHTML = `
      <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;margin-bottom:10px;text-transform:uppercase;">메모리 계층 구조 (Memory Hierarchy)</div>

      <div style="display:flex;flex-direction:column;align-items:center;gap:3px;margin-bottom:14px;">
        ${levels.map((lv,i) => `
          <div style="display:flex;align-items:center;gap:10px;width:100%;max-width:500px;">
            <div style="width:${lv.width}px;background:${lv.color};border-radius:4px;height:28px;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:white;white-space:nowrap;padding:0 8px;transition:width 0.3s;">${lv.name}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);white-space:nowrap;">${lv.size} / ${lv.speed}</div>
          </div>`).join('')}
        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">← 빠름·비쌈·적음 &nbsp;&nbsp;&nbsp; 느림·저렴·많음 →</div>
      </div>

      <table style="border-collapse:collapse;font-family:monospace;font-size:0.75rem;width:100%;">
        <thead><tr style="background:var(--bg-secondary);">
          <th style="padding:3px 8px;border:1px solid var(--border);">계층</th>
          <th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-blue);">용량</th>
          <th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-green);">접근 속도</th>
          <th style="padding:3px 8px;border:1px solid var(--border);color:var(--accent-purple);">비용/GB</th>
        </tr></thead>
        <tbody>
          ${levels.map(lv => `
            <tr>
              <td style="padding:3px 8px;border:1px solid var(--border);color:${lv.color};font-weight:700;">${lv.name}</td>
              <td style="padding:3px 8px;border:1px solid var(--border);">${lv.size}</td>
              <td style="padding:3px 8px;border:1px solid var(--border);">${lv.speed}</td>
              <td style="padding:3px 8px;border:1px solid var(--border);color:var(--text-muted);">${lv.cost}</td>
            </tr>`).join('')}
        </tbody>
      </table>

      <div style="margin-top:12px;background:var(--bg-tertiary);border-radius:4px;padding:10px;font-size:0.78rem;color:var(--text-muted);">
        <span style="color:var(--accent-blue);font-weight:700;">지역성 원리 (Locality Principle):</span><br>
        • <span style="color:var(--accent-green);">시간 지역성</span>: 최근 사용한 데이터를 곧 다시 사용할 가능성이 높음<br>
        • <span style="color:var(--accent-purple);">공간 지역성</span>: 사용한 데이터 주변의 데이터를 곧 사용할 가능성이 높음<br>
        캐시 메모리는 이 원리를 이용해 자주 사용하는 데이터를 빠른 메모리에 임시 저장합니다.
      </div>
    `;
  }

  container.querySelectorAll('.mem-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = +btn.dataset.tab;
      container.querySelectorAll('.mem-tab').forEach(b => {
        b.style.background = b === btn ? 'var(--accent-blue)' : '';
        b.style.color = b === btn ? 'white' : '';
      });
      render();
    });
  });

  render();
}
