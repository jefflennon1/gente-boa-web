import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Download, FileText, Landmark, Mail, ReceiptText, Search, Send, WalletCards } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { enumLabel, formatDate, money } from '../lib/format'
import type { BillDetail, BillListItem } from '../types'
import { Badge, Button, ConfirmDialog, DetailModal, EmptyState, ErrorState, LoadingState, PageHeader, StatCard, Toast } from '../components/ui'

export function Statements() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [visualPaid, setVisualPaid] = useState<Record<number, boolean>>({})
  const [toast, setToast] = useState('')
  const [emailTarget, setEmailTarget] = useState<BillDetail | null>(null)
  const [emailError, setEmailError] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const pageSize = 20

  const billsQuery = useQuery({ queryKey: [...queryKeys.bills, debouncedSearch, page, pageSize], queryFn: () => api.bills.list({ query: debouncedSearch || undefined, page, size: pageSize }) })
  const detailQuery = useQuery({ queryKey: [...queryKeys.bills, 'detail', detailId], queryFn: () => api.bills.find(detailId!), enabled: detailId !== null })
  const pdfMutation = useMutation({
    mutationFn: async (bill: Pick<BillListItem, 'id' | 'number'>) => ({ bill, blob: await api.bills.pdf(bill.id) }),
    onSuccess: ({ bill, blob }) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `boleto-${bill.number || bill.id}.pdf`
      link.click()
      URL.revokeObjectURL(url)
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

  function downloadPdf(bill: Pick<BillListItem, 'id' | 'number'>) {
    pdfMutation.mutate(bill)
  }

  return <>
    <PageHeader eyebrow="Financeiro" title="Boletos e extratos" subtitle="Cobranças geradas automaticamente na finalização das ordens de serviço." />
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
        <td><button type="button" className="bill-pdf-button" disabled={pdfMutation.isPending} onClick={(event) => { event.stopPropagation(); downloadPdf(bill) }} aria-label={`Baixar PDF do boleto ${bill.number || bill.id}`}><Download size={16} /></button></td>
        <td><button className="row-action" aria-label={`Visualizar boleto ${bill.number || bill.id}`}><ChevronRight size={18} /></button></td>
      </tr>)}</tbody></table></div>}
      <footer className="table-footer table-footer--pagination"><span>Mostrando <strong>{firstResult}–{lastResult}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong> boletos</span><div className="pagination-controls"><button disabled={page === 0 || billsQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button><span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span><button disabled={page + 1 >= totalPages || billsQuery.isFetching} onClick={() => setPage((value) => value + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button></div></footer>
    </section>

    <DetailModal open={detailId !== null} onClose={() => setDetailId(null)} title={detail ? `Boleto #${detail.number || detail.id}` : 'Detalhes do boleto'} description="Cliente, composição da cobrança e atendimentos vinculados." size="xlarge" actions={detail ? <><Button variant="secondary" icon={<Mail size={16} />} disabled={emailMutation.isPending} onClick={() => { setEmailError(''); setEmailTarget(detail) }}>{detail.emailSent ? 'Reenviar e-mail' : 'Enviar por e-mail'}</Button><Button icon={<Download size={16} />} disabled={pdfMutation.isPending} onClick={() => downloadPdf(detail)}>{pdfMutation.isPending ? 'Gerando PDF...' : 'Baixar PDF'}</Button></> : undefined}>
      {detailQuery.isLoading ? <LoadingState label="Carregando boleto..." /> : detailQuery.isError ? <ErrorState message={apiErrorMessage(detailQuery.error)} onRetry={() => detailQuery.refetch()} /> : detail ? <BillDetails bill={detail} paid={isPaid(detail)} /> : null}
    </DetailModal>
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

function Value({ label, value, total = false }: { label: string; value: number; total?: boolean }) {
  return <span className={total ? 'bill-composition__total' : ''}><small>{label}</small><strong>{money(value)}</strong></span>
}

function DetailTable({ title, empty, headers, rows }: { title: string; empty: string; headers: string[]; rows: Array<Array<string | number>> }) {
  return <section className="drawer-section bill-detail-table"><h3>{title}</h3>{rows.length === 0 ? <p>{empty}</p> : <div className="table-wrap"><table className="data-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${title}-${index}`}>{row.map((value, cell) => <td key={`${index}-${cell}`}>{value}</td>)}</tr>)}</tbody></table></div>}</section>
}
