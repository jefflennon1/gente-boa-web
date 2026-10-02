import { useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { AlertTriangle, ChevronLeft, ChevronRight, Clock3, RefreshCw, Search, Timer, Users } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { Badge, Button, EmptyState, ErrorState, LoadingState, StatCard } from './ui'

export function AccountsReceivableHourBalance() {
  const [referenceMonth, setReferenceMonth] = useState(currentReferenceMonth)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const debouncedSearch = useDebouncedValue(search.trim())
  const period = useMemo(() => monthPeriod(referenceMonth), [referenceMonth])

  const contractsQuery = useQuery({
    queryKey: [...queryKeys.contracts, 'receivable-hour-balances', debouncedSearch, referenceMonth, page, pageSize],
    queryFn: () => api.contracts.list({
      query: debouncedSearch || undefined,
      status: 'ATIVO',
      page,
      size: pageSize,
      sortBy: 'CLIENT',
      direction: 'ASC',
    }),
    enabled: period !== null,
  })

  const contracts = contractsQuery.data?.content ?? []
  const balanceQueries = useQueries({
    queries: contracts.map((contract) => ({
      queryKey: [...queryKeys.contracts, 'active-for-client', contract.clientId, period?.endDate],
      queryFn: () => api.contracts.activeByClient(contract.clientId, period!.endDate),
      enabled: period !== null,
      staleTime: 60_000,
    })),
  })

  const rows = contracts.map((contract, index) => ({
    contract,
    balance: balanceQueries[index]?.data?.balance ?? null,
    loading: balanceQueries[index]?.isLoading ?? false,
    error: balanceQueries[index]?.isError ? apiErrorMessage(balanceQueries[index].error) : '',
  }))
  const loadedBalances = rows.flatMap((row) => row.balance ? [row.balance] : [])
  const pageTotals = loadedBalances.reduce((totals, balance) => ({
    contracted: totals.contracted + balance.contractedMinutes,
    used: totals.used + balance.usedMinutes,
    balance: totals.balance + balance.balanceMinutes,
  }), { contracted: 0, used: 0, balance: 0 })
  const negativeBalances = loadedBalances.filter((balance) => balance.balanceMinutes < 0).length
  const total = contractsQuery.data?.total ?? 0
  const totalPages = contractsQuery.data?.totalPages ?? 0
  const firstResult = total === 0 ? 0 : page * pageSize + 1
  const lastResult = Math.min((page + 1) * pageSize, total)
  const balancesFetching = balanceQueries.some((query) => query.isFetching)

  function changeFilter(change: () => void) {
    change()
    setPage(0)
  }

  function refresh() {
    void contractsQuery.refetch()
    balanceQueries.forEach((query) => void query.refetch())
  }

  return <>
    <section className="stats-grid stats-grid--four statement-stats">
      <StatCard label="Contratos ativos" value={String(total)} helper="No contas a receber" icon={<Users />} tone="blue" />
      <StatCard label="Horas contratadas" value={formatDuration(pageTotals.contracted)} helper="Total desta página" icon={<Clock3 />} tone="purple" />
      <StatCard label="Horas utilizadas" value={formatDuration(pageTotals.used)} helper="Total desta página" icon={<Timer />} tone="orange" />
      <StatCard label="Saldo de horas" value={formatDuration(pageTotals.balance)} helper={negativeBalances > 0 ? `${negativeBalances} contrato(s) com saldo negativo` : 'Nenhum saldo negativo nesta página'} icon={<AlertTriangle />} tone={negativeBalances > 0 ? 'orange' : 'green'} />
    </section>

    <section className="panel data-panel hour-balance-panel">
      <div className="billing-filter-panel">
        <div className="billing-filter-panel__heading">
          <div><strong>Acompanhamento de saldo de horas</strong><small>Compare as horas contratadas com as utilizadas antes de faturar as contas do cliente.</small></div>
          <Badge tone="blue">Conferência mensal</Badge>
        </div>
        <div className="hour-balance-filters">
          <label className="billing-filter-group"><span>Cliente ou contrato</span><div className="search-box"><Search size={18} /><input value={search} onChange={(event) => changeFilter(() => setSearch(event.target.value))} placeholder="Nome, código do cliente ou contrato" /></div></label>
          <label className="billing-filter-group"><span>Mês de referência</span><input type="month" value={referenceMonth} onChange={(event) => changeFilter(() => setReferenceMonth(event.target.value))} /></label>
          <Button type="button" variant="secondary" icon={<RefreshCw size={16} />} disabled={contractsQuery.isFetching || balancesFetching} onClick={refresh}>{contractsQuery.isFetching || balancesFetching ? 'Atualizando...' : 'Atualizar saldos'}</Button>
        </div>
      </div>

      {!period ? <EmptyState title="Mês de referência inválido" description="Selecione o mês que deseja conferir." /> : contractsQuery.isLoading ? <LoadingState label="Carregando contratos ativos..." /> : contractsQuery.isError ? <ErrorState message={apiErrorMessage(contractsQuery.error)} onRetry={() => contractsQuery.refetch()} /> : rows.length === 0 ? <EmptyState title="Nenhum contrato ativo encontrado" description="Ajuste o mês ou a busca para consultar outros contratos." /> : <>
        <div className="hour-balance-help"><AlertTriangle size={16} /><span>Saldo negativo indica que as horas utilizadas ultrapassaram as contratadas. Confira as OS do mês antes de gerar o boleto.</span></div>
        <div className="table-wrap"><table className="data-table hour-balance-table"><thead><tr><th>Mês/Ano</th><th>Cliente</th><th>Contrato</th><th>Unidade</th><th>Contratado</th><th>Utilizado</th><th>Saldo</th><th>Situação</th></tr></thead><tbody>{rows.map(({ contract, balance, loading, error }) => {
          const balanceMinutes = balance?.balanceMinutes ?? 0
          return <tr key={contract.id}>
            <td><strong>{period.label}</strong></td>
            <td><strong className="table-primary">{contract.clientTradeName || contract.clientName || `Cliente #${contract.clientId}`}</strong><small className="table-secondary">Código {contract.clientId}</small></td>
            <td><strong>#{balance?.contractId ?? contract.id}</strong></td>
            <td>{balance?.unit || 'HORAS'}</td>
            <td className="hour-balance-value">{loading ? 'Carregando...' : error ? '—' : balance?.contracted || '00:00'}</td>
            <td className="hour-balance-value"><strong>{loading ? 'Carregando...' : error ? '—' : balance?.used || '00:00'}</strong></td>
            <td className={`hour-balance-value ${balanceMinutes < 0 ? 'hour-balance-value--negative' : ''}`}><strong>{loading ? 'Carregando...' : error ? '—' : balance?.balance || '00:00'}</strong></td>
            <td>{loading ? <Badge tone="neutral">Calculando</Badge> : error ? <Badge tone="red">Falha ao carregar</Badge> : !balance ? <Badge tone="neutral">Sem vigência no mês</Badge> : balanceMinutes < 0 ? <Badge tone="red">Saldo negativo</Badge> : balanceMinutes === 0 ? <Badge tone="orange">Saldo esgotado</Badge> : <Badge tone="green">Saldo disponível</Badge>}{error && <small className="table-secondary" title={error}>Atualize para tentar novamente</small>}</td>
          </tr>
        })}</tbody></table></div>
      </>}

      <footer className="table-footer table-footer--pagination"><span>Mostrando <strong>{firstResult}–{lastResult}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong> contratos</span><div className="pagination-controls"><label>Itens <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}>{[5, 10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}</select></label><button disabled={page === 0 || contractsQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button><span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span><button disabled={page + 1 >= totalPages || contractsQuery.isFetching} onClick={() => setPage((value) => value + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button></div></footer>
    </section>
  </>
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
    endDate: `${referenceMonth}-${String(lastDay).padStart(2, '0')}`,
    label: `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)}/${year}`,
  }
}

function formatDuration(minutes: number) {
  const rounded = Math.round(Number(minutes || 0))
  const absolute = Math.abs(rounded)
  const value = `${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`
  return rounded < 0 ? `-${value}` : value
}
