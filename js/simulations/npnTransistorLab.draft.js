// Draft preview: NPN transistor electron-flow simulation (not wired to chapters)

export function mountNpnTransistorLabDraft(container) {
  container.innerHTML = `
    <div class="sim-canvas-wrap" style="padding:12px;">
      <canvas id="npn-canvas" height="300" style="width:100%;"></canvas>
    </div>

    <div class="sim-controls" style="margin-top:12px;">
      <div class="sim-control-row">
        <span class="sim-label">베이스 구동 (VBE)</span>
        <input type="range" class="sim-slider" id="npn-vbe" min="0" max="0.95" step="0.01" value="0.78" />
        <span class="sim-value" id="npn-vbe-val">0.78 V</span>
      </div>
      <div class="sim-control-row">
        <span class="sim-label">컬렉터 전압 (VCE)</span>
        <input type="range" class="sim-slider" id="npn-vce" min="0.1" max="12" step="0.1" value="5.0" />
        <span class="sim-value" id="npn-vce-val">5.0 V</span>
      </div>
    </div>

    <div class="sim-info">
      <div class="sim-info-item">
        <span class="sim-info-label">동작 영역</span>
        <span class="sim-info-val" id="npn-region">Active</span>
      </div>
      <div class="sim-info-item">
        <span class="sim-info-label">전자 주 흐름</span>
        <span class="sim-info-val" id="npn-main-flow">Emitter -> Collector</span>
      </div>
      <div class="sim-info-item">
        <span class="sim-info-label">베이스 전류</span>
        <span class="sim-info-val" id="npn-base-current">작음</span>
      </div>
    </div>

    <div class="sim-warning" style="margin-top:10px;" id="npn-note">
      NPN에서 전자는 Emitter(N)에서 Base(P)를 거쳐 Collector(N)로 이동합니다.
      VBE가 약 0.65V 이상이면 BE 접합 장벽이 낮아지고 증폭 동작이 시작됩니다.
    </div>
  `;

  const canvas = container.querySelector('#npn-canvas');
  const ctx = canvas.getContext('2d');
  const vbeEl = container.querySelector('#npn-vbe');
  const vceEl = container.querySelector('#npn-vce');
  const vbeValEl = container.querySelector('#npn-vbe-val');
  const vceValEl = container.querySelector('#npn-vce-val');
  const regionEl = container.querySelector('#npn-region');
  const flowEl = container.querySelector('#npn-main-flow');
  const baseCurrentEl = container.querySelector('#npn-base-current');

  let rafId = 0;
  let t = 0;

  function resizeCanvas() {
    const width = canvas.parentElement.clientWidth - 24;
    canvas.width = Math.max(760, width);
    canvas.height = 300;
  }

  function drawElectron(x, y, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.fillStyle = '#22d3ee';
    ctx.arc(x, y, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = '10px monospace';
    ctx.fillText('e', x - 2.3, y + 3.1);
    ctx.restore();
  }

  function drawRegionBox(x, y, w, h, fill, label) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 13px "Noto Sans KR", sans-serif';
    ctx.fillText(label, x + 10, y + 20);
  }

  function drawArrow(x1, y1, x2, y2, color) {
    const head = 8;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const ang = Math.atan2(dy, dx);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(ang - Math.PI / 6), y2 - head * Math.sin(ang - Math.PI / 6));
    ctx.lineTo(x2 - head * Math.cos(ang + Math.PI / 6), y2 - head * Math.sin(ang + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  function classify(vbe, vce) {
    if (vbe < 0.62) {
      return { mode: 'Cutoff', conduct: 0.08, base: '거의 없음', color: 'var(--accent-red)' };
    }
    if (vce < 0.35) {
      return { mode: 'Saturation', conduct: 0.6, base: '큼', color: 'var(--accent-orange)' };
    }
    return { mode: 'Active', conduct: 1.0, base: '작음', color: 'var(--accent-green)' };
  }

  function drawScene() {
    resizeCanvas();
    const w = canvas.width;
    const h = canvas.height;

    const vbe = Number(vbeEl.value);
    const vce = Number(vceEl.value);
    const state = classify(vbe, vce);

    vbeValEl.textContent = `${vbe.toFixed(2)} V`;
    vceValEl.textContent = `${vce.toFixed(1)} V`;

    regionEl.textContent = state.mode;
    regionEl.style.color = state.color;
    baseCurrentEl.textContent = state.base;
    baseCurrentEl.style.color = state.color;
    flowEl.textContent = state.mode === 'Cutoff' ? '거의 차단' : 'Emitter -> Collector';

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, w, h);

    for (let gx = 0; gx < w; gx += 30) {
      ctx.strokeStyle = '#141d30';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }

    const top = 72;
    const bottom = 228;
    const ew = Math.floor(w * 0.32);
    const bw = Math.floor(w * 0.12);
    const cw = Math.floor(w * 0.32);
    const x0 = Math.floor((w - (ew + bw + cw)) / 2);

    drawRegionBox(x0, top, ew, bottom - top, 'rgba(15,118,110,0.30)', 'Emitter (N)');
    drawRegionBox(x0 + ew, top, bw, bottom - top, 'rgba(185,28,28,0.30)', 'Base (P)');
    drawRegionBox(x0 + ew + bw, top, cw, bottom - top, 'rgba(30,64,175,0.30)', 'Collector (N)');

    const beBarrier = Math.max(10, 34 - (vbe - 0.6) * 45);
    const bcBarrier = Math.min(44, 20 + (vce / 12) * 24);

    ctx.fillStyle = 'rgba(251,191,36,0.22)';
    ctx.fillRect(x0 + ew - beBarrier / 2, top, beBarrier, bottom - top);
    ctx.fillRect(x0 + ew + bw - bcBarrier / 2, top, bcBarrier, bottom - top);

    ctx.fillStyle = '#fde68a';
    ctx.font = '12px "Noto Sans KR", sans-serif';
    ctx.fillText('BE 장벽', x0 + ew - 28, top - 8);
    ctx.fillText('BC 장벽', x0 + ew + bw - 28, top - 8);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 13px "Noto Sans KR", sans-serif';
    ctx.fillText('NPN 트랜지스터 캐리어 이동', 24, 30);
    ctx.font = '12px "Noto Sans KR", sans-serif';
    ctx.fillText(`동작: ${state.mode}  |  VBE ${vbe.toFixed(2)}V, VCE ${vce.toFixed(1)}V`, 24, 50);

    // Electron main current (Emitter -> Collector)
    const laneCount = 4;
    const mainDensity = Math.floor(10 * state.conduct + 2);
    for (let i = 0; i < mainDensity; i++) {
      const lane = i % laneCount;
      const y = 106 + lane * 26;
      const span = ew + bw + cw - 30;
      const speed = 0.8 + state.conduct * 2.2;
      const phase = (t * speed + i * (span / mainDensity)) % span;
      const x = x0 + 16 + phase;

      let alpha = 0.95;
      if (x > x0 + ew - beBarrier * 0.4 && x < x0 + ew + bw + bcBarrier * 0.4) {
        alpha = state.mode === 'Cutoff' ? 0.15 : 0.9;
      }
      drawElectron(x, y, alpha);
    }

    // Base recombination current branch (small in Active, bigger in Saturation)
    const baseBranchCount = state.mode === 'Saturation' ? 6 : state.mode === 'Active' ? 3 : 1;
    for (let i = 0; i < baseBranchCount; i++) {
      const yStart = 120 + i * 18;
      const xStart = x0 + ew + 8;
      const yEnd = bottom + 34;
      const xEnd = x0 + ew + bw / 2;
      const p = ((t * 0.02 + i * 0.18) % 1);
      const x = xStart + (xEnd - xStart) * p;
      const y = yStart + (yEnd - yStart) * p;
      drawElectron(x, y, 0.65);
    }

    drawArrow(x0 + 20, bottom + 20, x0 + ew + bw + cw - 20, bottom + 20, '#22d3ee');
    ctx.fillStyle = '#93c5fd';
    ctx.font = '12px "Noto Sans KR", sans-serif';
    ctx.fillText('전자 주 흐름: Emitter -> Collector', x0 + 24, bottom + 42);

    drawArrow(x0 + ew + 12, bottom + 4, x0 + ew + bw / 2, bottom + 36, '#fda4af');
    ctx.fillStyle = '#fda4af';
    ctx.fillText('베이스로 일부 재결합', x0 + ew + bw / 2 + 10, bottom + 40);

    // Terminals
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0 + ew / 2, top);
    ctx.lineTo(x0 + ew / 2, 28);
    ctx.moveTo(x0 + ew + bw + cw / 2, top);
    ctx.lineTo(x0 + ew + bw + cw / 2, 28);
    ctx.moveTo(x0 + ew + bw / 2, bottom);
    ctx.lineTo(x0 + ew + bw / 2, bottom + 54);
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px monospace';
    ctx.fillText('C', x0 + ew + bw + cw / 2 - 4, 22);
    ctx.fillText('E', x0 + ew / 2 - 4, 22);
    ctx.fillText('B', x0 + ew + bw / 2 - 4, bottom + 70);

    t += 1;
    rafId = requestAnimationFrame(drawScene);
  }

  vbeEl.addEventListener('input', drawScene);
  vceEl.addEventListener('input', drawScene);
  drawScene();

  return () => cancelAnimationFrame(rafId);
}
