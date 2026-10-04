import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, Edit3, HandCoins, Plus, Search, Trash2, WalletCards } from 'lucide-react'
import { useMemo, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { api, queryKeys } from '../api/services'
import { Badge, Button, CollapsibleFilters, ConfirmDialog, EmptyState, ErrorState, FormError, FormField, LoadingState, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { formatDate, money } from '../lib/format'
import { useRouter } from '../router'
import type { PayableAccount, PayableAccountPayload, PayableDateField, PayablePaymentPayload, PayableStatus, Supplier } from '../types'

type ToastState = { message: string; variant: 'success' | 'error' } | null
type PaymentValues = Pick<PayablePaymentPayload, 'cashValue' | 'courtesyValue' | 'checkValue' | 'cardValue' | 'transferValue' | 'billValue'>

const emptyPayment: PaymentValues = { cashValue: 0, courtesyValue: 0, checkValue: 0, cardValue: 0, transferValue: 0, billValue: 0 }

export function AccountsPayable() {
  const queryClient = useQueryClient()
  const { search: routeSearch } = useRouter()
  const routeParams = new URLSearchParams(routeSearch)
  const routeSupplierId = routeParams.get('supplierId')
  const routePayableId = routeParams.get('payableId')
  const initialPeriod = useMemo(currentMonthPeriod, [])
  const [search, setSearch] = useState(routePayableId || '')
  const [supplierId, setSupplierId] = useState(routeSupplierId || '')
  const [startDate, setStartDate] = useState(routeSupplierId || routePayableId ? '' : initialPeriod.start)
  const [endDate, setEndDate] = useState(routeSupplierId || routePayableId ? '' : initialPeriod.end)
  const [dateField, setDateField] = useState<PayableDateField>('DUE_DATE')
  const [status, setStatus] = useState<'ALL' | PayableStatus>(routePayableId ? 'ALL' : 'OPEN')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<PayableAccount | null>(null)
  const [formSupplierSearch, setFormSupplierSearch] = useState('')
  const [formError, setFormError] = useState('')
  const [accountToDelete, setAccountToDelete] = useState<PayableAccount | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [settlementAccount, setSettlementAccount] = useState<PayableAccount | null>(null)
  const [paymentValues, setPaymentValues] = useState<PaymentValues>(emptyPayment)
  const [settlementError, setSettlementError] = useState('')
  const [toast, setToast] = useState<ToastState>(null)
  const debouncedSearch = useDebouncedValue(search.trim())
  const debouncedSupplierSearch = useDebouncedValue(formSupplierSearch.trim())

  const accountsQuery = useQuery({
    queryKey: [...queryKeys.payables, 'list', debouncedSearch, supplierId, startDate, endDate, dateField, status, page, pageSize],
    queryFn: () => api.payables.list({ query: debouncedSearch || undefined, supplierId: supplierId ? Number(supplierId) : undefined, startDate: startDate || undefined, endDate: endDate || undefined, dateField, status, page, size: pageSize }),
    placeholderData: keepPreviousData,
  })
  const filterSuppliersQuery = useQuery({ queryKey: [...queryKeys.suppliers, 'payable-filter'], queryFn: () => api.suppliers.list({ page: 0, size: 100 }) })
  const formSuppliersQuery = useQuery({ queryKey: [...queryKeys.suppliers, 'payable-form', debouncedSupplierSearch], queryFn: () => api.suppliers.list({ query: debouncedSupplierSearch || undefined, page: 0, size: 50 }), enabled: modalOpen })
  const costCentersQuery = useQuery({ queryKey: [...queryKeys.payables, 'cost-centers'], queryFn: () => api.payables.costCenters() })
  const subCostCentersQuery = useQuery({ queryKey: [...queryKeys.payables, 'sub-cost-centers'], queryFn: () => api.payables.subCostCenters() })
  const movementAccountsQuery = useQuery({ queryKey: [...queryKeys.payables, 'movement-accounts'], queryFn: () => api.payables.movementAccounts() })
  const detailQuery = useQuery({ queryKey: [...queryKeys.payables, 'detail', selected?.id], queryFn: () => api.payables.find(selected!.id), enabled: modalOpen && selected !== null })

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
    onSuccess: async () => { await invalidate(); setSettlementAccount(null); setPaymentValues(emptyPayment); showToast('Baixa registrada com sucesso.') },
    onError: (error) => setSettlementError(apiErrorMessage(error)),
  })
  const reverseMutation = useMutation({
    mutationFn: ({ id, paymentId }: { id: number; paymentId: number }) => api.payables.reversePayment(id, paymentId),
    onSuccess: async () => { await invalidate(); await detailQuery.refetch(); showToast('Baixa excluída e saldo recalculado.') },
    onError: (error) => showToast(apiErrorMessage(error), 'error'),
  })

  const accounts = accountsQuery.data?.content ?? []
  const total = accountsQuery.data?.total ?? 0
  const totalPages = accountsQuery.data?.totalPages ?? 0
  const firstResult = total === 0 ? 0 : page * pageSize + 1
  const lastResult = Math.min((page + 1) * pageSize, total)
  const pageDue = accounts.reduce((sum, account) => sum + Number(account.amountDue || 0), 0)
  const pagePaid = accounts.reduce((sum, account) => sum + Number(account.amountPaid || 0), 0)
  const pageBalance = accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0)
  const overdue = accounts.filter((account) => account.status !== 'PAID' && account.dueAt && account.dueAt.slice(0, 10) < today()).length
  const editingAccount = detailQuery.data ?? selected
  const formSupplierOptions = formSuppliersQuery.data?.content ?? []
  const selectedSupplierMissing = Boolean(editingAccount?.supplierId) && !formSupplierOptions.some((supplier) => supplier.id === editingAccount?.supplierId)
  const paymentTotal = Object.values(paymentValues).reduce((sum, value) => sum + Number(value || 0), 0)

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.payables }),
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders }),
      queryClient.invalidateQueries({ queryKey: queryKeys.materials }),
    ])
  }

  function showToast(message: string, variant: 'success' | 'error' = 'success') {
    setToast({ message, variant })
    window.setTimeout(() => setToast(null), variant === 'error' ? 6000 : 3200)
  }

  function openNew() { setSelected(null); setFormSupplierSearch(''); setFormError(''); setModalOpen(true) }
  function openEdit(account: PayableAccount) { setSelected(account); setFormSupplierSearch(account.supplierName || ''); setFormError(''); setModalOpen(true) }
  function openSettlement(account: PayableAccount) { setSettlementAccount(account); setPaymentValues({ ...emptyPayment, cashValue: Number(account.balance || 0) }); setSettlementError('') }

  function submitAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const numberOrNull = (name: string) => String(data.get(name) ?? '').trim() === '' ? null : Number(data.get(name))
    const textOrNull = (name: string) => String(data.get(name) ?? '').trim() || null
    const payload: PayableAccountPayload = {
      supplierId: Number(data.get('supplierId')),
      purchaseOrderId: numberOrNull('purchaseOrderId'),
      invoiceNumber: textOrNull('invoiceNumber'),
      serviceOrderId: numberOrNull('serviceOrderId'),
      contractId: numberOrNull('contractId'),
      orderedAt: dateTimeOrNull(data.get('orderedAt')),
      documentCode: textOrNull('documentCode'),
      description: String(data.get('description') ?? '').trim(),
      notes: textOrNull('notes'),
      amountDue: Number(data.get('amountDue') || 0),
      registeredAt: dateTimeOrNull(data.get('registeredAt')),
      dueAt: dateTime(String(data.get('dueAt'))),
      costCenterId: numberOrNull('costCenterId'),
      subCostCenterId: numberOrNull('subCostCenterId'),
    }
    saveMutation.mutate({ id: selected?.id, payload })
  }

  function submitSettlement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!settlementAccount) return
    const data = new FormData(event.currentTarget)
    const optionalNumber = (name: string) => String(data.get(name) ?? '').trim() === '' ? null : Number(data.get(name))
    settleMutation.mutate({
      id: settlementAccount.id, payload: {
        paidAt: dateTime(String(data.get('paidAt'))),
        ...paymentValues,
        movementAccountId: Number(data.get('movementAccountId')),
        costCenterId: optionalNumber('costCenterId'),
        subCostCenterId: optionalNumber('subCostCenterId'),
        notes: String(data.get('notes') ?? '').trim() || null,
      }
    })
  }

  return <>
    <PageHeader eyebrow="Financeiro" title="Contas a pagar" subtitle="Despesas avulsas e contas geradas pelos pedidos de compra das ordens de serviço." actions={<Button icon={<Plus size={18} />} onClick={openNew}>Nova conta</Button>} />

    <section className="stats-grid stats-grid--four">
      <StatCard label="Valor devido" value={money(pageDue)} helper="Contas desta página" icon={<CircleDollarSign />} tone="blue" />
      <StatCard label="Valor pago" value={money(pagePaid)} helper="Baixas acumuladas" icon={<Banknote />} tone="green" />
      <StatCard label="Saldo a pagar" value={money(pageBalance)} helper={`${total.toLocaleString('pt-BR')} contas no filtro`} icon={<HandCoins />} tone="orange" />
      <StatCard label="Vencidas" value={String(overdue)} helper="Contas desta página" icon={<CalendarDays />} tone="purple" />
    </section>

    <section className="panel data-panel">
      <CollapsibleFilters summary="Descrição, fornecedor, período e situação" activeCount={[search, supplierId, startDate, endDate].filter(Boolean).length + (dateField !== 'DUE_DATE' ? 1 : 0) + (status !== 'ALL' ? 1 : 0)} onClear={() => { setSearch(''); setSupplierId(''); setStartDate(''); setEndDate(''); setDateField('DUE_DATE'); setStatus('ALL'); setPage(0) }} contentClassName="payables-toolbar">
        <div className="search-box"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Código, descrição, pedido, OS ou nota fiscal..." /></div>
        <label><span>Fornecedor</span><select value={supplierId} onChange={(event) => { setSupplierId(event.target.value); setPage(0) }}><option value="">Todos</option>{filterSuppliersQuery.data?.content.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplierDisplay(supplier)}</option>)}</select></label>
        <label><span>Data de</span><select value={dateField} onChange={(event) => { setDateField(event.target.value as PayableDateField); setPage(0) }}><option value="DUE_DATE">Vencimento</option><option value="PAYMENT_DATE">Pagamento</option><option value="REGISTRATION_DATE">Cadastro</option></select></label>
        <label><span>De</span><input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setPage(0) }} /></label>
        <label><span>Até</span><input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setPage(0) }} /></label>
        <label><span>Status</span><select value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(0) }}><option value="OPEN">Em aberto</option><option value="PAID">Quitadas</option><option value="CLOSED">Fechadas</option><option value="ALL">Todas</option></select></label>
      </CollapsibleFilters>

      {accountsQuery.isLoading ? <LoadingState label="Carregando contas a pagar..." /> : accountsQuery.isError ? <ErrorState message={apiErrorMessage(accountsQuery.error)} onRetry={() => accountsQuery.refetch()} /> : accounts.length === 0 ? <EmptyState title="Nenhuma conta encontrada" description="Altere os filtros ou cadastre uma nova conta a pagar." /> : <div className={`table-wrap ${accountsQuery.isFetching ? 'table-wrap--refreshing' : ''}`}>
        <table className="data-table payables-table"><thead><tr><th>Código</th><th>Descrição</th><th>Fornecedor</th><th>Pedido / OS</th><th>Vencimento</th><th>Pagamento</th><th>Devido</th><th>Pago</th><th>Saldo</th><th>Status</th><th /></tr></thead><tbody>{accounts.map((account) => <tr key={account.id} onClick={() => openEdit(account)}>
          <td><strong>#{account.id}</strong></td><td><strong className="table-primary">{account.description || 'Sem descrição'}</strong>{account.invoiceNumber && <small className="table-secondary">NF {account.invoiceNumber}</small>}</td><td>{account.supplierName || ` Não informado `}</td><td>{account.purchaseOrderId ? `Pedido ` : 'Avulsa'}{account.serviceOrderId != 0 ? account.serviceOrderId && <small className="table-secondary">OS #{account.serviceOrderId}</small> : ''}</td><td>{formatDate(account.dueAt)}</td><td>{account.paidAt ? formatDate(account.paidAt) : '—'}</td><td><strong>{money(account.amountDue)}</strong></td><td>{money(account.amountPaid)}</td><td><strong className={account.balance > 0 ? 'negative-value' : 'positive-value'}>{money(account.balance)}</strong></td><td><Badge tone={statusTone(account.status)}>{statusLabel(account.status)}</Badge></td>
          <td><div className="row-actions">{account.balance > 0 && <button className="row-action row-action--success" onClick={(event) => { event.stopPropagation(); openSettlement(account) }} title="Dar baixa" aria-label={`Dar baixa na conta #${account.id}`}><WalletCards size={16} /></button>}<button className="row-action" onClick={(event) => { event.stopPropagation(); openEdit(account) }} title="Editar conta"><Edit3 size={16} /></button><button className="row-action row-action--danger" onClick={(event) => { event.stopPropagation(); setDeleteError(''); setAccountToDelete(account) }} title="Excluir conta"><Trash2 size={16} /></button></div></td>
        </tr>)}</tbody></table>
      </div>}
      <footer className="table-footer table-footer--pagination"><span>Mostrando <strong>{firstResult}–{lastResult}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong> contas</span><div className="pagination-controls"><label>Por página <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}>{[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label><button disabled={page === 0 || accountsQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft size={16} /></button><span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span><button disabled={page + 1 >= totalPages || accountsQuery.isFetching} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></button></div></footer>
    </section>

    <Modal open={modalOpen} onClose={() => !saveMutation.isPending && setModalOpen(false)} title={selected ? `Alterar conta a pagar #${selected.id}` : 'Inclusão de nova conta a pagar'} description="Dados do título, origem, vencimento e classificação financeira." size="xlarge">
      {selected && detailQuery.isLoading ? <LoadingState label="Carregando conta completa..." /> : <ModalForm key={`${editingAccount?.id ?? 'new'}-${detailQuery.dataUpdatedAt}`} onSubmit={submitAccount} onCancel={() => setModalOpen(false)} actions={selected && editingAccount && Number(editingAccount.balance) > 0 ? <Button type="button" variant="secondary" icon={<WalletCards size={16} />} onClick={() => { setModalOpen(false); openSettlement(editingAccount) }}>Dar baixa</Button> : undefined} submitting={saveMutation.isPending} submitLabel={saveMutation.isPending ? 'Gravando...' : 'Salvar'}>
        <FormError message={formError} />
        <div className="form-section-title"><span>1</span><div><strong>Documento e fornecedor</strong><small>Identificação principal da conta.</small></div></div>
        <div className="form-grid form-grid--three"><FormField label="Documento"><input name="documentCode" maxLength={50} defaultValue={editingAccount?.documentCode ?? ''} /></FormField><FormField label="Buscar fornecedor"><input value={formSupplierSearch} onChange={(event) => setFormSupplierSearch(event.target.value)} placeholder="Nome, documento ou código" /></FormField><FormField label="Fornecedor"><select name="supplierId" required defaultValue={editingAccount?.supplierId ?? ''}><option value="">Selecione</option>{selectedSupplierMissing && editingAccount && <option value={editingAccount.supplierId}>{editingAccount.supplierName || `Fornecedor #${editingAccount.supplierId}`}</option>}{formSupplierOptions.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplierDisplay(supplier)}</option>)}</select></FormField></div>
        <div className="form-section-title"><span>2</span><div><strong>Origem do título</strong><small>Pedido de compra, nota fiscal, contrato e ordem de serviço.</small></div></div>
        <div className="form-grid form-grid--four"><FormField label="Nº pedido de compra"><input name="purchaseOrderId" type="number" min="1" defaultValue={editingAccount?.purchaseOrderId ?? ''} /></FormField><FormField label="Data do pedido"><input name="orderedAt" type="date" defaultValue={toDateInput(editingAccount?.orderedAt)} /></FormField><FormField label="Nota fiscal"><input name="invoiceNumber" maxLength={50} defaultValue={editingAccount?.invoiceNumber ?? ''} /></FormField><FormField label="Nº contrato"><input name="contractId" type="number" min="1" defaultValue={editingAccount?.contractId ?? ''} /></FormField><FormField label="Ordem de serviço"><input name="serviceOrderId" type="number" min="1" defaultValue={editingAccount?.serviceOrderId ?? ''} /></FormField></div>
        <div className="form-section-title"><span>3</span><div><strong>Descrição e valores</strong><small>Informações do lançamento e totalizadores.</small></div></div>
        <div className="form-grid form-grid--three"><FormField label="Descrição"><input name="description" required maxLength={100} defaultValue={editingAccount?.description ?? ''} /></FormField><FormField label="Data de cadastro"><input name="registeredAt" type="date" defaultValue={toDateInput(editingAccount?.registeredAt) || today()} /></FormField><FormField label="Vencimento"><input name="dueAt" required type="date" defaultValue={toDateInput(editingAccount?.dueAt)} /></FormField><FormField label="Valor devido"><input name="amountDue" required type="number" min="0.01" step="0.01" defaultValue={editingAccount?.amountDue ?? ''} /></FormField><FormField label="Valor pago"><input value={money(editingAccount?.amountPaid ?? 0)} disabled /></FormField><FormField label="Saldo"><input value={money(editingAccount?.balance ?? 0)} disabled /></FormField></div>
        <FormField label="Observação"><textarea name="notes" rows={3} maxLength={200} defaultValue={editingAccount?.notes ?? ''} /></FormField>
        <div className="form-section-title"><span>4</span><div><strong>Classificação financeira</strong><small>Centro e subcentro de custo.</small></div></div>
        <div className="form-grid form-grid--two"><FormField label="Centro de custo"><select name="costCenterId" defaultValue={editingAccount?.costCenterId ?? 2}><option value="">Não informado</option>{costCentersQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</select></FormField><FormField label="Subcentro de custo"><select name="subCostCenterId" defaultValue={editingAccount?.subCostCenterId ?? 11}><option value="">Não informado</option>{subCostCentersQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</select></FormField></div>
        {editingAccount?.payments?.length ? <section className="payable-payment-history"><h3>Histórico de baixas</h3>{editingAccount.payments.map((payment) => <article key={payment.id}><span><strong>{formatDate(payment.paidAt)} · {money(payment.totalValue)}</strong><small>{payment.movementAccountName || 'Conta de movimento não informada'}{payment.notes ? ` · ${payment.notes}` : ''}</small></span><button type="button" disabled={reverseMutation.isPending} onClick={() => reverseMutation.mutate({ id: editingAccount.id, paymentId: payment.id })}>Excluir baixa</button></article>)}</section> : null}
        {selected && <div className="destructive-row"><span><strong>Excluir conta</strong><small>Contas com baixa ou ligadas a um pedido devem ser tratadas pela origem.</small></span><Button type="button" variant="danger" icon={<Trash2 size={16} />} onClick={() => { setDeleteError(''); setAccountToDelete(selected) }}>Excluir</Button></div>}
      </ModalForm>}
    </Modal>

    <Modal open={settlementAccount !== null} onClose={() => !settleMutation.isPending && setSettlementAccount(null)} title="Baixa de conta a pagar" description={settlementAccount?.description || `Conta #${settlementAccount?.id}`} size="large">
      <ModalForm onSubmit={submitSettlement} onCancel={() => setSettlementAccount(null)} submitting={settleMutation.isPending} submitLabel={settleMutation.isPending ? 'Efetuando...' : 'Efetuar pagamento'}>
        <FormError message={settlementError} />
        <div className="payable-settlement-summary"><span><small>Vencimento</small><strong>{formatDate(settlementAccount?.dueAt)}</strong></span><span><small>Devido</small><strong>{money(settlementAccount?.amountDue)}</strong></span><span><small>Pago</small><strong>{money(settlementAccount?.amountPaid)}</strong></span><span><small>Saldo</small><strong>{money(settlementAccount?.balance)}</strong></span></div>
        <div className="form-section-title"><span>1</span><div><strong>Valores do pagamento</strong><small>Distribua a baixa entre as formas utilizadas.</small></div></div>
        <div className="form-grid form-grid--three"><FormField label="Data do pagamento"><input name="paidAt" required type="date" defaultValue={today()} /></FormField>{paymentInput('Dinheiro', 'cashValue', paymentValues, setPaymentValues)}{paymentInput('Cortesia', 'courtesyValue', paymentValues, setPaymentValues)}{paymentInput('Cheque', 'checkValue', paymentValues, setPaymentValues)}{paymentInput('Cartão', 'cardValue', paymentValues, setPaymentValues)}{paymentInput('Transferência', 'transferValue', paymentValues, setPaymentValues)}{paymentInput('Boleto', 'billValue', paymentValues, setPaymentValues)}<FormField label="Total da baixa"><input value={money(paymentTotal)} readOnly /></FormField></div>
        {settlementAccount && paymentTotal > Number(settlementAccount.balance) && <FormError message="O total informado é maior que o saldo da conta." />}
        <div className="form-section-title"><span>2</span><div><strong>Movimentação e classificação</strong><small>Conta financeira e centro de custo da baixa.</small></div></div>
        <div className="form-grid form-grid--three"><FormField label="Conta de movimento"><select name="movementAccountId" required defaultValue={settlementAccount?.movementAccountId ?? ''}><option value="">Selecione</option>{movementAccountsQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.name}{item.detail ? ` · ${item.detail}` : ''}</option>)}</select></FormField><FormField label="Centro de custo"><select name="costCenterId" defaultValue={settlementAccount?.costCenterId ?? 2}><option value="">Não informado</option>{costCentersQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</select></FormField><FormField label="Subcentro de custo"><select name="subCostCenterId" defaultValue={settlementAccount?.subCostCenterId ?? 11}><option value="">Não informado</option>{subCostCentersQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</select></FormField></div><FormField label="Observação da baixa"><textarea name="notes" rows={3} maxLength={300} /></FormField>
      </ModalForm>
    </Modal>

    <ConfirmDialog open={accountToDelete !== null} title={`Excluir conta #${accountToDelete?.id ?? ''}?`} description="A conta será removida somente se não possuir baixas nem vínculo ativo com pedido de compra." confirmLabel="Excluir conta" busy={deleteMutation.isPending} error={deleteError} onCancel={() => { setAccountToDelete(null); setDeleteError('') }} onConfirm={() => accountToDelete && deleteMutation.mutate(accountToDelete.id)} />
    {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
  </>
}

function paymentInput(label: string, field: keyof PaymentValues, values: PaymentValues, setValues: React.Dispatch<React.SetStateAction<PaymentValues>>) {
  return <FormField label={label}><input type="number" min="0" step="0.01" value={values[field]} onChange={(event) => setValues((current) => ({ ...current, [field]: Number(event.target.value) }))} /></FormField>
}

function supplierDisplay(supplier: Supplier) { return `${supplier.tradeName || supplier.legalName || `Fornecedor #${supplier.id}`} · #${supplier.id}` }
function statusLabel(status: PayableStatus) { return status === 'PAID' ? 'Quitada' : status === 'CLOSED' ? 'Fechada' : 'Aberta' }
function statusTone(status: PayableStatus): 'green' | 'orange' | 'neutral' { return status === 'PAID' ? 'green' : status === 'OPEN' ? 'orange' : 'neutral' }
function today() { return new Date().toISOString().slice(0, 10) }
function currentMonthPeriod() { const now = new Date(); return { start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, end: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}` } }
function toDateInput(value?: string | null) { return value?.slice(0, 10) ?? '' }
function dateTime(value: string) { return `${value}T00:00:00` }
function dateTimeOrNull(value: FormDataEntryValue | null) { const normalized = String(value ?? '').trim(); return normalized ? dateTime(normalized) : null }
