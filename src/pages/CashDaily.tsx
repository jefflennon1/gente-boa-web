import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownCircle, ArrowUpCircle, Landmark, Lock, LockOpen, MinusCircle, Printer, Search, Wallet } from 'lucide-react'
import { useRef, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { financeApi, financeKeys } from '../api/finance'
import { api, queryKeys } from '../api/services'
import { ClientPicker, type PickerValue } from '../components/AsyncPicker'
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, FormError, FormField, LoadingState, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'
import { dateText, moneyText, printElement, todayIso } from '../lib/export'
import { money } from '../lib/format'
import type { CashAccountSummary, CashDaily as CashDailyData, CashEntry } from '../types-finance'

type Tab = 'summary' | 'credits' | 'debits'

/** Acompanhamento do caixa (POP p.20-21). */
export function CashDaily() {
  const queryClient = useQueryClient()
  const today = todayIso()
  const [draft, setDraft] = useState({ startDate: today, endDate: today, movementAccountId: '' })
  const [filters, setFilters] = useState(draft)
  const [tab, setTab] = useState<Tab>('summary')
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

  const fixedFund = data?.accounts.filter((account) => account.fixedFund) ?? []
  const bankAccounts = data?.accounts.filter((account) => !account.fixedFund) ?? []

  return <>
    <PageHeader eyebrow="Financeiro" title="Caixa diário" subtitle="Créditos e débitos das contas a receber e a pagar quitadas, por conta movimento (Caixa e Banco)." actions={<><Button variant="secondary" icon={<MinusCircle size={18} />} onClick={() => { setAdjustError(''); setAdjustClient(null); setAdjustOpen(true) }}>Lançar CR negativa</Button><Button icon={<Printer size={18} />} disabled={!data} onClick={() => printElement(printRef.current, 'Caixa Diário')}>Caixa diário</Button></>} />

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
          <button className={tab === 'summary' ? 'active' : ''} onClick={() => setTab('summary')}>Resumo</button>
          <button className={tab === 'credits' ? 'active' : ''} onClick={() => setTab('credits')}>Créditos (detalhado)</button>
          <button className={tab === 'debits' ? 'active' : ''} onClick={() => setTab('debits')}>Débitos (detalhado)</button>
        </nav>
        {tab === 'summary' && <div className="cash-summary-grid">{data.accounts.map((account) => <AccountCard key={account.id} account={account} />)}</div>}
        {tab === 'credits' && <EntriesTable entries={data.credits} kind="CR" />}
        {tab === 'debits' && <EntriesTable entries={data.debits} kind="CP" />}
      </section>
      <div className="print-source" ref={printRef} aria-hidden="true"><CashReport data={data} fixedFund={fixedFund} bankAccounts={bankAccounts} /></div>
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

function EntriesTable({ entries, kind }: { entries: CashEntry[]; kind: 'CR' | 'CP' }) {
  if (entries.length === 0) return <EmptyState title={kind === 'CR' ? 'Nenhum crédito no período' : 'Nenhum débito no período'} description="Não há baixas registradas para os filtros informados." />
  const total = entries.reduce((sum, entry) => sum + entry.total, 0)
  return <div className="table-wrap"><table className="data-table"><thead><tr><th>Data</th><th>{kind}</th>{kind === 'CR' && <th>Boleto</th>}<th>{kind === 'CR' ? 'Cliente' : 'Fornecedor'}</th><th>Descrição</th><th>Conta</th><th className="num">Dinheiro</th><th className="num">Transf.</th><th className="num">Boleto</th><th className="num">Outros</th><th className="num">Total</th></tr></thead>
    <tbody>{entries.map((entry, index) => <tr key={`${entry.documentId}-${index}`}><td>{dateText(entry.date)}</td><td><strong>{entry.documentId}</strong></td>{kind === 'CR' && <td>{entry.billNumber ?? '—'}</td>}<td>{entry.partyName || '—'}</td><td>{entry.description || '—'}</td><td>{entry.movementAccountName || '—'}</td><td className="num">{money(entry.cash)}</td><td className="num">{money(entry.transfer)}</td><td className="num">{money(entry.bill)}</td><td className="num">{money(entry.other)}</td><td className="num"><strong>{money(entry.total)}</strong></td></tr>)}</tbody>
    <tfoot><tr><td colSpan={kind === 'CR' ? 10 : 9}>Total</td><td className="num"><strong>{money(total)}</strong></td></tr></tfoot>
  </table></div>
}

/** Layout impresso do "Caixa Diário" do sistema anterior (POP p.21). */
function CashReport({ data, fixedFund, bankAccounts }: { data: CashDailyData; fixedFund: CashAccountSummary[]; bankAccounts: CashAccountSummary[] }) {
  const sum = (accounts: CashAccountSummary[], pick: (account: CashAccountSummary) => number) => accounts.reduce((total, account) => total + pick(account), 0)
  const bankIds = new Set(bankAccounts.map((account) => account.id))
  const fundIds = new Set(fixedFund.map((account) => account.id))
  const bankDebits = data.debits.filter((entry) => entry.movementAccountId !== null && bankIds.has(entry.movementAccountId))
  const bankCredits = data.credits.filter((entry) => entry.movementAccountId !== null && bankIds.has(entry.movementAccountId))
  const fundCredits = data.credits.filter((entry) => entry.movementAccountId !== null && fundIds.has(entry.movementAccountId))
  const fundDebits = data.debits.filter((entry) => entry.movementAccountId !== null && fundIds.has(entry.movementAccountId))
  const total = (entries: CashEntry[]) => entries.reduce((value, entry) => value + entry.total, 0)
  return <div>
    <div className="print-header"><div><h1>Caixa Diário</h1><small>Período: {dateText(data.startDate)} a {dateText(data.endDate)}</small></div><small>Emitido em {dateText(todayIso())}</small></div>
    {bankAccounts.length > 0 && <>
      <h2>Resumo das Operações Bancárias</h2>
      <div className="print-boxes">
        <div className="print-box"><small>Saldo anterior</small><strong>{moneyText(sum(bankAccounts, (account) => account.previousBalance))}</strong></div>
        <div className="print-box"><small>Boletos liquidados</small><strong>{moneyText(sum(bankAccounts, (account) => account.credits.bill))}</strong><small>Transferências</small><strong>{moneyText(sum(bankAccounts, (account) => account.credits.transfer))}</strong><small>Outros créditos</small><strong>{moneyText(sum(bankAccounts, (account) => account.credits.cash + account.credits.other))}</strong><small>(+) Total de créditos</small><strong>{moneyText(sum(bankAccounts, (account) => account.credits.total))}</strong></div>
        <div className="print-box"><small>Transferências</small><strong>{moneyText(sum(bankAccounts, (account) => account.debits.transfer))}</strong><small>Boletos</small><strong>{moneyText(sum(bankAccounts, (account) => account.debits.bill))}</strong><small>Outros débitos</small><strong>{moneyText(sum(bankAccounts, (account) => account.debits.cash + account.debits.other))}</strong><small>(−) Total de débitos</small><strong>{moneyText(sum(bankAccounts, (account) => account.debits.total))}</strong></div>
        <div className="print-box"><small>(=) Saldo final</small><strong>{moneyText(sum(bankAccounts, (account) => account.finalBalance))}</strong></div>
      </div>
    </>}
    <h2>Saldo Total Disponível (Banco + Fundo Fixo)</h2>
    <div className="print-boxes">
      <div className="print-box"><small>Saldo anterior</small><strong>{moneyText(data.previousBalance)}</strong></div>
      <div className="print-box"><small>(+) Total de créditos</small><strong>{moneyText(data.totalCredits.total)}</strong></div>
      <div className="print-box"><small>(−) Total de débitos</small><strong>{moneyText(data.totalDebits.total)}</strong></div>
      <div className="print-box"><small>Saldo</small><strong>{moneyText(data.finalBalance)}</strong></div>
    </div>
    <h2>Débitos em Conta Corrente</h2>
    <h3>Relação de Transferências, Pagamentos Eletrônicos e Débitos Automáticos</h3>
    <PrintEntries entries={bankDebits} kind="CP" />
    <h2>Créditos em Conta Corrente</h2>
    <h3>Relação de Transferências, Pagamentos Eletrônicos e Créditos Automáticos</h3>
    <PrintEntries entries={bankCredits} kind="CR" />
    {fixedFund.length > 0 && <>
      <h2>Resumo das Operações com Fundo Fixo</h2>
      <div className="print-boxes">
        <div className="print-box"><small>Saldo anterior</small><strong>{moneyText(sum(fixedFund, (account) => account.previousBalance))}</strong></div>
        <div className="print-box"><small>(+) Créditos</small><strong>{moneyText(total(fundCredits))}</strong></div>
        <div className="print-box"><small>(−) Débitos</small><strong>{moneyText(total(fundDebits))}</strong></div>
        <div className="print-box"><small>Saldo final</small><strong>{moneyText(sum(fixedFund, (account) => account.finalBalance))}</strong></div>
      </div>
      <h3>Créditos no Fundo Fixo</h3>
      <PrintEntries entries={fundCredits} kind="CR" />
      <h3>Débitos no Fundo Fixo</h3>
      <PrintEntries entries={fundDebits} kind="CP" />
    </>}
  </div>
}

function PrintEntries({ entries, kind }: { entries: CashEntry[]; kind: 'CR' | 'CP' }) {
  const total = entries.reduce((value, entry) => value + entry.total, 0)
  return <table><thead><tr><th>{kind === 'CR' ? 'C.R.' : 'C.P.'}</th><th>{kind === 'CR' ? 'Dt. Receb.' : 'Dt. Pagamento'}</th>{kind === 'CR' && <th>Boleto</th>}<th>{kind === 'CR' ? 'Cliente' : 'Fornecedor'}</th><th>Descrição</th><th className="num">Valor</th></tr></thead>
    <tbody>{entries.length === 0 ? <tr><td colSpan={kind === 'CR' ? 6 : 5} className="muted">Nenhum lançamento.</td></tr> : entries.map((entry, index) => <tr key={`${entry.documentId}-${index}`}><td>{entry.documentId}</td><td>{dateText(entry.date)}</td>{kind === 'CR' && <td>{entry.billNumber ?? ''}</td>}<td>{entry.partyName}</td><td>{entry.description}</td><td className="num">{moneyText(entry.total)}</td></tr>)}</tbody>
    <tfoot><tr><td colSpan={kind === 'CR' ? 5 : 4}>Total</td><td className="num">{moneyText(total)}</td></tr></tfoot></table>
}
