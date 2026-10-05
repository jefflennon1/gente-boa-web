import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, Edit3, FileText, HandCoins, ListChecks, Plus, Search, SplitSquareHorizontal, Trash2, Undo2, WalletCards } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { financeApi, financeKeys, type PayableFilterParams } from '../api/finance'
import { api, queryKeys } from '../api/services'
import { SupplierPicker, type PickerValue } from '../components/AsyncPicker'
import { InstallmentDialog, MultipleSettlementDialog, suggestedMovementAccount } from '../components/FinanceDialogs'
import { Badge, Button, CollapsibleFilters, ConfirmDialog, EmptyState, ErrorState, FormError, FormField, LoadingState, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { downloadCsv, monthBounds, todayIso } from '../lib/export'
import { formatDate, money } from '../lib/format'
import { useRouter } from '../router'
import type { PayableAccount, PayableAccountPayload, PayableDateField, PayablePaymentPayload } from '../types'

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
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<PayableAccount | null>(null)
  const [formSupplier, setFormSupplier] = useState<PickerValue>(null)
  const [formCostCenter, setFormCostCenter] = useState('')
  const [formError, setFormError] = useState('')
  const [accountToDelete, setAccountToDelete] = useState<PayableAccount | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [settlementAccount, setSettlementAccount] = useState<PayableAccount | null>(null)
  const [paymentValues, setPaymentValues] = useState({ cashValue: 0, transferValue: 0, billValue: 0 })
  const [settlementMovement, setSettlementMovement] = useState<number | ''>('')
  const [settlementError, setSettlementError] = useState('')
  const [installmentTarget, setInstallmentTarget] = useState<PayableAccount | null>(null)
  const [installmentError, setInstallmentError] = useState('')
  const [toast, setToast] = useState<ToastState>(null)
  const debouncedSearch = useDebouncedValue(search.trim())

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
  const detailQuery = useQuery({ queryKey: [...queryKeys.payables, 'detail', selected?.id], queryFn: () => api.payables.find(selected!.id), enabled: modalOpen && selected !== null })

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

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: PayableAccountPayload }) => id ? api.payables.update(id, payload) : api.payables.create(payload),
    onSuccess: async (_, variables) => { await invalidate(); setModalOpen(false); setSelected(null); showToast(variables.id ? 'Conta atualizada.' : 'Conta cadastrada.') },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.payables.remove(id),
    onSuccess: async () => { await invalidate(); setAccountToDelete(null); setModalOpen(false); showToast('Conta excluída.') },
    onError: (error) => setDeleteError(apiErrorMessage(error)),
  })
  const settleMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PayablePaymentPayload }) => api.payables.settle(id, payload),
    onSuccess: async () => { await invalidate(); setSettlementAccount(null); showToast('Baixa registrada com sucesso.') },
    onError: (error) => setSettlementError(apiErrorMessage(error)),
  })
  const multiMutation = useMutation({
    mutationFn: financeApi.payables.settleMultiple,
    onSuccess: async (result) => { await invalidate(); setMultiOpen(false); setSelection({}); showToast(`${result.count} conta(s) baixada(s) · ${money(result.totalAmount)}.`) },
    onError: (error) => setMultiError(apiErrorMessage(error)),
  })
  const reverseMutation = useMutation({
    mutationFn: ({ id, paymentId }: { id: number; paymentId?: number }) => paymentId ? api.payables.reversePayment(id, paymentId) : financeApi.payables.reverseLegacySettlement(id),
    onSuccess: async () => { await invalidate(); showToast('Baixa excluída e saldo recalculado.') },
    onError: (error) => showToast(apiErrorMessage(error), 'error'),
  })
  // Pedido de compra: o parcelamento é refeito para o pedido inteiro, somando as prestações já existentes.
  const purchaseGroupQuery = useQuery({
    queryKey: [...queryKeys.payables, 'purchase-group', installmentTarget?.purchaseOrderId, installmentTarget?.serviceOrderId],
    queryFn: () => financeApi.payables.list({ serviceOrderId: installmentTarget!.serviceOrderId!, status: 'ALL', page: 0, size: 200 }),
    enabled: Boolean(installmentTarget?.purchaseOrderId && installmentTarget?.serviceOrderId),
  })
  const purchaseGroup = (purchaseGroupQuery.data?.content ?? []).filter((row) => row.purchaseOrderId === installmentTarget?.purchaseOrderId)
  const installmentTotal = installmentTarget?.purchaseOrderId && purchaseGroup.length > 0
    ? purchaseGroup.reduce((sum, row) => sum + Number(row.amountDue || 0), 0)
    : Number(installmentTarget?.amountDue ?? 0)
  const installmentMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof financeApi.payables.installments>[1] }) => financeApi.payables.installments(id, payload),
    onSuccess: async (result) => { await invalidate(); setInstallmentTarget(null); setModalOpen(false); showToast(`${result.length} lançamentos gerados.`) },
    onError: (error) => setInstallmentError(apiErrorMessage(error)),
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
  const editingAccount = detailQuery.data ?? selected
  const centers = costCentersQuery.data ?? []
  const filterSubCenters = centers.find((center) => String(center.id) === costCenterId)?.subCenters ?? centers.flatMap((center) => center.subCenters)
  const formSubCenters = centers.find((center) => String(center.id) === formCostCenter)?.subCenters ?? []
  const selectedRows = Object.values(selection)
  const selectedTotal = selectedRows.reduce((sum, row) => sum + Number(row.balance || 0), 0)
  const paymentTotal = paymentValues.cashValue + paymentValues.transferValue + paymentValues.billValue
  const paymentMethod = paymentValues.cashValue > 0 && paymentValues.transferValue + paymentValues.billValue === 0 ? 'CASH' : 'TRANSFER'
  const legacySettlement = Boolean(editingAccount && !editingAccount.payments?.length && Number(editingAccount.amountPaid) > 0)
  const activeFilters = [search, supplier, payableId, serviceOrderId, startDate, endDate, minAmount, maxAmount, costCenterId, subCostCenterId].filter(Boolean).length + (dateField !== 'DUE_DATE' ? 1 : 0) + (status !== 'ALL' ? 1 : 0)

  function openNew() { setSelected(null); setFormSupplier(supplier); setFormCostCenter(''); setFormError(''); setModalOpen(true) }
  function openEdit(account: PayableAccount) {
    setSelected(account)
    setFormSupplier({ id: account.supplierId, label: `${account.supplierName || 'Fornecedor'} · #${account.supplierId}` })
    setFormCostCenter(account.costCenterId ? String(account.costCenterId) : '')
    setFormError('')
    setModalOpen(true)
  }
  function openSettlement(account: PayableAccount) { setSettlementAccount(account); setPaymentValues({ cashValue: Number(account.balance || 0), transferValue: 0, billValue: 0 }); setSettlementMovement(''); setSettlementError('') }
  function toggle(row: PayableAccount) { setSelection((current) => { const copy = { ...current }; if (copy[row.id]) delete copy[row.id]; else copy[row.id] = row; return copy }) }
  function togglePage() {
    const open = accounts.filter((row) => Number(row.balance) > 0)
    const all = open.length > 0 && open.every((row) => selection[row.id])
    setSelection((current) => { const copy = { ...current }; open.forEach((row) => { if (all) delete copy[row.id]; else copy[row.id] = row }); return copy })
  }

  function submitAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!formSupplier) { setFormError('Selecione o fornecedor.'); return }
    const data = new FormData(event.currentTarget)
    const numberOrNull = (name: string) => String(data.get(name) ?? '').trim() === '' ? null : Number(data.get(name))
    const textOrNull = (name: string) => String(data.get(name) ?? '').trim() || null
    const dateOrNull = (name: string) => { const value = String(data.get(name) ?? '').trim(); return value ? `${value}T00:00:00` : null }
    saveMutation.mutate({
      id: selected?.id, payload: {
        supplierId: formSupplier.id,
        purchaseOrderId: numberOrNull('purchaseOrderId'),
        invoiceNumber: textOrNull('invoiceNumber'),
        serviceOrderId: numberOrNull('serviceOrderId'),
        contractId: numberOrNull('contractId'),
        orderedAt: dateOrNull('orderedAt'),
        documentCode: textOrNull('documentCode'),
        description: String(data.get('description') ?? '').trim(),
        notes: textOrNull('notes'),
        amountDue: Number(data.get('amountDue') || 0),
        registeredAt: dateOrNull('registeredAt'),
        dueAt: `${String(data.get('dueAt'))}T00:00:00`,
        costCenterId: numberOrNull('costCenterId'),
        subCostCenterId: numberOrNull('subCostCenterId'),
      },
    })
  }

  function submitSettlement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!settlementAccount) return
    const data = new FormData(event.currentTarget)
    settleMutation.mutate({
      id: settlementAccount.id, payload: {
        paidAt: `${String(data.get('paidAt'))}T00:00:00`,
        cashValue: paymentValues.cashValue, transferValue: paymentValues.transferValue, billValue: paymentValues.billValue,
        courtesyValue: 0, checkValue: 0, cardValue: 0,
        movementAccountId: Number(settlementMovement || suggestedMovementAccount(movementAccountsQuery.data, paymentMethod)),
        notes: String(data.get('notes') ?? '').trim() || null,
      },
    })
  }

  return <>
    <PageHeader eyebrow="Financeiro" title="Contas a pagar" subtitle="Despesas avulsas e contas geradas pelos pedidos de compra das ordens de serviço." actions={<><Button variant="secondary" icon={<FileText size={18} />} disabled={exportMutation.isPending} onClick={() => exportMutation.mutate()}>{exportMutation.isPending ? 'Exportando...' : 'Exportar Excel'}</Button><Button icon={<Plus size={18} />} onClick={openNew}>Nova conta</Button></>} />

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
        <table className="data-table payables-table"><thead><tr><th className="check-column"><input type="checkbox" aria-label="Marcar contas abertas da página" checked={accounts.some((row) => Number(row.balance) > 0) && accounts.filter((row) => Number(row.balance) > 0).every((row) => selection[row.id])} onChange={togglePage} /></th><th>Código</th><th>Descrição</th><th>Fornecedor</th><th>Pedido / OS</th><th>Vencimento</th><th>Pagamento</th><th className="num">Devido</th><th className="num">Pago</th><th className="num">Saldo</th><th>Situação</th><th /></tr></thead><tbody>{accounts.map((account) => <tr key={account.id} onClick={() => openEdit(account)}>
          <td className="check-column" onClick={(event) => event.stopPropagation()}><input type="checkbox" disabled={Number(account.balance) <= 0} checked={Boolean(selection[account.id])} onChange={() => toggle(account)} aria-label={`Marcar conta ${account.id}`} /></td>
          <td><strong>#{account.id}</strong></td><td><strong className="table-primary">{account.description || 'Sem descrição'}</strong>{account.invoiceNumber && <small className="table-secondary">NF {account.invoiceNumber}</small>}</td><td>{account.supplierName || 'Não informado'}</td>
          <td>{account.purchaseOrderId ? `Pedido #${account.purchaseOrderId}` : 'Avulsa'}{account.serviceOrderId ? <small className="table-secondary">OS #{account.serviceOrderId}</small> : null}</td>
          <td>{formatDate(account.dueAt)}</td><td>{account.paidAt ? formatDate(account.paidAt) : '—'}</td>
          <td className="num"><strong>{money(account.amountDue)}</strong></td><td className="num">{money(account.amountPaid)}</td><td className="num"><strong className={account.balance > 0 ? 'negative-value' : 'positive-value'}>{money(account.balance)}</strong></td>
          <td><Badge tone={statusTone(account)}>{statusLabel(account)}</Badge></td>
          <td><div className="row-actions">{account.balance > 0 && <button className="row-action row-action--success" onClick={(event) => { event.stopPropagation(); openSettlement(account) }} title="Dar baixa"><WalletCards size={16} /></button>}<button className="row-action" onClick={(event) => { event.stopPropagation(); openEdit(account) }} title="Alterar conta"><Edit3 size={16} /></button><button className="row-action row-action--danger" onClick={(event) => { event.stopPropagation(); setDeleteError(''); setAccountToDelete(account) }} title="Excluir conta"><Trash2 size={16} /></button></div></td>
        </tr>)}</tbody></table>
      </div>}
      <footer className="table-footer table-footer--pagination"><span>Mostrando <strong>{total === 0 ? 0 : page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong> contas</span><div className="pagination-controls"><label>Por página <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}>{[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label><button disabled={page === 0 || accountsQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft size={16} /></button><span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span><button disabled={page + 1 >= totalPages || accountsQuery.isFetching} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></button></div></footer>
    </section>

    <Modal open={modalOpen} onClose={() => !saveMutation.isPending && setModalOpen(false)} title={selected ? `Alterar conta a pagar #${selected.id}` : 'Inclusão de nova conta a pagar'} description="Dados do título, origem, vencimento e classificação financeira." size="xlarge">
      {selected && detailQuery.isLoading ? <LoadingState label="Carregando conta completa..." /> : <ModalForm key={`${editingAccount?.id ?? 'new'}-${detailQuery.dataUpdatedAt}`} onSubmit={submitAccount} onCancel={() => setModalOpen(false)} submitting={saveMutation.isPending} submitLabel={saveMutation.isPending ? 'Gravando...' : 'Salvar'} actions={selected && editingAccount ? <>
        {Number(editingAccount.balance) > 0 && <Button type="button" variant="secondary" icon={<WalletCards size={16} />} onClick={() => { setModalOpen(false); openSettlement(editingAccount) }}>Dar baixa</Button>}
        {Number(editingAccount.amountPaid) === 0 && <Button type="button" variant="secondary" icon={<SplitSquareHorizontal size={16} />} onClick={() => { setInstallmentError(''); setInstallmentTarget(editingAccount) }}>Gerar prestações</Button>}
      </> : undefined}>
        <FormError message={formError} />
        <div className="form-section-title"><span>1</span><div><strong>Documento e fornecedor</strong><small>Identificação principal da conta.</small></div></div>
        <div className="form-grid form-grid--two"><FormField label="Fornecedor"><SupplierPicker value={formSupplier} onChange={setFormSupplier} /></FormField><FormField label="Documento"><input name="documentCode" maxLength={50} defaultValue={editingAccount?.documentCode ?? ''} /></FormField></div>
        <div className="form-section-title"><span>2</span><div><strong>Origem do título</strong><small>Pedido de compra, nota fiscal, contrato e ordem de serviço.</small></div></div>
        <div className="form-grid form-grid--four"><FormField label="Nº pedido de compra"><input name="purchaseOrderId" type="number" min="1" defaultValue={editingAccount?.purchaseOrderId || ''} /></FormField><FormField label="Data do pedido"><input name="orderedAt" type="date" defaultValue={editingAccount?.orderedAt?.slice(0, 10) ?? ''} /></FormField><FormField label="Nota fiscal"><input name="invoiceNumber" maxLength={50} defaultValue={editingAccount?.invoiceNumber ?? ''} /></FormField><FormField label="Nº contrato"><input name="contractId" type="number" min="1" defaultValue={editingAccount?.contractId || ''} /></FormField><FormField label="Ordem de serviço"><input name="serviceOrderId" type="number" min="1" defaultValue={editingAccount?.serviceOrderId || ''} /></FormField></div>
        <div className="form-section-title"><span>3</span><div><strong>Descrição e valores</strong><small>Informações do lançamento e totalizadores.</small></div></div>
        <div className="form-grid form-grid--three"><FormField label="Descrição"><input name="description" required maxLength={100} defaultValue={editingAccount?.description ?? ''} /></FormField><FormField label="Data de cadastro"><input name="registeredAt" type="date" defaultValue={editingAccount?.registeredAt?.slice(0, 10) || todayIso()} /></FormField><FormField label="Vencimento"><input name="dueAt" required type="date" defaultValue={editingAccount?.dueAt?.slice(0, 10) ?? ''} /></FormField><FormField label="Valor devido"><input name="amountDue" required type="number" min="0.01" step="0.01" defaultValue={editingAccount?.amountDue ?? ''} /></FormField><FormField label="Valor pago"><input value={money(editingAccount?.amountPaid ?? 0)} disabled /></FormField><FormField label="Saldo"><input value={money(editingAccount?.balance ?? 0)} disabled /></FormField></div>
        <FormField label="Observação"><textarea name="notes" rows={3} maxLength={200} defaultValue={editingAccount?.notes ?? ''} /></FormField>
        <div className="form-section-title"><span>4</span><div><strong>Classificação financeira</strong><small>Centro e subcentro de despesas, conforme o que está sendo comprado.</small></div></div>
        <div className="form-grid form-grid--two"><FormField label="Centro de custo"><select name="costCenterId" value={formCostCenter} onChange={(event) => setFormCostCenter(event.target.value)}><option value="">Não informado</option>{centers.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.description}</option>)}</select></FormField><FormField label="Subcentro de custo"><select key={formCostCenter} name="subCostCenterId" defaultValue={editingAccount?.subCostCenterId ?? ''}><option value="">Não informado</option>{formSubCenters.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.description}</option>)}</select></FormField></div>
        {editingAccount && (editingAccount.payments?.length > 0 || legacySettlement) ? <section className="payable-payment-history"><h3>Histórico de baixas</h3>
          {editingAccount.payments.map((payment) => <article key={payment.id}><span><strong>{formatDate(payment.paidAt)} · {money(payment.totalValue)}</strong><small>{payment.movementAccountName || 'Conta de movimento não informada'}{payment.notes ? ` · ${payment.notes}` : ''}</small></span><button type="button" disabled={reverseMutation.isPending} onClick={() => reverseMutation.mutate({ id: editingAccount.id, paymentId: payment.id })}><Undo2 size={14} /> Excluir baixa</button></article>)}
          {legacySettlement && <article><span><strong>{formatDate(editingAccount.paidAt)} · {money(editingAccount.amountPaid)}</strong><small>Baixa registrada no sistema anterior{editingAccount.movementAccountName ? ` · ${editingAccount.movementAccountName}` : ''}</small></span><button type="button" disabled={reverseMutation.isPending} onClick={() => reverseMutation.mutate({ id: editingAccount.id })}><Undo2 size={14} /> Excluir baixa</button></article>}
        </section> : null}
        {selected && <div className="destructive-row"><span><strong>Excluir conta</strong><small>Contas com baixa ou ligadas a um pedido devem ser tratadas pela origem.</small></span><Button type="button" variant="danger" icon={<Trash2 size={16} />} onClick={() => { setDeleteError(''); setAccountToDelete(selected) }}>Excluir</Button></div>}
      </ModalForm>}
    </Modal>

    <Modal open={settlementAccount !== null} onClose={() => !settleMutation.isPending && setSettlementAccount(null)} title="Baixa de conta a pagar" description={settlementAccount?.description || `Conta #${settlementAccount?.id}`} size="large">
      <ModalForm onSubmit={submitSettlement} onCancel={() => setSettlementAccount(null)} submitting={settleMutation.isPending} submitLabel={settleMutation.isPending ? 'Efetuando...' : 'Efetuar pagamento'}>
        <FormError message={settlementError} />
        <div className="payable-settlement-summary"><span><small>Vencimento</small><strong>{formatDate(settlementAccount?.dueAt)}</strong></span><span><small>Devido</small><strong>{money(settlementAccount?.amountDue)}</strong></span><span><small>Pago</small><strong>{money(settlementAccount?.amountPaid)}</strong></span><span><small>Saldo</small><strong>{money(settlementAccount?.balance)}</strong></span></div>
        <div className="form-grid form-grid--four">
          <FormField label="Data do pagamento"><input name="paidAt" required type="date" defaultValue={todayIso()} /></FormField>
          <FormField label="Dinheiro"><input type="number" min="0" step="0.01" value={paymentValues.cashValue} onChange={(event) => setPaymentValues((current) => ({ ...current, cashValue: Number(event.target.value) }))} /></FormField>
          <FormField label="Transferência"><input type="number" min="0" step="0.01" value={paymentValues.transferValue} onChange={(event) => setPaymentValues((current) => ({ ...current, transferValue: Number(event.target.value) }))} /></FormField>
          <FormField label="Boleto"><input type="number" min="0" step="0.01" value={paymentValues.billValue} onChange={(event) => setPaymentValues((current) => ({ ...current, billValue: Number(event.target.value) }))} /></FormField>
          <FormField label="Total da baixa"><input value={money(paymentTotal)} readOnly /></FormField>
          <FormField label="Conta movimento"><select required value={settlementMovement || suggestedMovementAccount(movementAccountsQuery.data, paymentMethod)} onChange={(event) => setSettlementMovement(Number(event.target.value))}><option value="">Selecione</option>{movementAccountsQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</select></FormField>
        </div>
        {settlementAccount && paymentTotal > Number(settlementAccount.balance) + 0.001 && <FormError message="O total informado é maior que o saldo da conta." />}
        <FormField label="Observação da baixa"><textarea name="notes" rows={2} maxLength={300} /></FormField>
      </ModalForm>
    </Modal>

    <MultipleSettlementDialog key={multiOpen ? 'open' : 'closed'} open={multiOpen} title="Baixa múltipla de contas a pagar" count={selectedRows.length} total={selectedTotal} movementAccounts={movementAccountsQuery.data} busy={multiMutation.isPending} error={multiError} onClose={() => setMultiOpen(false)} onSubmit={(payload) => multiMutation.mutate({ ...payload, ids: selectedRows.map((row) => row.id) })} />
    {installmentTarget && !(installmentTarget.purchaseOrderId && purchaseGroupQuery.isLoading) && <InstallmentDialog key={`${installmentTarget.id}-${installmentTotal}`} open total={installmentTotal} dueDate={installmentTarget.dueAt?.slice(0, 10) ?? todayIso()} description={installmentTarget.purchaseOrderId ? `Pedido de compra #${installmentTarget.purchaseOrderId} · ${purchaseGroup.length > 1 ? `refaz as ${purchaseGroup.length} prestações atuais do pedido` : 'as prestações continuam vinculadas ao pedido'}` : `Conta #${installmentTarget.id} · ${installmentTarget.description ?? ''}`} busy={installmentMutation.isPending} error={installmentError} onClose={() => setInstallmentTarget(null)} onSubmit={(payload) => installmentMutation.mutate({ id: installmentTarget.id, payload })} />}
    <ConfirmDialog open={accountToDelete !== null} title={`Excluir conta #${accountToDelete?.id ?? ''}?`} description="A conta será removida somente se não possuir baixas nem vínculo ativo com pedido de compra." confirmLabel="Excluir conta" busy={deleteMutation.isPending} error={deleteError} onCancel={() => { setAccountToDelete(null); setDeleteError('') }} onConfirm={() => accountToDelete && deleteMutation.mutate(accountToDelete.id)} />
    {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
  </>
}

function overdue(account: PayableAccount) { return Number(account.balance) > 0 && Boolean(account.dueAt) && account.dueAt!.slice(0, 10) < todayIso() }
function statusLabel(account: PayableAccount) { return account.status === 'PAID' ? 'Quitada' : account.status === 'CLOSED' ? 'Fechada' : overdue(account) ? 'Vencida' : 'Aberta' }
function statusTone(account: PayableAccount): 'green' | 'orange' | 'neutral' | 'red' { return account.status === 'PAID' ? 'green' : account.status === 'CLOSED' ? 'neutral' : overdue(account) ? 'red' : 'orange' }
