// ADC sampling + quantization error simulator

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function quantizeNormalized(x, bits) {
  const levels = Math.pow(2, bits);
  const idx = Math.round(((x + 1) * 0.5) * (levels - 1));
  const q = (idx / (levels - 1)) * 2 - 1;
  return clamp(q, -1, 1);
}

function fmt(num, digits = 3) {
  return Number(num).toFixed(digits);
}

export function mountAdcSampling(container) {
  container.innerHTML = `
    <div class="sim-canvas-wrap">
      <canvas id="canvas-adc" height="170" style="width:100%;display:block;"></canvas>
    </div>

    <div class="sim-controls">
      <div class="sim-control-row">
        <span class="sim-label">\uC2E0\uD638 \uC8FC\uD30C\uC218</span>
        <input type="range" class="sim-slider" id="adc-sig" min="1" max="10" step="0.5" value="2" />
        <span class="sim-value" id="adc-sig-val">2.0 Hz</span>
      </div>

      <div class="sim-control-row">
        <span class="sim-label">\uC0D8\uD50C\uB9C1 \uC8FC\uD30C\uC218</span>
        <input type="range" class="sim-slider" id="adc-samp" min="4" max="80" step="1" value="20" />
        <span class="sim-value" id="adc-samp-val">20 Hz</span>
      </div>

      <div class="sim-control-row">
        <span class="sim-label">ADC \uBE44\uD2B8 \uC218</span>
        <input type="range" class="sim-slider" id="adc-bits" min="2" max="12" step="1" value="8" />
        <span class="sim-value" id="adc-bits-val">8 bit</span>
      </div>
    </div>

    <div class="sim-info">
      <div class="sim-info-item">
        <span class="sim-info-label">\uC591\uC790\uD654 \uB2E8\uACC4 \uC218</span>
        <span class="sim-info-val" id="adc-levels">256</span>
      </div>
      <div class="sim-info-item">
        <span class="sim-info-label">\uC591\uC790\uD654 \uAC04\uACA9 (LSB)</span>
        <span class="sim-info-val" id="adc-lsb">0.0078</span>
      </div>
      <div class="sim-info-item">
        <span class="sim-info-label">\uD3C9\uADE0 \uC808\uB300 \uC624\uCC28</span>
        <span class="sim-info-val" id="adc-mae">0.0000</span>
      </div>
      <div class="sim-info-item">
        <span class="sim-info-label">\uB098\uC774\uD034\uC2A4\uD2B8</span>
        <span class="sim-info-val" id="adc-nyq">\uC815\uC0C1</span>
      </div>
    </div>

    <div class="sim-warning" id="adc-warning">
      Sampling frequency is below \uB098\uC774\uD034\uC2A4\uD2B8 (f_s &lt; 2f_signal). Aliasing may dominate the error.
    </div>
  `;

  const canvas = document.getElementById('canvas-adc');
  const sigSlider = document.getElementById('adc-sig');
  const sampSlider = document.getElementById('adc-samp');
  const bitsSlider = document.getElementById('adc-bits');

  const sigVal = document.getElementById('adc-sig-val');
  const sampVal = document.getElementById('adc-samp-val');
  const bitsVal = document.getElementById('adc-bits-val');
  const levelsVal = document.getElementById('adc-levels');
  const lsbVal = document.getElementById('adc-lsb');
  const maeVal = document.getElementById('adc-mae');
  const nyqVal = document.getElementById('adc-nyq');
  const warning = document.getElementById('adc-warning');

  function draw() {
    const fSig = parseFloat(sigSlider.value);
    const fSamp = parseInt(sampSlider.value, 10);
    const bits = parseInt(bitsSlider.value, 10);

    sigVal.textContent = `${fmt(fSig, 1)} Hz`;
    sampVal.textContent = `${fSamp} Hz`;
    bitsVal.textContent = `${bits} bit`;

    const levels = Math.pow(2, bits);
    const lsb = 2 / (levels - 1);
    levelsVal.textContent = `${levels}`;
    lsbVal.textContent = fmt(lsb, 4);

    const nyquistOk = fSamp >= 2 * fSig;
    nyqVal.textContent = nyquistOk ? '\uC815\uC0C1' : '\uC704\uBC18';
    nyqVal.style.color = nyquistOk ? 'var(--accent-green)' : 'var(--accent-red)';
    warning.classList.toggle('visible', !nyquistOk);

    const w = Math.max(320, container.clientWidth - 24);
    const h = 170;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, w, h);

    const left = 42;
    const right = 12;
    const top = 14;
    const bottom = 22;
    const plotW = w - left - right;
    const plotH = h - top - bottom;
    const midY = top + plotH / 2;
    const amp = plotH * 0.42;

    // Axis
    ctx.strokeStyle = '#2a3142';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, midY);
    ctx.lineTo(w - right, midY);
    ctx.stroke();

    // Analog reference signal (continuous)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let px = 0; px <= plotW; px++) {
      const t = px / plotW; // 0..1 sec
      const x = Math.sin(2 * Math.PI * fSig * t);
      const y = midY - amp * x;
      if (px === 0) ctx.moveTo(left + px, y);
      else ctx.lineTo(left + px, y);
    }
    ctx.stroke();

    // Sample points + quantized staircase
    const samples = [];
    for (let i = 0; i <= fSamp; i++) {
      const t = i / fSamp;
      const x = Math.sin(2 * Math.PI * fSig * t);
      const q = quantizeNormalized(x, bits);
      const px = left + t * plotW;
      const yQ = midY - amp * q;
      const yX = midY - amp * x;
      samples.push({ t, px, x, q, yQ, yX });
    }

    // Quantized reconstructed staircase
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i];
      const b = samples[i + 1];
      if (i === 0) ctx.moveTo(a.px, a.yQ);
      ctx.lineTo(b.px, a.yQ);
      ctx.lineTo(b.px, b.yQ);
    }
    ctx.stroke();

    // Error stems + sample dots
    let errSum = 0;
    for (const s of samples) {
      const e = Math.abs(s.x - s.q);
      errSum += e;

      ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.px, s.yX);
      ctx.lineTo(s.px, s.yQ);
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(s.px, s.yQ, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    const mae = errSum / samples.length;
    maeVal.textContent = fmt(mae, 4);

    // Legend
    const legend = [
      { c: 'rgba(56, 189, 248, 0.8)', t: '\uC6D0 \uC2E0\uD638' },
      { c: '#10b981', t: '\uC591\uC790\uD654 \uC2E0\uD638' },
      { c: 'rgba(245, 158, 11, 0.9)', t: '\uC624\uCC28' },
    ];

    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    legend.forEach((l, i) => {
      const x = left + i * 90;
      const y = h - 11;
      ctx.fillStyle = l.c;
      ctx.fillRect(x, y - 8, 9, 9);
      ctx.fillStyle = '#8b949e';
      ctx.fillText(l.t, x + 12, y);
    });
  }

  draw();
  sigSlider.addEventListener('input', draw);
  sampSlider.addEventListener('input', draw);
  bitsSlider.addEventListener('input', draw);

  const ro = new ResizeObserver(draw);
  ro.observe(container);

  return () => ro.disconnect();
}