import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, Landmark, ReceiptText, Search } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { formatDate, money } from '../lib/format'
import type { AccountsReceivableListItem } from '../types'
import { Badge, Button, EmptyState, ErrorState, FormField, LoadingState, Modal, StatCard } from './ui'
import { AccountsReceivableHourBalance } from './AccountsReceivableHourBalance'

type BillingType = 'ALL' | 'CONTRACT' | 'ONE_OFF'
type GeneratedStatus = 'ALL' | 'GENERATED' | 'PENDING'
type PaymentStatus = 'ALL' | 'PENDING' | 'PAID'

export function AccountsReceivableReview({ showToast }: { showToast: (message: string) => void }) {
  const queryClient = useQueryClient()
  const [reviewView, setReviewView] = useState<'entries' | 'hours'>('entries')
  const initialPeriod = useMemo(currentMonthPeriod, [])
  const [search, setSearch] = useState('')
  const [dueStart, setDueStart] = useState(initialPeriod.startDate)
  const [dueEnd, setDueEnd] = useState(initialPeriod.endDate)
  const [dueDay, setDueDay] = useState<'' | 1 | 10 | 20>('')
  const [billingType, setBillingType] = useState<BillingType>('ALL')
  const [generatedStatus, setGeneratedStatus] = useState<GeneratedStatus>('PENDING')
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('PENDING')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [selected, setSelected] = useState<Record<number, AccountsReceivableListItem>>({})
  const [issOpen, setIssOpen] = useState(false)
  const [issAmount, setIssAmount] = useState('')
  const [issDescription, setIssDescription] = useState('REF A ISS RETIDO')
  const [actionError, setActionError] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim())

  const query = useQuery({
    queryKey: [...queryKeys.accountsReceivable, debouncedSearch, dueStart, dueEnd, dueDay, billingType, generatedStatus, paymentStatus, page, pageSize],
    queryFn: () => api.accountsReceivable.list({
      query: debouncedSearch || undefined,
      dueStart: dueStart || undefined,
      dueEnd: dueEnd || undefined,
      dueDay: dueDay || undefined,
      billingType,
      generatedStatus,
      paymentStatus,
      page,
      size: pageSize,
    }),
    enabled: reviewView === 'entries',
  })

  const rows = query.data?.content ?? []
  const total = query.data?.total ?? 0
  const totalPages = query.data?.totalPages ?? 0
  const selectedRows = Object.values(selected)
  const selectedReference = selectedRows[0]
  const pageAmount = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const pending = rows.filter((row) => !row.generated).length
  const generated = rows.length - pending
  const firstResult = total === 0 ? 0 : page * pageSize + 1
  const lastResult = Math.min((page + 1) * pageSize, total)

  const generateMutation = useMutation({
    mutationFn: () => api.accountsReceivable.generateBill(selectedRows.map((item) => item.id)),
    onSuccess: async (bill) => {
      setSelected({})
      setActionError('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.accountsReceivable }),
        queryClient.invalidateQueries({ queryKey: queryKeys.bills }),
      ])
      showToast(`Boleto #${bill.number} gerado com ${bill.receivableCount} conta(s) a receber.`)
    },
    onError: (error) => setActionError(apiErrorMessage(error, 'Não foi possível gerar o boleto.')),
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
      const currentRows = Object.values(current)
      const reference = currentRows[0]
      if (reference && (reference.clientId !== row.clientId || dateOnly(reference.dueAt) !== dateOnly(row.dueAt))) {
        setActionError('Para gerar um boleto, selecione apenas contas do mesmo cliente e com o mesmo vencimento.')
        return current
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
    const reference = selectedRows[0] ?? selectable[0]
    if (!reference) return
    const compatible = selectable.filter((row) => row.clientId === reference.clientId && dateOnly(row.dueAt) === dateOnly(reference.dueAt))
    setSelected((current) => ({ ...current, ...Object.fromEntries(compatible.map((row) => [row.id, row])) }))
    if (compatible.length !== selectable.length) {
      setActionError('Foram selecionadas somente as contas do mesmo cliente e vencimento.')
    }
  }

  function openIss() {
    if (!selectedReference?.clientId || !selectedReference.dueAt) {
      setActionError('Selecione uma conta a receber para identificar o cliente e o vencimento do ISS.')
      return
    }
    setActionError('')
    setIssOpen(true)
  }

  const viewSelector = <section className="panel receivable-view-selector">
    <div><strong>Visão do contas a receber</strong><small>Alterne entre os lançamentos financeiros e a conferência mensal dos contratos.</small></div>
    <nav aria-label="Visões do contas a receber" role="tablist">
      <button type="button" role="tab" aria-selected={reviewView === 'entries'} className={reviewView === 'entries' ? 'active' : ''} onClick={() => setReviewView('entries')}><ReceiptText size={16} />Lançamentos de CR</button>
      <button type="button" role="tab" aria-selected={reviewView === 'hours'} className={reviewView === 'hours' ? 'active' : ''} onClick={() => setReviewView('hours')}><Clock3 size={16} />Saldo de horas</button>
    </nav>
  </section>

  if (reviewView === 'hours') {
    return <>{viewSelector}<AccountsReceivableHourBalance /></>
  }

  return <>
    {viewSelector}
    <section className="stats-grid stats-grid--four statement-stats">
      <StatCard label="Contas a receber" value={String(total)} helper="Registros encontrados" icon={<ReceiptText />} tone="blue" />
      <StatCard label="Valor nesta página" value={money(pageAmount)} helper={`${rows.length} lançamentos exibidos`} icon={<Landmark />} tone="purple" />
      <StatCard label="A faturar nesta página" value={String(pending)} helper="Ainda sem número de boleto" icon={<Clock3 />} tone="orange" />
      <StatCard label="Já faturadas nesta página" value={String(generated)} helper="Com boleto vinculado" icon={<CheckCircle2 />} tone="green" />
    </section>

    <section className="panel data-panel bill-panel">
      <div className="billing-filter-panel">
        <div className="billing-filter-panel__heading"><div><strong>Conferência do Contas a Receber</strong><small>Confira contratos, avulsos, saldo e ISS antes de agrupar os lançamentos em boleto.</small></div><Badge tone="orange">Pré-faturamento</Badge></div>
        <div className="billing-filter-grid receivable-filter-grid">
          <label className="billing-filter-group"><span>Cliente ou código</span><div className="search-box"><Search size={18} /><input value={search} onChange={(event) => changeFilter(() => setSearch(event.target.value))} placeholder="CR, cliente, CPF/CNPJ, contrato, boleto ou OS" /></div></label>
          <label className="billing-filter-group"><span>Faturamento</span><select value={billingType} onChange={(event) => changeFilter(() => setBillingType(event.target.value as BillingType))}><option value="ALL">Todos</option><option value="CONTRACT">Contratos fixos</option><option value="ONE_OFF">Avulsos</option></select></label>
          <label className="billing-filter-group"><span>Geração</span><select value={generatedStatus} onChange={(event) => changeFilter(() => setGeneratedStatus(event.target.value as GeneratedStatus))}><option value="PENDING">A faturar</option><option value="GENERATED">Com boleto</option><option value="ALL">Todos</option></select></label>
          <label className="billing-filter-group"><span>Pagamento</span><select value={paymentStatus} onChange={(event) => changeFilter(() => setPaymentStatus(event.target.value as PaymentStatus))}><option value="PENDING">Pendentes</option><option value="PAID">Pagos</option><option value="ALL">Todos</option></select></label>
          <div className="billing-filter-group"><span>Dia fixo</span><div className="billing-day-options"><button type="button" className={dueDay === '' ? 'active' : ''} onClick={() => changeFilter(() => setDueDay(''))}>Todos</button>{([1, 10, 20] as const).map((day) => <button type="button" key={day} className={dueDay === day ? 'active' : ''} onClick={() => changeFilter(() => setDueDay(day))}>{day}</button>)}</div></div>
          <label className="billing-filter-group billing-filter-group--dates"><span>Vencimento</span><div><input type="date" value={dueStart} max={dueEnd || undefined} onChange={(event) => changeFilter(() => setDueStart(event.target.value))} /><i>até</i><input type="date" value={dueEnd} min={dueStart || undefined} onChange={(event) => changeFilter(() => setDueEnd(event.target.value))} /></div></label>
        </div>
        <div className="billing-search-row billing-search-row--actions"><Button variant="ghost" onClick={() => changeFilter(() => { setDueStart(initialPeriod.startDate); setDueEnd(initialPeriod.endDate); setDueDay(''); setBillingType('ALL'); setGeneratedStatus('PENDING'); setPaymentStatus('PENDING'); setSearch('') })}>Limpar filtros</Button></div>
        <div className="receivable-actions"><span><strong>{selectedRows.length}</strong> lançamento(s) selecionado(s){selectedReference ? ` · ${selectedReference.clientTradeName || selectedReference.clientName || `Cliente #${selectedReference.clientId}`} · ${formatDate(selectedReference.dueAt)}` : ''}</span><div><Button type="button" variant="secondary" onClick={openIss}>Lançar ISS retido</Button><Button type="button" disabled={selectedRows.length === 0 || generateMutation.isPending} onClick={() => generateMutation.mutate()}>{generateMutation.isPending ? 'Gerando...' : `Gerar boleto (${selectedRows.length})`}</Button></div></div>
        {actionError && <div className="receivable-action-error" role="alert">{actionError}</div>}
      </div>

      {query.isLoading ? <LoadingState label="Carregando contas a receber..." /> : query.isError ? <ErrorState message={apiErrorMessage(query.error)} onRetry={() => query.refetch()} /> : rows.length === 0 ? <EmptyState title="Nenhuma conta a receber encontrada" description="Ajuste o período ou os filtros de faturamento." /> : <div className="table-wrap"><table className="data-table receivable-table"><thead><tr><th><input type="checkbox" checked={rows.some((row) => !row.generated) && rows.filter((row) => !row.generated).every((row) => Boolean(selected[row.id]))} onChange={togglePage} aria-label="Selecionar contas compatíveis desta página" /></th><th>CR</th><th>Cliente</th><th>Contrato</th><th>OS</th><th>Descrição</th><th>Cadastro</th><th>Vencimento</th><th>Valor</th><th>Saldo</th><th>Situação</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className={selected[row.id] ? 'receivable-row--selected' : ''} onClick={() => toggle(row)}>
        <td><input type="checkbox" checked={Boolean(selected[row.id])} disabled={row.generated} onChange={() => toggle(row)} onClick={(event) => event.stopPropagation()} aria-label={`Selecionar conta a receber ${row.id}`} /></td>
        <td><strong>#{row.id}</strong>{row.billNumber && <small className="table-secondary">Boleto #{row.billNumber}</small>}</td>
        <td><strong className="table-primary">{row.clientTradeName || row.clientName || `Cliente #${row.clientId}`}</strong><small className="table-secondary">{row.clientDocument || `Código ${row.clientId || '—'}`}</small></td>
        <td>{row.contractId ? `#${row.contractId}` : 'Avulso'}</td><td>{row.serviceOrderId || '—'}</td><td>{row.description || 'Não informada'}</td><td>{formatDate(row.createdAt)}</td><td>{formatDate(row.dueAt)}</td><td className={Number(row.amount) < 0 ? 'receivable-negative' : ''}><strong>{money(row.amount)}</strong></td><td>{money(row.balance)}</td><td><Badge tone={row.generated ? 'green' : row.paid ? 'blue' : 'orange'}>{row.generated ? `Boleto #${row.billNumber}` : row.paid ? 'Pago' : 'A faturar'}</Badge></td>
      </tr>)}</tbody></table></div>}

      <footer className="table-footer table-footer--pagination"><span>Mostrando <strong>{firstResult}–{lastResult}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong> contas</span><div className="pagination-controls"><label>Itens <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}>{[5, 10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label><button disabled={page === 0 || query.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button><span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span><button disabled={page + 1 >= totalPages || query.isFetching} onClick={() => setPage((value) => value + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button></div></footer>
    </section>

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
