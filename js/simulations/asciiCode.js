// ─── ASCII / 유니코드 코드 조회 ───

export function mountAsciiCode(container) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <!-- 입력 -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <div>
          <div style="font-size:0.72rem;color:var(--accent-blue);font-weight:700;margin-bottom:4px;text-transform:uppercase;">문자 입력</div>
          <input type="text" id="ac-char" value="A" maxlength="1"
            style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
            color:var(--accent-blue);padding:8px 14px;font-size:1.5rem;font-family:monospace;width:72px;text-align:center;" />
        </div>
        <div>
          <div style="font-size:0.72rem;color:var(--accent-green);font-weight:700;margin-bottom:4px;text-transform:uppercase;">10진수 코드 입력</div>
          <input type="number" id="ac-dec" value="65" min="0" max="127"
            style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
            color:var(--accent-green);padding:8px 14px;font-size:1rem;font-family:monospace;width:120px;" />
        </div>
      </div>

      <!-- 코드 표시 -->
      <div id="ac-display" style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:14px 16px;"></div>

      <!-- 표준 ASCII 테이블 (출력 가능 문자) -->
      <div style="border-top:1px solid var(--border);padding-top:12px;">
        <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">
          출력 가능 ASCII 문자 (32~126) — 클릭하여 선택
        </div>
        <div id="ac-table" style="display:flex;flex-wrap:wrap;gap:2px;max-height:220px;overflow-y:auto;"></div>
      </div>
    </div>
  `;

  const charInput = document.getElementById('ac-char');
  const decInput = document.getElementById('ac-dec');
  const displayEl = document.getElementById('ac-display');
  const tableEl = document.getElementById('ac-table');

  function getCategory(code) {
    if (code < 32) return '제어 문자';
    if (code >= 48 && code <= 57) return '숫자 (0-9)';
    if (code >= 65 && code <= 90) return '대문자 (A-Z)';
    if (code >= 97 && code <= 122) return '소문자 (a-z)';
    if (code === 32) return '공백';
    return '특수 문자';
  }

  function renderDisplay(code) {
    const ch = code >= 32 && code <= 126 ? String.fromCharCode(code) : '(제어)';
    const hex = code.toString(16).toUpperCase().padStart(2, '0');
    const bin = code.toString(2).padStart(7, '0');
    const cat = getCategory(code);

    displayEl.innerHTML = `
      <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">
        ASCII 코드 정보
      </div>
      <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;">
        <div style="font-size:3rem;font-family:monospace;color:var(--accent-blue);font-weight:700;
          width:60px;height:60px;display:flex;align-items:center;justify-content:center;
          background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border);">
          ${ch}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <div style="display:flex;gap:16px;font-size:0.85rem;">
            <span style="color:var(--text-muted);">10진수:</span>
            <span style="color:var(--accent-green);font-family:monospace;font-weight:700;">${code}</span>
          </div>
          <div style="display:flex;gap:16px;font-size:0.85rem;">
            <span style="color:var(--text-muted);">16진수:</span>
            <span style="color:var(--accent-purple);font-family:monospace;font-weight:700;">0x${hex}</span>
          </div>
          <div style="display:flex;gap:16px;font-size:0.85rem;">
            <span style="color:var(--text-muted);">2진수 (7비트):</span>
            <span style="color:var(--accent-blue);font-family:monospace;font-weight:700;">${bin}</span>
          </div>
          <div style="display:flex;gap:16px;font-size:0.85rem;">
            <span style="color:var(--text-muted);">분류:</span>
            <span style="color:var(--text-secondary);">${cat}</span>
          </div>
        </div>
      </div>
      <div style="margin-top:10px;display:flex;gap:3px;">
        ${bin.split('').map((b,i) => `<span style="width:26px;height:28px;display:inline-flex;align-items:center;justify-content:center;
          background:${b==='1'?'var(--accent-blue)':'var(--bg-secondary)'};
          color:${b==='1'?'white':'var(--text-muted)'};
          border:1px solid var(--border);border-radius:3px;font-family:monospace;font-size:0.82rem;font-weight:700;">${b}</span>`).join('')}
        <span style="font-size:0.75rem;color:var(--text-muted);align-self:center;margin-left:6px;">7비트 2진 표현</span>
      </div>
    `;
  }

  function buildTable(highlightCode) {
    tableEl.innerHTML = Array.from({length: 95}, (_, i) => {
      const code = i + 32;
      const ch = String.fromCharCode(code);
      const isHL = code === highlightCode;
      const isDigit = code >= 48 && code <= 57;
      const isUpper = code >= 65 && code <= 90;
      const isLower = code >= 97 && code <= 122;
      const color = isUpper ? 'var(--accent-blue)' : isLower ? 'var(--accent-green)' : isDigit ? 'var(--accent-yellow)' : 'var(--text-secondary)';
      return `<div data-code="${code}" style="
        display:flex;flex-direction:column;align-items:center;
        padding:3px 4px;border-radius:4px;cursor:pointer;min-width:36px;
        background:${isHL?'rgba(37,99,235,0.2)':'transparent'};
        border:1px solid ${isHL?'var(--accent-blue)':'transparent'};
        transition:background 0.15s;
      " title="${code} (0x${code.toString(16).toUpperCase()})">
        <span style="font-family:monospace;font-size:0.88rem;font-weight:700;color:${isHL?'var(--accent-blue)':color};">${ch}</span>
        <span style="font-size:0.58rem;color:var(--text-muted);">${code}</span>
      </div>`;
    }).join('');

    tableEl.querySelectorAll('div[data-code]').forEach(el => {
      el.addEventListener('click', () => {
        const code = parseInt(el.dataset.code);
        charInput.value = String.fromCharCode(code);
        decInput.value = code;
        renderDisplay(code);
        buildTable(code);
      });
    });
  }

  function fromChar() {
    const ch = charInput.value;
    if (!ch) return;
    const code = ch.charCodeAt(0);
    decInput.value = Math.min(127, code);
    renderDisplay(Math.min(127, code));
    buildTable(Math.min(127, code));
  }

  function fromDec() {
    const code = parseInt(decInput.value);
    if (isNaN(code) || code < 0 || code > 127) return;
    if (code >= 32 && code <= 126) charInput.value = String.fromCharCode(code);
    else charInput.value = '';
    renderDisplay(code);
    buildTable(code);
  }

  charInput.addEventListener('input', fromChar);
  decInput.addEventListener('input', fromDec);

  renderDisplay(65);
  buildTable(65);
}
