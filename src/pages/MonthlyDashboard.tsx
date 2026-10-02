import { useMemo, useState, type ReactNode } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  ArrowRight, CalendarDays, CircleDollarSign, ClipboardCheck, FileBarChart, FileCheck2,
  Plus, ReceiptText, RefreshCw, TrendingUp, WalletCards,
} from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { useAuth } from '../auth'
import { Badge, Button, EmptyState, ErrorState, LoadingState, PageHeader, StatCard } from '../components/ui'
import { enumLabel, formatDate, money } from '../lib/format'
import { useRouter } from '../router'
import type { PagedResponse, ServiceOrderListItem } from '../types'

const CHART_COLORS = ['#33399a', '#f48120', '#169b72', '#7f56d9', '#247ba0', '#d64550', '#c18b18', '#687087']
const TOOLTIP_STYLE = { borderRadius: 12, border: '1px solid #e1e2eb', boxShadow: '0 10px 28px rgba(25,27,61,.12)' }

export function MonthlyDashboard() {
  const { navigate } = useRouter()
  const { user } = useAuth()
  const [referenceMonth, setReferenceMonth] = useState(currentReferenceMonth)
  const period = useMemo(() => monthPeriod(referenceMonth), [referenceMonth])

  const [ordersQuery, receivablesQuery, invoicesQuery, statementsQuery, billsQuery, trackingsQuery, materialsQuery] = useQueries({ queries: [
    {
      queryKey: [...queryKeys.serviceOrders, 'dashboard-month', period?.startDate, period?.endDate],
      queryFn: () => loadMonthlyOrders(period!.startDate, period!.endDate),
      enabled: period !== null,
    },
    {
      queryKey: [...queryKeys.accountsReceivable, 'dashboard-month', period?.startDate, period?.endDate],
      queryFn: () => loadMonthlyReceivables(period!.startDate, period!.endDate),
      enabled: period !== null,
    },
    {
      queryKey: [...queryKeys.reports, 'dashboard-summary', 'invoices', period?.startDate, period?.endDate],
      queryFn: () => api.reports.summary('invoices', { startDate: period!.startDate, endDate: period!.endDate }),
      enabled: period !== null,
    },
    {
      queryKey: [...queryKeys.reports, 'dashboard-summary', 'statements', period?.startDate, period?.endDate],
      queryFn: () => api.reports.summary('statements', { startDate: period!.startDate, endDate: period!.endDate }),
      enabled: period !== null,
    },
    {
      queryKey: [...queryKeys.reports, 'dashboard-summary', 'bills', period?.startDate, period?.endDate],
      queryFn: () => api.reports.summary('bills', { startDate: period!.startDate, endDate: period!.endDate }),
      enabled: period !== null,
    },
    {
      queryKey: [...queryKeys.reports, 'dashboard-summary', 'trackings', period?.startDate, period?.endDate],
      queryFn: () => api.reports.summary('trackings', { startDate: period!.startDate, endDate: period!.endDate }),
      enabled: period !== null,
    },
    {
      queryKey: [...queryKeys.reports, 'dashboard-summary', 'materials', period?.startDate, period?.endDate],
      queryFn: () => api.reports.summary('materials', { startDate: period!.startDate, endDate: period!.endDate }),
      enabled: period !== null,
    },
  ] })

  const orders = ordersQuery.data?.content ?? []
  const receivables = receivablesQuery.data?.content ?? []
  const orderStatusData = useMemo(() => groupOrderStatuses(orders), [orders])
  const invoiceStatusData = invoicesQuery.data?.groups ?? []
  const finalizedOrders = orderStatusData.find((item) => statusKey(item.label) === 'FINALIZADA')?.count ?? 0
  const activeOrders = orders.filter((order) => !['FINALIZADA', 'CANCELADA'].includes(order.status))
  const pendingReceivables = receivables.filter((item) => !item.paid)
  const receivableBalance = pendingReceivables.reduce((sum, item) => sum + Number(item.balance ?? item.amount ?? 0), 0)
  const readyInvoices = invoiceStatusData.find((item) => statusKey(item.label) === 'PRONTA')?.count ?? 0
  const issuedInvoices = invoiceStatusData.find((item) => statusKey(item.label) === 'EMITIDA')?.count ?? 0
  const orderValue = orders.reduce((sum, order) => sum + Number(order.totalValue ?? 0), 0)

  const moduleCounts = [
    { name: 'Notas fiscais', count: invoicesQuery.data?.total ?? 0, fill: CHART_COLORS[0] },
    { name: 'Extratos', count: statementsQuery.data?.total ?? 0, fill: CHART_COLORS[1] },
    { name: 'Boletos', count: billsQuery.data?.total ?? 0, fill: CHART_COLORS[2] },
    { name: 'Contas a receber', count: receivablesQuery.data?.total ?? 0, fill: CHART_COLORS[3] },
    { name: 'Ordens de serviço', count: ordersQuery.data?.total ?? 0, fill: CHART_COLORS[4] },
    { name: 'Atendimentos', count: trackingsQuery.data?.total ?? 0, fill: CHART_COLORS[5] },
    { name: 'Materiais', count: materialsQuery.data?.total ?? 0, fill: CHART_COLORS[6] },
  ]
  const moduleValues = [
    { name: 'Notas fiscais', value: Number(invoicesQuery.data?.totalValue ?? 0), fill: CHART_COLORS[0] },
    { name: 'Extratos', value: Number(statementsQuery.data?.totalValue ?? 0), fill: CHART_COLORS[1] },
    { name: 'Boletos', value: Number(billsQuery.data?.totalValue ?? 0), fill: CHART_COLORS[2] },
    { name: 'Contas a receber', value: receivables.reduce((sum, item) => sum + Number(item.amount ?? 0), 0), fill: CHART_COLORS[3] },
    { name: 'Ordens de serviço', value: orderValue, fill: CHART_COLORS[4] },
    { name: 'Materiais', value: Number(materialsQuery.data?.totalValue ?? 0), fill: CHART_COLORS[6] },
  ]
  const activity = [...activeOrders]
    .sort((a, b) => (a.scheduledAt || a.orderedAt || '').localeCompare(b.scheduledAt || b.orderedAt || ''))
    .slice(0, 5)

  const queries = [ordersQuery, receivablesQuery, invoicesQuery, statementsQuery, billsQuery, trackingsQuery, materialsQuery]
  const isLoading = period !== null && queries.some((query) => query.isLoading)
  const isFetching = queries.some((query) => query.isFetching)
  const failedQuery = queries.find((query) => query.isError)

  function refreshAll() {
    queries.forEach((query) => void query.refetch())
  }

  const header = <PageHeader
    eyebrow="Painel de controle"
    title={`Olá, ${user?.name?.split(' ')[0] || 'equipe'}!`}
    subtitle={period ? `Visão consolidada da operação em ${period.label}.` : 'Selecione uma competência para consultar a operação.'}
    actions={<div className="dashboard-header-actions">
      <label className="dashboard-month-filter"><CalendarDays size={17} /><span>Competência</span><input type="month" value={referenceMonth} onChange={(event) => setReferenceMonth(event.target.value)} /></label>
      <Button variant="secondary" icon={<RefreshCw size={17} />} disabled={!period || isFetching} onClick={refreshAll}>{isFetching ? 'Atualizando...' : 'Atualizar'}</Button>
      <Button icon={<Plus size={18} />} onClick={() => navigate('/ordens-de-servico')}>Nova OS</Button>
    </div>}
  />

  if (!period) return <>{header}<EmptyState title="Competência inválida" description="Selecione um mês para carregar os indicadores." /></>
  if (isLoading) return <>{header}<LoadingState label={`Consolidando os módulos de ${period.label}...`} /></>
  if (failedQuery) return <>{header}<ErrorState message={apiErrorMessage(failedQuery.error)} onRetry={refreshAll} /></>

  return (
    <>
      {header}

      <section className="stats-grid dashboard-stats">
        <StatCard label="Notas fiscais" value={money(Number(invoicesQuery.data?.totalValue ?? 0))} helper={`${invoicesQuery.data?.total ?? 0} notas · ${issuedInvoices} emitidas`} icon={<ReceiptText />} tone="green" />
        <StatCard label="Extratos" value={money(Number(statementsQuery.data?.totalValue ?? 0))} helper={`${statementsQuery.data?.total ?? 0} clientes consolidados`} icon={<FileBarChart />} tone="purple" />
        <StatCard label="Boletos" value={money(Number(billsQuery.data?.totalValue ?? 0))} helper={`${billsQuery.data?.total ?? 0} processados no mês`} icon={<WalletCards />} tone="blue" />
        <StatCard label="Contas a receber" value={money(receivableBalance)} helper={`${pendingReceivables.length} pendentes por vencimento`} icon={<CircleDollarSign />} tone="orange" />
        <StatCard label="Ordens de serviço" value={String(ordersQuery.data?.total ?? 0)} helper={`${finalizedOrders} finalizadas · ${activeOrders.length} em andamento`} icon={<ClipboardCheck />} tone="gold" />
      </section>

      {readyInvoices > 0 && <button className="attention-banner" onClick={() => navigate('/notas-fiscais')}><span className="attention-banner__icon"><FileCheck2 size={21} /></span><span><strong>{readyInvoices} {readyInvoices === 1 ? 'nota está pronta' : 'notas estão prontas'} para emissão em {period.label}</strong><small>Revise os dados fiscais antes de concluir.</small></span><b>Revisar faturamento <ArrowRight size={17} /></b></button>}

      <div className="dashboard-period-scope"><CalendarDays size={16} /><span><strong>Critério da competência:</strong> NF por emissão, extratos pelo período movimentado, boletos por processamento, CR por vencimento e OS por abertura.</span></div>

      <section className="dashboard-analytics-grid">
        <DashboardChart title="Movimentações por módulo" eyebrow={period.label} description="Quantidade de registros gerados na competência.">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={moduleCounts} layout="vertical" margin={{ top: 2, right: 18, left: 10, bottom: 0 }}><CartesianGrid horizontal={false} stroke="#e8e9f1" strokeDasharray="3 5" /><XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#9295a8', fontSize: 10 }} /><YAxis type="category" dataKey="name" width={112} axisLine={false} tickLine={false} tick={{ fill: '#666b84', fontSize: 10 }} /><Tooltip formatter={(value) => [Number(value).toLocaleString('pt-BR'), 'Registros']} contentStyle={TOOLTIP_STYLE} /><Bar dataKey="count" radius={[0, 6, 6, 0]} isAnimationActive={false}>{moduleCounts.map((item) => <Cell key={item.name} fill={item.fill} />)}</Bar></BarChart></ResponsiveContainer>
        </DashboardChart>

        <DashboardChart title="Valores movimentados" eyebrow={period.label} description="Comparação financeira dos módulos que possuem valor.">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={moduleValues} layout="vertical" margin={{ top: 2, right: 18, left: 10, bottom: 0 }}><CartesianGrid horizontal={false} stroke="#e8e9f1" strokeDasharray="3 5" /><XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#9295a8', fontSize: 10 }} tickFormatter={(value) => Number(value).toLocaleString('pt-BR', { notation: 'compact' })} /><YAxis type="category" dataKey="name" width={112} axisLine={false} tickLine={false} tick={{ fill: '#666b84', fontSize: 10 }} /><Tooltip formatter={(value) => [money(Number(value)), 'Valor']} contentStyle={TOOLTIP_STYLE} /><Bar dataKey="value" radius={[0, 6, 6, 0]} isAnimationActive={false}>{moduleValues.map((item) => <Cell key={item.name} fill={item.fill} />)}</Bar></BarChart></ResponsiveContainer>
        </DashboardChart>

        <DashboardChart title="Situação das notas fiscais" eyebrow={`${invoicesQuery.data?.total ?? 0} registros`} description="Distribuição das NF da competência por situação." pie>
          {invoiceStatusData.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={invoiceStatusData} dataKey="count" nameKey="label" innerRadius={58} outerRadius={88} paddingAngle={2} isAnimationActive={false}>{invoiceStatusData.map((item, index) => <Cell key={item.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie><Tooltip formatter={(value) => [Number(value).toLocaleString('pt-BR'), 'Notas']} contentStyle={TOOLTIP_STYLE} /><Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} /></PieChart></ResponsiveContainer> : <ChartEmpty label="Nenhuma nota fiscal nesta competência." />}
        </DashboardChart>

        <DashboardChart title="Situação das ordens de serviço" eyebrow={`${ordersQuery.data?.total ?? 0} registros`} description="Distribuição das OS abertas na competência." pie>
          {orderStatusData.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={orderStatusData} dataKey="count" nameKey="label" innerRadius={58} outerRadius={88} paddingAngle={2} isAnimationActive={false}>{orderStatusData.map((item, index) => <Cell key={item.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie><Tooltip formatter={(value) => [Number(value).toLocaleString('pt-BR'), 'Ordens']} contentStyle={TOOLTIP_STYLE} /><Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} /></PieChart></ResponsiveContainer> : <ChartEmpty label="Nenhuma ordem de serviço nesta competência." />}
        </DashboardChart>
      </section>

      <section className="dashboard-grid dashboard-grid--bottom">
        <article className="panel schedule-panel">
          <div className="panel__header"><div><span className="eyebrow">Operação em {period.label}</span><h2>Ordens em andamento</h2></div><button className="panel-link" onClick={() => navigate('/ordens-de-servico')}>Ver todas <ArrowRight size={15} /></button></div>
          <div className="schedule-list">{activity.length ? activity.map((item) => <button key={item.id} className="schedule-row" onClick={() => navigate('/ordens-de-servico')}><span className={`schedule-time ${item.priority === 'URGENTE' ? 'schedule-time--urgent' : ''}`}>{formatDate(item.scheduledAt || item.orderedAt)}</span><span className="schedule-main"><strong>{item.clientTradeName || item.clientName || `Cliente #${item.clientId}`}</strong><small>{item.description || 'Descrição não informada'}</small></span><span className="schedule-tech">{enumLabel(item.status)}</span></button>) : <div className="kanban-empty">Nenhuma OS em andamento nesta competência.</div>}</div>
          <div className="schedule-footer"><ClipboardCheck size={16} /><span><strong>{ordersQuery.data?.total ?? 0}</strong> ordens abertas no mês selecionado</span></div>
        </article>

        <article className="panel closing-panel dashboard-month-summary"><div className="closing-panel__top"><span className="eyebrow">Resumo complementar</span><Badge tone="green">{period.label}</Badge></div><h2>Demais movimentações do mês</h2><p>Indicadores operacionais que complementam o faturamento e a execução dos serviços.</p><div className="detail-metrics"><span><small>Atendimentos</small><strong>{trackingsQuery.data?.total ?? 0}</strong></span><span><small>Tempo apontado</small><strong>{formatMinutes(Number(trackingsQuery.data?.totalQuantity ?? 0))}</strong></span><span><small>Materiais</small><strong>{materialsQuery.data?.total ?? 0}</strong></span><span><small>Valor materiais</small><strong>{money(Number(materialsQuery.data?.totalValue ?? 0))}</strong></span></div><Button variant="secondary" icon={<RefreshCw size={16} />} disabled={isFetching} onClick={refreshAll}>{isFetching ? 'Atualizando...' : 'Atualizar indicadores'}</Button></article>
      </section>

      <article className="panel quick-panel dashboard-quick-panel"><div className="panel__header"><div><span className="eyebrow">Acesso rápido</span><h2>Detalhar os indicadores</h2></div></div><div className="dashboard-quick-actions"><button onClick={() => navigate('/ordens-de-servico')}><span className="quick-icon quick-icon--blue"><ClipboardCheck /></span><span><strong>Ordens de serviço</strong><small>{ordersQuery.data?.total ?? 0} no mês</small></span><ArrowRight /></button><button onClick={() => navigate('/notas-fiscais')}><span className="quick-icon quick-icon--orange"><ReceiptText /></span><span><strong>Notas fiscais</strong><small>{invoicesQuery.data?.total ?? 0} no mês</small></span><ArrowRight /></button><button onClick={() => navigate('/extratos')}><span className="quick-icon quick-icon--green"><WalletCards /></span><span><strong>Boletos e extratos</strong><small>{billsQuery.data?.total ?? 0} boletos · {statementsQuery.data?.total ?? 0} extratos</small></span><ArrowRight /></button><button onClick={() => navigate('/relatorios')}><span className="quick-icon"><TrendingUp /></span><span><strong>Relatórios</strong><small>Análise detalhada e exportação</small></span><ArrowRight /></button></div></article>
    </>
  )
}

function DashboardChart({ title, eyebrow, description, pie = false, children }: { title: string; eyebrow: string; description: string; pie?: boolean; children: ReactNode }) {
  return <article className="panel dashboard-chart-card"><div className="panel__header"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div></div><div className={`dashboard-chart ${pie ? 'dashboard-chart--pie' : ''}`}>{children}</div></article>
}

function ChartEmpty({ label }: { label: string }) {
  return <div className="dashboard-chart-empty"><FileBarChart size={28} /><span>{label}</span></div>
}

function currentReferenceMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function monthPeriod(referenceMonth: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(referenceMonth)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  const lastDay = new Date(year, month, 0).getDate()
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(year, month - 1, 1))
  return {
    startDate: `${referenceMonth}-01`,
    endDate: `${referenceMonth}-${String(lastDay).padStart(2, '0')}`,
    label: `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} de ${year}`,
  }
}

async function loadMonthlyOrders(startDate: string, endDate: string) {
  const first = await api.serviceOrders.list({ startDate, endDate, page: 0, size: 500 })
  return collectAllPages(first, (page, size) => api.serviceOrders.list({ startDate, endDate, page, size }))
}

async function loadMonthlyReceivables(startDate: string, endDate: string) {
  const first = await api.accountsReceivable.list({ dueStart: startDate, dueEnd: endDate, generatedStatus: 'ALL', paymentStatus: 'ALL', page: 0, size: 500 })
  return collectAllPages(first, (page, size) => api.accountsReceivable.list({ dueStart: startDate, dueEnd: endDate, generatedStatus: 'ALL', paymentStatus: 'ALL', page, size }))
}

async function collectAllPages<T>(first: PagedResponse<T>, loadPage: (page: number, size: number) => Promise<PagedResponse<T>>) {
  if (first.totalPages <= 1) return first
  const size = first.size || first.content.length || 100
  const remaining = await Promise.all(Array.from({ length: first.totalPages - 1 }, (_, index) => loadPage(index + 1, size)))
  return { ...first, content: [first, ...remaining].flatMap((page) => page.content) }
}

function groupOrderStatuses(orders: ServiceOrderListItem[]) {
  const counts = new Map<string, number>()
  orders.forEach((order) => counts.set(enumLabel(order.status), (counts.get(enumLabel(order.status)) ?? 0) + 1))
  return Array.from(counts, ([label, count]) => ({ label, count }))
}

function statusKey(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').toUpperCase()
}

function formatMinutes(value: number) {
  const minutes = Math.max(0, Math.round(Number(value || 0)))
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}
