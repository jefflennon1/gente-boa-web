import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, Edit3, FileText, HandCoins, ListChecks, Plus, ReceiptText, Search, SplitSquareHorizontal, Trash2, Undo2, WalletCards } from 'lucide-react'
import { useMemo, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { financeApi, financeKeys } from '../api/finance'
import { api, queryKeys } from '../api/services'
import { ClientPicker, type PickerValue } from '../components/AsyncPicker'
import { InstallmentDialog, MultipleSettlementDialog, suggestedMovementAccount } from '../components/FinanceDialogs'
import { Badge, Button, CollapsibleFilters, ConfirmDialog, EmptyState, ErrorState, FormError, FormField, LoadingState, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { downloadCsv, monthBounds, todayIso } from '../lib/export'
import { formatDate, money } from '../lib/format'
import { useRouter } from '../router'
import type { FinancialStatusFilter, Receivable, ReceivableListParams, ReceivablePayload } from '../types-finance'

type ToastState = { message: string; variant: 'success' | 'error' } | null
type DateField = NonNullable<ReceivableListParams['dateField']>

const originLabels: Record<Receivable['origin'], string> = { MANUAL: 'Manual', OS: 'OS', CONTRATO: 'Contrato', ISS: 'ISS retido' }

export function AccountsReceivable() {
  const queryClient = useQueryClient()
  const { search: routeSearch } = useRouter()
  const routeParams = new URLSearchParams(routeSearch)
  const routeClientId = routeParams.get('clientId')
  const initialPeriod = useMemo(() => monthBounds(), [])
  const [search, setSearch] = useState('')
  const [client, setClient] = useState<PickerValue>(routeClientId ? { id: Number(routeClientId), label: `Cliente #${routeClientId}` } : null)
  const [receivableId, setReceivableId] = useState('')
  const [billNumber, setBillNumber] = useState('')
  const [serviceOrderId, setServiceOrderId] = useState('')
  const [dateField, setDateField] = useState<DateField>('DUE_DATE')
  const [startDate, setStartDate] = useState(routeClientId ? '' : initialPeriod.start)
  const [endDate, setEndDate] = useState(routeClientId ? '' : initialPeriod.end)
  const [status, setStatus] = useState<FinancialStatusFilter>('OPEN')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [costCenterId, setCostCenterId] = useState('')
  const [subCostCenterId, setSubCostCenterId] = useState('')
  const [billingType, setBillingType] = useState<'ALL' | 'CONTRACT' | 'ONE_OFF'>('ALL')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [selection, setSelection] = useState<Record<number, Receivable>>({})
  const [multiOpen, setMultiOpen] = useState(false)
  const [multiError, setMultiError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [selected, setSelected] = useState<Receivable | null>(null)
  const [formClient, setFormClient] = useState<PickerValue>(null)
  const [formCostCenter, setFormCostCenter] = useState('')
  const [formError, setFormError] = useState('')
  const [settlement, setSettlement] = useState<Receivable | null>(null)
  const [settlementValues, setSettlementValues] = useState({ cashValue: 0, transferValue: 0, billValue: 0 })
  const [settlementAccount, setSettlementAccount] = useState<number | ''>('')
  const [settlementError, setSettlementError] = useState('')
  const [installmentTarget, setInstallmentTarget] = useState<Receivable | null>(null)
  const [installmentError, setInstallmentError] = useState('')
  const [toDelete, setToDelete] = useState<Receivable | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [toast, setToast] = useState<ToastState>(null)
  const debouncedSearch = useDebouncedValue(search.trim())

  const filters: ReceivableListParams = {
    query: debouncedSearch || undefined,
    clientId: client?.id,
    receivableId: receivableId ? Number(receivableId) : undefined,
    billNumber: billNumber ? Number(billNumber) : undefined,
    serviceOrderId: serviceOrderId ? Number(serviceOrderId) : undefined,
    dateField,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    status,
    minAmount: minAmount ? Number(minAmount) : undefined,
    maxAmount: maxAmount ? Number(maxAmount) : undefined,
    costCenterId: costCenterId ? Number(costCenterId) : undefined,
    subCostCenterId: subCostCenterId ? Number(subCostCenterId) : undefined,
    billingType,
  }
  const listQuery = useQuery({
    queryKey: [...financeKeys.receivables, 'list', filters, page, pageSize],
    queryFn: () => financeApi.receivables.list({ ...filters, sortBy: dateField === 'RECEIPT_DATE' ? 'RECEIPT_DATE' : 'DUE_DATE', direction: status === 'PAID' ? 'DESC' : 'ASC', page, size: pageSize }),
    placeholderData: keepPreviousData,
  })
  const summaryQuery = useQuery({ queryKey: [...financeKeys.receivables, 'summary', filters], queryFn: () => financeApi.receivables.summary(filters), placeholderData: keepPreviousData })
  const costCentersQuery = useQuery({ queryKey: [...financeKeys.costCenters, 'Receitas'], queryFn: () => financeApi.costCenters.list('Receitas') })
  const movementAccountsQuery = useQuery({ queryKey: [...queryKeys.payables, 'movement-accounts'], queryFn: () => api.payables.movementAccounts() })
  const detailQuery = useQuery({ queryKey: [...financeKeys.receivables, 'detail', selected?.id], queryFn: () => financeApi.receivables.find(selected!.id), enabled: formOpen && selected !== null })

  const rows = listQuery.data?.content ?? []
  const total = listQuery.data?.total ?? 0
  const totalPages = listQuery.data?.totalPages ?? 0
  const summary = summaryQuery.data
  const editing = detailQuery.data ?? selected
  const selectedRows = Object.values(selection)
  const selectedTotal = selectedRows.reduce((sum, row) => sum + Number(row.balance || 0), 0)
  const centers = costCentersQuery.data ?? []
  const filterSubCenters = centers.find((center) => String(center.id) === costCenterId)?.subCenters ?? centers.flatMap((center) => center.subCenters)
  const formSubCenters = centers.find((center) => String(center.id) === formCostCenter)?.subCenters ?? []
  const activeFilters = [search, client, receivableId, billNumber, serviceOrderId, startDate, endDate, minAmount, maxAmount, costCenterId, subCostCenterId].filter(Boolean).length + (status !== 'ALL' ? 1 : 0) + (billingType !== 'ALL' ? 1 : 0)

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: financeKeys.receivables }),
      queryClient.invalidateQueries({ queryKey: queryKeys.accountsReceivable }),
      queryClient.invalidateQueries({ queryKey: queryKeys.bills }),
      queryClient.invalidateQueries({ queryKey: financeKeys.cash }),
    ])
  }
  function showToast(message: string, variant: 'success' | 'error' = 'success') {
    setToast({ message, variant })
    window.setTimeout(() => setToast(null), variant === 'error' ? 6000 : 3200)
  }
  function resetPage() { setPage(0); setSelection({}) }

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: ReceivablePayload }) => id ? financeApi.receivables.update(id, payload) : financeApi.receivables.create(payload),
    onSuccess: async (_, variables) => { await invalidate(); setFormOpen(false); setSelected(null); showToast(variables.id ? 'Conta atualizada.' : 'Conta cadastrada.') },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })
  const settleMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof financeApi.receivables.settle>[1] }) => financeApi.receivables.settle(id, payload),
    onSuccess: async () => { await invalidate(); setSettlement(null); showToast('Recebimento registrado.') },
    onError: (error) => setSettlementError(apiErrorMessage(error)),
  })
  const multiMutation = useMutation({
    mutationFn: financeApi.receivables.settleMultiple,
    onSuccess: async (result) => { await invalidate(); setMultiOpen(false); setSelection({}); showToast(`${result.count} conta(s) baixada(s) · ${money(result.totalAmount)}.`) },
    onError: (error) => setMultiError(apiErrorMessage(error)),
  })
  const reverseMutation = useMutation({
    mutationFn: ({ id, paymentId }: { id: number; paymentId?: number }) => paymentId ? financeApi.receivables.reversePayment(id, paymentId) : financeApi.receivables.reverseLegacySettlement(id),
    onSuccess: async () => { await invalidate(); showToast('Recebimento estornado e saldo recalculado.') },
    onError: (error) => showToast(apiErrorMessage(error), 'error'),
  })
  const installmentMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof financeApi.receivables.installments>[1] }) => financeApi.receivables.installments(id, payload),
    onSuccess: async (result) => { await invalidate(); setInstallmentTarget(null); setFormOpen(false); showToast(`${result.length} lançamentos gerados.`) },
    onError: (error) => setInstallmentError(apiErrorMessage(error)),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => financeApi.receivables.remove(id),
    onSuccess: async () => { await invalidate(); setToDelete(null); setFormOpen(false); showToast('Conta excluída.') },
    onError: (error) => setDeleteError(apiErrorMessage(error)),
  })
  const receiptMutation = useMutation({
    mutationFn: (id: number) => financeApi.receivables.receipt(id),
    onSuccess: (blob) => { const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener'); window.setTimeout(() => URL.revokeObjectURL(url), 60_000) },
    onError: (error) => showToast(apiErrorMessage(error), 'error'),
  })
  const exportMutation = useMutation({
    mutationFn: async () => {
      const result = await financeApi.receivables.list({ ...filters, page: 0, size: 100 })
      const all = [...result.content]
      for (let index = 1; index < Math.min(result.totalPages, 50); index++) all.push(...(await financeApi.receivables.list({ ...filters, page: index, size: 100 })).content)
      return all
    },
    onSuccess: (all) => downloadCsv('contas-a-receber', ['Código', 'Cliente', 'Descrição', 'OS', 'Boleto', 'Cadastro', 'Vencimento', 'Recebimento', 'Devido', 'Recebido', 'Saldo', 'Situação', 'Centro', 'Subcentro'], all.map((row) => [row.id, row.clientTradeName || row.clientName, row.description, row.serviceOrderId, row.billNumber, formatDate(row.createdAt), formatDate(row.dueAt), row.receivedAt ? formatDate(row.receivedAt) : '', row.amount, row.receivedAmount, row.balance, row.status === 'PAID' ? 'Quitada' : row.overdue ? 'Vencida' : 'Aberta', row.costCenterName, row.subCostCenterName])),
    onError: (error) => showToast(apiErrorMessage(error), 'error'),
  })

  function openNew() { setSelected(null); setFormClient(client); setFormCostCenter(''); setFormError(''); setFormOpen(true) }
  function openEdit(row: Receivable) {
    setSelected(row)
    setFormClient(row.clientId ? { id: row.clientId, label: `${row.clientTradeName || row.clientName || 'Cliente'} · #${row.clientId}` } : null)
    setFormCostCenter(row.costCenterId ? String(row.costCenterId) : '')
    setFormError('')
    setFormOpen(true)
  }
  function openSettlement(row: Receivable) {
    setSettlement(row)
    setSettlementValues({ cashValue: 0, transferValue: Math.abs(Number(row.balance || 0)), billValue: 0 })
    setSettlementAccount('')
    setSettlementError('')
  }
  function toggle(row: Receivable) {
    setSelection((current) => {
      const copy = { ...current }
      if (copy[row.id]) delete copy[row.id]
      else copy[row.id] = row
      return copy
    })
  }
  function togglePage() {
    const open = rows.filter((row) => row.status === 'OPEN')
    const all = open.length > 0 && open.every((row) => selection[row.id])
    setSelection((current) => {
      const copy = { ...current }
      open.forEach((row) => { if (all) delete copy[row.id]; else copy[row.id] = row })
      return copy
    })
  }

  function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!formClient) { setFormError('Selecione o cliente.'); return }
    const data = new FormData(event.currentTarget)
    const numberOrNull = (name: string) => String(data.get(name) ?? '').trim() === '' ? null : Number(data.get(name))
    const textOrNull = (name: string) => String(data.get(name) ?? '').trim() || null
    saveMutation.mutate({
      id: selected?.id, payload: {
        clientId: formClient.id,
        description: String(data.get('description') ?? '').trim(),
        amount: Number(data.get('amount')),
        dueAt: `${String(data.get('dueAt'))}T00:00:00`,
        registeredAt: data.get('registeredAt') ? `${String(data.get('registeredAt'))}T00:00:00` : null,
        invoiceNumber: textOrNull('invoiceNumber'),
        serviceOrderId: numberOrNull('serviceOrderId'),
        contractId: numberOrNull('contractId'),
        notes: textOrNull('notes'),
        costCenterId: numberOrNull('costCenterId'),
        subCostCenterId: numberOrNull('subCostCenterId'),
      },
    })
  }

  function submitSettlement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!settlement) return
    const data = new FormData(event.currentTarget)
    const method = settlementValues.cashValue > 0 && settlementValues.transferValue + settlementValues.billValue === 0 ? 'CASH' : 'TRANSFER'
    settleMutation.mutate({
      id: settlement.id, payload: {
        paidAt: `${String(data.get('paidAt'))}T00:00:00`,
        ...settlementValues,
        movementAccountId: Number(settlementAccount || suggestedMovementAccount(movementAccountsQuery.data, method)),
        notes: String(data.get('notes') ?? '').trim() || null,
      },
    })
  }

  const settlementTotal = settlementValues.cashValue + settlementValues.transferValue + settlementValues.billValue
  const settlementMethod = settlementValues.cashValue > 0 && settlementValues.transferValue + settlementValues.billValue === 0 ? 'CASH' : 'TRANSFER'

  return <>
    <PageHeader eyebrow="Financeiro" title="Contas a receber" subtitle="Inclusão, baixa, baixa múltipla, prestações e recibos das contas a receber." actions={<><Button variant="secondary" icon={<FileText size={18} />} disabled={exportMutation.isPending} onClick={() => exportMutation.mutate()}>{exportMutation.isPending ? 'Exportando...' : 'Exportar Excel'}</Button><Button icon={<Plus size={18} />} onClick={openNew}>Nova conta</Button></>} />

    <section className="stats-grid stats-grid--four">
      <StatCard label="Valor devido" value={money(summary?.amountDue)} helper={`${(summary?.count ?? 0).toLocaleString('pt-BR')} contas no filtro`} icon={<CircleDollarSign />} tone="blue" />
      <StatCard label="Valor recebido" value={money(summary?.amountPaid)} helper={`${(summary?.paidCount ?? 0).toLocaleString('pt-BR')} quitadas`} icon={<Banknote />} tone="green" />
      <StatCard label="Saldo a receber" value={money(summary?.balance)} helper={`${(summary?.openCount ?? 0).toLocaleString('pt-BR')} em aberto`} icon={<HandCoins />} tone="orange" />
      <StatCard label="Vencidas" value={money(summary?.overdueBalance)} helper={`${(summary?.overdueCount ?? 0).toLocaleString('pt-BR')} contas vencidas`} icon={<CalendarDays />} tone="purple" />
    </section>

    <section className="panel data-panel">
      <CollapsibleFilters summary="Cliente, período, boleto, nº CR, valor, centro e subcentro" activeCount={activeFilters} onClear={() => { setSearch(''); setClient(null); setReceivableId(''); setBillNumber(''); setServiceOrderId(''); setStartDate(''); setEndDate(''); setStatus('ALL'); setMinAmount(''); setMaxAmount(''); setCostCenterId(''); setSubCostCenterId(''); setBillingType('ALL'); resetPage() }} contentClassName="finance-filters">
        <label className="finance-filters__wide"><span>Busca</span><div className="search-box"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); resetPage() }} placeholder="Descrição, cliente, código, boleto ou OS..." /></div></label>
        <label className="finance-filters__wide"><span>Cliente</span><ClientPicker value={client} onChange={(value) => { setClient(value); resetPage() }} /></label>
        <label><span>Nº CR</span><input type="number" min="1" value={receivableId} onChange={(event) => { setReceivableId(event.target.value); resetPage() }} /></label>
        <label><span>Boleto</span><input type="number" min="1" value={billNumber} onChange={(event) => { setBillNumber(event.target.value); resetPage() }} /></label>
        <label><span>OS</span><input type="number" min="1" value={serviceOrderId} onChange={(event) => { setServiceOrderId(event.target.value); resetPage() }} /></label>
        <label><span>Data de</span><select value={dateField} onChange={(event) => { setDateField(event.target.value as DateField); resetPage() }}><option value="DUE_DATE">Vencimento</option><option value="RECEIPT_DATE">Recebimento</option><option value="REGISTRATION_DATE">Cadastro</option></select></label>
        <label><span>De</span><input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); resetPage() }} /></label>
        <label><span>Até</span><input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); resetPage() }} /></label>
        <label><span>Situação</span><select value={status} onChange={(event) => { setStatus(event.target.value as FinancialStatusFilter); resetPage() }}><option value="OPEN">Em aberto</option><option value="OVERDUE">Vencidas</option><option value="PAID">Quitadas</option><option value="ALL">Todas</option></select></label>
        <label><span>Valor mínimo</span><input type="number" step="0.01" value={minAmount} onChange={(event) => { setMinAmount(event.target.value); resetPage() }} /></label>
        <label><span>Valor máximo</span><input type="number" step="0.01" value={maxAmount} onChange={(event) => { setMaxAmount(event.target.value); resetPage() }} /></label>
        <label><span>Centro de custo</span><select value={costCenterId} onChange={(event) => { setCostCenterId(event.target.value); setSubCostCenterId(''); resetPage() }}><option value="">Todos</option>{centers.map((center) => <option key={center.id} value={center.id}>{center.id} · {center.description}</option>)}</select></label>
        <label><span>Subcentro</span><select value={subCostCenterId} onChange={(event) => { setSubCostCenterId(event.target.value); resetPage() }}><option value="">Todos</option>{filterSubCenters.map((sub) => <option key={sub.id} value={sub.id}>{sub.id} · {sub.description}</option>)}</select></label>
        <label><span>Faturamento</span><select value={billingType} onChange={(event) => { setBillingType(event.target.value as typeof billingType); resetPage() }}><option value="ALL">Todos</option><option value="CONTRACT">Contratados</option><option value="ONE_OFF">Avulsos</option></select></label>
      </CollapsibleFilters>

      {selectedRows.length > 0 && <div className="selection-bar"><span><ListChecks size={18} /><strong>{selectedRows.length}</strong> conta(s) marcada(s) · saldo {money(selectedTotal)}</span><div><Button variant="ghost" onClick={() => setSelection({})}>Limpar</Button><Button icon={<WalletCards size={16} />} onClick={() => { setMultiError(''); setMultiOpen(true) }}>Baixa múltipla</Button></div></div>}

      {listQuery.isLoading ? <LoadingState label="Carregando contas a receber..." /> : listQuery.isError ? <ErrorState message={apiErrorMessage(listQuery.error)} onRetry={() => listQuery.refetch()} /> : rows.length === 0 ? <EmptyState title="Nenhuma conta encontrada" description="Altere os filtros ou cadastre uma nova conta a receber." /> : <div className={`table-wrap ${listQuery.isFetching ? 'table-wrap--refreshing' : ''}`}>
        <table className="data-table finance-table"><thead><tr><th className="check-column"><input type="checkbox" aria-label="Marcar contas abertas da página" checked={rows.some((row) => row.status === 'OPEN') && rows.filter((row) => row.status === 'OPEN').every((row) => selection[row.id])} onChange={togglePage} /></th><th>Código</th><th>Cliente / descrição</th><th>Origem</th><th>Vencimento</th><th>Recebimento</th><th className="num">Devido</th><th className="num">Recebido</th><th className="num">Saldo</th><th>Situação</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id} onClick={() => openEdit(row)}>
          <td className="check-column" onClick={(event) => event.stopPropagation()}><input type="checkbox" disabled={row.status !== 'OPEN'} checked={Boolean(selection[row.id])} onChange={() => toggle(row)} aria-label={`Marcar conta ${row.id}`} /></td>
          <td><strong>#{row.id}</strong>{row.billNumber && <small className="table-secondary">Boleto {row.billNumber}</small>}</td>
          <td><strong className="table-primary">{row.clientTradeName || row.clientName || 'Cliente não informado'}</strong><small className="table-secondary">{row.description || 'Sem descrição'}</small></td>
          <td><Badge tone={row.origin === 'MANUAL' ? 'neutral' : row.origin === 'CONTRATO' ? 'purple' : 'blue'}>{originLabels[row.origin]}</Badge>{row.serviceOrderId && <small className="table-secondary">OS #{row.serviceOrderId}</small>}</td>
          <td>{formatDate(row.dueAt)}</td><td>{row.receivedAt ? formatDate(row.receivedAt) : '—'}</td>
          <td className="num"><strong>{money(row.amount)}</strong></td><td className="num">{money(row.receivedAmount)}</td>
          <td className="num"><strong className={row.balance !== 0 ? 'negative-value' : 'positive-value'}>{money(row.balance)}</strong></td>
          <td><Badge tone={row.status === 'PAID' ? 'green' : row.overdue ? 'red' : 'orange'}>{row.status === 'PAID' ? 'Quitada' : row.overdue ? 'Vencida' : 'Aberta'}</Badge></td>
          <td><div className="row-actions">
            {row.status === 'OPEN' && <button className="row-action row-action--success" onClick={(event) => { event.stopPropagation(); openSettlement(row) }} title="Dar baixa"><WalletCards size={16} /></button>}
            {row.receivedAmount !== 0 && <button className="row-action" onClick={(event) => { event.stopPropagation(); receiptMutation.mutate(row.id) }} title="Recibo"><ReceiptText size={16} /></button>}
            <button className="row-action" onClick={(event) => { event.stopPropagation(); openEdit(row) }} title="Alterar"><Edit3 size={16} /></button>
          </div></td>
        </tr>)}</tbody></table>
      </div>}
      <footer className="table-footer table-footer--pagination"><span>Mostrando <strong>{total === 0 ? 0 : page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong> contas</span><div className="pagination-controls"><label>Por página <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}>{[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label><button disabled={page === 0 || listQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft size={16} /></button><span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span><button disabled={page + 1 >= totalPages || listQuery.isFetching} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></button></div></footer>
    </section>

    <Modal open={formOpen} onClose={() => !saveMutation.isPending && setFormOpen(false)} title={selected ? `Conta a receber #${selected.id}` : 'Inclusão de nova conta a receber'} description={selected ? `Origem: ${originLabels[selected.origin]}${selected.managedBySystem ? ' · valor e cliente são mantidos pela origem' : ''}` : 'Use valor negativo para lançar ajustes (CR negativa) e conferir com o extrato do banco.'} size="xlarge">
      {selected && detailQuery.isLoading ? <LoadingState label="Carregando conta..." /> : <ModalForm key={`${editing?.id ?? 'new'}-${detailQuery.dataUpdatedAt}`} onSubmit={submitForm} onCancel={() => setFormOpen(false)} submitting={saveMutation.isPending} submitLabel={saveMutation.isPending ? 'Gravando...' : 'Salvar'} actions={editing && selected ? <>
        {editing.status === 'OPEN' && <Button type="button" variant="secondary" icon={<WalletCards size={16} />} onClick={() => { setFormOpen(false); openSettlement(editing) }}>Dar baixa</Button>}
        {editing.status === 'OPEN' && editing.receivedAmount === 0 && !editing.billNumber && !editing.managedBySystem && editing.amount > 0 && <Button type="button" variant="secondary" icon={<SplitSquareHorizontal size={16} />} onClick={() => { setInstallmentError(''); setInstallmentTarget(editing) }}>Gerar prestações</Button>}
        {editing.receivedAmount !== 0 && <Button type="button" variant="secondary" icon={<ReceiptText size={16} />} onClick={() => receiptMutation.mutate(editing.id)}>Recibo</Button>}
      </> : undefined}>
        <FormError message={formError} />
        <div className="form-section-title"><span>1</span><div><strong>Cliente e descrição</strong><small>Identificação da conta.</small></div></div>
        <div className="form-grid form-grid--two">
          <FormField label="Cliente"><ClientPicker value={formClient} onChange={setFormClient} disabled={Boolean(editing?.managedBySystem || editing?.billNumber)} /></FormField>
          <FormField label="Descrição"><input name="description" required maxLength={100} defaultValue={editing?.description ?? ''} /></FormField>
        </div>
        <div className="form-section-title"><span>2</span><div><strong>Valores e datas</strong><small>Valor devido, vencimento e documentos.</small></div></div>
        <div className="form-grid form-grid--four">
          <FormField label="Valor devido" hint="Negativo para ajuste/débito"><input name="amount" type="number" step="0.01" required defaultValue={editing?.amount ?? ''} disabled={Boolean(editing?.managedBySystem || editing?.billNumber)} /></FormField>
          {(editing?.managedBySystem || editing?.billNumber) && <input type="hidden" name="amount" value={editing?.amount ?? 0} />}
          <FormField label="Vencimento"><input name="dueAt" type="date" required defaultValue={editing?.dueAt?.slice(0, 10) ?? ''} /></FormField>
          <FormField label="Cadastro"><input name="registeredAt" type="date" defaultValue={editing?.createdAt?.slice(0, 10) ?? todayIso()} /></FormField>
          <FormField label="Nota fiscal"><input name="invoiceNumber" maxLength={50} defaultValue={editing?.invoiceNumber ?? ''} /></FormField>
          <FormField label="Ordem de serviço"><input name="serviceOrderId" type="number" min="1" defaultValue={editing?.serviceOrderId ?? ''} /></FormField>
          <FormField label="Contrato"><input name="contractId" type="number" min="1" defaultValue={editing?.contractId ?? ''} /></FormField>
          <FormField label="Recebido"><input value={money(editing?.receivedAmount ?? 0)} disabled /></FormField>
          <FormField label="Saldo"><input value={money(editing?.balance ?? 0)} disabled /></FormField>
        </div>
        <div className="form-section-title"><span>3</span><div><strong>Classificação financeira</strong><small>Centro e subcentro de receitas.</small></div></div>
        <div className="form-grid form-grid--two">
          <FormField label="Centro de custo"><select name="costCenterId" value={formCostCenter} onChange={(event) => setFormCostCenter(event.target.value)}><option value="">Não informado</option>{centers.map((center) => <option key={center.id} value={center.id}>{center.id} · {center.description}</option>)}</select></FormField>
          <FormField label="Subcentro de custo"><select name="subCostCenterId" defaultValue={editing?.subCostCenterId ?? ''} key={formCostCenter}><option value="">Não informado</option>{formSubCenters.map((sub) => <option key={sub.id} value={sub.id}>{sub.id} · {sub.description}</option>)}</select></FormField>
        </div>
        <FormField label="Observação"><textarea name="notes" rows={2} maxLength={200} defaultValue={editing?.notes ?? ''} /></FormField>
        {editing && (editing.payments.length > 0 || editing.legacySettlement) && <section className="payable-payment-history"><h3>Recebimentos</h3>
          {editing.payments.map((payment) => <article key={payment.id}><span><strong>{formatDate(payment.paidAt)} · {money(payment.totalValue)}</strong><small>{[payment.cashValue ? `Dinheiro ${money(payment.cashValue)}` : null, payment.transferValue ? `Transferência ${money(payment.transferValue)}` : null, payment.billValue ? `Boleto ${money(payment.billValue)}` : null, payment.movementAccountName, payment.notes].filter(Boolean).join(' · ')}</small></span><button type="button" disabled={reverseMutation.isPending} onClick={() => reverseMutation.mutate({ id: editing.id, paymentId: payment.id })}><Undo2 size={14} /> Estornar</button></article>)}
          {editing.legacySettlement && <article><span><strong>{formatDate(editing.receivedAt)} · {money(editing.receivedAmount)}</strong><small>Baixa registrada no sistema anterior{editing.paymentMethodDescription ? ` · ${editing.paymentMethodDescription}` : ''}{editing.movementAccountName ? ` · ${editing.movementAccountName}` : ''}</small></span><button type="button" disabled={reverseMutation.isPending} onClick={() => reverseMutation.mutate({ id: editing.id })}><Undo2 size={14} /> Estornar</button></article>}
        </section>}
        {selected && !selected.managedBySystem && !selected.billNumber && <div className="destructive-row"><span><strong>Excluir conta</strong><small>Somente contas sem recebimento e sem boleto.</small></span><Button type="button" variant="danger" icon={<Trash2 size={16} />} onClick={() => { setDeleteError(''); setToDelete(selected) }}>Excluir</Button></div>}
      </ModalForm>}
    </Modal>

    <Modal open={settlement !== null} onClose={() => !settleMutation.isPending && setSettlement(null)} title={`Baixa da conta a receber #${settlement?.id ?? ''}`} description={`${settlement?.clientTradeName || settlement?.clientName || ''} · ${settlement?.description || ''}`} size="large">
      <ModalForm onSubmit={submitSettlement} onCancel={() => setSettlement(null)} submitting={settleMutation.isPending} submitLabel={settleMutation.isPending ? 'Registrando...' : 'Efetuar recebimento'}>
        <FormError message={settlementError} />
        <div className="payable-settlement-summary"><span><small>Vencimento</small><strong>{formatDate(settlement?.dueAt)}</strong></span><span><small>Devido</small><strong>{money(settlement?.amount)}</strong></span><span><small>Recebido</small><strong>{money(settlement?.receivedAmount)}</strong></span><span><small>Saldo</small><strong>{money(settlement?.balance)}</strong></span></div>
        {settlement && settlement.balance < 0 && <p className="finance-dialog__hint">Conta negativa (ajuste): informe o valor positivo; o sistema aplica o sinal automaticamente.</p>}
        <div className="form-grid form-grid--four">
          <FormField label="Data do recebimento"><input name="paidAt" type="date" required defaultValue={todayIso()} /></FormField>
          <FormField label="Dinheiro"><input type="number" min="0" step="0.01" value={settlementValues.cashValue} onChange={(event) => setSettlementValues((current) => ({ ...current, cashValue: Number(event.target.value) }))} /></FormField>
          <FormField label="Transferência"><input type="number" min="0" step="0.01" value={settlementValues.transferValue} onChange={(event) => setSettlementValues((current) => ({ ...current, transferValue: Number(event.target.value) }))} /></FormField>
          <FormField label="Boleto"><input type="number" min="0" step="0.01" value={settlementValues.billValue} onChange={(event) => setSettlementValues((current) => ({ ...current, billValue: Number(event.target.value) }))} /></FormField>
          <FormField label="Total"><input value={money(settlementTotal)} readOnly /></FormField>
          <FormField label="Conta movimento"><select required value={settlementAccount || suggestedMovementAccount(movementAccountsQuery.data, settlementMethod)} onChange={(event) => setSettlementAccount(Number(event.target.value))}><option value="">Selecione</option>{movementAccountsQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</select></FormField>
        </div>
        {settlement && settlementTotal > Math.abs(Number(settlement.balance)) + 0.001 && <FormError message="O total informado é maior que o saldo da conta." />}
        <FormField label="Observação"><textarea name="notes" rows={2} maxLength={300} /></FormField>
      </ModalForm>
    </Modal>

    <MultipleSettlementDialog key={multiOpen ? 'open' : 'closed'} open={multiOpen} title="Baixa múltipla de contas a receber" count={selectedRows.length} total={selectedTotal} movementAccounts={movementAccountsQuery.data} busy={multiMutation.isPending} error={multiError} onClose={() => setMultiOpen(false)} onSubmit={(payload) => multiMutation.mutate({ ...payload, ids: selectedRows.map((row) => row.id) })} />
    {installmentTarget && <InstallmentDialog open total={installmentTarget.amount} dueDate={installmentTarget.dueAt?.slice(0, 10) ?? todayIso()} description={`Conta #${installmentTarget.id} · ${installmentTarget.description ?? ''}`} busy={installmentMutation.isPending} error={installmentError} onClose={() => setInstallmentTarget(null)} onSubmit={(payload) => installmentMutation.mutate({ id: installmentTarget.id, payload })} />}
    <ConfirmDialog open={toDelete !== null} title={`Excluir conta #${toDelete?.id ?? ''}?`} description="A conta será removida somente se não possuir recebimentos nem boleto." confirmLabel="Excluir conta" busy={deleteMutation.isPending} error={deleteError} onCancel={() => setToDelete(null)} onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)} />
    {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
  </>
}
