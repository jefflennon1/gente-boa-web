import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownCircle, ArrowUpCircle, Download, Landmark, Lock, LockOpen, MinusCircle, Printer, Search, Wallet } from 'lucide-react'
import { useRef, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { financeApi, financeKeys } from '../api/finance'
import { api, queryKeys } from '../api/services'
import { ClientPicker, type PickerValue } from '../components/AsyncPicker'
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, FormError, FormField, LoadingState, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'
import { dateText, moneyText, printElement, todayIso } from '../lib/export'
import { money } from '../lib/format'
import type { CashAccountSummary, CashDaily as CashDailyData, CashEntry } from '../types-finance'

type Tab = 'statement' | 'summary'

type StatementLine = { entry: CashEntry; balance: number }
type AccountStatement = { account: CashAccountSummary; lines: StatementLine[] }

/** Créditos e débitos juntos por conta, como no extrato bancário: em ordem de data, com o saldo após cada lançamento. */
function accountStatements(data: CashDailyData): AccountStatement[] {
  const all = [...data.credits, ...data.debits]
  return [...data.accounts]
    .sort((a, b) => Number(a.fixedFund === false) - Number(b.fixedFund === false) || a.id - b.id)
    .map((account) => {
      let balance = account.previousBalance
      const lines = all
        .filter((entry) => entry.movementAccountId === account.id)
        .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')) || (a.kind === b.kind ? 0 : a.kind === 'CR' ? -1 : 1) || a.documentId - b.documentId)
        .map((entry) => {
          balance += entry.kind === 'CR' ? entry.total : -entry.total
          return { entry, balance }
        })
      return { account, lines }
    })
}

function entryDocument(entry: CashEntry) {
  return `${entry.kind} ${entry.documentId}${entry.billNumber ? ` · Bol. ${entry.billNumber}` : ''}`
}

function entryHistory(entry: CashEntry) {
  return [entry.partyName, entry.description, entry.serviceOrderId ? `OS ${entry.serviceOrderId}` : null].filter(Boolean).join(' — ')
}

/** Acompanhamento do caixa (POP p.20-21). */
export function CashDaily() {
  const queryClient = useQueryClient()
  const today = todayIso()
  const [draft, setDraft] = useState({ startDate: today, endDate: today, movementAccountId: '' })
  const [filters, setFilters] = useState(draft)
  const [tab, setTab] = useState<Tab>('statement')
  const [confirm, setConfirm] = useState<'close' | 'reopen' | null>(null)
  const [confirmError, setConfirmError] = useState('')
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustClient, setAdjustClient] = useState<PickerValue>(null)
  const [adjustError, setAdjustError] = useState('')
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)
  const printRef = useRef<HTMLDivElement>(null)
  const movementAccountsQuery = useQuery({ queryKey: [...queryKeys.payables, 'movement-accounts'], queryFn: () => api.payables.movementAccounts() })
  const dailyQuery = useQuery({
    queryKey: [...financeKeys.cash, 'daily', filters],
    queryFn: () => financeApi.cash.daily({ startDate: filters.startDate, endDate: filters.endDate, movementAccountId: filters.movementAccountId ? Number(filters.movementAccountId) : undefined }),
    enabled: Boolean(filters.startDate && filters.endDate && filters.startDate <= filters.endDate),
  })
  const data = dailyQuery.data

  function showToast(message: string, variant: 'success' | 'error' = 'success') {
    setToast({ message, variant })
    window.setTimeout(() => setToast(null), variant === 'error' ? 6000 : 3200)
  }

  const statusMutation = useMutation({
    mutationFn: (action: 'close' | 'reopen') => action === 'close' ? financeApi.cash.close(filters.startDate, filters.endDate) : financeApi.cash.reopen(filters.startDate, filters.endDate),
    onSuccess: async (_, action) => { await queryClient.invalidateQueries({ queryKey: financeKeys.cash }); setConfirm(null); showToast(action === 'close' ? 'Caixa fechado para o período.' : 'Caixa reaberto para o período.') },
    onError: (error) => setConfirmError(apiErrorMessage(error)),
  })
  const adjustMutation = useMutation({
    mutationFn: async (input: { clientId: number; description: string; amount: number; date: string; movementAccountId: number }) => {
      const created = await financeApi.receivables.create({ clientId: input.clientId, description: input.description, amount: -Math.abs(input.amount), dueAt: `${input.date}T00:00:00`, registeredAt: `${input.date}T00:00:00` })
      return financeApi.receivables.settle(created.id, { paidAt: `${input.date}T00:00:00`, cashValue: 0, transferValue: Math.abs(input.amount), billValue: 0, movementAccountId: input.movementAccountId, notes: 'Ajuste de conferência com o extrato bancário' })
    },
    onSuccess: async (result) => { await Promise.all([queryClient.invalidateQueries({ queryKey: financeKeys.cash }), queryClient.invalidateQueries({ queryKey: financeKeys.receivables })]); setAdjustOpen(false); showToast(`CR negativa #${result.id} lançada e baixada.`) },
    onError: (error) => setAdjustError(apiErrorMessage(error)),
  })

  const pdfMutation = useMutation({
    mutationFn: () => financeApi.cash.dailyPdf({ startDate: filters.startDate, endDate: filters.endDate, movementAccountId: filters.movementAccountId ? Number(filters.movementAccountId) : undefined }),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `relatorio-caixa-${filters.startDate}-a-${filters.endDate}.pdf`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    },
    onError: (error) => showToast(apiErrorMessage(error, 'Não foi possível gerar o PDF do caixa.'), 'error'),
  })

  const statements = data ? accountStatements(data) : []

  return <>
    <PageHeader eyebrow="Financeiro" title="Caixa diário" subtitle="Créditos e débitos das contas a receber e a pagar quitadas, por conta movimento (Caixa e Banco)." actions={<><Button variant="secondary" icon={<MinusCircle size={18} />} onClick={() => { setAdjustError(''); setAdjustClient(null); setAdjustOpen(true) }}>Lançar CR negativa</Button><Button variant="secondary" icon={<Printer size={18} />} disabled={!data} onClick={() => printElement(printRef.current, 'Relatório de Caixa')}>Imprimir</Button><Button icon={<Download size={18} />} disabled={!data || pdfMutation.isPending} onClick={() => pdfMutation.mutate()}>{pdfMutation.isPending ? 'Gerando PDF...' : 'Baixar PDF'}</Button></>} />

    <section className="panel data-panel">
      <form className="cash-filters" data-allow-enter-submit="true" onSubmit={(event) => { event.preventDefault(); setFilters(draft) }}>
        <label><span>De</span><input type="date" value={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))} /></label>
        <label><span>Até</span><input type="date" value={draft.endDate} min={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))} /></label>
        <label><span>Conta movimento</span><select value={draft.movementAccountId} onChange={(event) => setDraft((current) => ({ ...current, movementAccountId: event.target.value }))}><option value="">Todas</option>{movementAccountsQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</select></label>
        <Button type="submit" icon={<Search size={16} />}>Pesquisar</Button>
        <div className="cash-filters__actions">
          <Button type="button" variant="secondary" icon={<Lock size={16} />} disabled={!data || data.fullyClosed} onClick={() => { setConfirmError(''); setConfirm('close') }}>Fechar caixa</Button>
          <Button type="button" variant="secondary" icon={<LockOpen size={16} />} disabled={!data || (!data.fullyClosed && !data.partiallyClosed)} onClick={() => { setConfirmError(''); setConfirm('reopen') }}>Reabrir caixa</Button>
        </div>
      </form>
      {data && <div className={`cash-status ${data.fullyClosed ? 'cash-status--closed' : data.partiallyClosed ? 'cash-status--partial' : ''}`}>{data.fullyClosed ? <><Lock size={16} /> Caixa fechado em todo o período — baixas e estornos nessas datas estão bloqueados.</> : data.partiallyClosed ? <><Lock size={16} /> Caixa fechado em {data.days.filter((day) => day.closed).length} de {data.days.length} dia(s) do período.</> : <><LockOpen size={16} /> Caixa aberto no período.</>}</div>}
    </section>

    {dailyQuery.isLoading ? <LoadingState label="Calculando o caixa..." /> : dailyQuery.isError ? <ErrorState message={apiErrorMessage(dailyQuery.error)} onRetry={() => dailyQuery.refetch()} /> : data ? <>
      <section className="stats-grid stats-grid--four">
        <StatCard label="Saldo anterior" value={money(data.previousBalance)} helper={`Até ${dateText(data.startDate)}`} icon={<Wallet />} tone="blue" />
        <StatCard label="Créditos" value={money(data.totalCredits.total)} helper={`${data.credits.length} recebimento(s)`} icon={<ArrowUpCircle />} tone="green" />
        <StatCard label="Débitos" value={money(data.totalDebits.total)} helper={`${data.debits.length} pagamento(s)`} icon={<ArrowDownCircle />} tone="orange" />
        <StatCard label="Saldo atual" value={money(data.finalBalance)} helper="Banco + Fundo fixo" icon={<Landmark />} tone="purple" />
      </section>
      <section className="panel data-panel">
        <nav className="system-parameters-menu" aria-label="Visões do caixa">
          <button className={tab === 'statement' ? 'active' : ''} onClick={() => setTab('statement')}>Extrato (créditos e débitos)</button>
          <button className={tab === 'summary' ? 'active' : ''} onClick={() => setTab('summary')}>Resumo por conta</button>
        </nav>
        {tab === 'statement' && <div className="cash-statements">{statements.map((statement) => <StatementTable key={statement.account.id} statement={statement} startDate={data.startDate} />)}</div>}
        {tab === 'summary' && <div className="cash-summary-grid">{data.accounts.map((account) => <AccountCard key={account.id} account={account} />)}</div>}
      </section>
      <div className="print-source" ref={printRef} aria-hidden="true"><CashReport data={data} statements={statements} /></div>
    </> : <EmptyState title="Informe o período" description="Selecione as datas e clique em Pesquisar." />}

    <ConfirmDialog open={confirm !== null} variant={confirm === 'close' ? 'primary' : 'danger'} icon={confirm === 'close' ? <Lock size={22} /> : <LockOpen size={22} />} eyebrow="Caixa diário" title={confirm === 'close' ? 'Fechar o caixa do período?' : 'Reabrir o caixa do período?'} description={confirm === 'close' ? `De ${dateText(filters.startDate)} a ${dateText(filters.endDate)}. Depois de fechado, não será possível registrar ou estornar baixas nessas datas até reabrir.` : `De ${dateText(filters.startDate)} a ${dateText(filters.endDate)}. As baixas nessas datas voltarão a poder ser alteradas.`} confirmLabel={confirm === 'close' ? 'Fechar caixa' : 'Reabrir caixa'} busyLabel="Processando..." busy={statusMutation.isPending} error={confirmError} onCancel={() => setConfirm(null)} onConfirm={() => confirm && statusMutation.mutate(confirm)} />

    <Modal open={adjustOpen} onClose={() => !adjustMutation.isPending && setAdjustOpen(false)} title="Lançar CR negativa" description="Ajuste de conferência com o extrato do banco. A conta é criada com valor negativo e já baixada na data informada.">
      <ModalForm submitting={adjustMutation.isPending} submitLabel={adjustMutation.isPending ? 'Lançando...' : 'Lançar ajuste'} onCancel={() => setAdjustOpen(false)} onSubmit={(event) => {
        event.preventDefault()
        if (!adjustClient) { setAdjustError('Selecione o cliente (ou a própria empresa) do ajuste.'); return }
        const form = new FormData(event.currentTarget)
        adjustMutation.mutate({ clientId: adjustClient.id, description: String(form.get('description') ?? '').trim(), amount: Number(form.get('amount')), date: String(form.get('date')), movementAccountId: Number(form.get('movementAccountId')) })
      }}>
        <FormError message={adjustError} />
        <FormField label="Cliente"><ClientPicker value={adjustClient} onChange={setAdjustClient} /></FormField>
        <FormField label="Descrição"><input name="description" required maxLength={100} defaultValue="REF A AJUSTE DE CONFERÊNCIA BANCÁRIA" /></FormField>
        <div className="form-grid form-grid--three">
          <FormField label="Valor" hint="Informe positivo; será lançado negativo"><input name="amount" type="number" min="0.01" step="0.01" required /></FormField>
          <FormField label="Data"><input name="date" type="date" required defaultValue={filters.endDate} /></FormField>
          <FormField label="Conta movimento"><select name="movementAccountId" required defaultValue={movementAccountsQuery.data?.find((item) => (item.name || '').toUpperCase().includes('BANCO'))?.id ?? ''}>{movementAccountsQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</select></FormField>
        </div>
      </ModalForm>
    </Modal>
    {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
  </>
}

function AccountCard({ account }: { account: CashAccountSummary }) {
  return <article className="cash-account-card">
    <header><strong>{account.id} · {account.name}</strong><Badge tone={account.fixedFund ? 'orange' : 'blue'}>{account.fixedFund ? 'Fundo fixo' : 'Banco'}</Badge></header>
    <dl>
      <div><dt>Saldo anterior</dt><dd>{money(account.previousBalance)}</dd></div>
      <div className="cash-account-card__credit"><dt>(+) Créditos</dt><dd>{money(account.credits.total)}</dd></div>
      <div className="cash-account-card__sub"><dt>Dinheiro</dt><dd>{money(account.credits.cash)}</dd></div>
      <div className="cash-account-card__sub"><dt>Transferências</dt><dd>{money(account.credits.transfer)}</dd></div>
      <div className="cash-account-card__sub"><dt>Boletos</dt><dd>{money(account.credits.bill)}</dd></div>
      {account.credits.other !== 0 && <div className="cash-account-card__sub"><dt>Outros</dt><dd>{money(account.credits.other)}</dd></div>}
      <div className="cash-account-card__debit"><dt>(−) Débitos</dt><dd>{money(account.debits.total)}</dd></div>
      <div className="cash-account-card__sub"><dt>Dinheiro</dt><dd>{money(account.debits.cash)}</dd></div>
      <div className="cash-account-card__sub"><dt>Transferências</dt><dd>{money(account.debits.transfer)}</dd></div>
      <div className="cash-account-card__sub"><dt>Boletos</dt><dd>{money(account.debits.bill)}</dd></div>
      {account.debits.other !== 0 && <div className="cash-account-card__sub"><dt>Outros</dt><dd>{money(account.debits.other)}</dd></div>}
      <div className="cash-account-card__total"><dt>(=) Saldo atual</dt><dd>{money(account.finalBalance)}</dd></div>
    </dl>
  </article>
}

/** Extrato de uma conta movimento: saldo anterior, créditos e débitos na mesma lista e saldo final. */
function StatementTable({ statement, startDate }: { statement: AccountStatement; startDate: string }) {
  const { account, lines } = statement
  return <section className="cash-statement">
    <header><strong>{account.id} · {account.name}</strong><Badge tone={account.fixedFund ? 'orange' : 'blue'}>{account.fixedFund ? 'Fundo fixo' : 'Banco'}</Badge>{account.detail && <small>{account.detail}</small>}</header>
    <div className="table-wrap"><table className="data-table cash-statement__table"><thead><tr><th>Data</th><th>Documento</th><th>Histórico</th><th className="num">Crédito</th><th className="num">Débito</th><th className="num">Saldo</th></tr></thead>
      <tbody>
        <tr className="cash-statement__opening"><td>{dateText(startDate)}</td><td /><td><strong>SALDO ANTERIOR</strong></td><td /><td /><td className="num"><strong>{money(account.previousBalance)}</strong></td></tr>
        {lines.length === 0 ? <tr><td colSpan={6} className="muted">Nenhum lançamento no período.</td></tr> : lines.map(({ entry, balance }, index) => <tr key={`${entry.kind}-${entry.documentId}-${index}`}>
          <td>{dateText(entry.date)}</td><td>{entryDocument(entry)}</td><td>{entryHistory(entry) || '—'}</td>
          <td className="num cash-statement__credit">{entry.kind === 'CR' ? money(entry.total) : ''}</td>
          <td className="num cash-statement__debit">{entry.kind === 'CP' ? money(entry.total) : ''}</td>
          <td className={`num ${balance < 0 ? 'negative-value' : ''}`}>{money(balance)}</td>
        </tr>)}
      </tbody>
      <tfoot><tr><td colSpan={3}>Totais do período / saldo final</td><td className="num"><strong>{money(account.credits.total)}</strong></td><td className="num"><strong>{money(account.debits.total)}</strong></td><td className="num"><strong>{money(account.finalBalance)}</strong></td></tr></tfoot>
    </table></div>
  </section>
}

/** Relatório de caixa impresso no formato de extrato bancário (mesmo conteúdo do PDF). */
function CashReport({ data, statements }: { data: CashDailyData; statements: AccountStatement[] }) {
  return <div>
    <div className="print-header"><div><h1>Relatório de Caixa — Extrato de Créditos e Débitos</h1><small>Período: {dateText(data.startDate)} a {dateText(data.endDate)}</small></div><small>Emitido em {dateText(todayIso())}</small></div>
    <div className="print-boxes">
      <div className="print-box"><small>Saldo anterior</small><strong>{moneyText(data.previousBalance)}</strong></div>
      <div className="print-box"><small>(+) Créditos</small><strong>{moneyText(data.totalCredits.total)}</strong></div>
      <div className="print-box"><small>(−) Débitos</small><strong>{moneyText(data.totalDebits.total)}</strong></div>
      <div className="print-box"><small>(=) Saldo atual (Banco + Fundo fixo)</small><strong>{moneyText(data.finalBalance)}</strong></div>
    </div>
    {statements.map(({ account, lines }) => <div key={account.id} className="print-group">
      <h2>{account.id} · {account.name}{account.fixedFund ? ' (Fundo fixo)' : ''}{account.detail ? ` — ${account.detail}` : ''}</h2>
      <table><thead><tr><th>Data</th><th>Documento</th><th>Histórico</th><th className="num">Crédito</th><th className="num">Débito</th><th className="num">Saldo</th></tr></thead>
        <tbody>
          <tr><td>{dateText(data.startDate)}</td><td /><td><strong>SALDO ANTERIOR</strong></td><td /><td /><td className="num"><strong>{moneyText(account.previousBalance)}</strong></td></tr>
          {lines.length === 0 ? <tr><td colSpan={6} className="muted">Nenhum lançamento no período.</td></tr> : lines.map(({ entry, balance }, index) => <tr key={`${entry.kind}-${entry.documentId}-${index}`}><td>{dateText(entry.date)}</td><td>{entryDocument(entry)}</td><td>{entryHistory(entry)}</td><td className="num">{entry.kind === 'CR' ? moneyText(entry.total) : ''}</td><td className="num">{entry.kind === 'CP' ? moneyText(entry.total) : ''}</td><td className="num">{moneyText(balance)}</td></tr>)}
        </tbody>
        <tfoot><tr><td colSpan={3}>Totais do período / saldo final</td><td className="num">{moneyText(account.credits.total)}</td><td className="num">{moneyText(account.debits.total)}</td><td className="num">{moneyText(account.finalBalance)}</td></tr></tfoot>
      </table>
    </div>)}
  </div>
}
