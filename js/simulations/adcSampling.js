// ADC digital sampling simulator (sampling-focused)

function fmt(num, digits = 2) {
  return Number(num).toFixed(digits);
}

export function mountAdcSampling(container) {
  container.innerHTML = `
    <div class="sim-canvas-wrap">
      <canvas id="canvas-adc" height="190" style="width:100%;display:block;"></canvas>
    </div>

    <div class="sim-controls">
      <div class="sim-control-row">
        <span class="sim-label">\uC785\uB825 \uC2E0\uD638 \uC8FC\uD30C\uC218</span>
        <input type="range" class="sim-slider" id="adc-sig" min="0.5" max="12" step="0.1" value="2.0" />
        <span class="sim-value" id="adc-sig-val">2.0 Hz</span>
      </div>

      <div class="sim-control-row">
        <span class="sim-label">\uC0D8\uD50C\uB9C1 \uC8FC\uD30C\uC218</span>
        <input type="range" class="sim-slider" id="adc-samp" min="2" max="80" step="1" value="20" />
        <span class="sim-value" id="adc-samp-val">20 Hz</span>
      </div>

      <div class="sim-control-row">
        <span class="sim-label">\uD45C\uC2DC \uC2DC\uAC04 \uAD6C\uAC04</span>
        <input type="range" class="sim-slider" id="adc-window" min="0.5" max="2.0" step="0.1" value="1.0" />
        <span class="sim-value" id="adc-window-val">1.0 s</span>
      </div>
    </div>

    <div class="sim-info">
      <div class="sim-info-item">
        <span class="sim-info-label">\uC0D8\uD50C \uAC04\uACA9 (T<sub>s</sub>)</span>
        <span class="sim-info-val" id="adc-ts">0.050 s</span>
      </div>
      <div class="sim-info-item">
        <span class="sim-info-label">\uCD1D \uC0D8\uD50C \uC218</span>
        <span class="sim-info-val" id="adc-count">21</span>
      </div>
      <div class="sim-info-item">
        <span class="sim-info-label">\uB098\uC774\uD034\uC2A4\uD2B8 \uAE30\uC900</span>
        <span class="sim-info-val" id="adc-nyq">\uC815\uC0C1</span>
      </div>
      <div class="sim-info-item">
        <span class="sim-info-label">\uCD94\uC815 \uC5D8\uB9AC\uC5B4\uC2F1 \uC8FC\uD30C\uC218</span>
        <span class="sim-info-val" id="adc-alias">-</span>
      </div>
    </div>

    <div class="sim-warning" id="adc-warning">
      \uC0D8\uD50C\uB9C1 \uC8FC\uD30C\uC218\uAC00 \uB098\uC774\uD034\uC2A4\uD2B8 \uC870\uAC74\uC744 \uB9CC\uC871\uD558\uC9C0 \uBABB\uD569\uB2C8\uB2E4. (f<sub>s</sub> &lt; 2f<sub>in</sub>)<br>
      \uD45C\uBCF8\uD654\uB41C \uC2E0\uD638\uAC00 \uB2E4\uB978 \uB0AE\uC740 \uC8FC\uD30C\uC218\uB85C \uBCF4\uC77C \uC218 \uC788\uC2B5\uB2C8\uB2E4 (\uC5D8\uB9AC\uC5B4\uC2F1).
    </div>
  `;

  const canvas = container.querySelector('#canvas-adc');
  const sigSlider = container.querySelector('#adc-sig');
  const sampSlider = container.querySelector('#adc-samp');
  const windowSlider = container.querySelector('#adc-window');

  const sigVal = container.querySelector('#adc-sig-val');
  const sampVal = container.querySelector('#adc-samp-val');
  const windowVal = container.querySelector('#adc-window-val');
  const tsVal = container.querySelector('#adc-ts');
  const countVal = container.querySelector('#adc-count');
  const nyqVal = container.querySelector('#adc-nyq');
  const aliasVal = container.querySelector('#adc-alias');
  const warning = container.querySelector('#adc-warning');

  function nearestAlias(fin, fs) {
    const k = Math.round(fin / fs);
    const fa = Math.abs(fin - k * fs);
    return fa;
  }

  function draw() {
    const fin = parseFloat(sigSlider.value);
    const fs = parseFloat(sampSlider.value);
    const windowSec = parseFloat(windowSlider.value);

    sigVal.textContent = `${fmt(fin, 1)} Hz`;
    sampVal.textContent = `${fmt(fs, 0)} Hz`;
    windowVal.textContent = `${fmt(windowSec, 1)} s`;

    const ts = 1 / fs;
    const sampleCount = Math.floor(windowSec * fs) + 1;
    tsVal.textContent = `${fmt(ts, 3)} s`;
    countVal.textContent = `${sampleCount}`;

    const nyquistOk = fs >= 2 * fin;
    nyqVal.textContent = nyquistOk ? '\uC815\uC0C1' : '\uC704\uBC18';
    nyqVal.style.color = nyquistOk ? 'var(--accent-green)' : 'var(--accent-red)';
    warning.classList.toggle('visible', !nyquistOk);

    if (nyquistOk) {
      aliasVal.textContent = '-';
      aliasVal.style.color = 'var(--text-primary)';
    } else {
      const fa = nearestAlias(fin, fs);
      aliasVal.textContent = `${fmt(fa, 2)} Hz`;
      aliasVal.style.color = 'var(--accent-yellow)';
    }

    const w = Math.max(320, container.clientWidth - 24);
    const h = 190;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
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

    // axis
    ctx.strokeStyle = '#2a3142';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, midY);
    ctx.lineTo(w - right, midY);
    ctx.stroke();

    // original analog signal
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    for (let px = 0; px <= plotW; px++) {
      const t = (px / plotW) * windowSec;
      const x = Math.sin(2 * Math.PI * fin * t);
      const y = midY - amp * x;
      if (px === 0) ctx.moveTo(left + px, y);
      else ctx.lineTo(left + px, y);
    }
    ctx.stroke();

    // sample points
    const samples = [];
    for (let i = 0; i < sampleCount; i++) {
      const t = i / fs;
      const x = Math.sin(2 * Math.PI * fin * t);
      const px = left + (t / windowSec) * plotW;
      const py = midY - amp * x;
      samples.push({ t, px, py, x });
    }

    // sampling vertical stems
    ctx.strokeStyle = 'rgba(148,163,184,0.4)';
    ctx.lineWidth = 1;
    for (const s of samples) {
      ctx.beginPath();
      ctx.moveTo(s.px, midY);
      ctx.lineTo(s.px, s.py);
      ctx.stroke();
    }

    // sample-and-hold reconstruction (stair)
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i];
      const b = samples[i + 1];
      if (i === 0) ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, a.py);
      ctx.lineTo(b.px, b.py);
    }
    ctx.stroke();

    // sample dots
    for (const s of samples) {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(s.px, s.py, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // legend
    const legend = [
      { c: 'rgba(56, 189, 248, 0.9)', t: '\uC6D0 \uC2E0\uD638(\uC544\uB0A0\uB85C\uADF8)' },
      { c: '#f59e0b', t: '\uC0D8\uD50C \uD3EC\uC778\uD2B8' },
      { c: '#10b981', t: '\uC0D8\uD50C-\uC564-\uD640\uB4DC \uC7AC\uAD6C\uC131' },
    ];

    ctx.font = '10px monospace';
    legend.forEach((l, i) => {
      const x = left + i * 130;
      const y = h - 10;
      ctx.fillStyle = l.c;
      ctx.fillRect(x, y - 8, 9, 9);
      ctx.fillStyle = '#8b949e';
      ctx.fillText(l.t, x + 12, y);
    });
  }

  draw();
  sigSlider.addEventListener('input', draw);
  sampSlider.addEventListener('input', draw);
  windowSlider.addEventListener('input', draw);

  const ro = new ResizeObserver(draw);
  ro.observe(container);

  return () => ro.disconnect();
}
