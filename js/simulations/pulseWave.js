// ─── 펄스 파형 시뮬레이터 ───

export function mountPulseWave(container) {
  container.innerHTML = `
    <div class="sim-canvas-wrap">
      <canvas id="canvas-pulse" height="120" style="width:100%;display:block;"></canvas>
    </div>
    <div class="sim-controls">
      <div class="sim-control-row">
        <span class="sim-label">주파수 (f)</span>
        <input type="range" class="sim-slider" id="pw-freq" min="50" max="500" step="10" value="250" />
        <span class="sim-value" id="pw-freq-val">250 Hz</span>
      </div>
      <div class="sim-control-row">
        <span class="sim-label">듀티 사이클 (DC)</span>
        <input type="range" class="sim-slider" id="pw-duty" min="0" max="100" step="5" value="25" />
        <span class="sim-value" id="pw-duty-val">25%</span>
      </div>
    </div>
    <div class="sim-info">
      <div class="sim-info-item">
        <span class="sim-info-label">주기 T</span>
        <span class="sim-info-val" id="pw-period">4.0 ms</span>
      </div>
      <div class="sim-info-item">
        <span class="sim-info-label">펄스 폭 tᵥᵥ</span>
        <span class="sim-info-val" id="pw-width">1.0 ms</span>
      </div>
      <div class="sim-info-item">
        <span class="sim-info-label">f = 1/T</span>
        <span class="sim-info-val" id="pw-formula">1/4ms = 250Hz</span>
      </div>
    </div>
  `;

  const canvas = document.getElementById('canvas-pulse');
  const freqSlider = document.getElementById('pw-freq');
  const dutySlider = document.getElementById('pw-duty');
  const freqVal = document.getElementById('pw-freq-val');
  const dutyVal = document.getElementById('pw-duty-val');
  const periodEl = document.getElementById('pw-period');
  const widthEl = document.getElementById('pw-width');
  const formulaEl = document.getElementById('pw-formula');

  function draw() {
    const freq = parseInt(freqSlider.value);
    const duty = parseInt(dutySlider.value) / 100;

    freqVal.textContent = `${freq} Hz`;
    dutyVal.textContent = `${Math.round(duty * 100)}%`;

    const T_ms = (1 / freq * 1000).toFixed(2);
    const tw_ms = (T_ms * duty).toFixed(2);
    periodEl.textContent = `${T_ms} ms`;
    widthEl.textContent = `${tw_ms} ms`;
    formulaEl.textContent = `1/${T_ms}ms = ${freq}Hz`;

    const W = canvas.parentElement.clientWidth - 24;
    canvas.width = W;
    canvas.height = 120;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, W, 120);

    const H = 120;
    const yHigh = 15;
    const yLow = 85;
    const yMid = (yHigh + yLow) / 2;

    // 기준선
    ctx.strokeStyle = '#2a3142';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(40, yHigh);
    ctx.lineTo(W - 10, yHigh);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(40, yLow);
    ctx.lineTo(W - 10, yLow);
    ctx.stroke();
    ctx.setLineDash([]);

    // 축 레이블
    ctx.fillStyle = '#8b949e';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('High', 36, yHigh + 4);
    ctx.fillText('Low', 36, yLow + 4);
    ctx.textAlign = 'left';

    // 파형 — 3주기 표시
    const cycles = 3;
    const pxPerCycle = (W - 50) / cycles;
    const pxHigh = pxPerCycle * duty;

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    let x = 40;
    ctx.moveTo(x, yLow);
    ctx.lineTo(x, yHigh);

    for (let i = 0; i < cycles; i++) {
      const xRise = x;
      const xFall = x + pxHigh;
      const xEnd = x + pxPerCycle;

      ctx.lineTo(xFall, yHigh);   // high plateau
      ctx.lineTo(xFall, yLow);    // falling edge
      ctx.lineTo(xEnd, yLow);     // low plateau
      if (i < cycles - 1) ctx.lineTo(xEnd, yHigh); // next rising edge
      x = xEnd;
    }
    ctx.stroke();

    // 주기 표시 화살표 (첫 번째 주기)
    const xStart = 40;
    const xCycleEnd = 40 + pxPerCycle;
    const arrowY = yLow + 20;
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xStart, arrowY);
    ctx.lineTo(xCycleEnd, arrowY);
    ctx.stroke();
    // 화살표 끝
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath();
    ctx.moveTo(xStart, arrowY - 4);
    ctx.lineTo(xStart, arrowY + 4);
    ctx.lineTo(xStart - 4, arrowY);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(xCycleEnd, arrowY - 4);
    ctx.lineTo(xCycleEnd, arrowY + 4);
    ctx.lineTo(xCycleEnd + 4, arrowY);
    ctx.fill();

    ctx.fillStyle = '#60a5fa';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`T = ${T_ms}ms`, (xStart + xCycleEnd) / 2, arrowY - 5);

    // 펄스 폭 표시
    if (duty > 0.05) {
      const xHighEnd = 40 + pxHigh;
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(40, yHigh - 8);
      ctx.lineTo(xHighEnd, yHigh - 8);
      ctx.stroke();
      ctx.fillStyle = '#10b981';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`tᵥᵥ = ${tw_ms}ms`, (40 + xHighEnd) / 2, yHigh - 12);
    }
  }

  draw();
  freqSlider.addEventListener('input', draw);
  dutySlider.addEventListener('input', draw);

  const resizeObs = new ResizeObserver(draw);
  resizeObs.observe(container);
}
