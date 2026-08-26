import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, CircleDollarSign, ClipboardCheck, FileCheck2, FileSignature, Plus, ReceiptText, TrendingUp, UsersRound } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { useAuth } from '../auth'
import { Badge, Button, ErrorState, LoadingState, PageHeader, StatCard } from '../components/ui'
import { enumLabel, formatDate, money } from '../lib/format'
import { useRouter } from '../router'
import type { Invoice } from '../types'

function buildCashFlow(invoices: Invoice[]) {
  const formatter = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
  const current = new Date()
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(current.getFullYear(), current.getMonth() - (5 - index), 1)
    return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, month: formatter.format(date).replace('.', ''), received: 0, pending: 0 }
  })
  for (const invoice of invoices) {
    const date = invoice.issuedAt || invoice.dtemiss
    const key = date?.slice(0, 7)
    const bucket = months.find((month) => month.key === key)
    if (!bucket) continue
    const target = invoice.status === 'EMITIDA' ? 'received' : 'pending'
    bucket[target] += Number(invoice.amount ?? 0) / 1000
  }
  return months
}

export function Dashboard() {
  const { navigate } = useRouter()
  const { user } = useAuth()
  const [clientStatisticsQuery, ordersQuery, invoicesQuery, statementsQuery] = useQueries({ queries: [
    { queryKey: [...queryKeys.clients, 'statistics'], queryFn: () => api.clients.statistics() },
    { queryKey: queryKeys.serviceOrders, queryFn: () => api.serviceOrders.list() },
    { queryKey: queryKeys.invoices, queryFn: () => api.invoices.list() },
    { queryKey: queryKeys.statements, queryFn: () => api.statements.list() },
  ] })

  const orders = ordersQuery.data?.content ?? []
  const invoices = invoicesQuery.data?.content ?? []
  const statements = statementsQuery.data?.content ?? []
  const today = new Date().toISOString().slice(0, 10)
  const currentMonth = today.slice(0, 7)
  const revenue = invoices.filter((invoice) => invoice.status === 'EMITIDA' && (invoice.issuedAt || invoice.dtemiss)?.startsWith(currentMonth)).reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0)
  const receivable = invoices.filter((invoice) => !['EMITIDA', 'CANCELADA'].includes(invoice.status)).reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0)
  const todayOrders = orders.filter((order) => order.orderedAt?.slice(0, 10) === today)
  const readyInvoices = invoices.filter((invoice) => invoice.status === 'PRONTA')
  const cashFlow = useMemo(() => buildCashFlow(invoices), [invoices])
  const activity = useMemo(() => [...orders].filter((order) => !['FINALIZADA', 'CANCELADA'].includes(order.status)).sort((a, b) => (a.orderedAt || '').localeCompare(b.orderedAt || '')).slice(0, 4), [orders])
  const isLoading = clientStatisticsQuery.isLoading || ordersQuery.isLoading || invoicesQuery.isLoading || statementsQuery.isLoading
  const failedQuery = [clientStatisticsQuery, ordersQuery, invoicesQuery, statementsQuery].find((query) => query.isError)

  if (isLoading) return <LoadingState label="Montando visão geral..." />
  if (failedQuery) return <ErrorState message={apiErrorMessage(failedQuery.error)} onRetry={() => { clientStatisticsQuery.refetch(); ordersQuery.refetch(); invoicesQuery.refetch(); statementsQuery.refetch() }} />

  return (
    <>
      <PageHeader eyebrow="Painel de controle" title={`Olá, ${user?.name?.split(' ')[0] || 'equipe'}!`} subtitle={`Resumo da operação em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date())}.`} actions={<Button icon={<Plus size={18} />} onClick={() => navigate('/ordens-de-servico')}>Nova ordem de serviço</Button>} />

      <section className="stats-grid stats-grid--four">
        <StatCard label="Receita emitida no mês" value={money(revenue)} helper={`${invoices.filter((invoice) => invoice.status === 'EMITIDA').length} notas emitidas no retorno`} icon={<TrendingUp />} tone="green" />
        <StatCard label="A faturar" value={money(receivable)} helper={`${readyInvoices.length} notas prontas`} icon={<CircleDollarSign />} tone="blue" />
        <StatCard label="Ordens hoje" value={String(todayOrders.length)} helper={`${todayOrders.filter((order) => order.status === 'ABERTA').length} abertas`} icon={<ClipboardCheck />} tone="orange" />
        <StatCard label="Clientes ativos" value={String(clientStatisticsQuery.data?.active ?? 0)} helper={`${clientStatisticsQuery.data?.total ?? 0} clientes cadastrados · ${clientStatisticsQuery.data?.inactive ?? 0} inativos`} icon={<UsersRound />} tone="purple" />
      </section>

      {readyInvoices.length > 0 && <button className="attention-banner" onClick={() => navigate('/notas-fiscais')}><span className="attention-banner__icon"><FileCheck2 size={21} /></span><span><strong>{readyInvoices.length} {readyInvoices.length === 1 ? 'nota está pronta' : 'notas estão prontas'} para emissão</strong><small>Revise os dados fiscais antes de concluir.</small></span><b>Revisar faturamento <ArrowRight size={17} /></b></button>}

      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <div className="panel__header"><div><span className="eyebrow">Últimos 6 meses</span><h2>Fluxo de notas fiscais</h2></div><div className="chart-legend"><span><i className="legend-dot legend-dot--blue" />Emitido</span><span><i className="legend-dot legend-dot--orange" />Pendente</span></div></div>
          <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={cashFlow} margin={{ top: 8, right: 0, left: -16, bottom: 0 }}><defs><linearGradient id="received" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#33399a" stopOpacity={0.28} /><stop offset="100%" stopColor="#33399a" stopOpacity={0.02} /></linearGradient><linearGradient id="pending" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f48120" stopOpacity={0.2} /><stop offset="100%" stopColor="#f48120" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#e8e9f1" strokeDasharray="3 5" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#7a7e98', fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#9a9db0', fontSize: 11 }} tickFormatter={(value) => `${value}k`} /><Tooltip formatter={(value) => [money(Number(value) * 1000), '']} contentStyle={{ borderRadius: 12, border: '1px solid #e1e2eb', boxShadow: '0 10px 28px rgba(25,27,61,.12)' }} /><Area type="monotone" dataKey="received" stroke="#33399a" strokeWidth={3} fill="url(#received)" isAnimationActive={false} /><Area type="monotone" dataKey="pending" stroke="#f48120" strokeWidth={2} fill="url(#pending)" isAnimationActive={false} /></AreaChart></ResponsiveContainer></div>
          <div className="chart-summary"><span>Emitido no mês<strong>{money(revenue)}</strong></span><span>A faturar<strong>{money(receivable)}</strong></span><span>Movimentação líquida<strong>{money(statements.reduce((sum, statement) => sum + Number(statement.amount ?? 0), 0))}</strong></span></div>
        </article>

        <article className="panel schedule-panel">
          <div className="panel__header"><div><span className="eyebrow">Agenda operacional</span><h2>Próximos atendimentos</h2></div><button className="panel-link" onClick={() => navigate('/ordens-de-servico')}>Ver agenda <ArrowRight size={15} /></button></div>
          <div className="schedule-list">{activity.length ? activity.map((item) => <button key={item.id} className="schedule-row" onClick={() => navigate('/ordens-de-servico')}><span className={`schedule-time ${item.priority === 'URGENTE' ? 'schedule-time--urgent' : ''}`}>{formatDate(item.orderedAt)}</span><span className="schedule-main"><strong>{item.clientTradeName || item.clientName || `Cliente #${item.clientId}`}</strong><small>{item.description || 'Descrição não informada'}</small></span><span className="schedule-tech">{enumLabel(item.status)}</span></button>) : <div className="kanban-empty">Nenhum atendimento pendente.</div>}</div>
          <div className="schedule-footer"><ClipboardCheck size={16} /><span><strong>{ordersQuery.data?.total ?? 0}</strong> ordens cadastradas na API</span></div>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid--bottom">
        <article className="panel quick-panel"><div className="panel__header"><div><span className="eyebrow">Acesso rápido</span><h2>Rotinas frequentes</h2></div></div><div className="quick-actions"><button onClick={() => navigate('/clientes')}><span className="quick-icon quick-icon--blue"><UsersRound /></span><span><strong>Novo cliente</strong><small>Cadastro completo</small></span><ArrowRight /></button><button onClick={() => navigate('/contratos')}><span className="quick-icon"><FileSignature /></span><span><strong>Contratos</strong><small>Vínculos e serviços contratados</small></span><ArrowRight /></button><button onClick={() => navigate('/notas-fiscais')}><span className="quick-icon quick-icon--orange"><ReceiptText /></span><span><strong>Notas fiscais</strong><small>{readyInvoices.length} prontas</small></span><ArrowRight /></button><button onClick={() => navigate('/extratos')}><span className="quick-icon quick-icon--green"><FileCheck2 /></span><span><strong>Extratos</strong><small>{statementsQuery.data?.total ?? 0} movimentos</small></span><ArrowRight /></button></div></article>
        <article className="panel closing-panel"><div className="closing-panel__top"><span className="eyebrow">Situação operacional</span><Badge tone="green">API sincronizada</Badge></div><h2>Dados consolidados</h2><p>Os indicadores desta tela são calculados sobre os registros retornados pelos endpoints atuais.</p><div className="detail-metrics"><span><small>Clientes</small><strong>{clientStatisticsQuery.data?.total ?? 0}</strong></span><span><small>Ordens</small><strong>{ordersQuery.data?.total ?? 0}</strong></span><span><small>Notas</small><strong>{invoicesQuery.data?.total ?? 0}</strong></span><span><small>Movimentos</small><strong>{statementsQuery.data?.total ?? 0}</strong></span></div><Button variant="secondary" onClick={() => { clientStatisticsQuery.refetch(); ordersQuery.refetch(); invoicesQuery.refetch(); statementsQuery.refetch() }}>Atualizar indicadores</Button></article>
      </section>
    </>
  )
}
