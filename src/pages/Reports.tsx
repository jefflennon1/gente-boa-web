import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  BarChart3, Boxes, ChevronLeft, ChevronRight, CircleDollarSign, ClipboardCheck,
  FileBarChart, FileDown, Filter, LoaderCircle, ReceiptText, Search, UserRoundCog, UsersRound,
} from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { useAuth } from '../auth'
import { Button, EmptyState, ErrorState, FormField, LoadingState, Modal, PageHeader, Toast } from '../components/ui'
import { formatDate, money } from '../lib/format'
import type { ReportRow, ReportType } from '../types'

type ReportDefinition = {
  key: ReportType
  title: string
  detail: string
  searchPlaceholder: string
  dateLabel: string
  statusLabel: string
  quantityLabel?: string
  valueLabel?: string
  codePrefix: string
  icon: typeof UsersRound
}

const reports: ReportDefinition[] = [
  { key: 'clients', title: 'Clientes', detail: 'Base completa de clientes, atendimentos e valores acumulados', searchPlaceholder: 'Nome, código ou documento do cliente', dateLabel: 'Cadastro', statusLabel: 'Tipo', quantityLabel: 'Ordens de serviço', valueLabel: 'Valor acumulado', codePrefix: 'CLI-', icon: UsersRound },
  { key: 'invoices', title: 'Notas fiscais', detail: 'Notas emitidas, clientes e valores no período', searchPlaceholder: 'Código da NF, cliente ou documento', dateLabel: 'Emissão', statusLabel: 'Situação', valueLabel: 'Valor da nota', codePrefix: '', icon: ReceiptText },
  { key: 'statements', title: 'Extratos', detail: 'Movimentação consolidada de cada cliente', searchPlaceholder: 'Cliente, código do extrato ou documento', dateLabel: 'Última OS', statusLabel: 'Vínculo', quantityLabel: 'Ordens', valueLabel: 'Total', codePrefix: 'EXT-', icon: CircleDollarSign },
  { key: 'bills', title: 'Boletos', detail: 'Boletos processados, vencimentos e pagamentos', searchPlaceholder: 'Código do boleto, cliente ou documento', dateLabel: 'Processamento', statusLabel: 'Pagamento', valueLabel: 'Valor', codePrefix: 'BOL-', icon: FileBarChart },
  { key: 'trackings', title: 'Acompanhamentos de OS', detail: 'Atendimentos realizados e em andamento por profissional', searchPlaceholder: 'Profissional, cliente, código da OS ou acompanhamento', dateLabel: 'Atendimento', statusLabel: 'Situação', quantityLabel: 'Duração', codePrefix: 'ACO-', icon: ClipboardCheck },
  { key: 'employees', title: 'Funcionários', detail: 'Base completa de funcionários, cargos e situação', searchPlaceholder: 'Nome, apelido, código ou CPF do funcionário', dateLabel: 'Contratação', statusLabel: 'Situação', quantityLabel: 'Comissão', codePrefix: 'FUN-', icon: UserRoundCog },
  { key: 'materials', title: 'Materiais', detail: 'Materiais utilizados nas ordens de serviço', searchPlaceholder: 'Material, marca, código ou OS', dateLabel: 'Utilização', statusLabel: 'Marca', quantityLabel: 'Quantidade', valueLabel: 'Valor', codePrefix: '', icon: Boxes },
]

const PAGE_SIZE = 20
const CHART_COLORS = ['#33399a', '#f48120', '#169b72', '#7f56d9', '#247ba0', '#d64550', '#c18b18', '#687087']

function currentMonthPeriod() {
  const today = new Date()
  const end = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return { start: `${end.slice(0, 8)}01`, end }
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`
}

function displayCode(report: ReportDefinition, code: string) {
  return `${report.codePrefix}${code}`
}

function displayQuantity(row: ReportRow) {
  if (row.quantity === null || row.quantity === undefined) return row.unit || '—'
  return `${Number(row.quantity).toLocaleString('pt-BR')}${row.unit ? ` ${row.unit}` : ''}`
}

export function Reports() {
  const { user } = useAuth()
  const initialPeriod = useMemo(currentMonthPeriod, [])
  const [catalogSearch, setCatalogSearch] = useState('')
  const [selected, setSelected] = useState<ReportType | null>(null)
  const [preview, setPreview] = useState(false)
  const [draftStartDate, setDraftStartDate] = useState(initialPeriod.start)
  const [draftEndDate, setDraftEndDate] = useState(initialPeriod.end)
  const [draftQuery, setDraftQuery] = useState('')
  const [filters, setFilters] = useState({ startDate: initialPeriod.start, endDate: initialPeriod.end, query: '' })
  const [page, setPage] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null)

  const selectedReport = reports.find((report) => report.key === selected)
  const hasPeriodFilter = selected !== 'clients' && selected !== 'employees'
  const reportParams = !hasPeriodFilter
    ? { query: filters.query || undefined }
    : { startDate: filters.startDate || undefined, endDate: filters.endDate || undefined, query: filters.query || undefined }
  const reportQuery = useQuery({
    queryKey: [...queryKeys.reports, selected, filters.startDate, filters.endDate, filters.query, page],
    queryFn: () => api.reports.list(selected!, { ...reportParams, page, size: PAGE_SIZE }),
    enabled: Boolean(selected && preview),
  })
  const summaryQuery = useQuery({
    queryKey: [...queryKeys.reports, 'summary', selected, filters.startDate, filters.endDate, filters.query],
    queryFn: () => api.reports.summary(selected!, reportParams),
    enabled: Boolean(selected && preview),
  })

  const visibleReports = reports.filter((report) => `${report.title} ${report.detail}`.toLowerCase().includes(catalogSearch.trim().toLowerCase()))
  const rows = reportQuery.data?.content ?? []
  const total = reportQuery.data?.total ?? 0
  const totalPages = reportQuery.data?.totalPages ?? 0
  const firstResult = total ? page * PAGE_SIZE + 1 : 0
  const lastResult = Math.min((page + 1) * PAGE_SIZE, total)

  function openReport(type: ReportType) {
    const period = currentMonthPeriod()
    setSelected(type)
    setPreview(false)
    setDraftStartDate(period.start)
    setDraftEndDate(period.end)
    setDraftQuery('')
    setPage(0)
  }

  function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (hasPeriodFilter && draftStartDate && draftEndDate && draftStartDate > draftEndDate) {
      setToast({ message: 'A data inicial não pode ser posterior à data final.', error: true })
      return
    }
    setFilters({ startDate: hasPeriodFilter ? draftStartDate : '', endDate: hasPeriodFilter ? draftEndDate : '', query: draftQuery.trim() })
    setPage(0)
    setPreview(true)
  }

  async function exportCsv() {
    if (!selected || !selectedReport || !total) return
    setExporting(true)
    try {
      const first = await api.reports.list(selected, { ...reportParams, page: 0, size: 500 })
      const requests = Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, index) =>
        api.reports.list(selected, { ...reportParams, page: index + 1, size: 500 }),
      )
      const remaining = await Promise.all(requests)
      const allRows = [...first.content, ...remaining.flatMap((response) => response.content)]
      const header = ['Código', 'Nome', 'Descrição', selectedReport.dateLabel, selectedReport.statusLabel]
      if (selectedReport.quantityLabel) header.push(selectedReport.quantityLabel)
      if (selectedReport.valueLabel) header.push(selectedReport.valueLabel)
      const contentRows = allRows.map((row) => {
        const values: (string | number)[] = [displayCode(selectedReport, row.code), row.name, row.description, row.date ? formatDate(row.date) : '', row.status]
        if (selectedReport.quantityLabel) values.push(displayQuantity(row))
        if (selectedReport.valueLabel) values.push(Number(row.value ?? 0).toFixed(2).replace('.', ','))
        return values
      })
      const content = [header, ...contentRows].map((row) => row.map(csvCell).join(';')).join('\r\n')
      const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${selectedReport.key}-${new Date().toISOString().slice(0, 10)}.csv`
      anchor.click()
      URL.revokeObjectURL(url)
      setToast({ message: `Relatório exportado com ${allRows.length.toLocaleString('pt-BR')} registros.` })
    } catch (error) {
      setToast({ message: apiErrorMessage(error), error: true })
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="Análises" title="Relatórios" subtitle="Consulte informações operacionais e financeiras por período, nome ou código." />
      <section className="reports-hero">
        <div><span className="reports-hero__icon"><FileBarChart size={24} /></span><span><strong>O que você precisa analisar?</strong><small>Selecione um módulo para configurar o relatório.</small></span></div>
        <div className="reports-search"><Search size={19} /><input value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Ex.: notas, materiais, funcionários..." /></div>
      </section>

      {visibleReports.length === 0 ? <EmptyState title="Nenhum relatório encontrado" description="Tente buscar por outro módulo." /> : (
        <section className="report-group">
          <header><span><BarChart3 size={20} /></span><div><h2>Relatórios disponíveis</h2><p>Todos possuem período e pesquisa contextual.</p></div></header>
          <div className="report-card-grid">{visibleReports.map((report) => {
            const Icon = report.icon
            return <button className="report-card" key={report.key} onClick={() => openReport(report.key)}><span className="report-card__icon"><Icon size={20} /></span><span><strong>{report.title}</strong><small>{report.detail}</small></span><ChevronRight size={18} /></button>
          })}</div>
        </section>
      )}

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selectedReport?.title || 'Gerar relatório'} description={preview ? 'Resultado da consulta configurada.' : 'Defina o período e, se desejar, refine a pesquisa.'} size="xlarge">
        {!preview ? (
          <form onSubmit={generate}>
            <div className="modal__body">
              <div className="report-config-intro"><span><Filter size={21} /></span><div><strong>Filtros do relatório</strong><small>{selected === 'clients' ? 'Sem busca informada, todos os clientes serão apresentados.' : selected === 'employees' ? 'Sem busca informada, todos os funcionários serão apresentados.' : 'O mês atual vem selecionado por padrão. Você pode alterar ou limpar as datas.'}</small></div></div>
              {hasPeriodFilter && <div className="form-grid form-grid--two">
                <FormField label="Período inicial"><input value={draftStartDate} onChange={(event) => setDraftStartDate(event.target.value)} type="date" /></FormField>
                <FormField label="Período final"><input value={draftEndDate} onChange={(event) => setDraftEndDate(event.target.value)} type="date" /></FormField>
              </div>}
              <div className="report-filter-search"><FormField label="Buscar por nome ou código" hint="A pesquisa também considera documento, cliente, funcionário ou OS quando aplicável."><div className="input-with-icon"><Search size={17} /><input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder={selectedReport?.searchPlaceholder} /></div></FormField></div>
            </div>
            <footer className="modal__footer"><Button type="button" variant="secondary" onClick={() => setSelected(null)}>Cancelar</Button><Button type="submit" icon={<BarChart3 size={17} />}>Gerar relatório</Button></footer>
          </form>
        ) : (
          <>
            <div className="modal__body report-preview">
              <div className="report-preview__header"><div><span>Gente Boa Manutenção e Serviços</span><h3>{selectedReport?.title}</h3><small>{selected === 'clients' ? 'Base completa de clientes' : selected === 'employees' ? 'Base completa de funcionários' : `Período: ${filters.startDate ? formatDate(filters.startDate) : 'sem limite'} a ${filters.endDate ? formatDate(filters.endDate) : 'sem limite'}`}{filters.query ? ` · Busca: ${filters.query}` : ''}</small></div><strong>RELATÓRIO</strong></div>
              <div className="report-preview__kpis"><span><small>Total de registros</small><strong>{(summaryQuery.data?.total ?? total).toLocaleString('pt-BR')}</strong></span>{selectedReport?.quantityLabel && <span><small>{selectedReport.quantityLabel}</small><strong>{Number(summaryQuery.data?.totalQuantity ?? 0).toLocaleString('pt-BR')}</strong></span>}{selectedReport?.valueLabel && <span><small>Valor consolidado</small><strong>{money(Number(summaryQuery.data?.totalValue ?? 0))}</strong></span>}<span><small>Gerado por</small><strong>{user?.name || 'Usuário atual'}</strong></span></div>
              {summaryQuery.data?.groups.length ? <div className="report-charts"><article><header><strong>Distribuição por {selectedReport?.statusLabel.toLowerCase()}</strong><small>Percentual dos registros filtrados</small></header><div><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={summaryQuery.data.groups} dataKey="count" nameKey="label" innerRadius={46} outerRadius={76} paddingAngle={2}>{summaryQuery.data.groups.map((group, index) => <Cell key={group.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie><Tooltip formatter={(value) => [Number(value).toLocaleString('pt-BR'), 'Registros']} /><Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} /></PieChart></ResponsiveContainer></div></article><article><header><strong>{selectedReport?.valueLabel ? 'Valores por classificação' : 'Registros por classificação'}</strong><small>Comparativo do conjunto completo</small></header><div><ResponsiveContainer width="100%" height="100%"><BarChart data={summaryQuery.data.groups} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><CartesianGrid vertical={false} stroke="#e8e9f1" strokeDasharray="3 5" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#777b91' }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#9295a8' }} width={selectedReport?.valueLabel ? 62 : 32} tickFormatter={(value) => selectedReport?.valueLabel ? `R$ ${Number(value).toLocaleString('pt-BR', { notation: 'compact' })}` : Number(value).toLocaleString('pt-BR')} /><Tooltip formatter={(value) => selectedReport?.valueLabel ? [money(Number(value)), 'Valor'] : [Number(value).toLocaleString('pt-BR'), 'Registros']} /><Bar dataKey={selectedReport?.valueLabel ? 'value' : 'count'} fill="#33399a" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></article></div> : null}
              {reportQuery.isLoading || reportQuery.isFetching ? <LoadingState label="Consultando relatório..." /> : reportQuery.isError ? <ErrorState message={apiErrorMessage(reportQuery.error)} onRetry={() => reportQuery.refetch()} /> : rows.length ? (
                <div className="table-wrap"><table><thead><tr><th>Código</th><th>Nome</th><th>Descrição</th><th>{selectedReport?.dateLabel}</th><th>{selectedReport?.statusLabel}</th>{selectedReport?.quantityLabel && <th>{selectedReport.quantityLabel}</th>}{selectedReport?.valueLabel && <th>{selectedReport.valueLabel}</th>}</tr></thead><tbody>{rows.map((row) => <tr key={`${row.code}-${row.date || ''}-${row.name}`}><td>{selectedReport ? displayCode(selectedReport, row.code) : row.code}</td><td>{row.name}</td><td>{row.description || '—'}</td><td>{row.date ? formatDate(row.date) : '—'}</td><td>{row.status || '—'}</td>{selectedReport?.quantityLabel && <td>{displayQuantity(row)}</td>}{selectedReport?.valueLabel && <td>{money(Number(row.value ?? 0))}</td>}</tr>)}</tbody></table></div>
              ) : <EmptyState title="Sem dados no período" description="Altere as datas ou o termo pesquisado para ampliar a consulta." />}
              {!reportQuery.isLoading && !reportQuery.isError && <footer className="table-footer table-footer--pagination"><span>Mostrando <strong>{firstResult}–{lastResult}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong> registros</span><div className="pagination-controls"><button disabled={page === 0 || reportQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button><span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span><button disabled={page + 1 >= totalPages || reportQuery.isFetching} onClick={() => setPage((value) => value + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button></div></footer>}
            </div>
            <footer className="modal__footer"><Button variant="secondary" onClick={() => setPreview(false)}>Alterar filtros</Button><Button icon={exporting ? <LoaderCircle className="spin" size={17} /> : <FileDown size={17} />} disabled={!total || exporting} onClick={exportCsv}>{exporting ? 'Exportando...' : 'Exportar CSV'}</Button></footer>
          </>
        )}
      </Modal>
      {toast && <Toast message={toast.message} variant={toast.error ? 'error' : 'success'} onClose={() => setToast(null)} />}
    </>
  )
}
