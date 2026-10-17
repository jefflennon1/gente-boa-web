import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock3, Download, ExternalLink, Eye, FileBarChart, FileSpreadsheet, FileText, Landmark, Mail, Printer, ReceiptText, Search, Send, Timer, Upload, Users, WalletCards } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { formatDate, money } from '../lib/format'
import type { BillDetail, BillListItem, ClientStatementSummary, GeneratedBill } from '../types'
import { Badge, Button, CollapsibleFilters, ConfirmDialog, DetailModal, EmptyState, ErrorState, LoadingState, Modal, PageHeader, StatCard, Toast } from '../components/ui'
import { financeApi } from '../api/finance'
import { modulesApi, modulesKeys, openPdf, summaryNumber } from '../api/modules'
import { MultipleSettlementDialog } from '../components/FinanceDialogs'
import { AccountsReceivableReview } from '../components/AccountsReceivableReview'
import { dateText, downloadCsv, printElement } from '../lib/export'
import { BillStatementModal } from '../components/BillStatementModal'
import { BillStatementsTab } from '../components/BillStatementsTab'
import { ClientStatementTab } from '../components/ClientStatementTab'
import { BillDetails, ClientStatementDetails, formatMinutes } from '../components/BillingDetails'
import { ClientWorkspaceModal } from '../components/ClientWorkspaceModal'
import { useRouter } from '../router'
import type { BillStatementSource } from '../api/modules'

export function Statements() {
  const queryClient = useQueryClient()
  const { pathname, navigate } = useRouter()
  const [billingView, setBillingView] = useState<'receivables' | 'generated' | 'statements' | 'printing'>(pathname === '/extratos' ? 'statements' : 'receivables')
  const [statementSource, setStatementSource] = useState<BillStatementSource | null>(null)
  const [search, setSearch] = useState('')
  const [billCpf, setBillCpf] = useState('')
  const [billCnpj, setBillCnpj] = useState('')
  const [billNumber, setBillNumber] = useState('')
  const [billServiceOrder, setBillServiceOrder] = useState('')
  const [billContract, setBillContract] = useState('')
  const [page, setPage] = useState(0)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [workspaceClient, setWorkspaceClient] = useState<{ id: number | null; label: string } | null>(null)
  const [settleTarget, setSettleTarget] = useState<BillDetail | null>(null)
  const [selectedBills, setSelectedBills] = useState<Record<number, BillListItem>>({})
  const [batchSettleOpen, setBatchSettleOpen] = useState(false)
  const [settleError, setSettleError] = useState('')
  const [toast, setToast] = useState('')
  const [emailTarget, setEmailTarget] = useState<BillDetail | null>(null)
  const [emailError, setEmailError] = useState('')
  // Boletos recém-gerados na "Criação de boletos": ficam destacados em "Boletos gerados e pagamento".
  const [recentBills, setRecentBills] = useState<GeneratedBill[]>([])
  const [billPdfPreview, setBillPdfPreview] = useState<{ url: string; bill: Pick<BillListItem, 'id' | 'number'> } | null>(null)
  const initialBillPeriod = useMemo(currentMonthPeriod, [])
  const [billOrderStart, setBillOrderStart] = useState('')
  const [billOrderEnd, setBillOrderEnd] = useState('')
  const [billDueStart, setBillDueStart] = useState(initialBillPeriod.startDate)
  const [billDueEnd, setBillDueEnd] = useState(initialBillPeriod.endDate)
  const [openUntil, setOpenUntil] = useState('')
  const [billDueDay, setBillDueDay] = useState<'' | 10 | 20>('')
  const [billingType, setBillingType] = useState<'ALL' | 'CONTRACT' | 'ONE_OFF'>('ALL')
  const [paymentStatus, setPaymentStatus] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL')
  const debouncedSearch = useDebouncedValue(search)
  const [pageSize, setPageSize] = useState(10)

  const billFilters = {
      clientName: debouncedSearch || undefined,
      cpf: billCpf || undefined,
      cnpj: billCnpj || undefined,
      billNumber: billNumber ? Number(billNumber) : undefined,
      serviceOrderNumber: billServiceOrder ? Number(billServiceOrder) : undefined,
      contractCode: billContract ? Number(billContract) : undefined,
      serviceOrderStart: billOrderStart || undefined,
      serviceOrderEnd: billOrderEnd || undefined,
      dueStart: openUntil ? undefined : billDueStart || undefined,
      dueEnd: openUntil || billDueEnd || undefined,
      dueDay: billDueDay || undefined,
      billingType,
      paymentStatus: openUntil ? 'PENDING' as const : paymentStatus,
  }
  const billsQuery = useQuery({
    queryKey: [...queryKeys.bills, debouncedSearch, billCpf, billCnpj, billNumber, billServiceOrder, billContract, billOrderStart, billOrderEnd, billDueStart, billDueEnd, openUntil, billDueDay, billingType, paymentStatus, page, pageSize],
    queryFn: () => api.bills.list({ ...billFilters, page, size: pageSize }),
    enabled: billingView === 'generated',
  })
  const billSummaryQuery = useQuery({
    queryKey: [...modulesKeys.summaries, 'bills', billFilters],
    queryFn: () => modulesApi.summaries.get('bills', billFilters),
    enabled: billingView === 'generated',
  })
  const movementAccountsQuery = useQuery({ queryKey: [...queryKeys.payables, 'movement-accounts'], queryFn: () => api.payables.movementAccounts(), enabled: settleTarget !== null || batchSettleOpen })
  const settleMutation = useMutation({
    mutationFn: ({ billIds, paidAt, movementAccountId, paymentMethod }: { billIds: number[]; paidAt: string; movementAccountId: number; paymentMethod: string }) => billIds.length === 1
      ? financeApi.receivables.settleBill(billIds[0], { paidAt, movementAccountId, paymentMethod })
      : financeApi.receivables.settleBills(billIds, { paidAt, movementAccountId, paymentMethod }),
    onSuccess: async (result) => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.bills }), queryClient.invalidateQueries({ queryKey: modulesKeys.summaries })])
      setSettleTarget(null)
      setBatchSettleOpen(false)
      setSelectedBills({})
      showToast(`Pagamento registrado: ${result.count} conta(s) a receber baixada(s), total ${money(result.totalAmount)}.`)
    },
    onError: (error) => setSettleError(apiErrorMessage(error, 'Não foi possível registrar o pagamento do boleto.')),
  })
  const detailQuery = useQuery({ queryKey: [...queryKeys.bills, 'detail', detailId], queryFn: () => api.bills.find(detailId!), enabled: detailId !== null })
  const pdfMutation = useMutation({
    mutationFn: async (bill: Pick<BillListItem, 'id' | 'number'>) => ({ bill, blob: await api.bills.pdf(bill.id) }),
    onSuccess: ({ bill, blob }) => {
      const url = URL.createObjectURL(blob)
      setBillPdfPreview((current) => {
        if (current) URL.revokeObjectURL(current.url)
        return { bill, url }
      })
    },
    onError: (error) => showToast(apiErrorMessage(error, 'Não foi possível gerar o PDF do boleto.')),
  })
  const emailMutation = useMutation({
    mutationFn: (bill: BillDetail) => api.bills.sendEmail(bill.id),
    onSuccess: async (response) => {
      setEmailTarget(null)
      setEmailError('')
      await queryClient.invalidateQueries({ queryKey: queryKeys.bills })
      showToast(`Boleto enviado para ${response.recipient}.`)
    },
    onError: (error) => setEmailError(apiErrorMessage(error, 'Não foi possível enviar o boleto por e-mail.')),
  })
  const uploadMutation = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => api.bills.uploadBankDocument(id, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.bills })
      showToast('PDF do boleto bancário anexado.')
    },
    onError: (error) => showToast(apiErrorMessage(error, 'Não foi possível anexar o boleto bancário.')),
  })

  const bills = billsQuery.data?.content ?? []
  const total = billsQuery.data?.total ?? 0
  const totalPages = billsQuery.data?.totalPages ?? 0
  const firstResult = total === 0 ? 0 : page * pageSize + 1
  const lastResult = Math.min((page + 1) * pageSize, total)
  const detail = detailQuery.data
  const selectedBillRows = Object.values(selectedBills)

  useEffect(() => () => {
    if (billPdfPreview) URL.revokeObjectURL(billPdfPreview.url)
  }, [billPdfPreview])

  function isPaid(bill: Pick<BillListItem, 'id' | 'paid'>) {
    return bill.paid
  }

  function openClientWorkspace(bill: BillListItem) {
    setDetailId(bill.id)
    setWorkspaceClient({ id: bill.clientId, label: bill.clientTradeName || bill.clientName || `Cliente #${bill.clientId}` })
  }

  function closeClientWorkspace() {
    setWorkspaceClient(null)
    setDetailId(null)
  }

  function openBillStatement(billId: number) {
    setStatementSource({ billId })
  }

  function changeView(view: typeof billingView) {
    setBillingView(view)
    setPage(0)
    // O menu lateral "Extratos" abre direto nesta aba; as demais ficam em /boletos.
    if (view === 'statements' && pathname !== '/extratos') navigate('/extratos', { replace: true })
    if (view !== 'statements' && pathname === '/extratos') navigate('/boletos', { replace: true })
  }

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }

  // Após gerar: limpa os filtros, filtra pelo número (um boleto) ou pelo período de vencimento dos novos boletos
  // (vários) e abre "Boletos gerados e pagamento" com eles em destaque.
  function showGeneratedBills(generated: GeneratedBill[]) {
    const dueDates = generated.map((bill) => String(bill.dueAt ?? '').slice(0, 10)).filter(Boolean).sort()
    setSearch('')
    setBillCpf('')
    setBillCnpj('')
    setBillServiceOrder('')
    setBillContract('')
    setBillOrderStart('')
    setBillOrderEnd('')
    setOpenUntil('')
    setBillDueDay('')
    setBillingType('ALL')
    setPaymentStatus('ALL')
    setSelectedBills({})
    setBillNumber(generated.length === 1 && generated[0].number ? String(generated[0].number) : '')
    setBillDueStart(dueDates[0] ?? initialBillPeriod.startDate)
    setBillDueEnd(dueDates[dueDates.length - 1] ?? initialBillPeriod.endDate)
    setRecentBills(generated)
    changeView('generated')
  }

  function previewBillPdf(bill: Pick<BillListItem, 'id' | 'number'>) {
    pdfMutation.mutate(bill)
  }

  function closeBillPdfPreview() {
    setBillPdfPreview(null)
  }

  function downloadBillPdf() {
    if (!billPdfPreview) return
    const link = document.createElement('a')
    link.href = billPdfPreview.url
    link.download = `demonstrativo-${billPdfPreview.bill.number || billPdfPreview.bill.id}.pdf`
    link.click()
  }

  function printBillPdf() {
    const frame = document.getElementById('bill-pdf-preview') as HTMLIFrameElement | null
    frame?.contentWindow?.print()
  }

  return <>
    <PageHeader eyebrow="Financeiro" title="Boletos" subtitle="Criação, impressão e pagamento de boletos no fluxo do sistema legado." />
    <nav className="system-parameters-menu billing-sections" aria-label="Etapas do faturamento">
      <button type="button" className={billingView === 'receivables' ? 'active' : ''} onClick={() => changeView('receivables')}><ReceiptText size={17} />Criação de boletos</button>
      <button type="button" className={billingView === 'generated' ? 'active' : ''} onClick={() => changeView('generated')}><WalletCards size={17} />Boletos gerados e pagamento</button>
      <button type="button" className={billingView === 'statements' ? 'active' : ''} onClick={() => changeView('statements')}><FileBarChart size={17} />Extratos</button>
      <button type="button" className={billingView === 'printing' ? 'active' : ''} onClick={() => changeView('printing')}><Printer size={17} />Impressões</button>
    </nav>
    {billingView === 'receivables' ? <AccountsReceivableReview showToast={showToast} onOpenStatement={setStatementSource} onGenerated={showGeneratedBills} /> : billingView === 'statements' ? <>
      <ClientStatementTab showToast={showToast} />
      <details className="os-detail-accordion bill-statements-batch">
        <summary><span><strong>Extratos dos boletos gerados</strong><small>Impressão em lote: extrato de cada boleto do vencimento e PDF único do período.</small></span><ChevronDown size={17} /></summary>
        <BillStatementsTab onOpen={setStatementSource} showToast={showToast} />
      </details>
    </> : billingView === 'generated' ? <>
    <section className="stats-grid stats-grid--four statement-stats">
      <StatCard label="Boletos" value={summaryNumber(billSummaryQuery.data, 'total').toLocaleString('pt-BR')} helper="Total geral do filtro" icon={<WalletCards />} tone="blue" />
      <StatCard label="Valor total" value={money(summaryNumber(billSummaryQuery.data, 'amount'))} helper="Soma de todos os boletos do filtro" icon={<Landmark />} tone="purple" />
      <StatCard label="Pendentes" value={summaryNumber(billSummaryQuery.data, 'pending').toLocaleString('pt-BR')} helper={money(summaryNumber(billSummaryQuery.data, 'pendingAmount'))} icon={<Clock3 />} tone="orange" />
      <StatCard label="Pagos" value={summaryNumber(billSummaryQuery.data, 'paid').toLocaleString('pt-BR')} helper={money(summaryNumber(billSummaryQuery.data, 'paidAmount'))} icon={<CheckCircle2 />} tone="green" />
    </section>

    {recentBills.length > 0 && <section className="recent-bills" aria-live="polite">
      <header><span className="recent-bills__icon"><CheckCircle2 size={18} /></span><div><strong>{recentBills.length === 1 ? `Boleto #${recentBills[0].number || recentBills[0].id} gerado agora` : `${recentBills.length} boletos gerados agora`}</strong><small>{recentBills.length === 1 ? 'A lista abaixo já está filtrada por este boleto.' : 'A lista abaixo está filtrada pelo vencimento dos novos boletos, que aparecem destacados.'}</small></div><Button type="button" variant="ghost" onClick={() => setRecentBills([])}>Fechar</Button></header>
      <div className="recent-bills__list">{recentBills.map((bill) => <article key={bill.id}><div><strong>#{bill.number || bill.id}</strong><small>Cliente #{bill.clientId} · venc. {formatDate(bill.dueAt)} · {bill.receivableCount} conta(s)</small></div><b>{money(bill.amount)}</b><span><button type="button" className="bill-pdf-button" onClick={() => openBillStatement(bill.id)} aria-label={`Abrir extrato do boleto ${bill.number || bill.id}`} title="Extrato"><FileBarChart size={16} /></button><button type="button" className="bill-pdf-button" disabled={pdfMutation.isPending} onClick={() => previewBillPdf({ id: bill.id, number: bill.number })} aria-label={`Visualizar demonstrativo ${bill.number || bill.id}`} title="Demonstrativo"><Eye size={16} /></button></span></article>)}</div>
    </section>}

    <section className="panel data-panel bill-panel">
      <CollapsibleFilters summary="Cliente, boleto, OS, contrato, documentos, situação e períodos" contentClassName="billing-filter-panel collapsible-filter-content--block">
        <div className="billing-filter-panel__heading"><div><strong>Visualização do faturamento</strong><small>Consulte contratos fixos e atendimentos avulsos antes do vencimento.</small></div><Badge tone="green">Boletos gerados</Badge></div>
        <div className="billing-filter-grid">
          <label className="billing-filter-group"><span>Nome do cliente</span><div className="search-box"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Razão social ou nome fantasia" /></div></label>
          <label className="billing-filter-group"><span>Número do boleto</span><input type="number" min="1" value={billNumber} onChange={(event) => { setBillNumber(event.target.value); setPage(0) }} /></label>
          <label className="billing-filter-group"><span>Número da OS</span><input type="number" min="1" value={billServiceOrder} onChange={(event) => { setBillServiceOrder(event.target.value); setPage(0) }} /></label>
          <label className="billing-filter-group"><span>Contrato</span><input type="number" min="1" value={billContract} onChange={(event) => { setBillContract(event.target.value); setPage(0) }} /></label>
          <label className="billing-filter-group"><span>CPF</span><input inputMode="numeric" value={billCpf} onChange={(event) => { setBillCpf(event.target.value.replace(/\D/g, '')); setPage(0) }} /></label>
          <label className="billing-filter-group"><span>CNPJ</span><input inputMode="numeric" value={billCnpj} onChange={(event) => { setBillCnpj(event.target.value.replace(/\D/g, '')); setPage(0) }} /></label>
          <div className="billing-filter-group"><span>Dia fixo</span><div className="billing-day-options"><button type="button" className={billDueDay === '' ? 'active' : ''} onClick={() => { setBillDueDay(''); setPage(0) }}>Todos</button>{([10, 20] as const).map((day) => <button type="button" key={day} className={billDueDay === day ? 'active' : ''} onClick={() => { setBillDueDay(day); setPage(0) }}>{day}</button>)}</div></div>
          <label className="billing-filter-group"><span>Faturamento</span><select value={billingType} onChange={(event) => { setBillingType(event.target.value as typeof billingType); setPage(0) }}><option value="ALL">Todos</option><option value="CONTRACT">Contratos fixos</option><option value="ONE_OFF">Avulsos</option></select></label>
          <label className="billing-filter-group"><span>Pagamento</span><select value={paymentStatus} onChange={(event) => { setPaymentStatus(event.target.value as typeof paymentStatus); setPage(0) }}><option value="ALL">Todos</option><option value="PENDING">Pendentes</option><option value="PAID">Pagos</option></select></label>
          <label className="billing-filter-group billing-filter-group--dates"><span>Data das OS</span><div><input type="date" value={billOrderStart} max={billOrderEnd || undefined} onChange={(event) => { setBillOrderStart(event.target.value); setPage(0) }} /><i>até</i><input type="date" value={billOrderEnd} min={billOrderStart || undefined} onChange={(event) => { setBillOrderEnd(event.target.value); setPage(0) }} /></div></label>
          <label className="billing-filter-group billing-filter-group--dates"><span>Vencimento</span><div><input type="date" value={billDueStart} max={billDueEnd || undefined} onChange={(event) => { setBillDueStart(event.target.value); setPage(0) }} /><i>até</i><input type="date" value={billDueEnd} min={billDueStart || undefined} onChange={(event) => { setBillDueEnd(event.target.value); setPage(0) }} /></div></label>
          <label className="billing-filter-group"><span>Em aberto até a data</span><input type="date" value={openUntil} onChange={(event) => { setOpenUntil(event.target.value); setPage(0); setSelectedBills({}) }} /><small>Lista de inadimplentes conforme a situação das CRs.</small></label>
        </div>
        <div className="billing-search-row billing-search-row--actions"><Button variant="ghost" onClick={() => { setBillOrderStart(''); setBillOrderEnd(''); setBillDueStart(initialBillPeriod.startDate); setBillDueEnd(initialBillPeriod.endDate); setOpenUntil(''); setBillDueDay(''); setBillingType('ALL'); setPaymentStatus('ALL'); setSearch(''); setBillCpf(''); setBillCnpj(''); setBillNumber(''); setBillServiceOrder(''); setBillContract(''); setPage(0); setSelectedBills({}) }}>Limpar filtros</Button></div>
        <div className="receivable-actions"><span><strong>{selectedBillRows.length}</strong> boleto(s) selecionado(s)</span><Button disabled={!selectedBillRows.length} icon={<CheckCircle2 size={16} />} onClick={() => { setSettleError(''); setBatchSettleOpen(true) }}>Registrar pagamento em lote</Button></div>
      </CollapsibleFilters>
      {billsQuery.isLoading ? <LoadingState label="Carregando boletos..." /> : billsQuery.isError ? <ErrorState message={apiErrorMessage(billsQuery.error)} onRetry={() => billsQuery.refetch()} /> : bills.length === 0 ? <EmptyState title="Nenhum boleto encontrado" description="Os boletos serão gerados quando uma ordem de serviço for finalizada." /> : <div className="table-wrap"><table className="data-table bill-table"><thead><tr><th><input type="checkbox" aria-label="Selecionar boletos em aberto desta página" checked={bills.some((bill) => !isPaid(bill)) && bills.filter((bill) => !isPaid(bill)).every((bill) => selectedBills[bill.id])} onChange={() => { const open = bills.filter((bill) => !isPaid(bill)); const all = open.every((bill) => selectedBills[bill.id]); setSelectedBills((current) => { const next = { ...current }; open.forEach((bill) => { if (all) delete next[bill.id]; else next[bill.id] = bill }); return next }) }} /></th><th>Boleto</th><th>OS</th><th>Cliente</th><th>Contrato</th><th>Data cadastro</th><th>Processamento</th><th>Vencimento</th><th>Valor</th><th>Enviado e-mail</th><th>Pagamento</th><th>Extrato</th><th>Demonstrativo</th><th /></tr></thead><tbody>{bills.map((bill) => <tr key={bill.id} className={recentBills.some((recent) => recent.id === bill.id) ? 'bill-row--new' : undefined} onClick={() => openClientWorkspace(bill)}>
        <td><input type="checkbox" disabled={isPaid(bill)} checked={Boolean(selectedBills[bill.id])} onClick={(event) => event.stopPropagation()} onChange={() => setSelectedBills((current) => { const next = { ...current }; if (next[bill.id]) delete next[bill.id]; else next[bill.id] = bill; return next })} aria-label={`Selecionar boleto ${bill.number || bill.id}`} /></td>
        <td><strong>#{bill.number || bill.id}</strong><small className="table-secondary">Registro {bill.id}</small></td>
        <td><strong>{bill.serviceOrderId || 'CR'}</strong></td>
        <td><strong className="table-primary">{bill.clientTradeName || bill.clientName || `Cliente #${bill.clientId}`}</strong><small className="table-secondary">{bill.clientTradeName && bill.clientName ? bill.clientName : `Código ${bill.clientId || '—'}`}</small></td>
        <td>{bill.contractId ? `#${bill.contractId}` : 'Avulso'}</td>
        <td>{formatDate(bill.serviceOrderDate)}</td><td>{formatDate(bill.processedAt, true)}</td><td>{formatDate(bill.dueAt)}</td><td><strong>{money(bill.amount)}</strong></td>
        <td><Badge tone={bill.emailSent ? 'green' : 'neutral'}>{bill.emailSent ? 'Sim' : 'Não'}</Badge>{bill.emailSentAt && <small className="table-secondary">{formatDate(bill.emailSentAt, true)}</small>}</td>
        <td><Badge tone={isPaid(bill) ? 'green' : 'orange'}>{isPaid(bill) ? 'Pago' : 'Pendente'}</Badge>{bill.paidAt && <small className="table-secondary">{formatDate(bill.paidAt)}</small>}</td>
        <td><button type="button" className="bill-pdf-button" onClick={(event) => { event.stopPropagation(); openBillStatement(bill.id) }} aria-label={`Abrir extrato do boleto ${bill.number || bill.id}`}><FileBarChart size={16} /></button></td>
        <td><button type="button" className="bill-pdf-button" disabled={pdfMutation.isPending} onClick={(event) => { event.stopPropagation(); previewBillPdf(bill) }} aria-label={`Visualizar demonstrativo ${bill.number || bill.id}`}><Eye size={16} /></button></td>
        <td><button className="row-action" aria-label={`Visualizar boleto ${bill.number || bill.id}`}><ChevronRight size={18} /></button></td>
      </tr>)}</tbody></table></div>}
      <footer className="table-footer table-footer--pagination"><span>Mostrando <strong>{firstResult}–{lastResult}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong> boletos</span><div className="pagination-controls"><label>Itens <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}>{[5, 10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label><button disabled={page === 0 || billsQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button><span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span><button disabled={page + 1 >= totalPages || billsQuery.isFetching} onClick={() => setPage((value) => value + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button></div></footer>
    </section>
    </> : <BillPrintingTab showToast={showToast} />}

    <ClientWorkspaceModal
      key={workspaceClient?.id ?? 'sem-cliente'}
      open={workspaceClient !== null}
      clientId={workspaceClient?.id ?? null}
      clientLabel={workspaceClient?.label}
      bill={detailId !== null ? {
        title: detail ? `Boleto #${detail.number || detail.id}` : 'Boleto selecionado',
        content: detailQuery.isLoading ? <LoadingState label="Carregando boleto..." /> : detailQuery.isError ? <ErrorState message={apiErrorMessage(detailQuery.error)} onRetry={() => detailQuery.refetch()} /> : detail ? <BillDetails bill={detail} paid={isPaid(detail)} /> : null,
        actions: detail ? <>{!isPaid(detail) && <Button variant="secondary" icon={<CheckCircle2 size={16} />} onClick={() => { setSettleError(''); setSettleTarget(detail) }}>Registrar pagamento</Button>}<Button variant="secondary" icon={<FileBarChart size={16} />} onClick={() => openBillStatement(detail.id)}>Extrato do boleto</Button><label className="button button--secondary"><Upload size={16} />{uploadMutation.isPending ? 'Anexando...' : detail.bankDocumentAvailable ? 'Substituir boleto bancário' : 'Anexar boleto bancário'}<input hidden type="file" accept="application/pdf,.pdf" disabled={uploadMutation.isPending} onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadMutation.mutate({ id: detail.id, file }); event.currentTarget.value = '' }} /></label><Button variant="secondary" icon={<Mail size={16} />} disabled={emailMutation.isPending} onClick={() => { setEmailError(''); setEmailTarget(detail) }}>{detail.emailSent ? 'Reenviar e-mail' : 'Enviar por e-mail'}</Button><Button icon={<Eye size={16} />} disabled={pdfMutation.isPending} onClick={() => previewBillPdf(detail)}>{pdfMutation.isPending ? 'Gerando PDF...' : 'Visualizar demonstrativo'}</Button></> : undefined,
      } : null}
      onSelectBill={setDetailId}
      onOpenStatement={setStatementSource}
      onClose={closeClientWorkspace}
    />
    <MultipleSettlementDialog key={settleTarget ? `settle-${settleTarget.id}` : batchSettleOpen ? `settle-batch-${selectedBillRows.map((bill) => bill.id).join('-')}` : 'settle-closed'} open={settleTarget !== null || batchSettleOpen} title={settleTarget ? `Pagamento do boleto #${settleTarget.number || settleTarget.id}` : `Pagamento em lote de ${selectedBillRows.length} boleto(s)`} count={settleTarget?.receivables?.length || selectedBillRows.length} total={settleTarget?.amount ?? selectedBillRows.reduce((sum, bill) => sum + Number(bill.amount || 0), 0)} movementAccounts={movementAccountsQuery.data} busy={settleMutation.isPending} error={settleError} defaultMethod="BILL" onClose={() => { setSettleTarget(null); setBatchSettleOpen(false) }} onSubmit={(payload) => settleMutation.mutate({ billIds: settleTarget ? [settleTarget.id] : selectedBillRows.map((bill) => bill.id), paidAt: payload.paidAt, movementAccountId: payload.movementAccountId, paymentMethod: payload.paymentMethod })} />
    <Modal open={billPdfPreview !== null} onClose={closeBillPdfPreview} title={billPdfPreview ? `Demonstrativo #${billPdfPreview.bill.number || billPdfPreview.bill.id}` : 'Demonstrativo'} description="Este documento não é o boleto bancário; ele detalha a cobrança." size="xlarge">
      <div className="modal__body contract-document-modal__body">
        {billPdfPreview && <iframe id="bill-pdf-preview" className="contract-document-frame" src={billPdfPreview.url} title={`Visualização do boleto ${billPdfPreview.bill.number || billPdfPreview.bill.id}`} />}
      </div>
      <footer className="modal__footer detail-modal__footer">
        <Button variant="secondary" icon={<ExternalLink size={16} />} onClick={() => billPdfPreview && window.open(billPdfPreview.url, '_blank', 'noopener,noreferrer')}>Abrir em nova aba</Button>
        <Button variant="secondary" icon={<Download size={16} />} onClick={downloadBillPdf}>Baixar PDF</Button>
        <Button icon={<Printer size={16} />} onClick={printBillPdf}>Imprimir</Button>
      </footer>
    </Modal>
    <ConfirmDialog
      open={emailTarget !== null}
      title={emailTarget?.emailSent ? 'Reenviar este boleto por e-mail?' : 'Enviar este boleto por e-mail?'}
      description={`O demonstrativo e os anexos configurados serão enviados para ${emailTarget?.clientEmail || 'o e-mail principal do cliente'}. O boleto bancário só acompanha o e-mail quando estiver anexado.`}
      confirmLabel={emailTarget?.emailSent ? 'Reenviar boleto' : 'Enviar boleto'}
      busyLabel="Enviando..."
      eyebrow="Envio por e-mail"
      icon={<Send size={24} />}
      variant="primary"
      busy={emailMutation.isPending}
      error={emailError}
      onCancel={() => { if (!emailMutation.isPending) { setEmailTarget(null); setEmailError('') } }}
      onConfirm={() => emailTarget && !emailMutation.isPending && emailMutation.mutate(emailTarget)}
    />
    <BillStatementModal source={statementSource} onClose={() => setStatementSource(null)} />
    {toast && <Toast message={toast} onClose={() => setToast('')} />}
  </>
}

function BillPrintingTab({ showToast }: { showToast: (message: string) => void }) {
  const initial = useMemo(currentMonthPeriod, [])
  const [dueStart, setDueStart] = useState(initial.startDate)
  const [dueEnd, setDueEnd] = useState(initial.endDate)
  const [relation, setRelation] = useState<'bills' | 'audited'>('bills')
  const [onlyStatementClients, setOnlyStatementClients] = useState(true)
  const printRef = useRef<HTMLDivElement>(null)
  const valid = Boolean(dueStart && dueEnd && dueStart <= dueEnd)
  const query = useQuery({
    queryKey: [...queryKeys.bills, 'printing', dueStart, dueEnd],
    queryFn: () => api.bills.printing(dueStart, dueEnd),
    enabled: valid,
  })
  const statementMutation = useMutation({
    mutationFn: () => api.bills.statementsPdf(dueStart, dueEnd, onlyStatementClients),
    onSuccess: openPdf,
    onError: (error) => showToast(apiErrorMessage(error, 'Não foi possível gerar o PDF consolidado de extratos.')),
  })
  const rows = query.data ?? []
  const visible = relation === 'audited' ? rows.filter((row) => row.audited) : rows

  function exportExcel() {
    if (relation === 'audited') {
      downloadCsv(`auditados-${dueStart}-${dueEnd}`, ['Cliente', 'Endereço', 'CNPJ/CPF', 'Descrição', 'Mão de obra', 'Materiais', 'Desconto', 'Alíquota ISS', 'Vr. ISS', 'Valor NF', 'Tributos aproximados', 'ISS retido'], visible.map((row) => [row.clientName, row.address, row.document, row.invoiceDescription, row.laborAmount, row.materialAmount, row.discountAmount, row.issRate, row.issAmount, row.invoiceAmount, row.approximateTaxAmount, row.issRetained ? 'SIM' : 'NÃO']))
    } else {
      downloadCsv(`boletos-${dueStart}-${dueEnd}`, ['Cliente', 'Vencimento', 'Nº boleto', 'Mão de obra', 'Material', 'Diversos', 'Total', 'E-mail', 'Envio', 'Extrato'], visible.map((row) => [row.clientName, dateText(row.dueAt), row.billNumber, row.laborAmount, row.materialAmount, row.otherAmount, row.totalAmount, row.email, row.delivery, row.statementDelivery]))
    }
  }

  return <section className="panel data-panel bill-panel">
    <div className="billing-filter-panel">
      <div className="billing-filter-panel__heading"><div><strong>Impressões por vencimento</strong><small>Relações do fechamento mensal no formato do POP.</small></div><Badge tone="blue">POP p.48</Badge></div>
      <div className="billing-filter-grid">
        <label className="billing-filter-group billing-filter-group--dates"><span>Vencimento</span><div><input type="date" value={dueStart} max={dueEnd || undefined} onChange={(event) => setDueStart(event.target.value)} /><i>até</i><input type="date" value={dueEnd} min={dueStart || undefined} onChange={(event) => setDueEnd(event.target.value)} /></div></label>
      </div>
      <div className="billing-search-row billing-search-row--actions">
        <Button variant={relation === 'bills' ? 'primary' : 'secondary'} onClick={() => setRelation('bills')}>Boletos</Button>
        <Button variant={relation === 'audited' ? 'primary' : 'secondary'} onClick={() => setRelation('audited')}>Auditados</Button>
        <label><input type="checkbox" checked={onlyStatementClients} onChange={(event) => setOnlyStatementClients(event.target.checked)} /> Extratos somente para clientes com Extrato = SIM</label>
        <Button variant="secondary" icon={<FileBarChart size={16} />} disabled={!valid || statementMutation.isPending} onClick={() => statementMutation.mutate()}>{statementMutation.isPending ? 'Gerando extratos...' : 'Extratos (PDF único)'}</Button>
        <Button variant="secondary" disabled title="aguardando modelo da cliente">Protocolo</Button>
        <Button variant="secondary" icon={<FileSpreadsheet size={16} />} disabled={!visible.length} onClick={exportExcel}>Excel</Button>
        <Button icon={<Printer size={16} />} disabled={!visible.length} onClick={() => printElement(printRef.current, relation === 'audited' ? 'Relação de Auditados' : 'Relação de Boletos')}>Imprimir / PDF</Button>
      </div>
    </div>
    {!valid ? <EmptyState title="Período inválido" description="A data inicial deve ser anterior ou igual à final." /> : query.isLoading ? <LoadingState label="Carregando relação de boletos..." /> : query.isError ? <ErrorState message={apiErrorMessage(query.error)} onRetry={() => query.refetch()} /> : !visible.length ? <EmptyState title="Nenhum registro encontrado" description="Não há boletos no vencimento informado para esta relação." /> : <div ref={printRef}>
      <div className="print-header"><div><h1>{relation === 'audited' ? 'Relação de clientes auditados' : 'Relação de boletos'}</h1><small>Vencimentos de {dateText(dueStart)} a {dateText(dueEnd)}</small></div><strong>{visible.length} registro(s)</strong></div>
      <div className="table-wrap"><table className="data-table"><thead><tr>{(relation === 'audited' ? ['Cliente', 'Endereço / documento', 'Descrição', 'Mão de obra', 'Materiais', 'Desconto', 'Alíquota', 'Vr. ISS', 'Valor NF', 'Tributos aprox.', 'ISS retido'] : ['Cliente', 'Vencimento', 'Nº boleto', 'Mão de obra', 'Material', 'Diversos', 'Total', 'E-mail', 'Envio', 'Extrato']).map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{visible.map((row) => relation === 'audited' ? <tr key={row.billId}><td>{row.clientId} · {row.clientName}</td><td>{row.address}<small className="table-secondary">{row.document}</small></td><td>{row.invoiceDescription}</td><td>{money(row.laborAmount)}</td><td>{money(row.materialAmount)}</td><td>{money(row.discountAmount)}</td><td>{Number(row.issRate || 0).toLocaleString('pt-BR')}%</td><td>{money(row.issAmount)}</td><td><strong>{money(row.invoiceAmount)}</strong></td><td>{money(row.approximateTaxAmount)}</td><td>{row.issRetained ? 'SIM' : 'NÃO'}</td></tr> : <tr key={row.billId}><td>{row.clientId} · {row.clientName}</td><td>{formatDate(row.dueAt)}</td><td>{row.billNumber}</td><td>{money(row.laborAmount)}</td><td>{money(row.materialAmount)}</td><td>{money(row.otherAmount)}</td><td><strong>{money(row.totalAmount)}</strong></td><td>{row.email || '—'}</td><td>{row.delivery || '—'}</td><td>{row.statementDelivery || '—'}</td></tr>)}</tbody></table></div>
      <footer className="table-footer"><span>Total: <strong>{money(visible.reduce((sum, row) => sum + Number(relation === 'audited' ? row.invoiceAmount : row.totalAmount), 0))}</strong></span></footer>
    </div>}
  </section>
}

export function ClientStatementsTab({ showToast }: { showToast: (message: string) => void }) {
  const initialPeriod = useMemo(previousMonthPeriod, [])
  const [startDate, setStartDate] = useState(initialPeriod.startDate)
  const [endDate, setEndDate] = useState(initialPeriod.endDate)
  const [search, setSearch] = useState('')
  const [cpfFilter, setCpfFilter] = useState('')
  const [cnpjFilter, setCnpjFilter] = useState('')
  const [clientCode, setClientCode] = useState('')
  const [attendanceLocation, setAttendanceLocation] = useState('')
  const [page, setPage] = useState(0)
  const [detailClientId, setDetailClientId] = useState<number | null>(null)
  const [pdfPreview, setPdfPreview] = useState<{ url: string; statement: Pick<ClientStatementSummary, 'clientId' | 'clientName' | 'clientTradeName'> } | null>(null)
  const debouncedSearch = useDebouncedValue(search.trim())
  const [pageSize, setPageSize] = useState(10)
  const validPeriod = Boolean(startDate && endDate && startDate <= endDate)

  const statementsQuery = useQuery({
    queryKey: [...queryKeys.clientStatements, startDate, endDate, debouncedSearch, cpfFilter, cnpjFilter, clientCode, attendanceLocation, page, pageSize],
    queryFn: () => api.clientStatements.list({
      startDate,
      endDate,
      clientName: debouncedSearch || undefined,
      cpf: cpfFilter || undefined,
      cnpj: cnpjFilter || undefined,
      clientId: clientCode ? Number(clientCode) : undefined,
      attendanceLocation: attendanceLocation || undefined,
      page,
      size: pageSize,
    }),
    enabled: validPeriod,
    refetchInterval: 60_000,
  })
  const detailQuery = useQuery({
    queryKey: [...queryKeys.clientStatements, 'detail', detailClientId, startDate, endDate],
    queryFn: () => api.clientStatements.find(detailClientId!, startDate, endDate),
    enabled: detailClientId !== null && validPeriod,
    refetchInterval: detailClientId !== null ? 60_000 : false,
  })
  const pdfMutation = useMutation({
    mutationFn: async (statement: Pick<ClientStatementSummary, 'clientId' | 'clientName' | 'clientTradeName'>) => ({ statement, blob: await api.clientStatements.pdf(statement.clientId, startDate, endDate) }),
    onSuccess: ({ statement, blob }) => {
      const url = URL.createObjectURL(blob)
      setPdfPreview((current) => {
        if (current) URL.revokeObjectURL(current.url)
        return { statement, url }
      })
    },
    onError: (error) => showToast(apiErrorMessage(error, 'Não foi possível gerar o PDF do extrato.')),
  })

  const statements = statementsQuery.data?.content ?? []
  const total = statementsQuery.data?.total ?? 0
  const totalPages = statementsQuery.data?.totalPages ?? 0
  const statementSummaryQuery = useQuery({
    queryKey: [...modulesKeys.summaries, 'client-statements', startDate, endDate, debouncedSearch, cpfFilter, cnpjFilter, clientCode, attendanceLocation],
    queryFn: () => modulesApi.summaries.get('client-statements', { startDate, endDate, clientName: debouncedSearch || undefined, cpf: cpfFilter || undefined, cnpj: cnpjFilter || undefined, clientId: clientCode ? Number(clientCode) : undefined, attendanceLocation: attendanceLocation || undefined }),
    enabled: validPeriod,
  })
  const firstResult = total === 0 ? 0 : page * pageSize + 1
  const lastResult = Math.min((page + 1) * pageSize, total)
  const detail = detailQuery.data

  useEffect(() => () => {
    if (pdfPreview) URL.revokeObjectURL(pdfPreview.url)
  }, [pdfPreview])

  function changePeriod(setter: (value: string) => void, value: string) {
    setter(value)
    setPage(0)
    setDetailClientId(null)
  }

  function closePdfPreview() {
    setPdfPreview(null)
  }

  function downloadPdfPreview() {
    if (!pdfPreview) return
    const link = document.createElement('a')
    link.href = pdfPreview.url
    link.download = `extrato-${pdfPreview.statement.clientId}-${startDate}-a-${endDate}.pdf`
    link.click()
  }

  function printPdfPreview() {
    const frame = document.getElementById('client-statement-pdf-preview') as HTMLIFrameElement | null
    frame?.contentWindow?.print()
  }

  return <>
    <section className="stats-grid stats-grid--four statement-stats">
      <StatCard label="Clientes no período" value={String(total)} helper="Com movimentação registrada" icon={<Users />} tone="blue" />
      <StatCard label="Atendimentos" value={summaryNumber(statementSummaryQuery.data, 'serviceOrders').toLocaleString('pt-BR')} helper="Total geral do filtro" icon={<FileText />} tone="purple" />
      <StatCard label="Tempo utilizado" value={formatMinutes(summaryNumber(statementSummaryQuery.data, 'usedMinutes'))} helper="Inclui OS em andamento" icon={<Timer />} tone="orange" />
      <StatCard label="Valor total" value={money(summaryNumber(statementSummaryQuery.data, 'amount'))} helper={`Inclui ${money(summaryNumber(statementSummaryQuery.data, 'materialAmount'))} em materiais`} icon={<Landmark />} tone="green" />
    </section>

    <section className="panel data-panel client-statement-panel">
      <CollapsibleFilters summary="Cliente, local, documentos e período" activeCount={[search, clientCode, attendanceLocation, cpfFilter, cnpjFilter, startDate, endDate].filter(Boolean).length} onClear={() => { setSearch(''); setClientCode(''); setAttendanceLocation(''); setCpfFilter(''); setCnpjFilter(''); setStartDate(''); setEndDate(''); setPage(0); setDetailClientId(null) }} contentClassName="data-toolbar client-statement-toolbar">
        <label className="structured-filter-field"><span>Nome do cliente</span><div className="search-box"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Razão social ou nome fantasia" /></div></label>
        <label className="structured-filter-field"><span>Código do cliente</span><input type="number" min="1" value={clientCode} onChange={(event) => { setClientCode(event.target.value); setPage(0) }} /></label>
        <label className="structured-filter-field structured-filter-field--wide"><span>Local de atendimento</span><input value={attendanceLocation} onChange={(event) => { setAttendanceLocation(event.target.value); setPage(0) }} placeholder="Nome, endereço ou bairro" /></label>
        <label className="structured-filter-field"><span>CPF</span><input inputMode="numeric" value={cpfFilter} onChange={(event) => { setCpfFilter(event.target.value.replace(/\D/g, '')); setPage(0) }} /></label>
        <label className="structured-filter-field"><span>CNPJ</span><input inputMode="numeric" value={cnpjFilter} onChange={(event) => { setCnpjFilter(event.target.value.replace(/\D/g, '')); setPage(0) }} /></label>
        <label className="statement-date-field"><span>De</span><input type="date" value={startDate} max={endDate || undefined} onChange={(event) => changePeriod(setStartDate, event.target.value)} /></label>
        <label className="statement-date-field"><span>Até</span><input type="date" value={endDate} min={startDate || undefined} onChange={(event) => changePeriod(setEndDate, event.target.value)} /></label>
      </CollapsibleFilters>
      {!validPeriod ? <EmptyState title="Período inválido" description="A data inicial deve ser anterior ou igual à data final." /> : statementsQuery.isLoading ? <LoadingState label="Consolidando extratos dos clientes..." /> : statementsQuery.isError ? <ErrorState message={apiErrorMessage(statementsQuery.error)} onRetry={() => statementsQuery.refetch()} /> : statements.length === 0 ? <EmptyState title="Nenhum extrato encontrado" description="Não existem ordens de serviço para os clientes no período selecionado." /> : <div className="table-wrap"><table className="data-table client-statement-table"><thead><tr><th>Cliente</th><th>Contrato</th><th>Período</th><th>Contratado</th><th>Utilizado</th><th>Saldo</th><th>Excedente</th><th>OS</th><th>Locais</th><th>Serviços</th><th>Total</th><th>PDF</th><th /></tr></thead><tbody>{statements.map((statement) => <tr key={statement.clientId} onClick={() => setDetailClientId(statement.clientId)}>
        <td><strong className="table-primary">{statement.clientTradeName || statement.clientName || `Cliente #${statement.clientId}`}</strong><small className="table-secondary">{statement.clientTradeName && statement.clientName ? statement.clientName : statement.clientDocument || `Código ${statement.clientId}`}</small></td>
        <td>{statement.contractId ? `#${statement.contractId}` : <Badge tone="neutral">Avulso</Badge>}</td>
        <td>{formatDate(statement.periodStart)}–{formatDate(statement.periodEnd)}</td>
        <td>{formatMinutes(statement.contractedMinutes)}</td><td><strong>{formatMinutes(statement.usedMinutes)}</strong></td><td><Badge tone={statement.availableMinutes > 0 ? 'green' : 'neutral'}>{formatMinutes(statement.availableMinutes)}</Badge></td><td><Badge tone={statement.extraMinutes > 0 ? 'orange' : 'neutral'}>{formatMinutes(statement.extraMinutes)}</Badge></td>
        <td>{statement.serviceOrderCount}</td><td>{statement.attendanceLocationCount}</td><td>{money(statement.serviceAmount)}</td><td><strong>{money(statement.totalAmount)}</strong></td>
        <td><button type="button" className="bill-pdf-button" disabled={pdfMutation.isPending} onClick={(event) => { event.stopPropagation(); pdfMutation.mutate(statement) }} aria-label={`Visualizar extrato de ${statement.clientTradeName || statement.clientName}`}><Eye size={16} /></button></td>
        <td><button type="button" className="row-action" aria-label={`Visualizar extrato de ${statement.clientTradeName || statement.clientName}`}><ChevronRight size={18} /></button></td>
      </tr>)}</tbody></table></div>}
      <footer className="table-footer table-footer--pagination"><span>Mostrando <strong>{firstResult}–{lastResult}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong> extratos</span><div className="pagination-controls"><label>Itens <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}>{[5, 10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label><button disabled={page === 0 || statementsQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button><span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span><button disabled={page + 1 >= totalPages || statementsQuery.isFetching} onClick={() => setPage((value) => value + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button></div></footer>
    </section>

    <DetailModal open={detailClientId !== null} onClose={() => setDetailClientId(null)} title={detail ? `Extrato · ${detail.clientTradeName || detail.clientName || `Cliente #${detail.clientId}`}` : 'Extrato do cliente'} description={`Movimentações de ${formatDate(startDate)} a ${formatDate(endDate)}.`} size="xlarge" actions={detail ? <Button icon={<Eye size={16} />} disabled={pdfMutation.isPending} onClick={() => pdfMutation.mutate(detail)}>{pdfMutation.isPending ? 'Gerando PDF...' : 'Visualizar PDF'}</Button> : undefined}>
      {detailQuery.isLoading ? <LoadingState label="Carregando extrato..." /> : detailQuery.isError ? <ErrorState message={apiErrorMessage(detailQuery.error)} onRetry={() => detailQuery.refetch()} /> : detail ? <ClientStatementDetails statement={detail} /> : null}
    </DetailModal>
    <Modal open={pdfPreview !== null} onClose={closePdfPreview} title="Extrato do cliente" description={pdfPreview ? `${pdfPreview.statement.clientTradeName || pdfPreview.statement.clientName || `Cliente #${pdfPreview.statement.clientId}`} · ${formatDate(startDate)} a ${formatDate(endDate)}` : undefined} size="xlarge">
      <div className="modal__body contract-document-modal__body">
        {pdfPreview && <iframe id="client-statement-pdf-preview" className="contract-document-frame" src={pdfPreview.url} title="Visualização do extrato em PDF" />}
      </div>
      <footer className="modal__footer detail-modal__footer">
        <Button variant="secondary" icon={<ExternalLink size={16} />} onClick={() => pdfPreview && window.open(pdfPreview.url, '_blank', 'noopener,noreferrer')}>Abrir em nova aba</Button>
        <Button variant="secondary" icon={<Download size={16} />} onClick={downloadPdfPreview}>Baixar PDF</Button>
        <Button icon={<Printer size={16} />} onClick={printPdfPreview}>Imprimir</Button>
      </footer>
    </Modal>
  </>
}

function previousMonthPeriod() {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const end = new Date(today.getFullYear(), today.getMonth(), 0)
  return { startDate: localDate(start), endDate: localDate(end) }
}

function currentMonthPeriod() {
  const today = new Date()
  return {
    startDate: localDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    endDate: localDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
  }
}

function localDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

