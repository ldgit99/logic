// ─── 논리식 평가기 — 진리표 자동 생성 ───

// Simple Boolean expression parser/evaluator
// Supports: variables (A-Z), AND (. or *), OR (+), NOT (! or ~), parentheses

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[A-Za-z]/.test(ch)) { tokens.push({type:'VAR', val: ch.toUpperCase()}); i++; }
    else if (ch === '!' || ch === '~' || ch === "'") { tokens.push({type:'NOT'}); i++; }
    else if (ch === '.' || ch === '*') { tokens.push({type:'AND'}); i++; }
    else if (ch === '+') { tokens.push({type:'OR'}); i++; }
    else if (ch === '(') { tokens.push({type:'LPAREN'}); i++; }
    else if (ch === ')') { tokens.push({type:'RPAREN'}); i++; }
    else i++;
  }
  return tokens;
}

function getVars(tokens) {
  const vars = new Set();
  tokens.forEach(t => { if (t.type === 'VAR') vars.add(t.val); });
  return [...vars].sort();
}

// Recursive descent parser
function parse(tokens, vars, env) {
  let pos = 0;

  function parseExpr() { return parseOR(); }

  function parseOR() {
    let left = parseAND();
    while (pos < tokens.length && tokens[pos].type === 'OR') {
      pos++;
      const right = parseAND();
      const l = left, r = right;
      left = () => l() | r();
    }
    return left;
  }

  function parseAND() {
    let left = parseNOT();
    while (pos < tokens.length &&
      (tokens[pos].type === 'AND' ||
       (tokens[pos].type !== 'OR' && tokens[pos].type !== 'RPAREN' && tokens[pos].type !== 'NOT' &&
        tokens[pos].type !== 'AND' && (tokens[pos].type === 'VAR' || tokens[pos].type === 'LPAREN')))) {
      if (tokens[pos].type === 'AND') pos++;
      const right = parseNOT();
      const l = left, r = right;
      left = () => l() & r();
    }
    return left;
  }

  function parseNOT() {
    if (pos < tokens.length && tokens[pos].type === 'NOT') {
      pos++;
      const operand = parseNOT();
      return () => 1 - operand();
    }
    return parsePrimary();
  }

  function parsePrimary() {
    if (pos >= tokens.length) return () => 0;
    const tok = tokens[pos];
    if (tok.type === 'LPAREN') {
      pos++;
      const expr = parseExpr();
      if (pos < tokens.length && tokens[pos].type === 'RPAREN') pos++;
      // Check for postfix NOT (prime notation)
      if (pos < tokens.length && tokens[pos].type === 'NOT') {
        pos++;
        return () => 1 - expr();
      }
      return expr;
    }
    if (tok.type === 'VAR') {
      pos++;
      const v = tok.val;
      // Check for postfix NOT
      if (pos < tokens.length && tokens[pos].type === 'NOT') {
        pos++;
        return () => 1 - (env[v] || 0);
      }
      return () => env[v] || 0;
    }
    pos++;
    return () => 0;
  }

  return parseExpr();
}

function evalExpr(expr, vars, assignment) {
  try {
    const tokens = tokenize(expr);
    const env = {};
    vars.forEach((v, i) => env[v] = assignment[i]);
    const fn = parse(tokens, vars, env);
    return fn() & 1;
  } catch {
    return null;
  }
}

export function mountBooleanEval(container) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div>
        <div style="font-size:0.72rem;color:var(--accent-blue);font-weight:700;margin-bottom:4px;text-transform:uppercase;">
          논리식 입력 (변수: A~D, 연산자: + OR, · AND, ! NOT, () 괄호)
        </div>
        <input type="text" id="be-expr" value="A+B!C"
          style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);
          color:var(--accent-blue);padding:8px 14px;font-size:1rem;font-family:monospace;" />
        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">
          예: A+B, A.B, !A+B.C, (A+B).(B+C), A'B+AB'
        </div>
      </div>

      <div id="be-output"></div>

      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="unit-example-btn be-ex" data-ex="A+B">A+B</button>
        <button class="unit-example-btn be-ex" data-ex="A.B">A·B</button>
        <button class="unit-example-btn be-ex" data-ex="!A+B.C">!A+B.C</button>
        <button class="unit-example-btn be-ex" data-ex="(A+B).(A+C)">분배법칙</button>
        <button class="unit-example-btn be-ex" data-ex="!(A.B)">드모르간</button>
        <button class="unit-example-btn be-ex" data-ex="A+A.B">흡수법칙</button>
      </div>
    </div>
  `;

  const exprInput = document.getElementById('be-expr');
  const outputEl = document.getElementById('be-output');

  function update() {
    const expr = exprInput.value.trim();
    if (!expr) { outputEl.innerHTML = ''; return; }

    const tokens = tokenize(expr);
    const vars = getVars(tokens);

    if (vars.length === 0) { outputEl.innerHTML = '<p style="color:var(--text-muted);">변수를 입력하세요 (A~D)</p>'; return; }
    if (vars.length > 4) { outputEl.innerHTML = '<p style="color:var(--accent-red);">변수는 최대 4개까지 지원합니다</p>'; return; }

    const rows = 1 << vars.length;
    let minterms = [], maxterms = [];
    let tableHTML = `<table style="width:100%;border-collapse:collapse;font-family:monospace;font-size:0.82rem;margin-bottom:10px;">
      <thead><tr style="background:var(--bg-secondary);">
        ${vars.map(v => `<th style="padding:4px 8px;border:1px solid var(--border);color:var(--accent-blue);">${v}</th>`).join('')}
        <th style="padding:4px 8px;border:1px solid var(--border);color:var(--accent-green);">F</th>
        <th style="padding:4px 8px;border:1px solid var(--border);color:var(--text-muted);">최소항</th>
      </tr></thead><tbody>`;

    for (let i = 0; i < rows; i++) {
      const bits = Array.from({length: vars.length}, (_, k) => (i >> (vars.length-1-k)) & 1);
      const out = evalExpr(expr, vars, bits);
      if (out === null) { outputEl.innerHTML = '<p style="color:var(--accent-red);">논리식을 파싱할 수 없습니다. 형식을 확인하세요.</p>'; return; }

      const mterm = `m${i}`;
      if (out) minterms.push(i); else maxterms.push(i);

      tableHTML += `<tr style="background:${out?'rgba(16,185,129,0.08)':'transparent'};">
        ${bits.map(b => `<td style="text-align:center;padding:4px 8px;border:1px solid var(--border);color:${b?'var(--accent-blue)':'var(--text-muted)'};">${b}</td>`).join('')}
        <td style="text-align:center;padding:4px 8px;border:1px solid var(--border);font-weight:700;color:${out?'var(--accent-green)':'var(--text-muted)'};">${out}</td>
        <td style="text-align:center;padding:4px 8px;border:1px solid var(--border);color:${out?'var(--accent-green)':'var(--text-muted)'};">${out?mterm:''}</td>
      </tr>`;
    }
    tableHTML += '</tbody></table>';

    const sopExpr = minterms.length === 0 ? 'F = 0' : minterms.length === rows ? 'F = 1' :
      `F = Σm(${minterms.join(',')})`;
    const posExpr = maxterms.length === 0 ? 'F = 1' : maxterms.length === rows ? 'F = 0' :
      `F = ΠM(${maxterms.join(',')})`;

    outputEl.innerHTML = `
      ${tableHTML}
      <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:0.85rem;font-family:monospace;">
        <div style="background:rgba(16,185,129,0.1);border:1px solid var(--accent-green);border-radius:4px;padding:8px 12px;">
          <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:2px;">최소항식 (SOP)</div>
          <div style="color:var(--accent-green);font-weight:700;">${sopExpr}</div>
        </div>
        <div style="background:rgba(139,92,246,0.1);border:1px solid var(--accent-purple);border-radius:4px;padding:8px 12px;">
          <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:2px;">최대항식 (POS)</div>
          <div style="color:var(--accent-purple);font-weight:700;">${posExpr}</div>
        </div>
      </div>
    `;
  }

  exprInput.addEventListener('input', update);
  container.querySelectorAll('.be-ex').forEach(btn => {
    btn.addEventListener('click', () => { exprInput.value = btn.dataset.ex; update(); });
  });

  update();
}
