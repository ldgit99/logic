// ─── 게이트 전기적 특성 계산기 ───

export function mountElectricalProps(container) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px;">
      <!-- 탭 선택 -->
      <div style="display:flex;gap:6px;">
        <button class="ep-tab unit-example-btn" data-tab="delay" style="background:var(--accent-blue);color:white;border-color:var(--accent-blue);">전파지연 & 주파수</button>
        <button class="ep-tab unit-example-btn" data-tab="fanout">팬아웃 계산</button>
        <button class="ep-tab unit-example-btn" data-tab="noise">잡음 여유도</button>
      </div>

      <!-- 전파지연 탭 -->
      <div id="ep-delay" class="ep-panel">
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px;">
          <div>
            <div style="font-size:0.72rem;color:var(--accent-blue);font-weight:700;margin-bottom:4px;">t_PHL (ns)</div>
            <input type="number" id="ep-tphl" value="5" min="0" step="0.5"
              style="width:90px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
              color:var(--accent-blue);padding:6px 10px;font-size:0.95rem;font-family:monospace;">
          </div>
          <div>
            <div style="font-size:0.72rem;color:var(--accent-green);font-weight:700;margin-bottom:4px;">t_PLH (ns)</div>
            <input type="number" id="ep-tplh" value="4.5" min="0" step="0.5"
              style="width:90px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
              color:var(--accent-green);padding:6px 10px;font-size:0.95rem;font-family:monospace;">
          </div>
        </div>
        <div id="ep-delay-result" style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:12px;"></div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="unit-example-btn ep-preset-delay" data-tphl="5" data-tplh="4.5">게이트 X (5/4.5ns)</button>
          <button class="unit-example-btn ep-preset-delay" data-tphl="8" data-tplh="7.5">게이트 Y (8/7.5ns)</button>
          <button class="unit-example-btn ep-preset-delay" data-tphl="2.5" data-tplh="2">HC CMOS (2.5/2ns)</button>
        </div>
      </div>

      <!-- 팬아웃 탭 -->
      <div id="ep-fanout" class="ep-panel" style="display:none;">
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px;">
          <div>
            <div style="font-size:0.72rem;color:var(--accent-blue);font-weight:700;margin-bottom:4px;">I_OH (mA, High)</div>
            <input type="number" id="ep-ioh" value="0.4" min="0" step="0.1"
              style="width:100px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
              color:var(--accent-blue);padding:6px 10px;font-size:0.95rem;font-family:monospace;">
          </div>
          <div>
            <div style="font-size:0.72rem;color:var(--accent-green);font-weight:700;margin-bottom:4px;">I_OL (mA, Low)</div>
            <input type="number" id="ep-iol" value="16" min="0" step="1"
              style="width:100px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
              color:var(--accent-green);padding:6px 10px;font-size:0.95rem;font-family:monospace;">
          </div>
          <div>
            <div style="font-size:0.72rem;color:var(--accent-yellow);font-weight:700;margin-bottom:4px;">I_IH (mA, 입력High)</div>
            <input type="number" id="ep-iih" value="0.04" min="0" step="0.01"
              style="width:100px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
              color:var(--accent-yellow);padding:6px 10px;font-size:0.95rem;font-family:monospace;">
          </div>
          <div>
            <div style="font-size:0.72rem;color:var(--accent-red);font-weight:700;margin-bottom:4px;">I_IL (mA, 입력Low)</div>
            <input type="number" id="ep-iil" value="0.4" min="0" step="0.1"
              style="width:100px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
              color:var(--accent-red);padding:6px 10px;font-size:0.95rem;font-family:monospace;">
          </div>
        </div>
        <div id="ep-fanout-result" style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:12px;"></div>
      </div>

      <!-- 잡음 여유도 탭 -->
      <div id="ep-noise" class="ep-panel" style="display:none;">
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px;">
          <div>
            <div style="font-size:0.72rem;color:var(--accent-blue);font-weight:700;margin-bottom:4px;">V_OH (V)</div>
            <input type="number" id="ep-voh" value="2.7" step="0.1"
              style="width:90px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
              color:var(--accent-blue);padding:6px 10px;font-size:0.95rem;font-family:monospace;">
          </div>
          <div>
            <div style="font-size:0.72rem;color:var(--accent-blue);font-weight:700;margin-bottom:4px;">V_IH (V)</div>
            <input type="number" id="ep-vih" value="2.0" step="0.1"
              style="width:90px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
              color:var(--accent-blue);padding:6px 10px;font-size:0.95rem;font-family:monospace;">
          </div>
          <div>
            <div style="font-size:0.72rem;color:var(--accent-green);font-weight:700;margin-bottom:4px;">V_IL (V)</div>
            <input type="number" id="ep-vil" value="0.8" step="0.1"
              style="width:90px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
              color:var(--accent-green);padding:6px 10px;font-size:0.95rem;font-family:monospace;">
          </div>
          <div>
            <div style="font-size:0.72rem;color:var(--accent-green);font-weight:700;margin-bottom:4px;">V_OL (V)</div>
            <input type="number" id="ep-vol" value="0.4" step="0.1"
              style="width:90px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
              color:var(--accent-green);padding:6px 10px;font-size:0.95rem;font-family:monospace;">
          </div>
        </div>
        <div id="ep-noise-result" style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:12px;"></div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="unit-example-btn ep-preset-noise" data-voh="2.7" data-vih="2.0" data-vil="0.8" data-vol="0.4">LS-TTL</button>
          <button class="unit-example-btn ep-preset-noise" data-voh="4.9" data-vih="3.5" data-vil="1.5" data-vol="0.1">CMOS 5V</button>
        </div>
      </div>
    </div>
  `;

  // Tab switching
  let activeTab = 'delay';
  container.querySelectorAll('.ep-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      container.querySelectorAll('.ep-panel').forEach(p => p.style.display = 'none');
      document.getElementById('ep-' + activeTab).style.display = 'block';
      container.querySelectorAll('.ep-tab').forEach(t => {
        t.style.background = t.dataset.tab === activeTab ? 'var(--accent-blue)' : '';
        t.style.color = t.dataset.tab === activeTab ? 'white' : '';
        t.style.borderColor = t.dataset.tab === activeTab ? 'var(--accent-blue)' : '';
      });
    });
  });

  // Propagation delay
  function calcDelay() {
    const tphl = parseFloat(document.getElementById('ep-tphl').value) || 0;
    const tplh = parseFloat(document.getElementById('ep-tplh').value) || 0;
    const tpd = (tphl + tplh) / 2;
    const fmax = tpd > 0 ? (1e9 / (2 * tpd)) : 0;
    document.getElementById('ep-delay-result').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div><div style="font-size:0.72rem;color:var(--text-muted);">평균 전파 지연 시간</div>
          <div style="font-size:1.1rem;color:var(--accent-blue);font-family:monospace;font-weight:700;">t_PD = ${tpd.toFixed(2)} ns</div></div>
        <div><div style="font-size:0.72rem;color:var(--text-muted);">최대 동작 주파수</div>
          <div style="font-size:1.1rem;color:var(--accent-green);font-family:monospace;font-weight:700;">f_max = ${(fmax/1e6).toFixed(2)} MHz</div></div>
      </div>
      <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:8px;">
        t_PD = (t_PHL + t_PLH) / 2 = (${tphl} + ${tplh}) / 2 = ${tpd.toFixed(2)} ns<br>
        f_max = 1 / (2 × t_PD) = 1 / (2 × ${tpd.toFixed(2)}ns) = ${(fmax/1e6).toFixed(2)} MHz
      </div>`;
  }

  ['ep-tphl','ep-tplh'].forEach(id => document.getElementById(id).addEventListener('input', calcDelay));
  container.querySelectorAll('.ep-preset-delay').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('ep-tphl').value = btn.dataset.tphl;
      document.getElementById('ep-tplh').value = btn.dataset.tplh;
      calcDelay();
    });
  });

  // Fan-out
  function calcFanout() {
    const ioh = parseFloat(document.getElementById('ep-ioh').value) || 0;
    const iol = parseFloat(document.getElementById('ep-iol').value) || 0;
    const iih = parseFloat(document.getElementById('ep-iih').value) || 0.001;
    const iil = parseFloat(document.getElementById('ep-iil').value) || 0.001;
    const foH = Math.floor(ioh / iih);
    const foL = Math.floor(iol / iil);
    const fo = Math.min(foH, foL);
    document.getElementById('ep-fanout-result').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
        <div><div style="font-size:0.72rem;color:var(--text-muted);">High 레벨 팬아웃</div>
          <div style="font-size:1.1rem;color:var(--accent-blue);font-family:monospace;font-weight:700;">${foH}개</div>
          <div style="font-size:0.7rem;color:var(--text-muted);">I_OH / I_IH = ${ioh}/${iih}</div></div>
        <div><div style="font-size:0.72rem;color:var(--text-muted);">Low 레벨 팬아웃</div>
          <div style="font-size:1.1rem;color:var(--accent-green);font-family:monospace;font-weight:700;">${foL}개</div>
          <div style="font-size:0.7rem;color:var(--text-muted);">I_OL / I_IL = ${iol}/${iil}</div></div>
        <div style="background:rgba(37,99,235,0.1);border-radius:4px;padding:8px;">
          <div style="font-size:0.72rem;color:var(--text-muted);">최종 팬아웃 (최솟값)</div>
          <div style="font-size:1.4rem;color:var(--accent-yellow);font-family:monospace;font-weight:700;">${fo}개</div></div>
      </div>`;
  }

  ['ep-ioh','ep-iol','ep-iih','ep-iil'].forEach(id => document.getElementById(id).addEventListener('input', calcFanout));

  // Noise margin
  function calcNoise() {
    const voh = parseFloat(document.getElementById('ep-voh').value) || 0;
    const vih = parseFloat(document.getElementById('ep-vih').value) || 0;
    const vil = parseFloat(document.getElementById('ep-vil').value) || 0;
    const vol = parseFloat(document.getElementById('ep-vol').value) || 0;
    const nmH = voh - vih;
    const nmL = vil - vol;
    document.getElementById('ep-noise-result').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div><div style="font-size:0.72rem;color:var(--text-muted);">High 레벨 잡음 여유도</div>
          <div style="font-size:1.1rem;color:var(--accent-blue);font-family:monospace;font-weight:700;">NM_H = ${nmH.toFixed(2)} V</div>
          <div style="font-size:0.72rem;color:var(--text-muted);">V_OH - V_IH = ${voh} - ${vih}</div></div>
        <div><div style="font-size:0.72rem;color:var(--text-muted);">Low 레벨 잡음 여유도</div>
          <div style="font-size:1.1rem;color:var(--accent-green);font-family:monospace;font-weight:700;">NM_L = ${nmL.toFixed(2)} V</div>
          <div style="font-size:0.72rem;color:var(--text-muted);">V_IL - V_OL = ${vil} - ${vol}</div></div>
      </div>
      <div style="margin-top:8px;font-size:0.75rem;color:var(--text-secondary);">
        잡음 여유도가 클수록 외부 잡음에 강한 게이트입니다. 두 값 중 작은 값이 실제 여유도입니다: min(${nmH.toFixed(2)}, ${nmL.toFixed(2)}) = ${Math.min(nmH, nmL).toFixed(2)} V
      </div>`;
  }

  ['ep-voh','ep-vih','ep-vil','ep-vol'].forEach(id => document.getElementById(id).addEventListener('input', calcNoise));
  container.querySelectorAll('.ep-preset-noise').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('ep-voh').value = btn.dataset.voh;
      document.getElementById('ep-vih').value = btn.dataset.vih;
      document.getElementById('ep-vil').value = btn.dataset.vil;
      document.getElementById('ep-vol').value = btn.dataset.vol;
      calcNoise();
    });
  });

  calcDelay();
  calcFanout();
  calcNoise();
}
