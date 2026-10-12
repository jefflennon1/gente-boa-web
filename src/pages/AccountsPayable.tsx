import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, Edit3, FileText, HandCoins, ListChecks, Plus, Search, Trash2, WalletCards } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { financeApi, financeKeys, type PayableFilterParams } from '../api/finance'
import { api, queryKeys } from '../api/services'
import { SupplierPicker, type PickerValue } from '../components/AsyncPicker'
import { MultipleSettlementDialog } from '../components/FinanceDialogs'
import { usePayableDialogs } from '../components/PayableDialogs'
import { Badge, Button, CollapsibleFilters, EmptyState, ErrorState, LoadingState, PageHeader, StatCard, Toast } from '../components/ui'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { downloadCsv, monthBounds, todayIso } from '../lib/export'
import { formatDate, money } from '../lib/format'
import { useRouter } from '../router'
import type { PayableAccount, PayableDateField } from '../types'

type ToastState = { message: string; variant: 'success' | 'error' } | null
type StatusFilter = NonNullable<PayableFilterParams['status']>

export function AccountsPayable() {
  const queryClient = useQueryClient()
  const { search: routeSearch } = useRouter()
  const routeParams = new URLSearchParams(routeSearch)
  const routeSupplierId = routeParams.get('supplierId')
  const routePayableId = routeParams.get('payableId')
  const initialPeriod = useMemo(() => monthBounds(), [])
  const [search, setSearch] = useState('')
  const [supplier, setSupplier] = useState<PickerValue>(routeSupplierId ? { id: Number(routeSupplierId), label: `Fornecedor #${routeSupplierId}` } : null)
  const [payableId, setPayableId] = useState(routePayableId || '')
  const [serviceOrderId, setServiceOrderId] = useState('')
  const [startDate, setStartDate] = useState(routeSupplierId || routePayableId ? '' : initialPeriod.start)
  const [endDate, setEndDate] = useState(routeSupplierId || routePayableId ? '' : initialPeriod.end)
  const [dateField, setDateField] = useState<PayableDateField>('DUE_DATE')
  const [status, setStatus] = useState<StatusFilter>(routePayableId ? 'ALL' : 'OPEN')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [costCenterId, setCostCenterId] = useState('')
  const [subCostCenterId, setSubCostCenterId] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [selection, setSelection] = useState<Record<number, PayableAccount>>({})
  const [multiOpen, setMultiOpen] = useState(false)
  const [multiError, setMultiError] = useState('')
  const [toast, setToast] = useState<ToastState>(null)
  const debouncedSearch = useDebouncedValue(search.trim())
  const payableDialogs = usePayableDialogs(showToast)

  useEffect(() => {
    if (!routeSupplierId) return
    api.suppliers.find(Number(routeSupplierId)).then((item) => setSupplier({ id: item.id, label: `${item.tradeName || item.legalName || 'Fornecedor'} · #${item.id}` })).catch(() => undefined)
  }, [routeSupplierId])

  const filters: PayableFilterParams = {
    query: debouncedSearch || undefined,
    supplierId: supplier?.id,
    payableId: payableId ? Number(payableId) : undefined,
    serviceOrderId: serviceOrderId ? Number(serviceOrderId) : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    dateField,
    status,
    minAmount: minAmount ? Number(minAmount) : undefined,
    maxAmount: maxAmount ? Number(maxAmount) : undefined,
    costCenterId: costCenterId ? Number(costCenterId) : undefined,
    subCostCenterId: subCostCenterId ? Number(subCostCenterId) : undefined,
  }
  const accountsQuery = useQuery({ queryKey: [...queryKeys.payables, 'list', filters, page, pageSize], queryFn: () => financeApi.payables.list({ ...filters, page, size: pageSize }), placeholderData: keepPreviousData })
  const summaryQuery = useQuery({ queryKey: [...queryKeys.payables, 'summary', filters], queryFn: () => financeApi.payables.summary(filters), placeholderData: keepPreviousData })
  const costCentersQuery = useQuery({ queryKey: [...financeKeys.costCenters, 'Despesas'], queryFn: () => financeApi.costCenters.list('Despesas') })
  const movementAccountsQuery = useQuery({ queryKey: [...queryKeys.payables, 'movement-accounts'], queryFn: () => api.payables.movementAccounts() })

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.payables }),
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders }),
      queryClient.invalidateQueries({ queryKey: queryKeys.materials }),
      queryClient.invalidateQueries({ queryKey: financeKeys.cash }),
    ])
  }
  function showToast(message: string, variant: 'success' | 'error' = 'success') {
    setToast({ message, variant })
    window.setTimeout(() => setToast(null), variant === 'error' ? 6000 : 3200)
  }
  function resetPage() { setPage(0); setSelection({}) }

  const multiMutation = useMutation({
    mutationFn: financeApi.payables.settleMultiple,
    onSuccess: async (result) => { await invalidate(); setMultiOpen(false); setSelection({}); showToast(`${result.count} conta(s) baixada(s) · ${money(result.totalAmount)}.`) },
    onError: (error) => setMultiError(apiErrorMessage(error)),
  })
  const exportMutation = useMutation({
    mutationFn: async () => {
      const first = await financeApi.payables.list({ ...filters, page: 0, size: 100 })
      const all = [...first.content]
      for (let index = 1; index < Math.min(first.totalPages, 50); index++) all.push(...(await financeApi.payables.list({ ...filters, page: index, size: 100 })).content)
      return all
    },
    onSuccess: (all) => downloadCsv('contas-a-pagar', ['Código', 'Fornecedor', 'Descrição', 'OS', 'Pedido', 'NF', 'Cadastro', 'Vencimento', 'Pagamento', 'Devido', 'Pago', 'Saldo', 'Situação', 'Centro', 'Subcentro'], all.map((row) => [row.id, row.supplierName, row.description, row.serviceOrderId || '', row.purchaseOrderId || '', row.invoiceNumber, formatDate(row.registeredAt), formatDate(row.dueAt), row.paidAt ? formatDate(row.paidAt) : '', row.amountDue, row.amountPaid, row.balance, statusLabel(row), row.costCenterName, row.subCostCenterName])),
    onError: (error) => showToast(apiErrorMessage(error), 'error'),
  })

  const accounts = accountsQuery.data?.content ?? []
  const total = accountsQuery.data?.total ?? 0
  const totalPages = accountsQuery.data?.totalPages ?? 0
  const summary = summaryQuery.data
  const centers = costCentersQuery.data ?? []
  const filterSubCenters = centers.find((center) => String(center.id) === costCenterId)?.subCenters ?? centers.flatMap((center) => center.subCenters)
  const selectedRows = Object.values(selection)
  const selectedTotal = selectedRows.reduce((sum, row) => sum + Number(row.balance || 0), 0)
  const activeFilters = [search, supplier, payableId, serviceOrderId, startDate, endDate, minAmount, maxAmount, costCenterId, subCostCenterId].filter(Boolean).length + (dateField !== 'DUE_DATE' ? 1 : 0) + (status !== 'ALL' ? 1 : 0)

  function toggle(row: PayableAccount) { setSelection((current) => { const copy = { ...current }; if (copy[row.id]) delete copy[row.id]; else copy[row.id] = row; return copy }) }
  function togglePage() {
    const open = accounts.filter((row) => Number(row.balance) > 0)
    const all = open.length > 0 && open.every((row) => selection[row.id])
    setSelection((current) => { const copy = { ...current }; open.forEach((row) => { if (all) delete copy[row.id]; else copy[row.id] = row }); return copy })
  }



  return <>
    <PageHeader eyebrow="Financeiro" title="Contas a pagar" subtitle="Despesas avulsas e contas geradas pelos pedidos de compra das ordens de serviço." actions={<><Button variant="secondary" icon={<FileText size={18} />} disabled={exportMutation.isPending} onClick={() => exportMutation.mutate()}>{exportMutation.isPending ? 'Exportando...' : 'Exportar Excel'}</Button><Button icon={<Plus size={18} />} onClick={() => payableDialogs.openNew(supplier)}>Nova conta</Button></>} />

    <section className="stats-grid stats-grid--four">
      <StatCard label="Valor devido" value={money(summary?.amountDue)} helper={`${(summary?.count ?? 0).toLocaleString('pt-BR')} contas no filtro`} icon={<CircleDollarSign />} tone="blue" />
      <StatCard label="Valor pago" value={money(summary?.amountPaid)} helper={`${(summary?.paidCount ?? 0).toLocaleString('pt-BR')} quitadas`} icon={<Banknote />} tone="green" />
      <StatCard label="Saldo a pagar" value={money(summary?.balance)} helper={`${(summary?.openCount ?? 0).toLocaleString('pt-BR')} em aberto`} icon={<HandCoins />} tone="orange" />
      <StatCard label="Vencidas" value={money(summary?.overdueBalance)} helper={`${(summary?.overdueCount ?? 0).toLocaleString('pt-BR')} contas vencidas`} icon={<CalendarDays />} tone="purple" />
    </section>

    <section className="panel data-panel">
      <CollapsibleFilters summary="Fornecedor, período, nº CP, valor, centro e subcentro" activeCount={activeFilters} onClear={() => { setSearch(''); setSupplier(null); setPayableId(''); setServiceOrderId(''); setStartDate(''); setEndDate(''); setDateField('DUE_DATE'); setStatus('ALL'); setMinAmount(''); setMaxAmount(''); setCostCenterId(''); setSubCostCenterId(''); resetPage() }} contentClassName="finance-filters">
        <label className="finance-filters__wide"><span>Busca</span><div className="search-box"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); resetPage() }} placeholder="Descrição, fornecedor, código, pedido, OS ou nota fiscal..." /></div></label>
        <label className="finance-filters__wide"><span>Fornecedor</span><SupplierPicker value={supplier} onChange={(value) => { setSupplier(value); resetPage() }} /></label>
        <label><span>Nº CP</span><input type="number" min="1" value={payableId} onChange={(event) => { setPayableId(event.target.value); resetPage() }} /></label>
        <label><span>OS</span><input type="number" min="1" value={serviceOrderId} onChange={(event) => { setServiceOrderId(event.target.value); resetPage() }} /></label>
        <label><span>Data de</span><select value={dateField} onChange={(event) => { setDateField(event.target.value as PayableDateField); resetPage() }}><option value="DUE_DATE">Vencimento</option><option value="PAYMENT_DATE">Pagamento</option><option value="REGISTRATION_DATE">Cadastro</option></select></label>
        <label><span>De</span><input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); resetPage() }} /></label>
        <label><span>Até</span><input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); resetPage() }} /></label>
        <label><span>Situação</span><select value={status} onChange={(event) => { setStatus(event.target.value as StatusFilter); resetPage() }}><option value="OPEN">Em aberto</option><option value="OVERDUE">Vencidas</option><option value="PAID">Quitadas</option><option value="ALL">Todas</option></select></label>
        <label><span>Valor mínimo</span><input type="number" step="0.01" value={minAmount} onChange={(event) => { setMinAmount(event.target.value); resetPage() }} /></label>
        <label><span>Valor máximo</span><input type="number" step="0.01" value={maxAmount} onChange={(event) => { setMaxAmount(event.target.value); resetPage() }} /></label>
        <label><span>Centro de custo</span><select value={costCenterId} onChange={(event) => { setCostCenterId(event.target.value); setSubCostCenterId(''); resetPage() }}><option value="">Todos</option>{centers.map((center) => <option key={center.id} value={center.id}>{center.id} · {center.description}</option>)}</select></label>
        <label><span>Subcentro</span><select value={subCostCenterId} onChange={(event) => { setSubCostCenterId(event.target.value); resetPage() }}><option value="">Todos</option>{filterSubCenters.map((sub) => <option key={sub.id} value={sub.id}>{sub.id} · {sub.description}</option>)}</select></label>
      </CollapsibleFilters>

      {selectedRows.length > 0 && <div className="selection-bar"><span><ListChecks size={18} /><strong>{selectedRows.length}</strong> conta(s) marcada(s) · saldo {money(selectedTotal)}</span><div><Button variant="ghost" onClick={() => setSelection({})}>Limpar</Button><Button icon={<WalletCards size={16} />} onClick={() => { setMultiError(''); setMultiOpen(true) }}>Baixa múltipla</Button></div></div>}

      {accountsQuery.isLoading ? <LoadingState label="Carregando contas a pagar..." /> : accountsQuery.isError ? <ErrorState message={apiErrorMessage(accountsQuery.error)} onRetry={() => accountsQuery.refetch()} /> : accounts.length === 0 ? <EmptyState title="Nenhuma conta encontrada" description="Altere os filtros ou cadastre uma nova conta a pagar." /> : <div className={`table-wrap ${accountsQuery.isFetching ? 'table-wrap--refreshing' : ''}`}>
        <table className="data-table payables-table"><thead><tr><th className="check-column"><input type="checkbox" aria-label="Marcar contas abertas da página" checked={accounts.some((row) => Number(row.balance) > 0) && accounts.filter((row) => Number(row.balance) > 0).every((row) => selection[row.id])} onChange={togglePage} /></th><th>Código</th><th>Descrição</th><th>Fornecedor</th><th>Pedido / OS</th><th>Vencimento</th><th>Pagamento</th><th className="num">Devido</th><th className="num">Pago</th><th className="num">Saldo</th><th>Situação</th><th /></tr></thead><tbody>{accounts.map((account) => <tr key={account.id} onClick={() => payableDialogs.openEdit(account)}>
          <td className="check-column" onClick={(event) => event.stopPropagation()}><input type="checkbox" disabled={Number(account.balance) <= 0} checked={Boolean(selection[account.id])} onChange={() => toggle(account)} aria-label={`Marcar conta ${account.id}`} /></td>
          <td><strong>#{account.id}</strong></td><td><strong className="table-primary">{account.description || 'Sem descrição'}</strong>{account.invoiceNumber && <small className="table-secondary">NF {account.invoiceNumber}</small>}</td><td>{account.supplierName || 'Não informado'}</td>
          <td>{account.purchaseOrderId ? `Pedido #${account.purchaseOrderId}` : 'Avulsa'}{account.serviceOrderId ? <small className="table-secondary">OS #{account.serviceOrderId}</small> : null}</td>
          <td>{formatDate(account.dueAt)}</td><td>{account.paidAt ? formatDate(account.paidAt) : '—'}</td>
          <td className="num"><strong>{money(account.amountDue)}</strong></td><td className="num">{money(account.amountPaid)}</td><td className="num"><strong className={account.balance > 0 ? 'negative-value' : 'positive-value'}>{money(account.balance)}</strong></td>
          <td><Badge tone={statusTone(account)}>{statusLabel(account)}</Badge></td>
          <td><div className="row-actions">{account.balance > 0 && <button className="row-action row-action--success" onClick={(event) => { event.stopPropagation(); payableDialogs.openSettlement(account) }} title="Dar baixa"><WalletCards size={16} /></button>}<button className="row-action" onClick={(event) => { event.stopPropagation(); payableDialogs.openEdit(account) }} title="Alterar conta"><Edit3 size={16} /></button><button className="row-action row-action--danger" onClick={(event) => { event.stopPropagation(); payableDialogs.requestDelete(account) }} title="Excluir conta"><Trash2 size={16} /></button></div></td>
        </tr>)}</tbody></table>
      </div>}
      <footer className="table-footer table-footer--pagination"><span>Mostrando <strong>{total === 0 ? 0 : page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong> contas</span><div className="pagination-controls"><label>Por página <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}>{[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label><button disabled={page === 0 || accountsQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft size={16} /></button><span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span><button disabled={page + 1 >= totalPages || accountsQuery.isFetching} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></button></div></footer>
    </section>



    {payableDialogs.dialogs}
    <MultipleSettlementDialog key={multiOpen ? 'open' : 'closed'} open={multiOpen} title="Baixa múltipla de contas a pagar" count={selectedRows.length} total={selectedTotal} movementAccounts={movementAccountsQuery.data} busy={multiMutation.isPending} error={multiError} onClose={() => setMultiOpen(false)} onSubmit={(payload) => multiMutation.mutate({ ...payload, ids: selectedRows.map((row) => row.id) })} />
    {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
  </>
}

function overdue(account: PayableAccount) { return Number(account.balance) > 0 && Boolean(account.dueAt) && account.dueAt!.slice(0, 10) < todayIso() }
function statusLabel(account: PayableAccount) { return account.status === 'PAID' ? 'Quitada' : account.status === 'CLOSED' ? 'Fechada' : overdue(account) ? 'Vencida' : 'Aberta' }
function statusTone(account: PayableAccount): 'green' | 'orange' | 'neutral' | 'red' { return account.status === 'PAID' ? 'green' : account.status === 'CLOSED' ? 'neutral' : overdue(account) ? 'red' : 'orange' }
