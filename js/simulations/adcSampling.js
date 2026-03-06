// ─── ADC 샘플링 시뮬레이터 ───

export function mountAdcSampling(container) {
  container.innerHTML = `
    <div class="sim-canvas-wrap">
      <canvas id="canvas-adc" height="140" style="width:100%;display:block;"></canvas>
    </div>
    <div class="sim-controls">
      <div class="sim-control-row">
        <span class="sim-label">신호 주파수 (fₛᵢg)</span>
        <input type="range" class="sim-slider" id="adc-sig" min="1" max="8" step="0.5" value="2" />
        <span class="sim-value" id="adc-sig-val">2 Hz</span>
      </div>
      <div class="sim-control-row">
        <span class="sim-label">샘플링 주파수 (fₛ)</span>
        <input type="range" class="sim-slider" id="adc-samp" min="2" max="30" step="1" value="10" />
        <span class="sim-value" id="adc-samp-val">10 Hz</span>
      </div>
    </div>
    <div class="sim-info">
      <div class="sim-info-item">
        <span class="sim-info-label">나이퀴스트 조건</span>
        <span class="sim-info-val" id="adc-nyquist">fₛ ≥ 2fₛᵢg</span>
      </div>
      <div class="sim-info-item">
        <span class="sim-info-label">상태</span>
        <span class="sim-info-val" id="adc-status">적절</span>
      </div>
    </div>
    <div class="sim-warning" id="adc-warning">
      ⚠ 나이퀴스트 정리 위반! 샘플링 주파수가 신호 주파수의 2배 미만입니다. 앨리어싱(aliasing) 발생으로 원 신호를 재현할 수 없습니다.
    </div>
  `;

  const canvas = document.getElementById('canvas-adc');
  const sigSlider = document.getElementById('adc-sig');
  const sampSlider = document.getElementById('adc-samp');
  const sigValEl = document.getElementById('adc-sig-val');
  const sampValEl = document.getElementById('adc-samp-val');
  const nyquistEl = document.getElementById('adc-nyquist');
  const statusEl = document.getElementById('adc-status');
  const warningEl = document.getElementById('adc-warning');

  function draw() {
    const fSig = parseFloat(sigSlider.value);
    const fSamp = parseInt(sampSlider.value);

    sigValEl.textContent = `${fSig} Hz`;
    sampValEl.textContent = `${fSamp} Hz`;

    const nyquist = fSamp >= 2 * fSig;
    nyquistEl.textContent = `${fSamp} ≥ ${2 * fSig} ?`;
    statusEl.textContent = nyquist ? '적절 ✓' : '위반 ✗';
    statusEl.style.color = nyquist ? 'var(--accent-green)' : 'var(--accent-red)';
    warningEl.classList.toggle('visible', !nyquist);

    const W = canvas.parentElement.clientWidth - 24;
    canvas.width = W;
    canvas.height = 140;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, W, 140);

    const H = 140;
    const mid = H / 2;
    const amp = (H / 2) * 0.75;
    const plotW = W - 50;
    const offsetX = 40;

    // 축
    ctx.strokeStyle = '#2a3142';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(offsetX, mid);
    ctx.lineTo(W - 10, mid);
    ctx.stroke();
    ctx.fillStyle = '#8b949e';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('+V', 36, mid - amp + 4);
    ctx.fillText('-V', 36, mid + amp + 4);
    ctx.fillText('0', 36, mid + 4);
    ctx.textAlign = 'left';

    // 원 신호
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let px = 0; px <= plotW; px++) {
      const t = px / plotW;
      const y = mid - amp * Math.sin(2 * Math.PI * fSig * t);
      px === 0 ? ctx.moveTo(offsetX + px, y) : ctx.lineTo(offsetX + px, y);
    }
    ctx.stroke();

    // 샘플 포인트들
    const sampleCount = fSamp; // 1초 기준
    const sampleInterval = plotW / fSamp;
    const samples = [];

    for (let i = 0; i <= fSamp; i++) {
      const t = i / fSamp;
      const y = mid - amp * Math.sin(2 * Math.PI * fSig * t);
      const px = offsetX + i * sampleInterval;
      samples.push({ px, y, t });

      // 수직선
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(px, mid);
      ctx.lineTo(px, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // 샘플 점
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(px, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 재현 신호 (샘플 선형 보간)
    ctx.strokeStyle = nyquist ? '#10b981' : '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = 0; px <= plotW; px++) {
      const t = px / plotW;
      // sinc 보간 (간단히 선형 보간으로 근사)
      let y = 0;
      let wSum = 0;
      samples.forEach(s => {
        const dt = Math.abs(t - s.t);
        const w = dt < 1e-9 ? 1e9 : 1 / (dt + 0.001);
        y += (mid - s.y) / amp * w;
        wSum += w;
      });
      const reconstructed = mid - amp * (y / wSum);
      px === 0 ? ctx.moveTo(offsetX + px, reconstructed) : ctx.lineTo(offsetX + px, reconstructed);
    }
    ctx.stroke();

    // 범례
    const legends = [
      { color: 'rgba(56, 189, 248, 0.8)', label: '원 신호' },
      { color: '#f59e0b', label: '샘플 포인트' },
      { color: nyquist ? '#10b981' : '#ef4444', label: '재현 신호' },
    ];
    legends.forEach((l, i) => {
      ctx.fillStyle = l.color;
      ctx.fillRect(offsetX + i * 90, H - 14, 10, 10);
      ctx.fillStyle = '#8b949e';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(l.label, offsetX + i * 90 + 13, H - 5);
    });
  }

  draw();
  sigSlider.addEventListener('input', draw);
  sampSlider.addEventListener('input', draw);

  const resizeObs = new ResizeObserver(draw);
  resizeObs.observe(container);
}
