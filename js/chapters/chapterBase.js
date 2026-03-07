// Shared chapter renderer

let exampleCounter = 0;

function getSectionBlocks(section) {
  return section.blocks || section.content || [];
}

function getSimId(block) {
  return block.simKey || block.simId;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderText(block) {
  return `<div class="content-block block-text">${escapeHtml(block.body || block.content)}</div>`;
}

function renderDefinition(block) {
  return `<div class="content-block block-definition">
    <div class="def-term">${escapeHtml(block.term)}</div>
    <div class="def-body">${escapeHtml(block.body || block.definition)}</div>
  </div>`;
}

function renderCompCard(side) {
  if (!side) return '';
  const bodyHtml = side.body
    ? `<div class="comp-body">${escapeHtml(side.body)}</div>`
    : (side.items || []).map((item) => `<div class="comp-body-item">- ${escapeHtml(item)}</div>`).join('');

  return `<div class="comp-card ${side.color || ''}">
    <div class="comp-label">${escapeHtml(side.label)}</div>
    ${bodyHtml}
  </div>`;
}

function renderComparison(block) {
  return `<div class="content-block block-comparison">
    <div class="comp-title">${escapeHtml(block.title)}</div>
    ${renderCompCard(block.left)}
    ${renderCompCard(block.right)}
  </div>`;
}

function renderList(block) {
  const items = (block.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  return `<div class="content-block block-list ${block.style || ''}">
    ${block.title ? `<div class="list-title">${escapeHtml(block.title)}</div>` : ''}
    <ul>${items}</ul>
  </div>`;
}

function renderTable(block) {
  const headers = (block.headers || []).map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const rows = (block.rows || []).map((row) =>
    `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join('')}</tr>`
  ).join('');

  return `<div class="content-block block-table">
    ${block.title ? `<div class="table-title">${escapeHtml(block.title)}</div>` : ''}
    <table>
      <thead><tr>${headers}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function renderExample(block) {
  exampleCounter += 1;
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
  const simId = getSimId(block);
  return `<div class="content-block block-simulation" id="sim-${simId}">
    <div class="sim-header">
      <span class="sim-badge">시뮬레이션</span>
      <span class="sim-title">${escapeHtml(block.title)}</span>
    </div>
    <div class="sim-body" id="sim-body-${simId}"></div>
  </div>`;
}

function renderBlock(block) {
  switch (block.type) {
    case 'text':
      return renderText(block);
    case 'definition':
      return renderDefinition(block);
    case 'comparison':
      return renderComparison(block);
    case 'list':
      return renderList(block);
    case 'table':
      return renderTable(block);
    case 'example':
      return renderExample(block);
    case 'simulation':
      return renderSimPlaceholder(block);
    default:
      return '';
  }
}

function renderSection(section) {
  const blocksHtml = getSectionBlocks(section).map(renderBlock).join('\n');
  return `<div class="content-section" id="section-${section.id}">
    <h3 class="section-title">${escapeHtml(section.title)}</h3>
    ${blocksHtml}
  </div>`;
}

function renderHeader(data) {
  const objectives = (data.objectives || [])
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

function bindExampleToggles(container) {
  container.querySelectorAll('.example-solution-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sol = document.getElementById(btn.dataset.target);
      if (!sol) return;

      const visible = sol.classList.toggle('visible');
      btn.innerHTML = visible ? '<span>▼</span> 풀이 숨기기' : '<span>▶</span> 풀이 보기';
    });
  });
}

function mountSimulations(data, simMounts) {
  (data.sections || []).forEach((section) => {
    getSectionBlocks(section)
      .filter((b) => b.type === 'simulation')
      .forEach((b) => {
        const simId = getSimId(b);
        const mountFn = simMounts[simId];
        const mountEl = document.getElementById(`sim-body-${simId}`);

        if (mountFn && mountEl) {
          try {
            mountFn(mountEl);
          } catch (e) {
            console.error(`시뮬레이션 마운트 실패 (${simId}):`, e);
            mountEl.innerHTML = '<p style="color:var(--accent-red);padding:8px;">시뮬레이션 로드에 실패했습니다.</p>';
          }
        }
      });
  });
}

export async function renderChapterWith(data, simMounts) {
  const contentInner = document.getElementById('content-inner');
  exampleCounter = 0;

  const sectionsHtml = (data.sections || []).map(renderSection).join('\n');
  contentInner.innerHTML = renderHeader(data) + sectionsHtml;

  bindExampleToggles(contentInner);
  mountSimulations(data, simMounts);
}
