// ─── 아날로그 vs 디지털 파형 비교 시뮬레이션 ───

export function mountAnalogDigital(container) {
  container.innerHTML = `
    <div class="sim-canvas-wrap" style="flex-direction:column;gap:0;padding:12px;">
      <canvas id="canvas-analog" height="90" style="width:100%;border-radius:4px 4px 0 0;border-bottom:1px solid #2a3142;"></canvas>
      <canvas id="canvas-digital" height="90" style="width:100%;border-radius:0 0 4px 4px;"></canvas>
    </div>
    <div class="sim-controls">
      <div class="sim-control-row">
        <span class="sim-label">신호 주파수</span>
        <input type="range" class="sim-slider" id="ad-freq" min="1" max="5" step="0.5" value="2" />
        <span class="sim-value" id="ad-freq-val">2 Hz</span>
      </div>
      <div class="sim-control-row">
        <span class="sim-label">잡음 크기</span>
        <input type="range" class="sim-slider" id="ad-noise" min="0" max="0.4" step="0.05" value="0.1" />
        <span class="sim-value" id="ad-noise-val">10%</span>
      </div>
    </div>
    <div class="sim-info">
      <div class="sim-info-item">
        <span class="sim-info-label">아날로그:</span>
        <span class="sim-info-val">연속적(Continuous) 신호</span>
      </div>
      <div class="sim-info-item">
        <span class="sim-info-label">디지털:</span>
        <span class="sim-info-val">이산적(Discrete) 신호</span>
      </div>
    </div>
  `;

  const cAnalog = document.getElementById('canvas-analog');
  const cDigital = document.getElementById('canvas-digital');
  const freqSlider = document.getElementById('ad-freq');
  const noiseSlider = document.getElementById('ad-noise');
  const freqVal = document.getElementById('ad-freq-val');
  const noiseVal = document.getElementById('ad-noise-val');

  let animFrame;
  let phase = 0;

  function resize() {
    const w = cAnalog.parentElement.clientWidth - 24;
    cAnalog.width = w;
    cDigital.width = w;
    cAnalog.height = 90;
    cDigital.height = 90;
  }

  function draw() {
    resize();
    const freq = parseFloat(freqSlider.value);
    const noise = parseFloat(noiseSlider.value);
    freqVal.textContent = `${freq} Hz`;
    noiseVal.textContent = `${Math.round(noise * 100)}%`;

    const W = cAnalog.width;
    const H = 90;
    const mid = H / 2;
    const amp = (H / 2) * 0.7;

    // ─── 아날로그 캔버스 ───
    const ctxA = cAnalog.getContext('2d');
    ctxA.clearRect(0, 0, W, H);
    ctxA.fillStyle = '#0a0e1a';
    ctxA.fillRect(0, 0, W, H);

    // 레이블
    ctxA.fillStyle = '#8b949e';
    ctxA.font = '11px monospace';
    ctxA.fillText('Analog', 6, 16);

    // 기준선
    ctxA.strokeStyle = '#2a3142';
    ctxA.lineWidth = 1;
    ctxA.beginPath();
    ctxA.moveTo(0, mid);
    ctxA.lineTo(W, mid);
    ctxA.stroke();

    // 신호
    ctxA.strokeStyle = '#38bdf8';
    ctxA.lineWidth = 2;
    ctxA.beginPath();
    for (let x = 0; x <= W; x++) {
      const t = x / W;
      const n = (Math.random() - 0.5) * 2 * noise;
      const y = mid - amp * (Math.sin(2 * Math.PI * freq * t + phase) + n);
      x === 0 ? ctxA.moveTo(x, y) : ctxA.lineTo(x, y);
    }
    ctxA.stroke();

    // ─── 디지털 캔버스 ───
    const ctxD = cDigital.getContext('2d');
    ctxD.clearRect(0, 0, W, H);
    ctxD.fillStyle = '#0a0e1a';
    ctxD.fillRect(0, 0, W, H);

    ctxD.fillStyle = '#8b949e';
    ctxD.font = '11px monospace';
    ctxD.fillText('Digital', 6, 16);

    ctxD.strokeStyle = '#2a3142';
    ctxD.lineWidth = 1;
    ctxD.beginPath();
    ctxD.moveTo(0, mid);
    ctxD.lineTo(W, mid);
    ctxD.stroke();

    // 디지털: 임계값 기준으로 0/1
    const threshold = 0;
    ctxD.strokeStyle = '#10b981';
    ctxD.lineWidth = 2;
    ctxD.beginPath();
    let prevLevel = null;
    for (let x = 0; x <= W; x++) {
      const t = x / W;
      const analog = Math.sin(2 * Math.PI * freq * t + phase);
      const level = analog >= threshold ? 1 : 0;
      const yHigh = mid - amp * 0.85;
      const yLow = mid + amp * 0.85;
      const y = level === 1 ? yHigh : yLow;
      if (x === 0) {
        ctxD.moveTo(x, y);
        prevLevel = level;
      } else {
        if (level !== prevLevel) {
          ctxD.lineTo(x, prevLevel === 1 ? yHigh : yLow);
          ctxD.lineTo(x, y);
        } else {
          ctxD.lineTo(x, y);
        }
        prevLevel = level;
      }
    }
    ctxD.stroke();

    // 레이블 High/Low
    ctxD.fillStyle = '#10b981';
    ctxD.font = '10px monospace';
    ctxD.fillText('1 (High)', W - 70, mid - amp * 0.85 + 4);
    ctxD.fillText('0 (Low)', W - 70, mid + amp * 0.85 + 4);

    phase += 0.015;
    animFrame = requestAnimationFrame(draw);
  }

  draw();

  freqSlider.addEventListener('input', () => { });
  noiseSlider.addEventListener('input', () => { });

  // 정리
  return () => cancelAnimationFrame(animFrame);
}
