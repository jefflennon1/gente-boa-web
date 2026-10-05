import { useMutation } from '@tanstack/react-query'
import { FileSpreadsheet, Printer, Search } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { api, type ServiceOrderListParams, type ServiceOrderSummary } from '../api/services'
import { ClientPicker, EmployeePicker, type PickerValue } from '../components/AsyncPicker'
import { Button, EmptyState, ErrorState, LoadingState, PageHeader, Toast } from '../components/ui'
import { dateText, downloadCsv, monthBounds, moneyText, printElement } from '../lib/export'
import type { ServiceOrderListItem, ServiceOrderStatus } from '../types'

const statusLabels: Record<string, string> = { ABERTA: 'Em aberto', EM_ATENDIMENTO: 'Em andamento', FINALIZADA: 'Concluída', CANCELADA: 'Cancelada', ENCAMINHADA: 'Em aberto', AGENDADA: 'Em aberto' }
const originLabels: Record<string, string> = { C: 'Contratada', A: 'Avulsa', O: 'Obras', E: 'Experiência' }
const categoryLabels: Record<string, string> = { MAO_DE_OBRA: 'Mão de obra', GARANTIA: 'Garantia', VISITA_TECNICA: 'Visita técnica', CANCELAMENTO: 'Cancelados', DESLOCAMENTO: 'Deslocamento', ORCAMENTO: 'Orçamento', TRANSPORTE: 'Transporte', SERVICO_TERCEIRIZADO: 'Serv. terceirizado' }

/** Relatórios Diversos > Impressão das Ordens de Serviço (POP p.42). */
export function ServiceOrderReport() {
  const bounds = useMemo(() => monthBounds(), [])
  const [startDate, setStartDate] = useState(bounds.start)
  const [endDate, setEndDate] = useState(bounds.end)
  const [client, setClient] = useState<PickerValue>(null)
  const [technician, setTechnician] = useState<PickerValue>(null)
  const [status, setStatus] = useState<'' | ServiceOrderStatus>('')
  const [origin, setOrigin] = useState<'' | 'C' | 'A' | 'O' | 'E'>('')
  const [category, setCategory] = useState('')
  const printRef = useRef<HTMLDivElement>(null)
  const [toast, setToast] = useState('')

  const mutation = useMutation({
    mutationFn: async (): Promise<{ rows: ServiceOrderListItem[]; summary: ServiceOrderSummary; truncated: boolean }> => {
      const extra: ServiceOrderListParams = { startDate, endDate, origin: origin || undefined, category: category || undefined, technicianId: technician?.id, clientId: client?.id }
      const first = await api.serviceOrders.list({ ...extra, status: status || undefined, page: 0, size: 100 })
      const rows = [...first.content]
      const pages = Math.min(first.totalPages, 50)
      for (let page = 1; page < pages; page++) rows.push(...(await api.serviceOrders.list({ ...extra, status: status || undefined, page, size: 100 })).content)
      const summary = await api.serviceOrders.summary(extra)
      return { rows: rows.sort((left, right) => left.orderedAt.localeCompare(right.orderedAt) || left.id - right.id), summary, truncated: first.totalPages > 50 }
    },
    onError: (error) => setToast(apiErrorMessage(error)),
  })
  const result = mutation.data

  function exportExcel() {
    if (!result) return
    downloadCsv('ordens-de-servico', ['OS', 'Abertura', 'Cliente', 'Tipo', 'Categoria', 'Situação', 'Técnicos', 'Descrição', 'Previsão', 'Valor'], result.rows.map((order) => [order.id, dateText(order.orderedAt), order.clientTradeName || order.clientName, originLabels[order.origin] ?? order.origin, categoryLabels[order.category] ?? order.category, statusLabel(order), order.professionalNames.join(', '), order.description, order.forecastAt ? `${dateText(order.forecastAt)} ${order.forecastStart ?? ''}` : '', order.totalValue ?? 0]))
  }

  return <>
    <PageHeader eyebrow="Relatórios" title="Impressão das ordens de serviço" subtitle="Relação de OS por período, cliente, técnico, status, tipo e categoria." />
    <section className="panel data-panel">
      <form className="report-filters" data-allow-enter-submit="true" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
        <label><span>Período de</span><input type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <label><span>até</span><input type="date" required value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        <label className="report-filters__wide"><span>Cliente</span><ClientPicker value={client} onChange={setClient} /></label>
        <label className="report-filters__wide"><span>Técnico</span><EmployeePicker value={technician} onChange={setTechnician} /></label>
        <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="">Geral</option><option value="ABERTA">Em aberto</option><option value="EM_ATENDIMENTO">Em andamento</option><option value="FINALIZADA">Concluídas</option><option value="CANCELADA">Canceladas</option></select></label>
        <label><span>Tipo</span><select value={origin} onChange={(event) => setOrigin(event.target.value as typeof origin)}><option value="">Geral</option><option value="C">Contratada</option><option value="A">Avulsa</option><option value="O">Obras</option><option value="E">Experiência</option></select></label>
        <label><span>Categoria</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Geral</option><option value="MAO_DE_OBRA">Mão de obra</option><option value="GARANTIA">Garantia</option><option value="VISITA_TECNICA">Visita técnica</option><option value="CANCELAMENTO">Cancelados</option><option value="DESLOCAMENTO">Deslocamento</option><option value="ORCAMENTO">Orçamento (legado)</option></select></label>
        <div className="report-filters__actions"><Button type="submit" icon={<Search size={16} />} disabled={mutation.isPending}>{mutation.isPending ? 'Gerando...' : 'Visualizar'}</Button><Button type="button" variant="secondary" icon={<Printer size={16} />} disabled={!result} onClick={() => printElement(printRef.current, 'Impressão das Ordens de Serviço')}>Imprimir / PDF</Button><Button type="button" variant="secondary" icon={<FileSpreadsheet size={16} />} disabled={!result} onClick={exportExcel}>Excel</Button></div>
      </form>
      {mutation.isPending ? <LoadingState label="Gerando relatório..." /> : mutation.isError ? <ErrorState message={apiErrorMessage(mutation.error)} /> : !result ? <EmptyState title="Defina os filtros" description="Informe o período e os filtros desejados e clique em Visualizar." /> : <div className="report-document" ref={printRef}>
        <div className="print-header"><div><h1>GENTE BOA SERVIÇOS</h1><p>Impressão das Ordens de Serviço</p><small>Período: {dateText(startDate)} a {dateText(endDate)}{client ? ` · Cliente: ${client.label}` : ''}{technician ? ` · Técnico: ${technician.label}` : ''}{status ? ` · ${statusLabels[status]}` : ''}{origin ? ` · ${originLabels[origin]}` : ''}{category ? ` · ${categoryLabels[category]}` : ''}</small></div><small>{result.rows.length} OS</small></div>
        {result.truncated && <p className="muted">Exibindo as primeiras 5.000 OS. Reduza o período para ver todas.</p>}
        <div className="print-boxes"><div className="print-box"><small>Total geral</small><strong>{result.summary.total}</strong></div><div className="print-box"><small>Em aberto</small><strong>{result.summary.open}</strong></div><div className="print-box"><small>Em andamento</small><strong>{result.summary.inProgress}</strong></div><div className="print-box"><small>Concluídas</small><strong>{result.summary.finished}</strong></div><div className="print-box"><small>Canceladas</small><strong>{result.summary.canceled}</strong></div><div className="print-box"><small>Urgentes</small><strong>{result.summary.urgent}</strong></div><div className="print-box"><small>Valor das OS listadas</small><strong>R$ {moneyText(result.rows.reduce((sum, order) => sum + Number(order.totalValue ?? 0), 0))}</strong></div></div>
        <table><thead><tr><th>OS</th><th>Abertura</th><th>Cliente</th><th>Tipo</th><th>Categoria</th><th>Situação</th><th>Técnico(s)</th><th>Descrição</th><th>Agenda</th><th className="num">Valor</th></tr></thead>
          <tbody>{result.rows.map((order) => <tr key={order.id}><td>{order.id}</td><td>{dateText(order.orderedAt)}</td><td>{order.clientTradeName || order.clientName}</td><td>{originLabels[order.origin] ?? order.origin}</td><td>{categoryLabels[order.category] ?? order.category}</td><td>{statusLabel(order)}{order.priority === 'URGENTE' ? ' · Urgente' : ''}</td><td>{order.professionalNames.join(', ')}</td><td>{order.description}</td><td>{order.forecastAt ? `${dateText(order.forecastAt)} ${order.forecastStart ?? ''}` : ''}</td><td className="num">{moneyText(order.totalValue)}</td></tr>)}</tbody></table>
      </div>}
    </section>
    {toast && <Toast variant="error" message={toast} onClose={() => setToast('')} />}
  </>
}

function statusLabel(order: ServiceOrderListItem) {
  if (order.status === 'ABERTA' && order.started && !order.finished) return 'Em andamento'
  return statusLabels[order.status] ?? order.status
}
