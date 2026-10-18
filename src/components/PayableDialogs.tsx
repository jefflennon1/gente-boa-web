import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { FileCheck2, FileText, ReceiptText, SplitSquareHorizontal, Trash2, Undo2, WalletCards } from 'lucide-react'
import { apiErrorMessage } from '../api/client'
import { financeApi, financeKeys } from '../api/finance'
import { api, queryKeys } from '../api/services'
import { SupplierPicker, type PickerValue } from './AsyncPicker'
import { InstallmentDialog, suggestedMovementAccount } from './FinanceDialogs'
import { AccountReceipt, AccountWorkspace, PartyReceipts, payableReceiptRow } from './ReceiptsPanel'
import { Button, ConfirmDialog, FormError, FormField, LoadingState, Modal, ModalForm } from './ui'
import { todayIso } from '../lib/export'
import { formatDate, money } from '../lib/format'
import type { PayableAccount, PayableAccountPayload, PayablePaymentPayload } from '../types'

type ShowToast = (message: string, variant?: 'success' | 'error') => void
type PaidMethod = 'CASH' | 'TRANSFER' | 'BILL'
type RemainingAction = 'OPEN' | 'NEXT_INVOICE' | 'INSTALLMENTS'

function addMonths(isoDate: string, months: number) {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number)
  const target = new Date(year, month - 1 + months, 1)
  target.setDate(Math.min(day, new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()))
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`
}

type PaidAdjustment = { amountPaid: number; paidAt: string | null; paymentMethod: PaidMethod; movementAccountId: number | null }

/**
 * Diálogos de conta a pagar compartilhados (tela de Contas a pagar e modal "Dados do fornecedor"):
 * inclusão/alteração, baixa (pagamento), estorno de baixa, geração de prestações (parcelamento) e exclusão.
 */
export function usePayableDialogs(showToast: ShowToast) {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  // Menu lateral do modal da conta: dados (formulário) e recibos (o desta conta e os demais do fornecedor).
  const [accountSection, setAccountSection] = useState<'form' | 'receipts'>('form')
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
  // Pagamento parcial: pergunta o que fazer com o saldo (deixar em aberto, próxima fatura ou parcelar).
  const [remainingTarget, setRemainingTarget] = useState<PayableAccount | null>(null)
  const [remainingForm, setRemainingForm] = useState<{ action: RemainingAction; firstDueDate: string; installments: number }>({ action: 'OPEN', firstDueDate: todayIso(), installments: 2 })
  const [remainingError, setRemainingError] = useState('')
  // Valor pago editável na alteração da conta (pagamento parcial).
  const [amounts, setAmounts] = useState({ due: '', paid: '' })
  const [paidDetails, setPaidDetails] = useState<{ paidAt: string; method: PaidMethod; movementAccountId: number | '' }>({ paidAt: todayIso(), method: 'CASH', movementAccountId: '' })
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

  const saveMutation = useMutation({
    mutationFn: async ({ id, payload, paid, paidDecreases }: { id?: number; payload: PayableAccountPayload; paid?: PaidAdjustment; paidDecreases?: boolean }) => {
      // Reduzir o valor pago vem antes (a API não aceita devido menor que o já pago); aumentar vem depois.
      if (id && paid && paidDecreases) {
        await api.payables.adjustAmountPaid(id, paid)
        return api.payables.update(id, payload)
      }
      const saved = id ? await api.payables.update(id, payload) : await api.payables.create(payload)
      if (paid) return api.payables.adjustAmountPaid(saved.id, paid)
      return saved
    },
    onSuccess: async (result, variables) => {
      await invalidate(); setModalOpen(false); setSelected(null)
      showToast(`${variables.id ? 'Conta atualizada' : 'Conta cadastrada'}${variables.paid ? ' e valor pago registrado' : ''}.`)
      if (variables.paid && !variables.paidDecreases) askAboutRemaining(result)
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.payables.remove(id),
    onSuccess: async () => { await invalidate(); setAccountToDelete(null); setModalOpen(false); showToast('Conta excluída.') },
    onError: (error) => setDeleteError(apiErrorMessage(error)),
  })
  const settleMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PayablePaymentPayload }) => api.payables.settle(id, payload),
    onSuccess: async (result) => { await invalidate(); setSettlementAccount(null); showToast('Baixa registrada com sucesso.'); askAboutRemaining(result) },
    onError: (error) => setSettlementError(apiErrorMessage(error)),
  })
  const reverseMutation = useMutation({
    mutationFn: ({ id, paymentId }: { id: number; paymentId?: number }) => paymentId ? api.payables.reversePayment(id, paymentId) : financeApi.payables.reverseLegacySettlement(id),
    onSuccess: async () => { await invalidate(); showToast('Baixa excluída e saldo recalculado.') },
    onError: (error) => showToast(apiErrorMessage(error), 'error'),
  })
  const remainingMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof api.payables.remainingBalance>[1] }) => api.payables.remainingBalance(id, payload),
    onSuccess: async (result, variables) => {
      await invalidate()
      setRemainingTarget(null)
      const created = result.slice(1).map((item) => `#${item.id}`).join(', ')
      showToast(variables.payload.action === 'INSTALLMENTS' ? `Saldo parcelado nas contas ${created}.` : `Saldo levado para a próxima fatura (conta ${created}).`)
    },
    onError: (error) => setRemainingError(apiErrorMessage(error)),
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

  const editingAccount = detailQuery.data ?? selected
  const centers = costCentersQuery.data ?? []
  const formSubCenters = centers.find((center) => String(center.id) === formCostCenter)?.subCenters ?? []
  const paymentTotal = paymentValues.cashValue + paymentValues.transferValue + paymentValues.billValue
  const paymentMethod = paymentValues.cashValue > 0 && paymentValues.transferValue + paymentValues.billValue === 0 ? 'CASH' : 'TRANSFER'
  const legacySettlement = Boolean(editingAccount && !editingAccount.payments?.length && Number(editingAccount.amountPaid) > 0)
  const currentPaid = Number(editingAccount?.amountPaid ?? 0)
  const formDue = Number(amounts.due || 0)
  const formPaid = Number(amounts.paid || 0)
  const paidChange = Math.round((formPaid - currentPaid) * 100) / 100
  const formBalance = Math.max(0, formDue - formPaid)

  function resetPaidForm(due: number | string, paid: number) {
    setAmounts({ due: due === '' ? '' : String(due), paid: String(paid) })
    setPaidDetails({ paidAt: todayIso(), method: 'CASH', movementAccountId: '' })
  }
  function openNew(defaultSupplier: PickerValue = null) { setSelected(null); setFormSupplier(defaultSupplier); setFormCostCenter(''); setFormError(''); resetPaidForm('', 0); setAccountSection('form'); setModalOpen(true) }
  function openEdit(account: PayableAccount) {
    setSelected(account)
    setFormSupplier({ id: account.supplierId, label: `${account.supplierName || 'Fornecedor'} · #${account.supplierId}` })
    setFormCostCenter(account.costCenterId ? String(account.costCenterId) : '')
    setFormError('')
    resetPaidForm(account.amountDue, Number(account.amountPaid || 0))
    setAccountSection('form')
    setModalOpen(true)
  }
  function openSettlement(account: PayableAccount) { setSettlementAccount(account); setPaymentValues({ cashValue: Number(account.balance || 0), transferValue: 0, billValue: 0 }); setSettlementMovement(''); setSettlementError('') }
  function askAboutRemaining(account: PayableAccount) {
    if (!(Number(account.amountPaid) > 0 && Number(account.balance) > 0)) return
    setRemainingError('')
    setRemainingForm({ action: 'OPEN', firstDueDate: addMonths(account.dueAt?.slice(0, 10) || todayIso(), 1), installments: 2 })
    setRemainingTarget(account)
  }
  function submitRemaining(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!remainingTarget) return
    if (remainingForm.action === 'OPEN') {
      setRemainingTarget(null)
      showToast(`Saldo de ${money(remainingTarget.balance)} mantido em aberto na conta #${remainingTarget.id}.`)
      return
    }
    remainingMutation.mutate({ id: remainingTarget.id, payload: { action: remainingForm.action, firstDueDate: remainingForm.firstDueDate, installments: remainingForm.action === 'INSTALLMENTS' ? remainingForm.installments : undefined } })
  }
  function openInstallments(account: PayableAccount) { setInstallmentError(''); setInstallmentTarget(account) }
  function requestDelete(account: PayableAccount) { setDeleteError(''); setAccountToDelete(account) }

  function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!formSupplier) { setFormError('Selecione o fornecedor.'); return }
    const data = new FormData(event.currentTarget)
    const numberOrNull = (name: string) => String(data.get(name) ?? '').trim() === '' ? null : Number(data.get(name))
    const textOrNull = (name: string) => String(data.get(name) ?? '').trim() || null
    const dateOrNull = (name: string) => { const value = String(data.get(name) ?? '').trim(); return value ? `${value}T00:00:00` : null }
    if (formPaid < 0) { setFormError('O valor pago não pode ser negativo.'); return }
    if (formPaid > formDue + 0.001) { setFormError('O valor pago não pode ser maior que o valor devido.'); return }
    const paid: PaidAdjustment | undefined = paidChange !== 0 ? {
      amountPaid: formPaid,
      paidAt: paidChange > 0 ? `${paidDetails.paidAt}T00:00:00` : null,
      paymentMethod: paidDetails.method,
      movementAccountId: paidChange > 0 ? Number(paidDetails.movementAccountId || suggestedMovementAccount(movementAccountsQuery.data, paidDetails.method === 'CASH' ? 'CASH' : 'TRANSFER')) || null : null,
    } : undefined
    if (paid && paidChange > 0 && !paid.movementAccountId) { setFormError('Selecione a conta movimento do pagamento.'); return }
    saveMutation.mutate({
      id: selected?.id, paid, paidDecreases: paidChange < 0, payload: {
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

  function submitSettlement(event: FormEvent<HTMLFormElement>) {
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

  // Campos do formulário da conta: usados direto (conta nova) ou na seção "Dados da conta" do menu lateral.
  const accountFormFields = <>
    <FormError message={formError} />
    <div className="form-section-title"><span>1</span><div><strong>Documento e fornecedor</strong><small>Identificação principal da conta.</small></div></div>
    <div className="form-grid form-grid--two"><FormField label="Fornecedor"><SupplierPicker value={formSupplier} onChange={setFormSupplier} /></FormField><FormField label="Documento"><input name="documentCode" maxLength={50} defaultValue={editingAccount?.documentCode ?? ''} /></FormField></div>
    <div className="form-section-title"><span>2</span><div><strong>Origem do título</strong><small>Pedido de compra, nota fiscal, contrato e ordem de serviço.</small></div></div>
    <div className="form-grid form-grid--four"><FormField label="Nº pedido de compra"><input name="purchaseOrderId" type="number" min="1" defaultValue={editingAccount?.purchaseOrderId || ''} /></FormField><FormField label="Data do pedido"><input name="orderedAt" type="date" defaultValue={editingAccount?.orderedAt?.slice(0, 10) ?? ''} /></FormField><FormField label="Nota fiscal"><input name="invoiceNumber" maxLength={50} defaultValue={editingAccount?.invoiceNumber ?? ''} /></FormField><FormField label="Nº contrato"><input name="contractId" type="number" min="1" defaultValue={editingAccount?.contractId || ''} /></FormField><FormField label="Ordem de serviço"><input name="serviceOrderId" type="number" min="1" defaultValue={editingAccount?.serviceOrderId || ''} /></FormField></div>
    <div className="form-section-title"><span>3</span><div><strong>Descrição e valores</strong><small>Informações do lançamento e totalizadores.</small></div></div>
    <div className="form-grid form-grid--three"><FormField label="Descrição"><input name="description" required maxLength={100} defaultValue={editingAccount?.description ?? ''} /></FormField><FormField label="Data de cadastro"><input name="registeredAt" type="date" defaultValue={editingAccount?.registeredAt?.slice(0, 10) || todayIso()} /></FormField><FormField label="Vencimento"><input name="dueAt" required type="date" defaultValue={editingAccount?.dueAt?.slice(0, 10) ?? ''} /></FormField><FormField label="Valor devido"><input name="amountDue" required type="number" min="0.01" step="0.01" value={amounts.due} onChange={(event) => setAmounts((current) => ({ ...current, due: event.target.value }))} /></FormField><FormField label="Valor pago" hint="Informe o que já foi pago, mesmo que seja só uma parte."><input type="number" min="0" step="0.01" value={amounts.paid} onChange={(event) => setAmounts((current) => ({ ...current, paid: event.target.value }))} /></FormField><FormField label="Saldo a pagar"><input className={formBalance > 0 ? 'payable-balance-open' : 'payable-balance-paid'} value={money(formBalance)} readOnly tabIndex={-1} /></FormField></div>
    {paidChange > 0 && <div className="payable-paid-change"><p><strong>Pagamento de {money(paidChange)}</strong> será registrado como baixa{formBalance > 0 ? `, ficando ${money(formBalance)} a pagar` : ' e a conta ficará quitada'}.</p><div className="form-grid form-grid--three">
      <FormField label="Data do pagamento"><input type="date" required value={paidDetails.paidAt} onChange={(event) => setPaidDetails((current) => ({ ...current, paidAt: event.target.value }))} /></FormField>
      <FormField label="Forma de pagamento"><select value={paidDetails.method} onChange={(event) => setPaidDetails((current) => ({ ...current, method: event.target.value as PaidMethod, movementAccountId: '' }))}><option value="CASH">Dinheiro</option><option value="TRANSFER">Transferência</option><option value="BILL">Boleto</option></select></FormField>
      <FormField label="Conta movimento"><select required value={paidDetails.movementAccountId || suggestedMovementAccount(movementAccountsQuery.data, paidDetails.method === 'CASH' ? 'CASH' : 'TRANSFER')} onChange={(event) => setPaidDetails((current) => ({ ...current, movementAccountId: Number(event.target.value) }))}><option value="">Selecione</option>{movementAccountsQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</select></FormField>
    </div></div>}
    {paidChange < 0 && <div className="payable-paid-change payable-paid-change--reverse"><p><strong>O valor pago vai diminuir {money(-paidChange)}.</strong> As baixas mais recentes serão estornadas até chegar a {money(formPaid)}{formBalance > 0 ? `, ficando ${money(formBalance)} a pagar` : ''}.</p></div>}
    <FormField label="Observação"><textarea name="notes" rows={3} maxLength={200} defaultValue={editingAccount?.notes ?? ''} /></FormField>
    <div className="form-section-title"><span>4</span><div><strong>Classificação financeira</strong><small>Centro e subcentro de despesas, conforme o que está sendo comprado.</small></div></div>
    <div className="form-grid form-grid--two"><FormField label="Centro de custo"><select name="costCenterId" value={formCostCenter} onChange={(event) => setFormCostCenter(event.target.value)}><option value="">Não informado</option>{centers.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.description}</option>)}</select></FormField><FormField label="Subcentro de custo"><select key={formCostCenter} name="subCostCenterId" defaultValue={editingAccount?.subCostCenterId ?? ''}><option value="">Não informado</option>{formSubCenters.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.description}</option>)}</select></FormField></div>
    {editingAccount && (editingAccount.payments?.length > 0 || legacySettlement) ? <section className="payable-payment-history"><h3>Histórico de baixas</h3>
      {editingAccount.payments.map((payment) => <article key={payment.id}><span><strong>{formatDate(payment.paidAt)} · {money(payment.totalValue)}</strong><small>{payment.movementAccountName || 'Conta de movimento não informada'}{payment.notes ? ` · ${payment.notes}` : ''}</small></span><button type="button" disabled={reverseMutation.isPending} onClick={() => reverseMutation.mutate({ id: editingAccount.id, paymentId: payment.id })}><Undo2 size={14} /> Excluir baixa</button></article>)}
      {legacySettlement && <article><span><strong>{formatDate(editingAccount.paidAt)} · {money(editingAccount.amountPaid)}</strong><small>Baixa registrada no sistema anterior{editingAccount.movementAccountName ? ` · ${editingAccount.movementAccountName}` : ''}</small></span><button type="button" disabled={reverseMutation.isPending} onClick={() => reverseMutation.mutate({ id: editingAccount.id })}><Undo2 size={14} /> Excluir baixa</button></article>}
    </section> : null}
    {selected && <div className="destructive-row"><span><strong>Excluir conta</strong><small>Contas com baixa ou ligadas a um pedido devem ser tratadas pela origem.</small></span><Button type="button" variant="danger" icon={<Trash2 size={16} />} onClick={() => { setDeleteError(''); setAccountToDelete(selected) }}>Excluir</Button></div>}
  </>

  const dialogs = <>
    <Modal open={modalOpen} onClose={() => !saveMutation.isPending && setModalOpen(false)} title={selected ? `Alterar conta a pagar #${selected.id}` : 'Inclusão de nova conta a pagar'} description="Dados do título, origem, vencimento e classificação financeira." size="xlarge">
      {selected && detailQuery.isLoading ? <LoadingState label="Carregando conta completa..." /> : <ModalForm key={`${editingAccount?.id ?? 'new'}-${detailQuery.dataUpdatedAt}`} onSubmit={submitAccount} onCancel={() => setModalOpen(false)} submitting={saveMutation.isPending} submitLabel={saveMutation.isPending ? 'Gravando...' : 'Salvar'} actions={selected && editingAccount ? <>
        {Number(editingAccount.balance) > 0 && <Button type="button" variant="secondary" icon={<WalletCards size={16} />} onClick={() => { setModalOpen(false); openSettlement(editingAccount) }}>Dar baixa</Button>}
        {Number(editingAccount.amountPaid) === 0 && <Button type="button" variant="secondary" icon={<SplitSquareHorizontal size={16} />} onClick={() => { setInstallmentError(''); setInstallmentTarget(editingAccount) }}>Gerar prestações</Button>}
        {Number(editingAccount.amountPaid) !== 0 && accountSection !== 'receipts' && <Button type="button" variant="secondary" icon={<ReceiptText size={16} />} onClick={() => setAccountSection('receipts')}>Recibo</Button>}
      </> : undefined}>
        {selected && editingAccount ? <AccountWorkspace active={accountSection} onSelect={setAccountSection} sections={[
          { id: 'form', label: 'Dados da conta', icon: <FileText size={17} /> },
          { id: 'receipts', label: 'Recibos', icon: <FileCheck2 size={17} /> },
        ]}>
          {/* O formulário fica montado (só oculto) nas outras seções, para "Salvar" continuar valendo. */}
          <div hidden={accountSection !== 'form'}>
            {accountFormFields}
          </div>
          {accountSection === 'receipts' && (editingAccount.supplierId
            ? <PartyReceipts kind="payable" partyId={editingAccount.supplierId} currentAccount={payableReceiptRow(editingAccount)} />
            : <div className="client-workspace__section"><AccountReceipt kind="payable" id={editingAccount.id} settledAmount={Number(editingAccount.amountPaid)} /></div>)}
        </AccountWorkspace> : accountFormFields}
      </ModalForm>}
    </Modal>

    <Modal open={settlementAccount !== null} onClose={() => !settleMutation.isPending && setSettlementAccount(null)} title="Baixa de conta a pagar" description={settlementAccount?.description || `Conta #${settlementAccount?.id}`} size="large">
      <ModalForm onSubmit={submitSettlement} onCancel={() => setSettlementAccount(null)} submitting={settleMutation.isPending} submitLabel={settleMutation.isPending ? 'Efetuando...' : 'Efetuar pagamento'}>
        <FormError message={settlementError} />
        <div className="payable-settlement-summary"><span><small>Vencimento</small><strong>{formatDate(settlementAccount?.dueAt)}</strong></span><span><small>Devido</small><strong>{money(settlementAccount?.amountDue)}</strong></span><span><small>Pago</small><strong>{money(settlementAccount?.amountPaid)}</strong></span><span><small>Saldo</small><strong>{money(settlementAccount?.balance)}</strong></span></div>
        <div className="form-grid form-grid--four">
          <FormField label="Data do pagamento"><input name="paidAt" required type="date" defaultValue={todayIso()} /></FormField>
          <FormField label="Dinheiro"><input type="number" min="0" step="0.01" value={0.00} onChange={(event) => setPaymentValues((current) => ({ ...current, cashValue: Number(event.target.value) }))} /></FormField>
          <FormField label="Transferência"><input type="number" min="0" step="0.01" value={paymentValues.transferValue != null ? paymentValues.transferValue : paymentValues.cashValue} onChange={(event) => setPaymentValues((current) => ({ ...current, transferValue: Number(event.target.value) }))} /></FormField>
          <FormField label="Boleto"><input type="number" min="0" step="0.01" value={paymentValues.billValue} onChange={(event) => setPaymentValues((current) => ({ ...current, billValue: Number(event.target.value) }))} /></FormField>
          <FormField label="Total da baixa"><input value={money(paymentTotal)} readOnly /></FormField>
          <FormField label="Conta movimento"><select required value={settlementMovement || suggestedMovementAccount(movementAccountsQuery.data, paymentMethod)} onChange={(event) => setSettlementMovement(Number(event.target.value))}><option value="">Selecione</option>{movementAccountsQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</select></FormField>
        </div>
        {settlementAccount && paymentTotal > Number(settlementAccount.balance) + 0.001 && <FormError message="O total informado é maior que o saldo da conta." />}
        <FormField label="Observação da baixa"><textarea name="notes" rows={2} maxLength={300} /></FormField>
      </ModalForm>
    </Modal>

    {installmentTarget && !(installmentTarget.purchaseOrderId && purchaseGroupQuery.isLoading) && <InstallmentDialog key={`${installmentTarget.id}-${installmentTotal}`} open total={installmentTotal} dueDate={installmentTarget.dueAt?.slice(0, 10) ?? todayIso()} description={installmentTarget.purchaseOrderId ? `Pedido de compra #${installmentTarget.purchaseOrderId} · ${purchaseGroup.length > 1 ? `refaz as ${purchaseGroup.length} prestações atuais do pedido` : 'as prestações continuam vinculadas ao pedido'}` : `Conta #${installmentTarget.id} · ${installmentTarget.description ?? ''}`} busy={installmentMutation.isPending} error={installmentError} onClose={() => setInstallmentTarget(null)} onSubmit={(payload) => installmentMutation.mutate({ id: installmentTarget.id, payload })} />}
    <ConfirmDialog open={accountToDelete !== null} title={`Excluir conta #${accountToDelete?.id ?? ''}?`} description="A conta será removida somente se não possuir baixas nem vínculo ativo com pedido de compra." confirmLabel="Excluir conta" busy={deleteMutation.isPending} error={deleteError} onCancel={() => { setAccountToDelete(null); setDeleteError('') }} onConfirm={() => accountToDelete && deleteMutation.mutate(accountToDelete.id)} />
    <Modal open={remainingTarget !== null} onClose={() => !remainingMutation.isPending && setRemainingTarget(null)} title="Pagamento parcial registrado" description={remainingTarget ? `Conta #${remainingTarget.id} · ${remainingTarget.description ?? ''}` : undefined} size="medium">
      {remainingTarget && <ModalForm onSubmit={submitRemaining} onCancel={() => setRemainingTarget(null)} submitting={remainingMutation.isPending} submitLabel={remainingMutation.isPending ? 'Gravando...' : 'Confirmar'}>
        <FormError message={remainingError} />
        <div className="payable-settlement-summary payable-remaining__summary"><span><small>Valor da conta</small><strong>{money(remainingTarget.amountDue)}</strong></span><span><small>Pago</small><strong className="positive-value">{money(remainingTarget.amountPaid)}</strong></span><span><small>Restante</small><strong className="negative-value">{money(remainingTarget.balance)}</strong></span></div>
        <p className="payable-remaining__question">O que fazer com o saldo de <strong>{money(remainingTarget.balance)}</strong>? O valor pago fica registrado de qualquer forma.</p>
        <div className="payable-remaining__options" role="radiogroup" aria-label="Destino do saldo">
          <label className={remainingForm.action === 'OPEN' ? 'active' : ''}><input type="radio" name="remaining-action" checked={remainingForm.action === 'OPEN'} onChange={() => setRemainingForm((current) => ({ ...current, action: 'OPEN' }))} /><span><strong>Deixar em aberto</strong><small>A conta continua aberta com {money(remainingTarget.balance)} a pagar, no mesmo vencimento.</small></span></label>
          <label className={remainingForm.action === 'NEXT_INVOICE' ? 'active' : ''}><input type="radio" name="remaining-action" checked={remainingForm.action === 'NEXT_INVOICE'} onChange={() => setRemainingForm((current) => ({ ...current, action: 'NEXT_INVOICE' }))} /><span><strong>Levar para a próxima fatura</strong><small>Esta conta fica quitada em {money(remainingTarget.amountPaid)} e o saldo vira uma nova conta com o vencimento escolhido.</small></span></label>
          <label className={remainingForm.action === 'INSTALLMENTS' ? 'active' : ''}><input type="radio" name="remaining-action" checked={remainingForm.action === 'INSTALLMENTS'} onChange={() => setRemainingForm((current) => ({ ...current, action: 'INSTALLMENTS' }))} /><span><strong>Parcelar o saldo</strong><small>Esta conta fica quitada em {money(remainingTarget.amountPaid)} e o saldo é dividido em prestações mensais.</small></span></label>
        </div>
        {remainingForm.action !== 'OPEN' && <div className="form-grid form-grid--two">
          <FormField label={remainingForm.action === 'INSTALLMENTS' ? 'Vencimento da 1ª prestação' : 'Vencimento da próxima fatura'}><input type="date" required value={remainingForm.firstDueDate} onChange={(event) => setRemainingForm((current) => ({ ...current, firstDueDate: event.target.value }))} /></FormField>
          {remainingForm.action === 'INSTALLMENTS' && <FormField label="Quantidade de prestações" hint={`${remainingForm.installments}x de aprox. ${money(Number(remainingTarget.balance) / Math.max(1, remainingForm.installments))}`}><input type="number" min="2" max="120" required value={remainingForm.installments} onChange={(event) => setRemainingForm((current) => ({ ...current, installments: Number(event.target.value) }))} /></FormField>}
        </div>}
      </ModalForm>}
    </Modal>
  </>

  return { openNew, openEdit, openSettlement, openInstallments, requestDelete, dialogs }
}
