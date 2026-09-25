import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Download, ExternalLink, Eye, FileBarChart, FileText, Landmark, Mail, Printer, ReceiptText, Search, Send, Timer, Users, WalletCards } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { enumLabel, formatDate, money } from '../lib/format'
import type { BillDetail, BillListItem, ClientStatementDetail, ClientStatementSummary } from '../types'
import { Badge, Button, ConfirmDialog, DetailModal, EmptyState, ErrorState, LoadingState, Modal, PageHeader, StatCard, Toast } from '../components/ui'

export function Statements() {
  const queryClient = useQueryClient()
  const [section, setSection] = useState<'bills' | 'statements'>('bills')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [visualPaid, setVisualPaid] = useState<Record<number, boolean>>({})
  const [toast, setToast] = useState('')
  const [emailTarget, setEmailTarget] = useState<BillDetail | null>(null)
  const [emailError, setEmailError] = useState('')
  const [billPdfPreview, setBillPdfPreview] = useState<{ url: string; bill: Pick<BillListItem, 'id' | 'number'> } | null>(null)
  const debouncedSearch = useDebouncedValue(search)
  const pageSize = 20

  const billsQuery = useQuery({ queryKey: [...queryKeys.bills, debouncedSearch, page, pageSize], queryFn: () => api.bills.list({ query: debouncedSearch || undefined, page, size: pageSize }), enabled: section === 'bills' })
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

  const bills = billsQuery.data?.content ?? []
  const total = billsQuery.data?.total ?? 0
  const totalPages = billsQuery.data?.totalPages ?? 0
  const pageAmount = useMemo(() => bills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0), [bills])
  const pending = bills.filter((bill) => !isPaid(bill)).length
  const paid = bills.length - pending
  const firstResult = total === 0 ? 0 : page * pageSize + 1
  const lastResult = Math.min((page + 1) * pageSize, total)
  const detail = detailQuery.data

  useEffect(() => () => {
    if (billPdfPreview) URL.revokeObjectURL(billPdfPreview.url)
  }, [billPdfPreview])

  function isPaid(bill: Pick<BillListItem, 'id' | 'paidAt'>) {
    return visualPaid[bill.id] ?? Boolean(bill.paidAt)
  }

  function togglePaid(event: React.MouseEvent, bill: BillListItem) {
    event.stopPropagation()
    setVisualPaid((current) => ({ ...current, [bill.id]: !isPaid(bill) }))
  }

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
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
    link.download = `boleto-${billPdfPreview.bill.number || billPdfPreview.bill.id}.pdf`
    link.click()
  }

  function printBillPdf() {
    const frame = document.getElementById('bill-pdf-preview') as HTMLIFrameElement | null
    frame?.contentWindow?.print()
  }

  return <>
    <PageHeader eyebrow="Financeiro" title="Boletos e extratos" subtitle="Cobranças individuais e demonstrativos consolidados dos clientes." />
    <nav className="system-parameters-menu statement-sections" aria-label="Seções financeiras">
      <button type="button" className={section === 'bills' ? 'active' : ''} onClick={() => setSection('bills')}><WalletCards size={17} />Boletos</button>
      <button type="button" className={section === 'statements' ? 'active' : ''} onClick={() => setSection('statements')}><FileBarChart size={17} />Extratos</button>
    </nav>
    {section === 'bills' ? <>
    <section className="stats-grid stats-grid--four statement-stats">
      <StatCard label="Boletos" value={String(total)} helper="Registros encontrados" icon={<WalletCards />} tone="blue" />
      <StatCard label="Valor nesta página" value={money(pageAmount)} helper={`${bills.length} cobranças exibidas`} icon={<Landmark />} tone="purple" />
      <StatCard label="Pendentes nesta página" value={String(pending)} helper="Controle visual" icon={<Clock3 />} tone="orange" />
      <StatCard label="Pagos nesta página" value={String(paid)} helper="Controle visual" icon={<CheckCircle2 />} tone="green" />
    </section>

    <section className="panel data-panel bill-panel">
      <div className="data-toolbar"><div className="search-box"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Buscar cliente, CPF/CNPJ, boleto ou OS..." /></div></div>
      {billsQuery.isLoading ? <LoadingState label="Carregando boletos..." /> : billsQuery.isError ? <ErrorState message={apiErrorMessage(billsQuery.error)} onRetry={() => billsQuery.refetch()} /> : bills.length === 0 ? <EmptyState title="Nenhum boleto encontrado" description="Os boletos serão gerados quando uma ordem de serviço for finalizada." /> : <div className="table-wrap"><table className="data-table bill-table"><thead><tr><th>Boleto</th><th>OS</th><th>Cliente</th><th>Contrato</th><th>Data cadastro</th><th>Processamento</th><th>Vencimento</th><th>Valor</th><th>Enviado e-mail</th><th>Pagamento</th><th>PDF</th><th /></tr></thead><tbody>{bills.map((bill) => <tr key={bill.id} onClick={() => setDetailId(bill.id)}>
        <td><strong>#{bill.number || bill.id}</strong><small className="table-secondary">Registro {bill.id}</small></td>
        <td><strong>{bill.serviceOrderId || '—'}</strong></td>
        <td><strong className="table-primary">{bill.clientTradeName || bill.clientName || `Cliente #${bill.clientId}`}</strong><small className="table-secondary">{bill.clientTradeName && bill.clientName ? bill.clientName : `Código ${bill.clientId || '—'}`}</small></td>
        <td>{bill.contractId ? `#${bill.contractId}` : 'Avulso'}</td>
        <td>{formatDate(bill.serviceOrderDate)}</td><td>{formatDate(bill.processedAt, true)}</td><td>{formatDate(bill.dueAt)}</td><td><strong>{money(bill.amount)}</strong></td>
        <td><Badge tone={bill.emailSent ? 'green' : 'neutral'}>{bill.emailSent ? 'Sim' : 'Não'}</Badge>{bill.emailSentAt && <small className="table-secondary">{formatDate(bill.emailSentAt, true)}</small>}</td>
        <td><button type="button" className={`bill-paid-toggle ${isPaid(bill) ? 'bill-paid-toggle--on' : ''}`} role="switch" aria-checked={isPaid(bill)} onClick={(event) => togglePaid(event, bill)}><span /><strong>{isPaid(bill) ? 'Pago' : 'Pendente'}</strong></button></td>
        <td><button type="button" className="bill-pdf-button" disabled={pdfMutation.isPending} onClick={(event) => { event.stopPropagation(); previewBillPdf(bill) }} aria-label={`Visualizar PDF do boleto ${bill.number || bill.id}`}><Eye size={16} /></button></td>
        <td><button className="row-action" aria-label={`Visualizar boleto ${bill.number || bill.id}`}><ChevronRight size={18} /></button></td>
      </tr>)}</tbody></table></div>}
      <footer className="table-footer table-footer--pagination"><span>Mostrando <strong>{firstResult}–{lastResult}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong> boletos</span><div className="pagination-controls"><button disabled={page === 0 || billsQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button><span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span><button disabled={page + 1 >= totalPages || billsQuery.isFetching} onClick={() => setPage((value) => value + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button></div></footer>
    </section>
    </> : <ClientStatementsTab showToast={showToast} />}

    <DetailModal open={detailId !== null} onClose={() => setDetailId(null)} title={detail ? `Boleto #${detail.number || detail.id}` : 'Detalhes do boleto'} description="Cliente, composição da cobrança e atendimentos vinculados." size="xlarge" actions={detail ? <><Button variant="secondary" icon={<Mail size={16} />} disabled={emailMutation.isPending} onClick={() => { setEmailError(''); setEmailTarget(detail) }}>{detail.emailSent ? 'Reenviar e-mail' : 'Enviar por e-mail'}</Button><Button icon={<Eye size={16} />} disabled={pdfMutation.isPending} onClick={() => previewBillPdf(detail)}>{pdfMutation.isPending ? 'Gerando PDF...' : 'Visualizar PDF'}</Button></> : undefined}>
      {detailQuery.isLoading ? <LoadingState label="Carregando boleto..." /> : detailQuery.isError ? <ErrorState message={apiErrorMessage(detailQuery.error)} onRetry={() => detailQuery.refetch()} /> : detail ? <BillDetails bill={detail} paid={isPaid(detail)} /> : null}
    </DetailModal>
    <Modal open={billPdfPreview !== null} onClose={closeBillPdfPreview} title={billPdfPreview ? `Boleto #${billPdfPreview.bill.number || billPdfPreview.bill.id}` : 'Boleto'} description="Visualização do documento antes de imprimir ou baixar." size="xlarge">
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
      description={`O PDF será enviado para ${emailTarget?.clientEmail || 'o e-mail principal do cliente'}. Confirme somente depois de conferir o destinatário.`}
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
    {toast && <Toast message={toast} onClose={() => setToast('')} />}
  </>
}

function ClientStatementsTab({ showToast }: { showToast: (message: string) => void }) {
  const initialPeriod = useMemo(previousMonthPeriod, [])
  const [startDate, setStartDate] = useState(initialPeriod.startDate)
  const [endDate, setEndDate] = useState(initialPeriod.endDate)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [detailClientId, setDetailClientId] = useState<number | null>(null)
  const [pdfPreview, setPdfPreview] = useState<{ url: string; statement: Pick<ClientStatementSummary, 'clientId' | 'clientName' | 'clientTradeName'> } | null>(null)
  const debouncedSearch = useDebouncedValue(search.trim())
  const pageSize = 10
  const validPeriod = Boolean(startDate && endDate && startDate <= endDate)

  const statementsQuery = useQuery({
    queryKey: [...queryKeys.clientStatements, startDate, endDate, debouncedSearch, page, pageSize],
    queryFn: () => api.clientStatements.list({ startDate, endDate, query: debouncedSearch || undefined, page, size: pageSize }),
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
  const pageTotals = useMemo(() => statements.reduce((accumulator, item) => ({
    orders: accumulator.orders + item.serviceOrderCount,
    minutes: accumulator.minutes + item.usedMinutes,
    materials: accumulator.materials + Number(item.materialAmount || 0),
    amount: accumulator.amount + Number(item.totalAmount || 0),
  }), { orders: 0, minutes: 0, materials: 0, amount: 0 }), [statements])
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
      <StatCard label="Atendimentos nesta página" value={String(pageTotals.orders)} helper={`${statements.length} extratos exibidos`} icon={<FileText />} tone="purple" />
      <StatCard label="Tempo utilizado" value={formatMinutes(pageTotals.minutes)} helper="Inclui OS em andamento" icon={<Timer />} tone="orange" />
      <StatCard label="Valor nesta página" value={money(pageTotals.amount)} helper={`Materiais: ${money(pageTotals.materials)}`} icon={<Landmark />} tone="green" />
    </section>

    <section className="panel data-panel client-statement-panel">
      <div className="data-toolbar client-statement-toolbar">
        <div className="search-box"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Filtrar por cliente, código ou CPF/CNPJ..." /></div>
        <label className="statement-date-field"><span>De</span><input type="date" value={startDate} max={endDate || undefined} onChange={(event) => changePeriod(setStartDate, event.target.value)} /></label>
        <label className="statement-date-field"><span>Até</span><input type="date" value={endDate} min={startDate || undefined} onChange={(event) => changePeriod(setEndDate, event.target.value)} /></label>
      </div>
      {!validPeriod ? <EmptyState title="Período inválido" description="A data inicial deve ser anterior ou igual à data final." /> : statementsQuery.isLoading ? <LoadingState label="Consolidando extratos dos clientes..." /> : statementsQuery.isError ? <ErrorState message={apiErrorMessage(statementsQuery.error)} onRetry={() => statementsQuery.refetch()} /> : statements.length === 0 ? <EmptyState title="Nenhum extrato encontrado" description="Não existem ordens de serviço para os clientes no período selecionado." /> : <div className="table-wrap"><table className="data-table client-statement-table"><thead><tr><th>Cliente</th><th>Contrato</th><th>Período</th><th>Contratado</th><th>Utilizado</th><th>Saldo</th><th>Excedente</th><th>OS</th><th>Serviços</th><th>Materiais</th><th>Total</th><th>PDF</th><th /></tr></thead><tbody>{statements.map((statement) => <tr key={statement.clientId} onClick={() => setDetailClientId(statement.clientId)}>
        <td><strong className="table-primary">{statement.clientTradeName || statement.clientName || `Cliente #${statement.clientId}`}</strong><small className="table-secondary">{statement.clientTradeName && statement.clientName ? statement.clientName : statement.clientDocument || `Código ${statement.clientId}`}</small></td>
        <td>{statement.contractId ? `#${statement.contractId}` : <Badge tone="neutral">Avulso</Badge>}</td>
        <td>{formatDate(statement.periodStart)}–{formatDate(statement.periodEnd)}</td>
        <td>{formatMinutes(statement.contractedMinutes)}</td><td><strong>{formatMinutes(statement.usedMinutes)}</strong></td><td><Badge tone={statement.availableMinutes > 0 ? 'green' : 'neutral'}>{formatMinutes(statement.availableMinutes)}</Badge></td><td><Badge tone={statement.extraMinutes > 0 ? 'orange' : 'neutral'}>{formatMinutes(statement.extraMinutes)}</Badge></td>
        <td>{statement.serviceOrderCount}</td><td>{money(statement.serviceAmount)}</td><td>{money(statement.materialAmount)}</td><td><strong>{money(statement.totalAmount)}</strong></td>
        <td><button type="button" className="bill-pdf-button" disabled={pdfMutation.isPending} onClick={(event) => { event.stopPropagation(); pdfMutation.mutate(statement) }} aria-label={`Visualizar extrato de ${statement.clientTradeName || statement.clientName}`}><Eye size={16} /></button></td>
        <td><button type="button" className="row-action" aria-label={`Visualizar extrato de ${statement.clientTradeName || statement.clientName}`}><ChevronRight size={18} /></button></td>
      </tr>)}</tbody></table></div>}
      <footer className="table-footer table-footer--pagination"><span>Mostrando <strong>{firstResult}–{lastResult}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong> extratos</span><div className="pagination-controls"><button disabled={page === 0 || statementsQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button><span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span><button disabled={page + 1 >= totalPages || statementsQuery.isFetching} onClick={() => setPage((value) => value + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button></div></footer>
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

function ClientStatementDetails({ statement }: { statement: ClientStatementDetail }) {
  const services = statement.orders.flatMap((order) => order.services.map((item) => [
    `OS-${order.serviceOrderId || '—'}`, item.description || `Serviço #${item.serviceId}`, item.quantity || 0,
    item.hours || '00:00', money(item.totalAmount),
  ]))
  const materials = statement.orders.flatMap((order) => order.materials.map((item) => [
    `OS-${order.serviceOrderId || '—'}`, item.description || `Material #${item.materialId}`, item.unit || '—',
    item.quantity || 0, money(item.unitAmount), money(item.totalAmount),
  ]))
  return <div className="detail-modal-content client-statement-detail">
    <div className="detail-modal__hero-row"><div className="detail-drawer__hero"><span className="detail-avatar"><FileBarChart /></span><div><span>Extrato de {formatDate(statement.periodStart)} a {formatDate(statement.periodEnd)}</span><h2>{statement.clientTradeName || statement.clientName || `Cliente #${statement.clientId}`}</h2><p>{statement.clientDocument || 'CPF/CNPJ não informado'} · {statement.contractId ? `Contrato #${statement.contractId}` : 'Cliente avulso'}</p></div></div><Badge tone="blue">{statement.serviceOrderCount} atendimento(s)</Badge></div>
    <div className="client-statement-balance-grid"><Value label="Horas contratadas" valueText={formatMinutes(statement.contractedMinutes)} /><Value label="Horas utilizadas" valueText={formatMinutes(statement.usedMinutes)} /><Value label="Saldo disponível" valueText={formatMinutes(statement.availableMinutes)} /><Value label="Horas excedentes" valueText={formatMinutes(statement.extraMinutes)} /></div>
    <div className="detail-sections-grid">
      <section className="drawer-section"><h3>Cliente</h3><dl><div><dt>Código</dt><dd>{statement.clientId}</dd></div><div><dt>Razão social</dt><dd>{statement.clientName || 'Não informada'}</dd></div><div><dt>Nome fantasia</dt><dd>{statement.clientTradeName || 'Não informado'}</dd></div><div><dt>CPF / CNPJ</dt><dd>{statement.clientDocument || 'Não informado'}</dd></div><div><dt>Telefone</dt><dd>{statement.clientPhone || 'Não informado'}</dd></div><div><dt>E-mail</dt><dd>{statement.clientEmail || 'Não informado'}</dd></div><div className="drawer-section__wide"><dt>Endereço</dt><dd>{statement.clientAddress || 'Não informado'}</dd></div></dl></section>
      <section className="drawer-section bill-composition"><h3>Resumo financeiro</h3><div className="bill-composition__grid"><Value label="Serviços" value={statement.serviceAmount} /><Value label="Materiais" value={statement.materialAmount} /><Value label="Taxas e adicionais" value={statement.additionalAmount} /><Value label="Descontos" value={-statement.discountAmount} /><Value label="Total no período" value={statement.totalAmount} total /></div></section>
    </div>
    <DetailTable title="Ordens de serviço do período" empty="Nenhuma ordem de serviço encontrada." headers={['OS', 'Data', 'Descrição', 'Tempo', 'Serviços', 'Materiais', 'Total']} rows={statement.orders.map((order) => [`OS-${order.serviceOrderId || '—'}`, formatDate(order.serviceOrderDate), order.serviceOrderDescription || 'Não informada', order.actualHours || '00:00', money(order.serviceAmount), money(order.materialAmount), money(order.amount)])} />
    <DetailTable title="Serviços realizados" empty="Nenhum serviço registrado." headers={['OS', 'Serviço', 'Qtd.', 'Tempo', 'Total']} rows={services} />
    <DetailTable title="Materiais utilizados" empty="Nenhum material registrado." headers={['OS', 'Material', 'Unidade', 'Qtd.', 'Unitário', 'Total']} rows={materials} />
  </div>
}

function previousMonthPeriod() {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const end = new Date(today.getFullYear(), today.getMonth(), 0)
  return { startDate: localDate(start), endDate: localDate(end) }
}

function localDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatMinutes(minutes: number) {
  const safe = Math.max(0, Math.round(Number(minutes || 0)))
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

function BillDetails({ bill, paid }: { bill: BillDetail; paid: boolean }) {
  return <div className="detail-modal-content bill-detail">
    <div className="detail-modal__hero-row"><div className="detail-drawer__hero"><span className="detail-avatar"><ReceiptText /></span><div><span>Boleto #{bill.number || bill.id}{bill.serviceOrderId ? ` · OS-${bill.serviceOrderId}` : ' · Registro legado'}</span><h2>{bill.clientTradeName || bill.clientName || `Cliente #${bill.clientId}`}</h2><p>Vencimento em {formatDate(bill.dueAt)}</p></div></div><Badge tone={paid ? 'green' : 'orange'}>{paid ? 'Pago' : 'Pendente'}</Badge></div>
    <div className="detail-metrics bill-detail__metrics"><span><small>Valor total</small><strong>{money(bill.amount)}</strong></span><span><small>Serviços</small><strong>{money(bill.serviceAmount)}</strong></span><span><small>Materiais</small><strong>{money(bill.materialAmount)}</strong></span><span><small>Tempo realizado</small><strong>{bill.actualHours || '00:00'}</strong></span></div>
    <div className="detail-sections-grid">
      <section className="drawer-section"><h3>Cliente</h3><dl><div><dt>Código</dt><dd>{bill.clientId || '—'}</dd></div><div><dt>Razão social</dt><dd>{bill.clientName || 'Não informada'}</dd></div><div><dt>Nome fantasia</dt><dd>{bill.clientTradeName || 'Não informado'}</dd></div><div><dt>CPF / CNPJ</dt><dd>{bill.clientDocument || 'Não informado'}</dd></div><div><dt>Telefone</dt><dd>{bill.clientPhone || 'Não informado'}</dd></div><div><dt>E-mail</dt><dd>{bill.clientEmail || 'Não informado'}</dd></div><div className="drawer-section__wide"><dt>Endereço</dt><dd>{bill.clientAddress || 'Não informado'}</dd></div></dl></section>
      <section className="drawer-section"><h3>Ordem de serviço</h3><dl><div><dt>OS</dt><dd>{bill.serviceOrderId ? `OS-${bill.serviceOrderId}` : 'Vínculo não disponível'}</dd></div><div><dt>Contrato</dt><dd>{bill.contractId ? `#${bill.contractId}` : bill.serviceOrderId ? 'Atendimento avulso' : 'Não disponível'}</dd></div><div><dt>Data</dt><dd>{formatDate(bill.serviceOrderDate)}</dd></div><div><dt>Origem</dt><dd>{enumLabel(bill.serviceOrderOrigin)}</dd></div><div><dt>Categoria</dt><dd>{enumLabel(bill.serviceOrderCategory)}</dd></div><div><dt>Tempo cobrado</dt><dd>{bill.billableHours || '00:00'}</dd></div><div className="drawer-section__wide"><dt>Descrição</dt><dd>{bill.serviceOrderDescription || 'Não informada'}</dd></div></dl></section>
    </div>
    <section className="drawer-section bill-composition"><h3>Composição da cobrança</h3><div className="bill-composition__grid"><Value label="Serviços e minutos extras" value={bill.serviceAmount} /><Value label="Materiais" value={bill.materialAmount} /><Value label="Taxa do boleto" value={bill.billFeeAmount} /><Value label="Transporte" value={bill.transportAmount} /><Value label="Aluguel" value={bill.rentalAmount} /><Value label="Outros" value={bill.otherAmount} /><Value label="Desconto" value={-bill.discountAmount} /><Value label="Total" value={bill.amount} total /></div></section>
    <DetailTable title="Serviços cobrados" empty="Nenhum serviço vinculado." headers={['Código', 'Descrição', 'Qtd.', 'Tempo', 'Valor mínimo', 'Minuto', 'Extra', 'Avulso', 'Total']} rows={bill.services.map((item) => [item.serviceId, item.description || 'Não informado', item.quantity || 0, item.hours || '00:00', money(item.minimumAmount), money(item.minuteAmount), money(item.extraMinuteAmount), money(item.oneOffMinuteAmount), money(item.totalAmount)])} />
    <DetailTable title="Materiais utilizados" empty="Nenhum material cobrado." headers={['Código', 'Material', 'Unidade', 'Marca', 'Qtd.', 'Unitário', 'Total']} rows={bill.materials.map((item) => [item.materialId, item.description || 'Não informado', item.unit || '—', item.brand || '—', item.quantity || 0, money(item.unitAmount), money(item.totalAmount)])} />
    <DetailTable title="Atendimentos realizados" empty="Nenhum atendimento vinculado." headers={['Agenda', 'Data', 'Início', 'Fim', 'Duração', 'Profissional']} rows={bill.attendances.map((item) => [item.scheduleId, formatDate(item.date), item.start || '—', item.end || '—', item.duration || '00:00', item.professional || 'Não informado'])} />
    {bill.serviceOrderNotes && <section className="drawer-section"><h3>Observações</h3><p>{bill.serviceOrderNotes}</p></section>}
    <div className="bill-detail__dates"><span><CalendarDays size={15} /> Processado em {formatDate(bill.processedAt, true)}</span><span><FileText size={15} /> Vencimento em {formatDate(bill.dueAt)}</span><span><Mail size={15} /> E-mail: {bill.emailSentAt ? `enviado em ${formatDate(bill.emailSentAt, true)}` : 'ainda não enviado'}</span></div>
  </div>
}

function Value({ label, value = 0, valueText, total = false }: { label: string; value?: number; valueText?: string; total?: boolean }) {
  return <span className={total ? 'bill-composition__total' : ''}><small>{label}</small><strong>{valueText ?? money(value)}</strong></span>
}

function DetailTable({ title, empty, headers, rows }: { title: string; empty: string; headers: string[]; rows: Array<Array<string | number>> }) {
  return <section className="drawer-section bill-detail-table"><h3>{title}</h3>{rows.length === 0 ? <p>{empty}</p> : <div className="table-wrap"><table className="data-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${title}-${index}`}>{row.map((value, cell) => <td key={`${index}-${cell}`}>{value}</td>)}</tr>)}</tbody></table></div>}</section>
}
