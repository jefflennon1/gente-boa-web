import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, FileCheck2, Search } from 'lucide-react'
import { apiErrorMessage } from '../api/client'
import { financeApi, financeKeys } from '../api/finance'
import { queryKeys } from '../api/services'
import { groupReceiptsByServiceOrder, payableReceiptRow, ReceiptDocument, receiptTitle, receivableReceiptRow, type ReceiptKind, type ReceiptRow } from '../components/ReceiptsPanel'
import { Button, CollapsibleFilters, EmptyState, ErrorState, LoadingState, Modal, PageHeader } from '../components/ui'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { monthBounds } from '../lib/export'
import { formatDate, money } from '../lib/format'

const COPY: Record<ReceiptKind, { title: string; subtitle: string; code: string; party: string; settled: string; settledAmount: string; search: string; empty: string }> = {
  receivable: {
    title: 'Recibos de contas a receber',
    subtitle: 'Contas recebidas no período: emita o recibo de pagamento para o cliente.',
    code: 'CR',
    party: 'Cliente',
    settled: 'Recebimento',
    settledAmount: 'Recebido',
    search: 'Cliente, descrição, código, boleto ou OS...',
    empty: 'Nenhuma conta recebida no período informado.',
  },
  payable: {
    title: 'Recibos de contas a pagar',
    subtitle: 'Contas pagas no período: emita o recibo para o fornecedor assinar.',
    code: 'CP',
    party: 'Fornecedor',
    settled: 'Pagamento',
    settledAmount: 'Pago',
    search: 'Fornecedor, descrição, código, pedido, OS ou NF...',
    empty: 'Nenhuma conta paga no período informado.',
  },
}

export function ReceivableReceipts() {
  return <ReceiptsPage kind="receivable" />
}

export function PayableReceipts() {
  return <ReceiptsPage kind="payable" />
}

function ReceiptsPage({ kind }: { kind: ReceiptKind }) {
  const copy = COPY[kind]
  const initial = monthBounds()
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState(initial.start)
  const [endDate, setEndDate] = useState(initial.end)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [preview, setPreview] = useState<ReceiptRow | null>(null)
  const query = useDebouncedValue(search)

  // Só contas com baixa: filtra pela data do recebimento/pagamento (contas sem baixa não têm essa data).
  const listQuery = useQuery({
    queryKey: [...(kind === 'receivable' ? financeKeys.receivables : queryKeys.payables), 'receipts', query, startDate, endDate, page, pageSize],
    queryFn: async () => {
      if (kind === 'receivable') {
        const data = await financeApi.receivables.list({ query: query || undefined, dateField: 'RECEIPT_DATE', startDate: startDate || undefined, endDate: endDate || undefined, status: 'ALL', sortBy: 'RECEIPT_DATE', direction: 'DESC', page, size: pageSize })
        // Recibo único por OS: os lançamentos da mesma OS (mão de obra, material, taxas...) viram uma linha.
        return { ...data, rows: groupReceiptsByServiceOrder(data.content.map(receivableReceiptRow)) }
      }
      const data = await financeApi.payables.list({ query: query || undefined, dateField: 'PAYMENT_DATE', startDate: startDate || undefined, endDate: endDate || undefined, status: 'ALL', page, size: pageSize })
      return { ...data, rows: data.content.map(payableReceiptRow) }
    },
    placeholderData: keepPreviousData,
  })
  function changeFilter(action: () => void) {
    action()
    setPage(0)
  }

  const rows = listQuery.data?.rows ?? []
  const total = listQuery.data?.total ?? 0
  const totalPages = listQuery.data?.totalPages ?? 0
  const activeFilters = [search, startDate, endDate].filter(Boolean).length

  return <>
    <PageHeader eyebrow="Financeiro" title={copy.title} subtitle={copy.subtitle} />
    <section className="panel data-panel">
      <CollapsibleFilters summary={`${copy.party}, descrição e período do ${copy.settled.toLowerCase()}`} activeCount={activeFilters} onClear={() => changeFilter(() => { setSearch(''); setStartDate(initial.start); setEndDate(initial.end) })} contentClassName="finance-filters">
        <label className="finance-filters__wide"><span>Busca</span><div className="search-box"><Search size={18} /><input value={search} onChange={(event) => changeFilter(() => setSearch(event.target.value))} placeholder={copy.search} /></div></label>
        <label><span>{copy.settled} de</span><input type="date" value={startDate} max={endDate || undefined} onChange={(event) => changeFilter(() => setStartDate(event.target.value))} /></label>
        <label><span>Até</span><input type="date" value={endDate} min={startDate || undefined} onChange={(event) => changeFilter(() => setEndDate(event.target.value))} /></label>
      </CollapsibleFilters>
      {listQuery.isLoading ? <LoadingState label="Carregando contas..." /> : listQuery.isError ? <ErrorState message={apiErrorMessage(listQuery.error)} onRetry={() => listQuery.refetch()} /> : rows.length === 0 ? <EmptyState title="Nenhum recibo disponível" description={copy.empty} /> : <div className="table-wrap"><table className="data-table receipts-table">
        <thead><tr><th>{copy.code}</th><th>{copy.party}</th><th>Descrição</th><th>OS</th><th>Documento</th><th>Vencimento</th><th>{copy.settled}</th><th className="num">Valor</th><th className="num">{copy.settledAmount}</th><th className="num">Saldo</th><th /></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}>
          <td><strong>#{row.ids.join(', #')}</strong></td>
          <td><strong className="table-primary">{row.party}</strong></td>
          <td>{row.description || 'Sem descrição'}</td>
          <td>{row.serviceOrderId || '—'}</td>
          <td>{row.documentText}</td>
          <td>{formatDate(row.dueAt)}</td>
          <td>{formatDate(row.settledAt)}</td>
          <td className="num">{money(row.amount)}</td>
          <td className="num"><strong>{money(row.settledAmount)}</strong></td>
          <td className="num">{money(row.balance)}</td>
          <td><Button type="button" variant="secondary" icon={<FileCheck2 size={15} />} disabled={Number(row.settledAmount || 0) === 0} onClick={() => setPreview(row)}>Recibo</Button></td>
        </tr>)}</tbody>
      </table></div>}
      <footer className="table-footer table-footer--pagination"><span>Mostrando <strong>{total === 0 ? 0 : page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong> contas</span><div className="pagination-controls"><label>Por página <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}>{[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label><button disabled={page === 0 || listQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button><span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span><button disabled={page + 1 >= totalPages || listQuery.isFetching} onClick={() => setPage((value) => value + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button></div></footer>
    </section>

    <Modal open={preview !== null} onClose={() => setPreview(null)} title={preview ? receiptTitle(kind, preview) : 'Recibo'} description={preview ? (preview.serviceOrderReceipt ? `${preview.party} · todos os lançamentos recebidos da O.S. ${preview.serviceOrderId} em um único recibo` : `${preview.party} · ${money(preview.settledAmount)} em ${formatDate(preview.settledAt)}`) : undefined} size="xlarge">
      <div className="modal__body">{preview && <ReceiptDocument kind={kind} id={preview.id} serviceOrderId={preview.serviceOrderReceipt ? preview.serviceOrderId : null} />}</div>
    </Modal>
  </>
}
