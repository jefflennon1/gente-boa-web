/** Exportação para Excel (CSV com separador ";" e BOM, que o Excel em português abre corretamente). */
export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const cell = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return '""'
    const text = typeof value === 'number' ? value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : value
    return `"${String(text).replaceAll('"', '""')}"`
  }
  const content = [headers, ...rows].map((row) => row.map(cell).join(';')).join('\r\n')
  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 18px; font-size: 10.5px; }
  h1 { font-size: 16px; margin: 0 0 2px; }
  h2 { font-size: 12.5px; margin: 14px 0 4px; border-bottom: 1.5px solid #222; padding-bottom: 2px; }
  h3 { font-size: 11px; margin: 10px 0 3px; }
  p { margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0 8px; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th, td { border-bottom: 1px dotted #999; padding: 3px 4px; text-align: left; vertical-align: top; }
  th { border-bottom: 1px solid #333; font-size: 9.5px; text-transform: uppercase; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  tfoot td, .total-row td { font-weight: bold; border-top: 1px solid #333; }
  .print-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 8px; }
  .print-header small { color: #444; }
  .print-boxes { display: flex; gap: 8px; flex-wrap: wrap; margin: 6px 0; }
  .print-box { border: 1px solid #333; padding: 4px 8px; min-width: 120px; }
  .print-box small { display: block; font-size: 9px; color: #333; }
  .print-box strong { font-size: 11.5px; }
  .muted { color: #555; }
  .no-print { display: none !important; }
  .print-group { page-break-inside: avoid; }
  .summary-columns { display: flex; gap: 12px; }
  .summary-columns > div { flex: 1; }
  .statement-doc__header { display: flex; justify-content: space-between; align-items: flex-start; }
  .statement-doc__header img { max-width: 220px; max-height: 86px; }
  .statement-doc__header div { text-align: right; }
  .statement-doc__client { margin: 10px 0 0 80px; font-size: 12px; line-height: 1.6; }
  .statement-doc__number, .statement-doc__total { text-align: right; }
  .statement-doc__notice { padding: 4px 6px; border: 1px solid #111; }
  .statement-doc__total { margin: 8px 0 12px; padding-top: 5px; border-top: 1.5px solid #111; font-size: 13px; font-weight: bold; }
  .statement-doc__band { padding: 3px 5px; background: #dedfe6; font-weight: bold; }
  .statement-doc__order td, .statement-doc__order-amount td { font-weight: bold; }
  .statement-doc__purchase-cell { padding-left: 26px; }
  .statement-doc__footer { margin-top: 22px; padding-top: 5px; border-top: 1px solid #111; text-align: center; font-size: 9px; display: flex; flex-direction: column; }
  .statement-doc__preview { color: #b45309; font-weight: bold; }
  @page { margin: 12mm; }
`

/** Abre uma janela com o conteúdo do relatório e chama a impressão do navegador (salvar em PDF ou imprimir). */
export function printElement(element: HTMLElement | null, title: string) {
  if (!element) return
  const win = window.open('', '_blank', 'width=1100,height=800')
  if (!win) {
    window.alert('Libere as janelas pop-up do navegador para imprimir o relatório.')
    return
  }
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title.replace(/</g, '')}</title><style>${PRINT_STYLES}</style></head><body>${element.innerHTML}</body></html>`)
  win.document.close()
  win.focus()
  window.setTimeout(() => win.print(), 350)
}

export function moneyText(value?: number | null) {
  return (value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function dateText(value?: string | null) {
  if (!value) return ''
  const [year, month, day] = value.slice(0, 10).split('-')
  return day && month && year ? `${day}/${month}/${year}` : value
}

export function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function monthBounds(reference = new Date()) {
  const year = reference.getFullYear()
  const month = reference.getMonth() + 1
  const last = new Date(year, month, 0).getDate()
  const pad = (value: number) => String(value).padStart(2, '0')
  return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(last)}` }
}
