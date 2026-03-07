// PN junction diode simulation with electrons, holes, and potential barrier.
// Preview-safe module (not wired by default).

export function mountDiodeElectronFlow(container) {
  container.innerHTML = `
    <div class="sim-canvas-wrap" style="padding:12px;">
      <canvas id="diode-canvas" height="280" style="width:100%;"></canvas>
    </div>

    <div class="sim-controls" style="margin-top:12px;">
      <div class="sim-control-row">
        <span class="sim-label">바이어스</span>
        <select id="diode-bias" style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);padding:8px 10px;font-size:0.92rem;">
          <option value="forward">순방향</option>
          <option value="reverse">역방향</option>
        </select>
      </div>
      <div class="sim-control-row">
        <span class="sim-label">인가 전압 |V|</span>
        <input type="range" class="sim-slider" id="diode-v" min="0" max="2.0" step="0.05" value="0.8" />
        <span class="sim-value" id="diode-v-val">0.80 V</span>
      </div>
    </div>

    <div class="sim-info">
      <div class="sim-info-item">
        <span class="sim-info-label">전위 장벽</span>
        <span class="sim-info-val" id="barrier-state">낮아짐</span>
      </div>
      <div class="sim-info-item">
        <span class="sim-info-label">공핍층 폭</span>
        <span class="sim-info-val" id="depletion-width">좁음</span>
      </div>
      <div class="sim-info-item">
        <span class="sim-info-label">전자 이동</span>
        <span class="sim-info-val" id="electron-flow">N형 -> P형 (활발)</span>
      </div>
    </div>

    <div class="sim-warning" style="margin-top:10px;" id="diode-desc">
      순방향: 장벽이 낮아지고 공핍층이 좁아져 다수 캐리어(전자/정공)가 접합을 넘습니다.
      역방향: 장벽이 높아지고 공핍층이 넓어져 다수 캐리어는 차단되고, 소수 캐리어 누설 전류만 흐릅니다.
    </div>
  `;

  const canvas = container.querySelector('#diode-canvas');
  const ctx = canvas.getContext('2d');
  const biasEl = container.querySelector('#diode-bias');
  const vEl = container.querySelector('#diode-v');
  const vValEl = container.querySelector('#diode-v-val');
  const barrierStateEl = container.querySelector('#barrier-state');
  const depletionWidthEl = container.querySelector('#depletion-width');
  const electronFlowEl = container.querySelector('#electron-flow');

  let frameId = 0;
  let tick = 0;

  function resizeCanvas() {
    const width = canvas.parentElement.clientWidth - 24;
    canvas.width = Math.max(700, width);
    canvas.height = 280;
  }

  function drawElectron(x, y, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(x, y, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = '10px monospace';
    ctx.fillText('e', x - 2.2, y + 3.1);
    ctx.restore();
  }

  function drawHole(x, y, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#fb7185';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fb7185';
    ctx.font = '11px monospace';
    ctx.fillText('+', x - 2.7, y + 3.5);
    ctx.restore();
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

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(ang - Math.PI / 6), y2 - head * Math.sin(ang - Math.PI / 6));
    ctx.lineTo(x2 - head * Math.cos(ang + Math.PI / 6), y2 - head * Math.sin(ang + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawBaseRegions(yTop, yBottom, jx, depWidth) {
    const w = canvas.width;

    ctx.fillStyle = 'rgba(30,58,138,0.28)';
    ctx.fillRect(18, yTop, jx - depWidth / 2 - 18, yBottom - yTop);

    ctx.fillStyle = 'rgba(22,101,52,0.26)';
    ctx.fillRect(jx + depWidth / 2, yTop, w - 18 - (jx + depWidth / 2), yBottom - yTop);

    ctx.fillStyle = 'rgba(251,191,36,0.24)';
    ctx.fillRect(jx - depWidth / 2, yTop, depWidth, yBottom - yTop);

    ctx.strokeStyle = 'rgba(251,191,36,0.65)';
    ctx.lineWidth = 1;
    ctx.strokeRect(jx - depWidth / 2, yTop, depWidth, yBottom - yTop);

    ctx.fillStyle = '#dbeafe';
    ctx.font = 'bold 14px "Noto Sans KR", sans-serif';
    ctx.fillText('P형 반도체', 34, yTop + 22);

    ctx.fillStyle = '#dcfce7';
    ctx.fillText('N형 반도체', canvas.width - 130, yTop + 22);

    ctx.fillStyle = '#fde68a';
    ctx.fillText('공핍층 / 전위 장벽', jx - 64, yTop + 22);
  }

  function drawBarrierChart(x, y, width, height, barrierLevel) {
    ctx.save();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);

    const centerX = x + width * 0.5;
    const leftX = x + 10;
    const rightX = x + width - 10;
    const peakY = y + (1 - barrierLevel) * (height - 20) + 10;
    const baseY = y + height - 12;

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(leftX, baseY);
    ctx.quadraticCurveTo(centerX - 20, peakY, centerX, peakY - 4);
    ctx.quadraticCurveTo(centerX + 20, peakY, rightX, baseY);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "Noto Sans KR", sans-serif';
    ctx.fillText('전위 장벽 높이', x + 8, y - 6);
    ctx.restore();
  }

  function render() {
    resizeCanvas();
    const w = canvas.width;
    const h = canvas.height;
    const yTop = 56;
    const yBottom = 224;
    const centerY = (yTop + yBottom) / 2;
    const jx = Math.floor(w * 0.5);

    const forward = biasEl.value === 'forward';
    const v = Number(vEl.value);
    vValEl.textContent = `${v.toFixed(2)} V`;

    const depWidth = forward ? Math.max(28, 78 - v * 22) : Math.min(132, 72 + v * 24);
    const barrierLevel = forward ? Math.max(0.28, 0.76 - v * 0.22) : Math.min(0.95, 0.62 + v * 0.15);

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

    drawBaseRegions(yTop, yBottom, jx, depWidth);

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, centerY);
    ctx.lineTo(w - 18, centerY);
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 13px "Noto Sans KR", sans-serif';
    ctx.fillText(forward ? '순방향 바이어스' : '역방향 바이어스', 24, 30);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px "Noto Sans KR", sans-serif';
    ctx.fillText(forward ? 'P(+), N(-): 장벽 감소' : 'P(-), N(+): 장벽 증가', 170, 30);

    drawArrow(60, centerY - 40, 130, centerY - 40, forward ? '#60a5fa' : '#64748b');
    ctx.fillStyle = '#93c5fd';
    ctx.fillText('전자 이동 방향', 138, centerY - 35);

    drawArrow(130, centerY + 42, 60, centerY + 42, forward ? '#fb7185' : '#64748b');
    ctx.fillStyle = '#fda4af';
    ctx.fillText('정공 이동 방향', 138, centerY + 47);

    const eCount = forward ? Math.floor(10 + v * 7) : 5;
    const hCount = forward ? Math.floor(9 + v * 6) : 5;

    for (let i = 0; i < eCount; i++) {
      const lane = i % 3;
      const y = centerY - 20 + lane * 14;

      if (forward) {
        const span = (w - 50);
        const phase = (tick * (1.0 + v * 1.6) + i * (span / eCount)) % span;
        const x = w - 28 - phase;
        drawElectron(x, y, 0.95);
      } else {
        const nStart = jx + depWidth / 2 + 10;
        const nSpan = Math.max(20, w - 30 - nStart);
        const phase = (tick * 0.65 + i * (nSpan / eCount)) % nSpan;
        const x = nStart + phase;
        drawElectron(x, y, 0.7);
      }
    }

    for (let i = 0; i < hCount; i++) {
      const lane = i % 3;
      const y = centerY + 18 + lane * 14;

      if (forward) {
        const pStart = 28;
        const pSpan = Math.max(20, jx - depWidth / 2 - 38);
        const phase = (tick * (0.95 + v * 1.2) + i * (pSpan / hCount)) % pSpan;
        const x = pStart + phase;
        drawHole(x, y, 0.92);
      } else {
        const pSpan = Math.max(20, jx - depWidth / 2 - 34);
        const phase = (tick * 0.55 + i * (pSpan / hCount)) % pSpan;
        const x = jx - depWidth / 2 - phase - 4;
        drawHole(x, y, 0.7);
      }
    }

    if (forward) {
      const crossCount = Math.max(2, Math.floor(v * 5));
      for (let i = 0; i < crossCount; i++) {
        const phase = (tick * 1.6 + i * 28) % (depWidth + 34);
        const x = jx + depWidth / 2 + 10 - phase;
        drawElectron(x, centerY - 6 + (i % 2) * 12, 0.95);
      }
    } else {
      const leakCount = Math.max(1, Math.floor(v * 1.8));
      for (let i = 0; i < leakCount; i++) {
        const phase = (tick * 0.35 + i * 50) % (depWidth + 34);
        const x = jx - depWidth / 2 - 6 + phase;
        drawElectron(x, centerY - 6 + i * 12, 0.35);
      }
    }

    drawBarrierChart(24, 234, 180, 38, barrierLevel);

    if (forward) {
      barrierStateEl.textContent = '낮아짐';
      barrierStateEl.style.color = 'var(--accent-green)';
      depletionWidthEl.textContent = '좁음';
      depletionWidthEl.style.color = 'var(--accent-green)';
      electronFlowEl.textContent = 'N형 -> P형 (활발)';
electronFlowEl.style.color = 'var(--accent-green)';
    } else {
      barrierStateEl.textContent = '높아짐';
      barrierStateEl.style.color = 'var(--accent-red)';
      depletionWidthEl.textContent = '넓음';
      depletionWidthEl.style.color = 'var(--accent-red)';
      electronFlowEl.textContent = '대부분 차단, 소수 캐리어만 누설';
electronFlowEl.style.color = 'var(--accent-orange)';
    }

    tick += 1;
    frameId = requestAnimationFrame(render);
  }

  biasEl.addEventListener('change', render);
  vEl.addEventListener('input', render);
  render();

  return () => cancelAnimationFrame(frameId);
}
