import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { BarChart3, ChevronRight, CircleDollarSign, ClipboardList, Download, FileBarChart, FileDown, FileText, Filter, ReceiptText, Search, UsersRound } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { useAuth } from '../auth'
import { Button, EmptyState, ErrorState, FormField, LoadingState, Modal, PageHeader, Toast } from '../components/ui'
import { enumLabel, formatDate, money } from '../lib/format'

type ReportKey = 'service-orders' | 'clients' | 'invoices' | 'statements'
type ReportRow = { code: string; description: string; date: string; status: string; value: number }

const reports: { key: ReportKey; title: string; detail: string; icon: typeof ClipboardList }[] = [
  { key: 'service-orders', title: 'Ordens de serviço', detail: 'Cliente, agenda, status, categoria e valor cobrado', icon: ClipboardList },
  { key: 'clients', title: 'Clientes e contratos', detail: 'Documento, situação, quantidade de OS e valor acumulado', icon: UsersRound },
  { key: 'invoices', title: 'Notas fiscais', detail: 'Competência, emissão, situação e valor total', icon: ReceiptText },
  { key: 'statements', title: 'Movimentos de extrato', detail: 'Conta, data, créditos, débitos e saldo', icon: CircleDollarSign },
]

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`
}

export function Reports() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ReportKey | null>(null)
  const [preview, setPreview] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [toast, setToast] = useState('')
  const [clientsQuery, ordersQuery, invoicesQuery, statementsQuery] = useQueries({ queries: [
    { queryKey: queryKeys.clients, queryFn: () => api.clients.list() },
    { queryKey: queryKeys.serviceOrders, queryFn: () => api.serviceOrders.list() },
    { queryKey: queryKeys.invoices, queryFn: () => api.invoices.list() },
    { queryKey: queryKeys.statements, queryFn: () => api.statements.list() },
  ] })

  const reportRows = useMemo<ReportRow[]>(() => {
    let rows: ReportRow[] = []
    if (selected === 'clients') rows = (clientsQuery.data?.content ?? []).map((client) => ({ code: `CLI-${client.id}`, description: `${client.name || 'Sem nome'} · ${client.serviceOrderCount} OS`, date: '', status: enumLabel(client.status), value: Number(client.totalValue ?? 0) }))
    if (selected === 'service-orders') rows = (ordersQuery.data?.content ?? []).map((order) => ({ code: `OS-${order.id}`, description: `${order.clientTradeName || order.clientName || `Cliente #${order.clientId}`} · ${enumLabel(order.category)}`, date: order.orderedAt?.slice(0, 10) || '', status: enumLabel(order.status), value: Number(order.totalValue ?? 0) }))
    if (selected === 'invoices') rows = (invoicesQuery.data?.content ?? []).map((invoice) => ({ code: invoice.number || `NF-${invoice.id}`, description: `${invoice.clientName || 'Sem cliente'} · ${invoice.competence || 'Sem competência'}`, date: invoice.issuedAt || '', status: enumLabel(invoice.status), value: Number(invoice.amount ?? 0) }))
    if (selected === 'statements') rows = (statementsQuery.data?.content ?? []).map((statement) => ({ code: `EXT-${statement.id}`, description: `${statement.clientName || 'Sem descrição'} · ${statement.nrbanco || 'Banco não informado'}`, date: statement.sentAt?.slice(0, 10) || '', status: statement.amount >= 0 ? 'Crédito' : 'Débito', value: Number(statement.amount ?? 0) }))
    return rows.filter((row) => (!startDate || !row.date || row.date >= startDate) && (!endDate || !row.date || row.date <= endDate))
  }, [clientsQuery.data, endDate, invoicesQuery.data, ordersQuery.data, selected, startDate, statementsQuery.data])

  const selectedReport = reports.find((report) => report.key === selected)
  const isLoading = clientsQuery.isLoading || ordersQuery.isLoading || invoicesQuery.isLoading || statementsQuery.isLoading
  const failedQuery = [clientsQuery, ordersQuery, invoicesQuery, statementsQuery].find((query) => query.isError)
  const visibleReports = reports.filter((report) => `${report.title} ${report.detail}`.toLowerCase().includes(search.toLowerCase()))

  function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setStartDate(String(data.get('startDate')))
    setEndDate(String(data.get('endDate')))
    setPreview(true)
  }

  function exportCsv() {
    if (!selectedReport) return
    const header = ['Código', 'Descrição', 'Data', 'Status', 'Valor']
    const content = [header, ...reportRows.map((row) => [row.code, row.description, row.date, row.status, row.value])].map((row) => row.map(csvCell).join(';')).join('\r\n')
    const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${selectedReport.key}-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    setToast('Relatório exportado com dados da API.')
    window.setTimeout(() => setToast(''), 3000)
  }

  return (
    <>
      <PageHeader eyebrow="Análises" title="Relatórios" subtitle="Relatórios gerados a partir dos endpoints disponíveis no backend." />
      <section className="reports-hero"><div><span className="reports-hero__icon"><FileBarChart size={24} /></span><span><strong>O que você precisa analisar?</strong><small>Selecione um conjunto de dados da API.</small></span></div><div className="reports-search"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ex.: notas, OS, clientes..." /></div></section>

      {isLoading ? <LoadingState label="Carregando bases dos relatórios..." /> : failedQuery ? <ErrorState message={apiErrorMessage(failedQuery.error)} onRetry={() => { clientsQuery.refetch(); ordersQuery.refetch(); invoicesQuery.refetch(); statementsQuery.refetch() }} /> : visibleReports.length === 0 ? <EmptyState title="Nenhum relatório encontrado" description="Tente buscar por outro termo." /> : (
        <section className="report-group"><header><span><BarChart3 size={20} /></span><div><h2>Relatórios disponíveis</h2><p>Os dados são consultados diretamente nos endpoints atuais.</p></div></header><div className="report-card-grid">{visibleReports.map((report) => { const Icon = report.icon; return <button className="report-card" key={report.key} onClick={() => { setSelected(report.key); setPreview(false); setStartDate(''); setEndDate('') }}><span className="report-card__icon"><Icon size={20} /></span><span><strong>{report.title}</strong><small>{report.detail}</small></span><ChevronRight size={18} /></button> })}</div></section>
      )}

      <section className="panel recent-reports"><div className="panel__header"><div><span className="eyebrow">Fontes integradas</span><h2>Endpoints utilizados</h2></div><Button variant="ghost" icon={<Download size={16} />} onClick={() => { clientsQuery.refetch(); ordersQuery.refetch(); invoicesQuery.refetch(); statementsQuery.refetch() }}>Atualizar</Button></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Recurso</th><th>Endpoint</th><th>Registros</th><th>Responsável atual</th></tr></thead><tbody><tr><td><div className="report-file"><span><FileText size={17} /></span><strong>Clientes</strong></div></td><td>/api/clients</td><td>{clientsQuery.data?.total ?? 0}</td><td>{user?.name}</td></tr><tr><td><div className="report-file"><span><FileText size={17} /></span><strong>Ordens de serviço</strong></div></td><td>/api/service-orders</td><td>{ordersQuery.data?.total ?? 0}</td><td>{user?.name}</td></tr><tr><td><div className="report-file"><span><FileText size={17} /></span><strong>Notas fiscais</strong></div></td><td>/api/invoices</td><td>{invoicesQuery.data?.total ?? 0}</td><td>{user?.name}</td></tr><tr><td><div className="report-file"><span><FileText size={17} /></span><strong>Extratos</strong></div></td><td>/api/statements</td><td>{statementsQuery.data?.total ?? 0}</td><td>{user?.name}</td></tr></tbody></table></div></section>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selectedReport?.title || 'Gerar relatório'} description="Defina o período para visualizar os dados." size="large">
        {!preview ? <form onSubmit={generate}><div className="modal__body"><div className="report-config-intro"><span><Filter size={21} /></span><div><strong>Filtros do relatório</strong><small>Datas vazias incluem todo o retorno da API.</small></div></div><div className="form-grid form-grid--two"><FormField label="Período inicial"><input name="startDate" type="date" /></FormField><FormField label="Período final"><input name="endDate" type="date" /></FormField></div></div><footer className="modal__footer"><Button type="button" variant="secondary" onClick={() => setSelected(null)}>Cancelar</Button><Button type="submit" icon={<BarChart3 size={17} />}>Gerar visualização</Button></footer></form> : <><div className="modal__body report-preview"><div className="report-preview__header"><div><span>Gente Boa Manutenção e Serviços</span><h3>{selectedReport?.title}</h3><small>Período: {startDate ? formatDate(startDate) : 'início'} a {endDate ? formatDate(endDate) : 'hoje'}</small></div><strong>API</strong></div><div className="report-preview__kpis"><span><small>Total de registros</small><strong>{reportRows.length}</strong></span><span><small>Valor consolidado</small><strong>{money(reportRows.reduce((sum, row) => sum + row.value, 0))}</strong></span><span><small>Gerado por</small><strong>{user?.name || 'Usuário atual'}</strong></span></div>{reportRows.length ? <table><thead><tr><th>Código</th><th>Descrição</th><th>Data</th><th>Status</th><th>Valor</th></tr></thead><tbody>{reportRows.slice(0, 20).map((row) => <tr key={`${row.code}-${row.date}`}><td>{row.code}</td><td>{row.description}</td><td>{formatDate(row.date)}</td><td>{row.status}</td><td>{money(row.value)}</td></tr>)}</tbody></table> : <EmptyState title="Sem dados no período" description="Altere as datas para ampliar a consulta." />}<p>Prévia limitada a 20 registros. O CSV exportado contém todos os {reportRows.length} registros filtrados.</p></div><footer className="modal__footer"><Button variant="secondary" onClick={() => setPreview(false)}>Alterar filtros</Button><Button icon={<FileDown size={17} />} disabled={!reportRows.length} onClick={exportCsv}>Exportar CSV</Button></footer></>}
      </Modal>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </>
  )
}
