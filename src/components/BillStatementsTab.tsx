import { useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Eye, FileBarChart, FileDown, Search } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { modulesApi, openPdf, type BillStatementSource } from '../api/modules'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { formatDate, money } from '../lib/format'
import { monthBounds } from '../lib/export'
import { Badge, Button, EmptyState, ErrorState, LoadingState } from './ui'

/**
 * Extratos dos boletos (POP p.40-41): lista os boletos do vencimento e abre o extrato explicativo de cada um
 * (modal com opção de PDF) ou gera um PDF único com todos os extratos do período.
 */
export function BillStatementsTab({ onOpen, showToast }: { onOpen: (source: BillStatementSource) => void; showToast: (message: string) => void }) {
  const initial = useMemo(() => monthBounds(), [])
  const [dueStart, setDueStart] = useState(initial.start)
  const [dueEnd, setDueEnd] = useState(initial.end)
  const [search, setSearch] = useState('')
  const [billNumber, setBillNumber] = useState('')
  const [onlyStatementClients, setOnlyStatementClients] = useState(false)
  const [page, setPage] = useState(0)
  const [pdfLoadingId, setPdfLoadingId] = useState<number | null>(null)
  const debouncedSearch = useDebouncedValue(search.trim())
  const valid = Boolean(dueStart && dueEnd && dueStart <= dueEnd)
  const pageSize = 20

  const billsQuery = useQuery({
    queryKey: [...queryKeys.bills, 'statements', dueStart, dueEnd, debouncedSearch, billNumber, page],
    queryFn: () => api.bills.list({ dueStart, dueEnd, clientName: debouncedSearch || undefined, billNumber: billNumber ? Number(billNumber) : undefined, billingType: 'ALL', paymentStatus: 'ALL', page, size: pageSize }),
    enabled: valid,
    placeholderData: keepPreviousData,
  })
  const batchMutation = useMutation({
    mutationFn: () => api.bills.statementsPdf(dueStart, dueEnd, onlyStatementClients),
    onSuccess: (blob) => openPdf(blob),
    onError: (error) => showToast(apiErrorMessage(error, 'Não foi possível gerar o PDF dos extratos.')),
  })

  async function pdf(billId: number) {
    setPdfLoadingId(billId)
    try {
      openPdf(await modulesApi.bills.statement(billId))
    } catch (error) {
      showToast(apiErrorMessage(error, 'Não foi possível gerar o PDF do extrato.'))
    } finally {
      setPdfLoadingId(null)
    }
  }

  const bills = billsQuery.data?.content ?? []
  const total = billsQuery.data?.total ?? 0
  const totalPages = billsQuery.data?.totalPages ?? 0
  const change = (setter: (value: string) => void) => (event: React.ChangeEvent<HTMLInputElement>) => { setter(event.target.value); setPage(0) }

  return <section className="panel data-panel bill-panel">
    <div className="report-filters">
      <label><span>Vencimento de</span><input type="date" value={dueStart} max={dueEnd || undefined} onChange={change(setDueStart)} /></label>
      <label><span>até</span><input type="date" value={dueEnd} min={dueStart || undefined} onChange={change(setDueEnd)} /></label>
      <label className="report-filters__wide"><span>Cliente</span><div className="search-box"><Search size={18} /><input value={search} onChange={change(setSearch)} placeholder="Razão social ou nome fantasia" /></div></label>
      <label><span>Nº do boleto</span><input type="number" min="1" value={billNumber} onChange={change(setBillNumber)} /></label>
      <div className="report-filters__actions">
        <label className="checkbox-inline"><input type="checkbox" checked={onlyStatementClients} onChange={(event) => setOnlyStatementClients(event.target.checked)} /> Somente clientes com Extrato = SIM</label>
        <Button type="button" variant="secondary" icon={<FileBarChart size={16} />} disabled={!valid || batchMutation.isPending} onClick={() => batchMutation.mutate()}>{batchMutation.isPending ? 'Gerando...' : 'PDF único com os extratos do período'}</Button>
      </div>
    </div>
    {!valid ? <EmptyState title="Período inválido" description="Informe o vencimento inicial e final." /> : billsQuery.isLoading ? <LoadingState label="Carregando boletos..." /> : billsQuery.isError ? <ErrorState message={apiErrorMessage(billsQuery.error)} onRetry={() => billsQuery.refetch()} /> : bills.length === 0 ? <EmptyState title="Nenhum boleto no período" description="Gere os boletos em Criação de boletos ou ajuste o vencimento." /> : <div className="table-wrap"><table className="data-table">
      <thead><tr><th>Boleto</th><th>Cliente</th><th>Vencimento</th><th className="num">Valor</th><th>Pagamento</th><th /></tr></thead>
      <tbody>{bills.map((bill) => <tr key={bill.id} onClick={() => onOpen({ billId: bill.id })}>
        <td><strong>#{bill.number || bill.id}</strong></td>
        <td><strong className="table-primary">{bill.clientTradeName || bill.clientName || `Cliente #${bill.clientId}`}</strong><small className="table-secondary">Código {bill.clientId || '—'}</small></td>
        <td>{formatDate(bill.dueAt)}</td>
        <td className="num"><strong>{money(bill.amount)}</strong></td>
        <td><Badge tone={bill.paid ? 'green' : 'orange'}>{bill.paid ? 'Pago' : 'Pendente'}</Badge></td>
        <td><div className="row-actions">
          <button type="button" className="row-action" title="Ver extrato" onClick={(event) => { event.stopPropagation(); onOpen({ billId: bill.id }) }}><Eye size={16} /></button>
          <button type="button" className="row-action" title="Gerar PDF do extrato" disabled={pdfLoadingId === bill.id} onClick={(event) => { event.stopPropagation(); void pdf(bill.id) }}><FileDown size={16} /></button>
        </div></td>
      </tr>)}</tbody>
    </table></div>}
    <footer className="table-footer table-footer--pagination"><span><strong>{total.toLocaleString('pt-BR')}</strong> boleto(s) no período</span><div className="pagination-controls">
      <button disabled={page === 0 || billsQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button>
      <span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span>
      <button disabled={page + 1 >= totalPages || billsQuery.isFetching} onClick={() => setPage((value) => value + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button>
    </div></footer>
  </section>
}
