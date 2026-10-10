import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, Eye, FileBarChart, Landmark, ReceiptText, Search, Timer } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { modulesApi, modulesKeys, summaryNumber, type BillStatementSource } from '../api/modules'
import { apiErrorMessage } from '../api/client'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { formatDate, money } from '../lib/format'
import type { AccountsReceivableListItem, BillDetail, BillGenerationPreview, ClientBillingContext } from '../types'
import { Badge, Button, CollapsibleFilters, DetailModal, EmptyState, ErrorState, FormField, LoadingState, Modal, StatCard } from './ui'
import { ClientHourTracking } from './ClientHourTracking'

type BillingType = 'ALL' | 'CONTRACT' | 'ONE_OFF'
type GeneratedStatus = 'ALL' | 'GENERATED' | 'PENDING'
type PaymentStatus = 'ALL' | 'PENDING' | 'PAID'

export function AccountsReceivableReview({ showToast, onOpenStatement }: { showToast: (message: string) => void; onOpenStatement?: (source: BillStatementSource) => void }) {
  const queryClient = useQueryClient()
  const initialPeriod = useMemo(currentMonthPeriod, [])
  const [search, setSearch] = useState('')
  const [dueStart, setDueStart] = useState(initialPeriod.startDate)
  const [dueEnd, setDueEnd] = useState(initialPeriod.endDate)
  const [orderStart, setOrderStart] = useState('')
  const [orderEnd, setOrderEnd] = useState('')
  const [dueDay, setDueDay] = useState<'' | 10 | 20>('')
  const [billingType, setBillingType] = useState<BillingType>('ALL')
  const [generatedStatus, setGeneratedStatus] = useState<GeneratedStatus>('PENDING')
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('PENDING')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [selected, setSelected] = useState<Record<number, AccountsReceivableListItem>>({})
  const [previewRow, setPreviewRow] = useState<AccountsReceivableListItem | null>(null)
  const [previewSection, setPreviewSection] = useState<'bill' | 'receivables' | 'tracking'>('bill')
  const [issOpen, setIssOpen] = useState(false)
  const [issAmount, setIssAmount] = useState('')
  const [issDescription, setIssDescription] = useState('REF A ISS RETIDO')
  const [generationPreview, setGenerationPreview] = useState<BillGenerationPreview | null>(null)
  const [includeOtherGroups, setIncludeOtherGroups] = useState<Record<string, boolean>>({})
  const [actionError, setActionError] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim())

  const query = useQuery({
    queryKey: [...queryKeys.accountsReceivable, debouncedSearch, dueStart, dueEnd, orderStart, orderEnd, dueDay, billingType, generatedStatus, paymentStatus, page, pageSize],
    queryFn: () => api.accountsReceivable.list({
      query: debouncedSearch || undefined,
      dueStart: dueStart || undefined,
      dueEnd: dueEnd || undefined,
      serviceOrderStart: orderStart || undefined,
      serviceOrderEnd: orderEnd || undefined,
      dueDay: dueDay || undefined,
      billingType,
      generatedStatus,
      paymentStatus,
      page,
      size: pageSize,
    }),
  })
  const summaryQuery = useQuery({
    queryKey: [...modulesKeys.summaries, 'receivables-review', debouncedSearch, dueStart, dueEnd, orderStart, orderEnd, dueDay, billingType, generatedStatus, paymentStatus],
    queryFn: () => modulesApi.summaries.get('receivables-review', { query: debouncedSearch || undefined, dueStart: dueStart || undefined, dueEnd: dueEnd || undefined, serviceOrderStart: orderStart || undefined, serviceOrderEnd: orderEnd || undefined, dueDay: dueDay || undefined, billingType, generatedStatus, paymentStatus }),
  })
  const previewQuery = useQuery({
    queryKey: [...queryKeys.bills, 'preview-service-order', previewRow?.serviceOrderId],
    queryFn: () => api.bills.previewByServiceOrder(previewRow!.serviceOrderId!),
    enabled: previewRow?.serviceOrderId != null,
  })
  const clientContextQuery = useQuery({
    queryKey: [...queryKeys.bills, 'client-context', previewRow?.clientId],
    queryFn: () => api.bills.clientContext(previewRow!.clientId!),
    enabled: previewRow?.clientId != null,
  })

  const rows = query.data?.content ?? []
  const total = query.data?.total ?? 0
  const totalPages = query.data?.totalPages ?? 0
  const selectedRows = Object.values(selected)
  const selectedReference = selectedRows[0]
  const selectedClients = new Set(selectedRows.map((row) => row.clientId).filter(Boolean)).size
  const selectedAmount = selectedRows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const firstResult = total === 0 ? 0 : page * pageSize + 1
  const lastResult = Math.min((page + 1) * pageSize, total)

  const generateMutation = useMutation({
    mutationFn: (ids: number[]) => api.accountsReceivable.generateBills(ids),
    onSuccess: async (result) => {
      setSelected({})
      setPreviewRow(null)
      setGenerationPreview(null)
      setActionError('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.accountsReceivable }),
        queryClient.invalidateQueries({ queryKey: queryKeys.bills }),
      ])
      showToast(`${result.billCount} boleto(s) gerado(s), ${result.receivableCount} lançamento(s) faturado(s) e ${result.invoiceCount} rascunho(s) de NF criado(s) para clientes auditados.`)
    },
    onError: (error) => setActionError(apiErrorMessage(error, 'Não foi possível gerar o boleto.')),
  })
  const previewGenerationMutation = useMutation({
    mutationFn: (ids: number[]) => api.accountsReceivable.previewBills(ids),
    onSuccess: (preview) => {
      setGenerationPreview(preview)
      setIncludeOtherGroups({})
      setActionError('')
    },
    onError: (error) => setActionError(apiErrorMessage(error, 'Não foi possível preparar a prévia dos boletos.')),
  })
  const selectAllMutation = useMutation({
    mutationFn: () => api.accountsReceivable.selection({
      query: debouncedSearch || undefined,
      dueStart: dueStart || undefined,
      dueEnd: dueEnd || undefined,
      serviceOrderStart: orderStart || undefined,
      serviceOrderEnd: orderEnd || undefined,
      dueDay: dueDay || undefined,
      billingType,
      generatedStatus,
      paymentStatus,
    }),
    onSuccess: (items) => setSelected(Object.fromEntries(items.map((item) => [item.id, item]))),
    onError: (error) => setActionError(apiErrorMessage(error, 'Não foi possível marcar todos os títulos do filtro.')),
  })

  const issMutation = useMutation({
    mutationFn: () => api.accountsReceivable.createIssWithholding({
      clientId: selectedReference!.clientId!,
      dueDate: String(selectedReference!.dueAt).slice(0, 10),
      amount: Number(issAmount.replace(',', '.')),
      description: issDescription.trim() || undefined,
    }),
    onSuccess: async (iss) => {
      if (selectedReference) {
        setSelected((current) => ({
          ...current,
          [iss.id]: {
            ...selectedReference,
            ...iss,
            clientName: selectedReference.clientName,
            clientTradeName: selectedReference.clientTradeName,
            clientDocument: selectedReference.clientDocument,
            generated: false,
            paid: false,
          },
        }))
      }
      setIssOpen(false)
      setIssAmount('')
      setActionError('')
      await queryClient.invalidateQueries({ queryKey: queryKeys.accountsReceivable })
      showToast('ISS retido lançado como valor negativo no Contas a Receber.')
    },
    onError: (error) => setActionError(apiErrorMessage(error, 'Não foi possível lançar o ISS retido.')),
  })

  /** Extrato do boleto a gerar: as contas marcadas precisam ser de um único cliente e vencimento (um boleto). */
  function openSelectionStatement() {
    if (!onOpenStatement || selectedRows.length === 0) return
    const groups = new Set(selectedRows.map((row) => `${row.clientId}|${String(row.dueAt ?? '').slice(0, 10)}`))
    if (groups.size > 1) {
      setActionError('O extrato é por boleto: marque contas de um único cliente e vencimento para ver o extrato.')
      return
    }
    setActionError('')
    onOpenStatement({ receivableIds: selectedRows.map((row) => row.id) })
  }

  function changeFilter(change: () => void) {
    change()
    setPage(0)
    setSelected({})
    setActionError('')
  }

  function toggle(row: AccountsReceivableListItem) {
    if (row.generated) return
    setActionError('')
    setSelected((current) => {
      if (current[row.id]) {
        const copy = { ...current }
        delete copy[row.id]
        return copy
      }
      return { ...current, [row.id]: row }
    })
  }

  function togglePage() {
    const selectable = rows.filter((row) => !row.generated)
    const allSelected = selectable.length > 0 && selectable.every((row) => selected[row.id])
    if (allSelected) {
      setSelected((current) => {
        const copy = { ...current }
        selectable.forEach((row) => delete copy[row.id])
        return copy
      })
      return
    }
    setSelected((current) => ({ ...current, ...Object.fromEntries(selectable.map((row) => [row.id, row])) }))
  }

  function openPreview(row: AccountsReceivableListItem) {
    setPreviewRow(row)
    setPreviewSection('bill')
    setActionError('')
  }

  async function openIss() {
    if (!selectedReference?.clientId || !selectedReference.dueAt) {
      setActionError('Selecione uma conta a receber para identificar o cliente e o vencimento do ISS.')
      return
    }
    setActionError('')
    try {
      const preview = await api.accountsReceivable.previewBills(selectedRows.map((row) => row.id))
      const group = preview.groups.find((item) => item.clientId === selectedReference.clientId && item.dueDate === String(selectedReference.dueAt).slice(0, 10))
      setIssAmount(group && group.issRetained ? String(group.suggestedIssAmount).replace('.', ',') : '')
      setIssOpen(true)
    } catch (error) {
      setActionError(apiErrorMessage(error, 'Não foi possível calcular a sugestão de ISS.'))
    }
  }

  function openGenerationPreview() {
    if (!selectedRows.length) return
    previewGenerationMutation.mutate(selectedRows.map((item) => item.id))
  }

  function confirmGeneration() {
    if (!generationPreview) return
    const ids = generationPreview.groups.flatMap((group) => includeOtherGroups[`${group.clientId}-${group.dueDate}`]
      ? group.allReceivableIds : group.selectedReceivableIds)
    generateMutation.mutate([...new Set(ids)])
  }

  return <>
    <section className="stats-grid stats-grid--four statement-stats">
      <StatCard label="Contas a receber" value={summaryNumber(summaryQuery.data, 'total').toLocaleString('pt-BR')} helper="Total geral do filtro" icon={<ReceiptText />} tone="blue" />
      <StatCard label="Valor total" value={money(summaryNumber(summaryQuery.data, 'amount'))} helper="Soma de todos os lançamentos do filtro" icon={<Landmark />} tone="purple" />
      <StatCard label="A faturar" value={summaryNumber(summaryQuery.data, 'pending').toLocaleString('pt-BR')} helper={`${money(summaryNumber(summaryQuery.data, 'pendingAmount'))} sem boleto`} icon={<Clock3 />} tone="orange" />
      <StatCard label="Já faturadas" value={summaryNumber(summaryQuery.data, 'generated').toLocaleString('pt-BR')} helper="Com boleto vinculado" icon={<CheckCircle2 />} tone="green" />
    </section>

    <section className="panel data-panel bill-panel">
      <CollapsibleFilters summary="Cliente, vencimento do CR, data das OS e situação" contentClassName="billing-filter-panel collapsible-filter-content--block">
        <div className="billing-filter-panel__heading"><div><strong>Criação de boletos</strong><small>Selecione contas sem boleto pelo vencimento e confira os grupos antes de gerar.</small></div><Badge tone="orange">Um boleto por cliente e vencimento</Badge></div>
        <div className="billing-filter-grid receivable-filter-grid">
          <label className="billing-filter-group"><span>Cliente ou código</span><div className="search-box"><Search size={18} /><input value={search} onChange={(event) => changeFilter(() => setSearch(event.target.value))} placeholder="CR, cliente, CPF/CNPJ, contrato, boleto ou OS" /></div></label>
          <label className="billing-filter-group"><span>Faturamento</span><select value={billingType} onChange={(event) => changeFilter(() => setBillingType(event.target.value as BillingType))}><option value="ALL">Todos</option><option value="CONTRACT">Contratos fixos</option><option value="ONE_OFF">Avulsos</option></select></label>
          <label className="billing-filter-group"><span>Geração</span><select value={generatedStatus} onChange={(event) => changeFilter(() => setGeneratedStatus(event.target.value as GeneratedStatus))}><option value="PENDING">A faturar</option><option value="GENERATED">Com boleto</option><option value="ALL">Todos</option></select></label>
          {/* <label className="billing-filter-group"><span>Pagamento</span><select value={paymentStatus} onChange={(event) => changeFilter(() => setPaymentStatus(event.target.value as PaymentStatus))}><option value="PENDING">Pendentes</option><option value="PAID">Pagos</option><option value="ALL">Todos</option></select></label> */}
          {/* <div className="billing-filter-group"><span>Dia fixo</span><div className="billing-day-options"><button type="button" className={dueDay === '' ? 'active' : ''} onClick={() => changeFilter(() => setDueDay(''))}>Todos</button>{([10, 20] as const).map((day) => <button type="button" key={day} className={dueDay === day ? 'active' : ''} onClick={() => changeFilter(() => setDueDay(day))}>{day}</button>)}</div></div> */}
          <label className="billing-filter-group billing-filter-group--dates"><span>Vencimento do CR</span><div><input type="date" value={dueStart} max={dueEnd || undefined} onChange={(event) => changeFilter(() => setDueStart(event.target.value))} /><i>até</i><input type="date" value={dueEnd} min={dueStart || undefined} onChange={(event) => changeFilter(() => setDueEnd(event.target.value))} /></div></label>
          <label className="billing-filter-group billing-filter-group--dates"><span>Data das OS (opcional)</span><div><input type="date" value={orderStart} max={orderEnd || undefined} onChange={(event) => changeFilter(() => setOrderStart(event.target.value))} /><i>até</i><input type="date" value={orderEnd} min={orderStart || undefined} onChange={(event) => changeFilter(() => setOrderEnd(event.target.value))} /></div></label>
        </div>
        <div className="billing-search-row billing-search-row--actions"><Button variant="ghost" onClick={() => changeFilter(() => { setDueStart(initialPeriod.startDate); setDueEnd(initialPeriod.endDate); setOrderStart(''); setOrderEnd(''); setDueDay(''); setBillingType('ALL'); setGeneratedStatus('PENDING'); setPaymentStatus('PENDING'); setSearch('') })}>Limpar filtros</Button><Button variant="secondary" disabled={selectAllMutation.isPending || total === 0} onClick={() => selectAllMutation.mutate()}>{selectAllMutation.isPending ? 'Marcando...' : 'Marcar todos do filtro'}</Button></div>
        <div className="receivable-actions"><span><strong>{selectedRows.length}</strong> registro(s) selecionado(s)</span><div><Button type="button" variant="secondary" icon={<FileBarChart size={16} />} disabled={selectedRows.length === 0 || !onOpenStatement} title="Extrato do boleto das contas marcadas (um cliente e um vencimento)" onClick={openSelectionStatement}>Extrato</Button><Button type="button" variant="secondary" onClick={() => void openIss()}>Lançar ISS retido</Button><Button type="button" disabled={selectedRows.length === 0 || previewGenerationMutation.isPending} onClick={openGenerationPreview}>{previewGenerationMutation.isPending ? 'Preparando prévia...' : `Revisar e gerar (${selectedRows.length})`}</Button></div></div>
        {actionError && <div className="receivable-action-error" role="alert">{actionError}</div>}
      </CollapsibleFilters>
       
           <div className="billing-filter-grid receivable-filter-grid externo">
             <div className="billing-filter-group externo"><span>Dia fixo</span><div className="billing-day-options"><button type="button" className={dueDay === '' ? 'active' : ''} onClick={() => changeFilter(() => setDueDay(''))}>Todos</button>{([10, 20] as const).map((day) => <button type="button" key={day} className={dueDay === day ? 'active' : ''} onClick={() => changeFilter(() => setDueDay(day))}>{day}</button>)}</div></div>
             <label className="billing-filter-group externo"><span>Pagamento</span><select value={paymentStatus} onChange={(event) => changeFilter(() => setPaymentStatus(event.target.value as PaymentStatus))}><option value="PENDING">Pendentes</option><option value="PAID">Pagos</option><option value="ALL">Todos</option></select></label>         
           </div>
         

      {query.isLoading ? <LoadingState label="Carregando contas a receber..." /> : query.isError ? <ErrorState message={apiErrorMessage(query.error)} onRetry={() => query.refetch()} /> : rows.length === 0 ? <EmptyState title="Nenhuma conta a receber sem boleto neste vencimento" description="Ajuste o vencimento do CR ou confira se os títulos já foram faturados." /> : <div className="table-wrap"><table className="data-table receivable-table"><thead><tr><th><input type="checkbox" checked={rows.some((row) => !row.generated) && rows.filter((row) => !row.generated).every((row) => Boolean(selected[row.id]))} onChange={togglePage} aria-label="Marcar os registros pendentes desta página" /></th><th>CR</th><th>Cliente</th><th>Contrato</th><th>OS</th><th>Descrição</th><th>Cadastro</th><th>Vencimento</th><th>Valor</th><th>Saldo</th><th>Situação</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className={selected[row.id] ? 'receivable-row--selected' : ''} onClick={() => openPreview(row)}>
        <td><input type="checkbox" checked={Boolean(selected[row.id])} disabled={row.generated} onChange={() => toggle(row)} onClick={(event) => event.stopPropagation()} aria-label={`Selecionar conta a receber ${row.id}`} /></td>
        <td><strong>#{row.id}</strong>{row.billNumber && <small className="table-secondary">Boleto #{row.billNumber}</small>}</td>
        <td><strong className="table-primary">{row.clientTradeName || row.clientName || `Cliente #${row.clientId}`}</strong><small className="table-secondary">{row.clientDocument || `Código ${row.clientId || '—'}`}</small></td>
        <td>{row.contractId ? `#${row.contractId}` : 'Avulso'}</td><td>{row.serviceOrderId || '—'}</td><td>{row.description || 'Não informada'}</td><td>{formatDate(row.createdAt)}</td><td>{formatDate(row.dueAt)}</td><td className={Number(row.amount) < 0 ? 'receivable-negative' : ''}><strong>{money(row.amount)}</strong></td><td>{money(row.balance)}</td><td><Badge tone={row.generated ? 'green' : row.paid ? 'blue' : 'orange'}>{row.generated ? `Boleto #${row.billNumber}` : row.paid ? 'Pago' : 'A faturar'}</Badge></td><td><button type="button" className="row-action" onClick={(event) => { event.stopPropagation(); openPreview(row) }} aria-label={`Visualizar registro ${row.id}`}><Eye size={16} /></button></td>
      </tr>)}</tbody></table></div>}

      <div className="receivable-selection-footer"><span>Qtd. títulos <strong>{selectedRows.length}</strong></span><span>Qtd. clientes <strong>{selectedClients}</strong></span><span>Valor selecionado <strong>{money(selectedAmount)}</strong></span></div>

      <footer className="table-footer table-footer--pagination"><span>Mostrando <strong>{firstResult}–{lastResult}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong> contas</span><div className="pagination-controls"><label>Itens <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}>{[5, 10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label><button disabled={page === 0 || query.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button><span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span><button disabled={page + 1 >= totalPages || query.isFetching} onClick={() => setPage((value) => value + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button></div></footer>
    </section>

    <DetailModal
      open={previewRow !== null && previewSection === 'bill'}
      onClose={() => setPreviewRow(null)}
      title={previewRow?.generated ? `Boleto #${previewRow.billNumber}` : `Boleto a gerar · CR #${previewRow?.id}`}
      description={previewRow?.generated ? 'Dados da cobrança gerada para o cliente.' : 'Pré-visualização da cobrança antes da geração do boleto.'}
      size="xlarge"
      actions={previewRow ? <>
        <Button variant="secondary" icon={<ReceiptText size={16} />} onClick={() => setPreviewSection('receivables')}>Contas a receber</Button>
        <Button variant="secondary" icon={<Timer size={16} />} disabled={!previewRow.clientId} onClick={() => setPreviewSection('tracking')}>Acompanhamento de horas</Button>
        {!previewRow.generated && previewRow.clientId && previewRow.dueAt && onOpenStatement && <Button variant="secondary" icon={<FileBarChart size={16} />} onClick={() => onOpenStatement({ clientId: previewRow.clientId!, dueDate: String(previewRow.dueAt).slice(0, 10) })}>Extrato do boleto</Button>}
        {!previewRow.generated && <Button disabled={previewGenerationMutation.isPending} onClick={() => previewGenerationMutation.mutate([previewRow.id])}>{previewGenerationMutation.isPending ? 'Preparando prévia...' : 'Revisar e gerar'}</Button>}
      </> : undefined}
    >
      {previewRow?.serviceOrderId && previewQuery.isLoading ? <LoadingState label="Carregando dados da cobrança..." /> : previewRow?.serviceOrderId && previewQuery.isError ? <ErrorState message={apiErrorMessage(previewQuery.error)} onRetry={() => previewQuery.refetch()} /> : previewRow ? <PendingBillDetails row={previewRow} bill={previewQuery.data} /> : null}
    </DetailModal>

    <DetailModal
      open={previewRow !== null && previewSection === 'receivables'}
      onClose={() => setPreviewSection('bill')}
      title={`Contas a receber · ${previewRow?.billNumber ? `Boleto #${previewRow.billNumber}` : `CR #${previewRow?.id}`}`}
      description="Todos os títulos ainda não pagos deste cliente."
      size="xlarge"
      actions={<Button variant="secondary" onClick={() => setPreviewSection('bill')}>Voltar ao boleto</Button>}
    >
      {clientContextQuery.isLoading ? <LoadingState label="Carregando contas do cliente..." /> : clientContextQuery.isError ? <ErrorState message={apiErrorMessage(clientContextQuery.error)} onRetry={() => clientContextQuery.refetch()} /> : previewRow ? <PendingReceivables row={previewRow} context={clientContextQuery.data} /> : null}
    </DetailModal>

    <DetailModal
      open={previewRow !== null && previewSection === 'tracking'}
      onClose={() => setPreviewSection('bill')}
      title={`Acompanhamento de horas · ${previewRow?.clientTradeName || previewRow?.clientName || `Cliente #${previewRow?.clientId || '—'}`}`}
      description="Histórico completo de acompanhamento de horas deste cliente."
      size="xlarge"
      actions={<Button variant="secondary" onClick={() => setPreviewSection('bill')}>Voltar ao boleto</Button>}
    >
      {clientContextQuery.isLoading ? <LoadingState label="Carregando acompanhamento do cliente..." /> : clientContextQuery.isError ? <ErrorState message={apiErrorMessage(clientContextQuery.error)} onRetry={() => clientContextQuery.refetch()} /> : previewRow ? <PendingTracking row={previewRow} context={clientContextQuery.data} /> : null}
    </DetailModal>

    <Modal open={generationPreview !== null} onClose={() => !generateMutation.isPending && setGenerationPreview(null)} title="Prévia da geração de boletos" description="Confira os agrupamentos por cliente e vencimento antes de confirmar." size="xlarge">
      <div className="modal__body bill-generation-preview">
        {generationPreview && <>
          <div className="detail-metrics bill-detail__metrics">
            <span><small>Boletos</small><strong>{generationPreview.billCount}</strong></span>
            <span><small>Títulos selecionados</small><strong>{generationPreview.receivableCount}</strong></span>
            <span><small>Clientes</small><strong>{generationPreview.clientCount}</strong></span>
            <span><small>Valor selecionado</small><strong>{money(generationPreview.amount)}</strong></span>
          </div>
          <div className="bill-generation-preview__groups">
            {generationPreview.groups.map((group) => {
              const groupKey = `${group.clientId}-${group.dueDate}`
              return <article className="bill-generation-preview__group" key={groupKey}>
                <header><div><strong>{group.clientName || `Cliente #${group.clientId}`}</strong><small>Cliente #{group.clientId} · vencimento {formatDate(group.dueDate)}</small></div><strong>{money(group.amount)}</strong></header>
                <p>{group.selectedReceivableIds.length} título(s) selecionado(s){group.hasIssLine ? ' · ISS já incluído' : ''}</p>
                {group.warning && <div className="receivable-action-warning" role="status">{group.warning}{group.suggestedIssAmount > 0 ? ` Sugestão: ${money(group.suggestedIssAmount)}.` : ''}</div>}
                {group.unselectedReceivableIds.length > 0 && <label className="bill-generation-preview__option"><input type="checkbox" checked={Boolean(includeOtherGroups[groupKey])} onChange={(event) => setIncludeOtherGroups((current) => ({ ...current, [groupKey]: event.target.checked }))} /><span>Incluir também {group.unselectedReceivableIds.length} outro(s) título(s) do mesmo cliente e vencimento</span></label>}
              </article>
            })}
          </div>
        </>}
      </div>
      <footer className="modal__footer"><Button type="button" variant="secondary" disabled={generateMutation.isPending} onClick={() => setGenerationPreview(null)}>Cancelar</Button><Button type="button" disabled={generateMutation.isPending || !generationPreview?.groups.length} onClick={confirmGeneration}>{generateMutation.isPending ? 'Gerando...' : 'Confirmar geração'}</Button></footer>
    </Modal>

    <Modal open={issOpen} onClose={() => !issMutation.isPending && setIssOpen(false)} title="Lançar ISS retido" description="O valor será registrado negativamente no Contas a Receber e poderá compor o boleto do mesmo cliente e vencimento.">
      <form onSubmit={(event) => { event.preventDefault(); setActionError(''); issMutation.mutate() }}>
        <div className="modal__body form-grid">
          <FormField label="Cliente"><input value={selectedReference?.clientTradeName || selectedReference?.clientName || ''} disabled /></FormField>
          <FormField label="Vencimento"><input value={dateOnly(selectedReference?.dueAt)} disabled /></FormField>
          <FormField label="Valor do ISS retido"><input type="number" min="0.01" step="0.01" value={issAmount} onChange={(event) => setIssAmount(event.target.value)} required /></FormField>
          <FormField label="Descrição"><input value={issDescription} maxLength={200} onChange={(event) => setIssDescription(event.target.value)} required /></FormField>
          {actionError && <div className="receivable-action-error form-grid__wide" role="alert">{actionError}</div>}
        </div>
        <footer className="modal__footer"><Button type="button" variant="secondary" disabled={issMutation.isPending} onClick={() => setIssOpen(false)}>Cancelar</Button><Button type="submit" disabled={issMutation.isPending || Number(issAmount.replace(',', '.')) <= 0}>{issMutation.isPending ? 'Lançando...' : 'Lançar valor negativo'}</Button></footer>
      </form>
    </Modal>
  </>
}

function PendingBillDetails({ row, bill }: { row: AccountsReceivableListItem; bill?: BillDetail }) {
  return <div className="detail-modal-content bill-detail">
    <div className="detail-modal__hero-row"><div className="detail-drawer__hero"><span className="detail-avatar"><ReceiptText /></span><div><span>{row.generated ? `Boleto #${row.billNumber}` : 'Aguardando geração'}{row.serviceOrderId ? ` · OS-${row.serviceOrderId}` : ''}</span><h2>{row.clientTradeName || row.clientName || `Cliente #${row.clientId}`}</h2><p>Cobrança com vencimento em {formatDate(row.dueAt)}</p></div></div><Badge tone={row.generated ? 'green' : 'orange'}>{row.generated ? 'Gerado' : 'A faturar'}</Badge></div>
    <div className="detail-metrics bill-detail__metrics"><span><small>Valor</small><strong>{money(row.amount)}</strong></span><span><small>Saldo</small><strong>{money(row.balance)}</strong></span><span><small>Serviços</small><strong>{money(bill?.serviceAmount || 0)}</strong></span><span><small>Materiais</small><strong>{money(bill?.materialAmount || 0)}</strong></span></div>
    <div className="detail-sections-grid">
      <section className="drawer-section"><h3>Cliente</h3><dl><div><dt>Código</dt><dd>{row.clientId || '—'}</dd></div><div><dt>Razão social</dt><dd>{bill?.clientName || row.clientName || 'Não informada'}</dd></div><div><dt>Nome fantasia</dt><dd>{bill?.clientTradeName || row.clientTradeName || 'Não informado'}</dd></div><div><dt>CPF / CNPJ</dt><dd>{bill?.clientDocument || row.clientDocument || 'Não informado'}</dd></div><div><dt>Telefone</dt><dd>{bill?.clientPhone || 'Não informado'}</dd></div><div><dt>E-mail</dt><dd>{bill?.clientEmail || 'Não informado'}</dd></div><div className="drawer-section__wide"><dt>Endereço</dt><dd>{bill?.clientAddress || 'Não informado'}</dd></div></dl></section>
      <section className="drawer-section"><h3>Origem da cobrança</h3><dl><div><dt>Conta a receber</dt><dd>#{row.id}</dd></div><div><dt>OS</dt><dd>{row.serviceOrderId ? `OS-${row.serviceOrderId}` : 'Sem OS vinculada'}</dd></div><div><dt>Contrato</dt><dd>{row.contractId ? `#${row.contractId}` : 'Avulso'}</dd></div><div><dt>Cadastro</dt><dd>{formatDate(row.createdAt)}</dd></div><div><dt>Vencimento</dt><dd>{formatDate(row.dueAt)}</dd></div><div><dt>Situação</dt><dd>{row.paid ? 'Pago' : row.generated ? 'Boleto gerado' : 'A faturar'}</dd></div><div className="drawer-section__wide"><dt>Descrição</dt><dd>{bill?.serviceOrderDescription || row.description || 'Não informada'}</dd></div></dl></section>
    </div>
  </div>
}

function PendingReceivables({ row, context }: { row: AccountsReceivableListItem; context?: ClientBillingContext }) {
  const receivables = context?.openReceivables || []
  const total = receivables.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const balance = receivables.reduce((sum, item) => sum + Number(item.balance || 0), 0)
  return <div className="detail-modal-content bill-related-detail">
    <div className="detail-modal__hero-row"><div className="detail-drawer__hero"><span className="detail-avatar"><ReceiptText /></span><div><span>Cliente #{row.clientId || '—'}</span><h2>{row.clientTradeName || row.clientName || 'Cliente não identificado'}</h2><p>{row.clientDocument || 'CPF/CNPJ não informado'}</p></div></div><Badge tone={balance > 0 ? 'orange' : 'green'}>{balance > 0 ? 'Em aberto' : 'Quitado'}</Badge></div>
    <div className="detail-metrics bill-detail__metrics"><span><small>Títulos vinculados</small><strong>{receivables.length}</strong></span><span><small>Valor lançado</small><strong>{money(total)}</strong></span><span><small>Saldo em aberto</small><strong>{money(balance)}</strong></span><span><small>Boleto</small><strong>{row.billNumber ? `#${row.billNumber}` : 'Não gerado'}</strong></span></div>
    <ReviewTable title="Contas a receber em aberto do cliente" empty="Este cliente não possui contas a receber em aberto." headers={['CR', 'OS', 'Contrato', 'Descrição', 'Cadastro', 'Vencimento', 'Valor', 'Saldo']} rows={receivables.map((item) => [item.id, item.serviceOrderId || '—', item.contractId || '—', item.description || 'Não informada', formatDate(item.createdAt), formatDate(item.dueAt), money(item.amount), money(item.balance)])} />
  </div>
}

function PendingTracking({ row, context }: { row: AccountsReceivableListItem; context?: ClientBillingContext }) {
  return <ClientHourTracking clientId={row.clientId} clientName={row.clientTradeName || row.clientName || `Cliente #${row.clientId}`} context={context} />
}

function ReviewTable({ title, empty, headers, rows }: { title: string; empty: string; headers: string[]; rows: Array<Array<string | number>> }) {
  return <section className="drawer-section bill-detail-table"><h3>{title}</h3>{rows.length === 0 ? <p>{empty}</p> : <div className="table-wrap"><table className="data-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${title}-${index}`}>{row.map((value, cell) => <td key={`${index}-${cell}`}>{value}</td>)}</tr>)}</tbody></table></div>}</section>
}

function dateOnly(value: string | null | undefined) {
  return value ? String(value).slice(0, 10) : ''
}

function currentMonthPeriod() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  return {
    startDate: localDate(new Date(year, month, 1)),
    endDate: localDate(new Date(year, month + 1, 0)),
  }
}

function localDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
