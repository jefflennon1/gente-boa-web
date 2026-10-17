import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download, ExternalLink, FileCheck2, Printer } from 'lucide-react'
import { apiErrorMessage } from '../api/client'
import { financeApi, financeKeys } from '../api/finance'
import { queryKeys } from '../api/services'
import { todayIso } from '../lib/export'
import { formatDate, money } from '../lib/format'
import type { PayableAccount } from '../types'
import type { Receivable } from '../types-finance'
import { Button, EmptyState, ErrorState, LoadingState } from './ui'

export type ReceiptKind = 'receivable' | 'payable'

/** Conta com recebimento/pagamento registrado, no formato comum às listas de recibos. */
export type ReceiptRow = {
  id: number
  party: string
  description: string | null
  serviceOrderId: number | null
  documentText: string
  dueAt: string | null
  settledAt: string | null
  amount: number
  settledAmount: number
  balance: number
}

export const receiptCodes: Record<ReceiptKind, string> = { receivable: 'CR', payable: 'CP' }

export function receivableReceiptRow(row: Receivable): ReceiptRow {
  return { id: row.id, party: row.clientTradeName || row.clientName || `Cliente #${row.clientId ?? '—'}`, description: row.description, serviceOrderId: row.serviceOrderId, documentText: row.billNumber ? `Boleto ${row.billNumber}` : '—', dueAt: row.dueAt, settledAt: row.receivedAt, amount: row.amount, settledAmount: row.receivedAmount, balance: row.balance }
}

export function payableReceiptRow(row: PayableAccount): ReceiptRow {
  return { id: row.id, party: row.supplierName || `Fornecedor #${row.supplierId}`, description: row.description, serviceOrderId: row.serviceOrderId, documentText: row.invoiceNumber ? `NF ${row.invoiceNumber}` : row.purchaseOrderId ? `Pedido ${row.purchaseOrderId}` : '—', dueAt: row.dueAt, settledAt: row.paidAt, amount: row.amountDue, settledAmount: row.amountPaid, balance: row.balance }
}

function fetchReceipt(kind: ReceiptKind, id: number) {
  return kind === 'receivable' ? financeApi.receivables.receipt(id) : financeApi.payables.receipt(id)
}

/** PDF do recibo de uma conta, com abrir em nova aba, baixar e imprimir. */
export function ReceiptDocument({ kind, id }: { kind: ReceiptKind; id: number }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const frameId = `receipt-frame-${kind}-${id}`

  useEffect(() => {
    let active = true
    let created: string | null = null
    setUrl(null)
    setError('')
    fetchReceipt(kind, id)
      .then((blob) => {
        if (!active) return
        created = URL.createObjectURL(blob)
        setUrl(created)
      })
      .catch((reason) => { if (active) setError(apiErrorMessage(reason, 'Não foi possível gerar o recibo.')) })
    return () => {
      active = false
      if (created) URL.revokeObjectURL(created)
    }
  }, [kind, id, attempt])

  function download() {
    if (!url) return
    const link = document.createElement('a')
    link.href = url
    link.download = `recibo-${receiptCodes[kind].toLowerCase()}-${id}.pdf`
    link.click()
  }

  if (error) return <ErrorState message={error} onRetry={() => setAttempt((value) => value + 1)} />
  if (!url) return <LoadingState label="Gerando recibo..." />
  return <div className="receipt-document">
    <div className="receipt-document__actions">
      <Button type="button" variant="secondary" icon={<ExternalLink size={15} />} onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>Abrir em nova aba</Button>
      <Button type="button" variant="secondary" icon={<Download size={15} />} onClick={download}>Baixar PDF</Button>
      <Button type="button" icon={<Printer size={15} />} onClick={() => (document.getElementById(frameId) as HTMLIFrameElement | null)?.contentWindow?.print()}>Imprimir</Button>
    </div>
    <iframe id={frameId} className="contract-document-frame receipt-document__frame" src={url} title={`Recibo ${receiptCodes[kind]} ${id}`} />
  </div>
}

/** Recibo de uma conta específica; sem recebimento/pagamento registrado não há recibo. */
export function AccountReceipt({ kind, id, settledAmount }: { kind: ReceiptKind; id: number; settledAmount: number }) {
  if (!Number(settledAmount)) {
    return <EmptyState title="Recibo indisponível" description={kind === 'receivable' ? 'O recibo é emitido depois que a conta tiver recebimento registrado.' : 'O recibo é emitido depois que a conta tiver pagamento registrado.'} />
  }
  return <ReceiptDocument kind={kind} id={id} />
}

/**
 * Recibos de um cliente (contas a receber recebidas) ou de um fornecedor (contas a pagar pagas): lista as contas com
 * baixa, da mais recente para a mais antiga, e abre o recibo de cada uma. Dentro do modal de uma conta
 * ({@code currentAccount}), já abre no recibo dela quando houver baixa.
 */
export function PartyReceipts({ kind, partyId, currentAccount }: { kind: ReceiptKind; partyId: number; currentAccount?: ReceiptRow }) {
  const [selected, setSelected] = useState<ReceiptRow | null>(currentAccount && Number(currentAccount.settledAmount) !== 0 ? currentAccount : null)
  const partyLabel = kind === 'receivable' ? 'do cliente' : 'do fornecedor'
  const listQuery = useQuery({
    queryKey: [...(kind === 'receivable' ? financeKeys.receivables : queryKeys.payables), 'party-receipts', partyId],
    queryFn: async () => {
      // Filtrar pela data da baixa traz só as contas recebidas/pagas (as demais não têm essa data).
      const period = { startDate: '2000-01-01', endDate: todayIso(), status: 'ALL' as const, page: 0, size: 100 }
      const rows = kind === 'receivable'
        ? (await financeApi.receivables.list({ ...period, clientId: partyId, dateField: 'RECEIPT_DATE', sortBy: 'RECEIPT_DATE', direction: 'DESC' })).content.map(receivableReceiptRow)
        : (await financeApi.payables.list({ ...period, supplierId: partyId, dateField: 'PAYMENT_DATE' })).content.map(payableReceiptRow)
      return rows.filter((row) => Number(row.settledAmount) !== 0)
        .sort((a, b) => String(b.settledAt ?? '').localeCompare(String(a.settledAt ?? '')) || b.id - a.id)
    },
  })
  const code = receiptCodes[kind]
  const settledLabel = kind === 'receivable' ? 'Recebimento' : 'Pagamento'

  if (selected) {
    return <div className="client-workspace__section">
      <ReceiptsHeading title={`Recibo ${code} #${selected.id}`} description={`${selected.description || 'Sem descrição'} · ${money(selected.settledAmount)} em ${formatDate(selected.settledAt)}`} action={<Button type="button" variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => setSelected(null)}>{currentAccount ? `Ver todos os recibos ${partyLabel}` : 'Voltar à lista'}</Button>} />
      <ReceiptDocument kind={kind} id={selected.id} />
    </div>
  }
  const rows = listQuery.data ?? []
  return <div className="client-workspace__section">
    <ReceiptsHeading title={`Recibos ${partyLabel}`} description={kind === 'receivable' ? 'Contas recebidas deste cliente: abra o recibo de pagamento para enviar ou imprimir.' : 'Contas pagas a este fornecedor: abra o recibo para o fornecedor assinar.'} />
    {currentAccount && Number(currentAccount.settledAmount) === 0 && <p className="receipts-notice">A conta {code} #{currentAccount.id} ainda não tem {kind === 'receivable' ? 'recebimento' : 'pagamento'} registrado: o recibo dela aparece aqui depois da baixa.</p>}
    {listQuery.isLoading ? <LoadingState label="Carregando recibos..." /> : listQuery.isError ? <ErrorState message={apiErrorMessage(listQuery.error)} onRetry={() => listQuery.refetch()} /> : rows.length === 0 ? <EmptyState title="Nenhum recibo disponível" description={kind === 'receivable' ? 'Este cliente ainda não tem contas recebidas.' : 'Este fornecedor ainda não tem contas pagas.'} /> : <div className="table-wrap"><table className="data-table receipts-table">
      <thead><tr><th>{code}</th><th>Descrição</th><th>OS</th><th>Documento</th><th>Vencimento</th><th>{settledLabel}</th><th className="num">Valor</th><th className="num">{kind === 'receivable' ? 'Recebido' : 'Pago'}</th><th className="num">Saldo</th><th /></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id} className={row.id === currentAccount?.id ? 'receipts-table__current' : undefined}>
        <td><strong>#{row.id}</strong></td><td>{row.description || 'Sem descrição'}</td><td>{row.serviceOrderId || '—'}</td><td>{row.documentText}</td>
        <td>{formatDate(row.dueAt)}</td><td>{formatDate(row.settledAt)}</td><td className="num">{money(row.amount)}</td><td className="num"><strong>{money(row.settledAmount)}</strong></td><td className="num">{money(row.balance)}</td>
        <td><Button type="button" variant="secondary" icon={<FileCheck2 size={15} />} onClick={() => setSelected(row)}>Recibo</Button></td>
      </tr>)}</tbody>
    </table></div>}
  </div>
}

function ReceiptsHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <header className="client-workspace__heading"><div><h3>{title}</h3><p>{description}</p></div>{action}</header>
}

/** Menu lateral dos modais de conta (contas a receber/pagar), no mesmo formato da janela do cliente e de boletos. */
export function AccountWorkspace<T extends string>({ sections, active, onSelect, children }: { sections: Array<{ id: T; label: string; icon: ReactNode; hidden?: boolean }>; active: T; onSelect: (id: T) => void; children: ReactNode }) {
  return <div className="client-workspace account-workspace">
    <nav className="client-workspace__menu" aria-label="Informações da conta">
      {sections.filter((item) => !item.hidden).map((item) => <button key={item.id} type="button" className={active === item.id ? 'active' : ''} aria-current={active === item.id ? 'page' : undefined} onClick={() => onSelect(item.id)}>{item.icon}<span>{item.label}</span></button>)}
    </nav>
    {/* Se o formulário (oculto em outra seção) tiver campo inválido ao salvar, volta para ele. */}
    <div className="client-workspace__content" onInvalidCapture={() => onSelect(sections[0].id)}>{children}</div>
  </div>
}
