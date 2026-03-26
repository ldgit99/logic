// ─── 소수 진법 변환기 — 10진 소수 → 2진수 곱셈법 단계별 시각화 ───

export function mountFractionConverter(container) {
  container.innerHTML = `
    <div class="sim-controls" style="margin-bottom:14px;">
      <div class="sim-control-row">
        <span class="sim-label">10진 소수 입력</span>
        <input type="number" id="fc-input" min="0" max="0.9999999" step="0.0001" value="0.6875"
          style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
          color:var(--text-primary);padding:8px 14px;font-size:0.95rem;font-family:monospace;width:140px;" />
        <span class="sim-value" id="fc-result" style="font-family:monospace;color:var(--accent-green);">0.1011₂</span>
      </div>
    </div>

    <div id="fc-display"></div>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
      <button class="unit-example-btn" data-val="0.6875">0.6875 (유한)</button>
      <button class="unit-example-btn" data-val="0.5">0.5 (유한)</button>
      <button class="unit-example-btn" data-val="0.375">0.375 (유한)</button>
      <button class="unit-example-btn" data-val="0.1">0.1 (무한반복)</button>
    </div>
  `;

  const input = document.getElementById('fc-input');
  const resultEl = document.getElementById('fc-result');
  const display = document.getElementById('fc-display');

  const MAX_STEPS = 20;

  function computeSteps(frac) {
    const steps = [];
    let cur = frac;
    const seen = new Map();
    let repeating = false;
    let repeatFrom = -1;

    for (let i = 0; i < MAX_STEPS; i++) {
      if (cur === 0) break;
      // 부동소수점 반복 감지: 소수부를 7자리로 반올림해서 비교
      const key = cur.toFixed(10);
      if (seen.has(key)) {
        repeating = true;
        repeatFrom = seen.get(key);
        break;
      }
      seen.set(key, i);
      const product = cur * 2;
      const intPart = Math.floor(product);
      const fracPart = product - intPart;
      // 부동소수점 오차 보정
      const cleanFrac = Math.abs(fracPart) < 1e-10 ? 0 : (Math.abs(fracPart - 1) < 1e-10 ? 0 : fracPart);
      steps.push({ cur, product: product, intPart, fracPart: cleanFrac });
      cur = cleanFrac;
      if (cur === 0) break;
    }
    return { steps, repeating, repeatFrom };
  }

  function update() {
    let val = parseFloat(input.value);
    if (isNaN(val) || val < 0 || val >= 1) {
      display.innerHTML = `<div style="color:var(--accent-red);font-size:0.85rem;">0 이상 1 미만의 소수를 입력하세요.</div>`;
      resultEl.textContent = '-';
      return;
    }

    const { steps, repeating, repeatFrom } = computeSteps(val);

    const bits = steps.map(s => s.intPart);
    const binStr = '0.' + bits.join('') + (repeating ? '...' : '');

    resultEl.textContent = binStr + '₂';

    // 테이블 렌더링
    const rows = steps.map((s, i) => {
      const curStr = s.cur.toPrecision(7).replace(/\.?0+$/, '');
      const productStr = s.product.toPrecision(7).replace(/\.?0+$/, '');
      const isRepeatStart = repeating && i === repeatFrom;
      const bitColor = s.intPart === 1 ? 'var(--accent-green)' : 'var(--text-muted)';
      return `
        <tr style="${isRepeatStart ? 'border-top:2px dashed var(--accent-yellow);' : ''}">
          <td style="padding:5px 10px;font-family:monospace;color:var(--text-secondary);font-size:0.88rem;">
            ${isRepeatStart ? '<span style="font-size:0.72rem;color:var(--accent-yellow);margin-right:4px;">[반복시작]</span>' : ''}
            ${curStr}
          </td>
          <td style="padding:5px 10px;font-family:monospace;font-size:0.88rem;color:var(--text-primary);">× 2 = ${productStr}</td>
          <td style="padding:5px 10px;text-align:center;">
            <span style="
              display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;
              background:${s.intPart === 1 ? 'var(--accent-green)' : 'var(--bg-tertiary)'};
              color:${s.intPart === 1 ? 'white' : 'var(--text-muted)'};
              border:1px solid var(--border);border-radius:3px;
              font-family:monospace;font-size:0.9rem;font-weight:700;
            ">${s.intPart}</span>
          </td>
          <td style="padding:5px 10px;font-family:monospace;font-size:0.82rem;color:var(--text-muted);">
            소수부: ${s.fracPart === 0 ? '<span style="color:var(--accent-blue);">0 (종료)</span>' : s.fracPart.toPrecision(6).replace(/\.?0+$/, '')}
          </td>
        </tr>
      `;
    }).join('');

    const repeatNote = repeating
      ? `<div style="margin-top:8px;font-size:0.8rem;color:var(--accent-yellow);">⚠ ${MAX_STEPS}번 반복 후 종료 — 이 소수는 유한한 2진수로 표현되지 않습니다 (무한 반복)</div>`
      : '';

    display.innerHTML = `
      <div style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:14px 16px;overflow-x:auto;">
        <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">
          소수 부분 변환 과정 (2 곱하기법)
        </div>
        <table style="border-collapse:collapse;width:100%;">
          <thead>
            <tr style="border-bottom:1px solid var(--border);">
              <th style="padding:4px 10px;font-size:0.75rem;color:var(--text-muted);font-weight:600;text-align:left;">소수부</th>
              <th style="padding:4px 10px;font-size:0.75rem;color:var(--text-muted);font-weight:600;text-align:left;">× 2 = 결과</th>
              <th style="padding:4px 10px;font-size:0.75rem;color:var(--text-muted);font-weight:600;text-align:center;">정수부(비트)</th>
              <th style="padding:4px 10px;font-size:0.75rem;color:var(--text-muted);font-weight:600;text-align:left;">다음 소수부</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${repeatNote}
      </div>
      <div class="sim-info" style="margin-top:10px;">
        <div class="sim-info-item">
          <span class="sim-info-label">결과 (순서대로 읽기)</span>
          <span class="sim-info-val" style="font-family:monospace;color:var(--accent-green);">${binStr}₂</span>
        </div>
        <div class="sim-info-item">
          <span class="sim-info-label">유한/무한</span>
          <span class="sim-info-val" style="color:${repeating ? 'var(--accent-yellow)' : 'var(--accent-green)'};">${repeating ? '무한 반복 ∞' : '유한 ✓'}</span>
        </div>
      </div>
    `;
  }

  input.addEventListener('input', update);

  container.querySelectorAll('.unit-example-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      input.value = btn.dataset.val;
      update();
    });
  });

  update();
}
