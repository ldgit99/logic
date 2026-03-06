import { mountAnalogDigital } from '../simulations/analogDigital.js';
import { mountPulseWave } from '../simulations/pulseWave.js';
import { mountAdcSampling } from '../simulations/adcSampling.js';
import { mountUnitConverter } from '../simulations/unitConverter.js';

const SIM_MOUNTS = {
  analogDigital: mountAnalogDigital,
  pulseWave: mountPulseWave,
  adcSampling: mountAdcSampling,
  unitConverter: mountUnitConverter,
};

// ─── 블록 렌더러 ───

function renderText(block) {
  return `<div class="content-block block-text">${escapeHtml(block.body)}</div>`;
}

function renderDefinition(block) {
  return `<div class="content-block block-definition">
    <div class="def-term">${escapeHtml(block.term)}</div>
    <div class="def-body">${escapeHtml(block.body)}</div>
  </div>`;
}

function renderComparison(block) {
  const l = block.left;
  const r = block.right;
  return `<div class="content-block block-comparison">
    <div class="comp-title">${escapeHtml(block.title)}</div>
    <div class="comp-card ${l.color}">
      <div class="comp-label">${escapeHtml(l.label)}</div>
      <div class="comp-body">${escapeHtml(l.body)}</div>
    </div>
    <div class="comp-card ${r.color}">
      <div class="comp-label">${escapeHtml(r.label)}</div>
      <div class="comp-body">${escapeHtml(r.body)}</div>
    </div>
  </div>`;
}

function renderList(block) {
  const items = block.items.map(item => `<li>${escapeHtml(item)}</li>`).join('');
  return `<div class="content-block block-list ${block.style}">
    ${block.title ? `<div class="list-title">${escapeHtml(block.title)}</div>` : ''}
    <ul>${items}</ul>
  </div>`;
}

function renderTable(block) {
  const headers = block.headers.map(h => `<th>${escapeHtml(h)}</th>`).join('');
  const rows = block.rows.map(row =>
    `<tr>${row.map(cell => `<td>${escapeHtml(String(cell))}</td>`).join('')}</tr>`
  ).join('');
  return `<div class="content-block block-table">
    ${block.title ? `<div class="table-title">${escapeHtml(block.title)}</div>` : ''}
    <table>
      <thead><tr>${headers}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

let exampleCounter = 0;

function renderExample(block) {
  exampleCounter++;
  const id = `example-sol-${exampleCounter}`;
  return `<div class="content-block block-example">
    <div class="example-header">
      <span class="example-badge">예제</span>
      <span class="example-title">${escapeHtml(block.title)}</span>
    </div>
    <div class="example-body">
      <div class="example-problem">${escapeHtml(block.problem)}</div>
      <button class="example-solution-toggle" data-target="${id}">
        <span>▶</span> 풀이 보기
      </button>
      <div class="example-solution" id="${id}">${escapeHtml(block.solution)}</div>
    </div>
  </div>`;
}

function renderSimPlaceholder(block) {
  return `<div class="content-block block-simulation" id="sim-${block.simId}">
    <div class="sim-header">
      <span class="sim-badge">시뮬레이션</span>
      <span class="sim-title">${escapeHtml(block.title)}</span>
    </div>
    <div class="sim-body" id="sim-body-${block.simId}">
      <!-- 시뮬레이션 마운트 포인트 -->
    </div>
  </div>`;
}

function renderBlock(block) {
  switch (block.type) {
    case 'text':       return renderText(block);
    case 'definition': return renderDefinition(block);
    case 'comparison': return renderComparison(block);
    case 'list':       return renderList(block);
    case 'table':      return renderTable(block);
    case 'example':    return renderExample(block);
    case 'simulation': return renderSimPlaceholder(block);
    default:           return '';
  }
}

// ─── 섹션 렌더러 ───
function renderSection(section) {
  const blocksHtml = section.content.map(renderBlock).join('\n');
  return `<div class="content-section" id="section-${section.id}">
    <h3 class="section-title">${escapeHtml(section.title)}</h3>
    ${blocksHtml}
  </div>`;
}

// ─── 챕터 헤더 ───
function renderHeader(data) {
  const objectives = data.objectives
    .map((o, i) => `<li>${i + 1}. ${escapeHtml(o)}</li>`)
    .join('');
  return `<div class="chapter-header">
    <span class="chapter-num-badge">CHAPTER ${data.id}</span>
    <h2>${escapeHtml(data.title)}</h2>
    <div class="objectives-box">
      <div class="obj-title">학습목표</div>
      <ol>${objectives}</ol>
    </div>
  </div>`;
}

// ─── 이벤트 바인딩 ───
function bindExampleToggles(container) {
  container.querySelectorAll('.example-solution-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const sol = document.getElementById(targetId);
      if (!sol) return;
      const visible = sol.classList.toggle('visible');
      btn.innerHTML = visible ? '<span>▼</span> 풀이 숨기기' : '<span>▶</span> 풀이 보기';
    });
  });
}

// ─── 시뮬레이션 마운트 ───
function mountSimulations(data) {
  data.sections.forEach(section => {
    section.content
      .filter(b => b.type === 'simulation')
      .forEach(b => {
        const mountFn = SIM_MOUNTS[b.simId];
        const mountEl = document.getElementById(`sim-body-${b.simId}`);
        if (mountFn && mountEl) {
          try {
            mountFn(mountEl);
          } catch (e) {
            console.error(`시뮬레이션 마운트 실패 (${b.simId}):`, e);
          }
        }
      });
  });
}

// ─── 유틸 ───
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── 메인 렌더 함수 ───
export async function renderChapter(data) {
  const contentInner = document.getElementById('content-inner');
  exampleCounter = 0;

  const sectionsHtml = data.sections.map(renderSection).join('\n');
  contentInner.innerHTML = renderHeader(data) + sectionsHtml;

  bindExampleToggles(contentInner);
  mountSimulations(data);
}
