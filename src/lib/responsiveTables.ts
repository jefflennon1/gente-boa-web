// Nenhuma tabela do sistema deve exigir rolagem lateral. Este módulo observa as tabelas da tela,
// rotula cada célula com o título da coluna (data-label) e, quando a tabela não cabe na largura
// disponível, aplica o layout empilhado (cada linha vira um cartão com os campos rotulados).

const TABLE_SELECTOR = 'table.data-table, table.os-edit-table'
const STACKED_CLASS = 'table--stacked'
const RESTORE_MARGIN = 24

function headerLabels(table: HTMLTableElement) {
  const row = table.tHead?.rows[table.tHead.rows.length - 1]
  if (!row) return []
  const labels: string[] = []
  for (const cell of Array.from(row.cells)) {
    const text = (cell.textContent ?? '').replace(/\s+/g, ' ').trim() || cell.getAttribute('aria-label') || ''
    for (let span = 0; span < cell.colSpan; span++) labels.push(text)
  }
  return labels
}

function labelCells(table: HTMLTableElement) {
  const labels = headerLabels(table)
  const sections = [...Array.from(table.tBodies), ...(table.tFoot ? [table.tFoot] : [])]
  for (const section of sections) {
    for (const row of Array.from(section.rows)) {
      let column = 0
      for (const cell of Array.from(row.cells)) {
        const label = cell.colSpan > 1 ? '' : labels[column] ?? ''
        if (cell.dataset.label !== label) cell.dataset.label = label
        column += cell.colSpan
      }
    }
  }
}

function availableWidth(element: HTMLElement) {
  const style = getComputedStyle(element)
  return element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
}

function fitTable(table: HTMLTableElement) {
  const container = table.parentElement
  if (!container) return
  const width = availableWidth(container)
  if (width <= 0) return

  // Mede a largura mínima da tabela no layout normal (width 0 força o mínimo do conteúdo).
  // Tudo acontece antes da pintura, então a troca não pisca na tela.
  const wasStacked = table.classList.contains(STACKED_CLASS)
  const previousWidth = table.style.width
  table.classList.remove(STACKED_CLASS)
  table.style.width = '0px'
  const required = table.getBoundingClientRect().width
  table.style.width = previousWidth

  // Folga ao voltar para tabela evita alternar sem parar quando a barra de rolagem vertical aparece ou some.
  const stacked = wasStacked ? required > width - RESTORE_MARGIN : required > width + 1
  table.classList.toggle(STACKED_CLASS, stacked)
}

function updateTables(resizes: ResizeObserver) {
  for (const table of Array.from(document.querySelectorAll<HTMLTableElement>(TABLE_SELECTOR))) {
    labelCells(table)
    fitTable(table)
    if (table.parentElement) resizes.observe(table.parentElement)
  }
}

export function watchResponsiveTables() {
  let frame = 0
  const schedule = () => {
    if (frame) return
    frame = requestAnimationFrame(() => { frame = 0; updateTables(resizes) })
  }

  // Mudanças de largura (janela, menu lateral recolhido, modal aberto) e de conteúdo reavaliam as tabelas.
  const resizes = new ResizeObserver(schedule)
  const mutations = new MutationObserver(schedule)
  mutations.observe(document.body, { childList: true, subtree: true, characterData: true })
  schedule()

  return () => {
    mutations.disconnect()
    resizes.disconnect()
    cancelAnimationFrame(frame)
  }
}
