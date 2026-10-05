import { useMemo, useState } from 'react'
import type { FinancialLookup } from '../types'
import type { InstallmentPayload, MultipleSettlementPayload, SettlementMethod } from '../types-finance'
import { money } from '../lib/format'
import { dateText, todayIso } from '../lib/export'
import { FormError, FormField, Modal, ModalForm } from './ui'

export const settlementMethodLabels: Record<SettlementMethod, string> = { CASH: 'Dinheiro', TRANSFER: 'Transferência', BILL: 'Boleto' }

/** Conta movimento sugerida conforme a forma: dinheiro → CAIXA, demais → BANCO (POP p.13). */
export function suggestedMovementAccount(accounts: FinancialLookup[] | undefined, method: SettlementMethod) {
  const wanted = method === 'CASH' ? 'CAIXA' : 'BANCO'
  return accounts?.find((account) => (account.name || '').toUpperCase().includes(wanted))?.id ?? accounts?.[0]?.id ?? ''
}

export function MultipleSettlementDialog({ open, title, count, total, movementAccounts, busy, error, defaultMethod = 'CASH', onClose, onSubmit }: {
  open: boolean
  title: string
  count: number
  total: number
  movementAccounts: FinancialLookup[] | undefined
  busy: boolean
  error: string
  defaultMethod?: SettlementMethod
  onClose: () => void
  onSubmit: (payload: Omit<MultipleSettlementPayload, 'ids'>) => void
}) {
  const [method, setMethod] = useState<SettlementMethod>(defaultMethod)
  const [movementAccountId, setMovementAccountId] = useState<number | ''>('')
  const effectiveAccount = movementAccountId || suggestedMovementAccount(movementAccounts, method)
  return <Modal open={open} onClose={() => !busy && onClose()} title={title} description={`${count} conta(s) selecionada(s) · total ${money(total)}`}>
    <ModalForm submitting={busy} submitLabel={busy ? 'Efetuando baixa...' : 'Efetuar baixa'} onCancel={onClose} onSubmit={(event) => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      onSubmit({ paidAt: `${String(data.get('paidAt'))}T00:00:00`, movementAccountId: Number(effectiveAccount), paymentMethod: method, notes: String(data.get('notes') ?? '').trim() || null })
    }}>
      <FormError message={error} />
      <p className="finance-dialog__hint">O saldo integral de cada conta será quitado na data informada.</p>
      <div className="form-grid form-grid--three">
        <FormField label="Data do pagamento"><input name="paidAt" type="date" required defaultValue={todayIso()} /></FormField>
        <FormField label="Forma de pagamento"><select value={method} onChange={(event) => { setMethod(event.target.value as SettlementMethod); setMovementAccountId('') }}>{(Object.keys(settlementMethodLabels) as SettlementMethod[]).map((key) => <option key={key} value={key}>{settlementMethodLabels[key]}</option>)}</select></FormField>
        <FormField label="Conta movimento"><select required value={effectiveAccount} onChange={(event) => setMovementAccountId(Number(event.target.value))}><option value="">Selecione</option>{movementAccounts?.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</select></FormField>
      </div>
      <FormField label="Observação"><textarea name="notes" rows={2} maxLength={300} /></FormField>
    </ModalForm>
  </Modal>
}

type PreviewLine = { label: string; amount: number; dueDate: string }

function addMonths(date: string, months: number) {
  const [year, month, day] = date.split('-').map(Number)
  const target = new Date(year, month - 1 + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

function preview(total: number, entry: number, entryDate: string, count: number, firstDate: string): PreviewLine[] | string {
  if (!entryDate || count < 1) return 'Informe a data e a quantidade de prestações.'
  const cents = Math.round(total * 100)
  const entryCents = Math.round(entry * 100)
  const lines: PreviewLine[] = []
  let remaining = cents
  let start = entryDate
  if (entryCents > 0) {
    if (entryCents >= cents) return 'A entrada deve ser menor que o valor total.'
    lines.push({ label: 'Entrada', amount: entryCents / 100, dueDate: entryDate })
    remaining = cents - entryCents
    start = firstDate || addMonths(entryDate, 1)
    if (start <= entryDate) return 'A primeira prestação deve vencer depois da entrada.'
  } else if (count < 2) {
    return 'Sem entrada, informe ao menos 2 prestações.'
  }
  const part = Math.floor(remaining / count)
  if (part <= 0) return 'O valor das prestações ficou zerado.'
  for (let index = 1; index <= count; index++) {
    const amount = index === count ? remaining - part * (count - 1) : part
    lines.push({ label: `Parcela ${index}/${count}`, amount: amount / 100, dueDate: addMonths(start, index - 1) })
  }
  return lines
}

export function InstallmentDialog({ open, total, dueDate, description, busy, error, onClose, onSubmit }: {
  open: boolean
  total: number
  dueDate: string
  description: string
  busy: boolean
  error: string
  onClose: () => void
  onSubmit: (payload: InstallmentPayload) => void
}) {
  const [entry, setEntry] = useState('0')
  const [entryDate, setEntryDate] = useState(dueDate || todayIso())
  const [count, setCount] = useState('2')
  const [firstDate, setFirstDate] = useState('')
  const lines = useMemo(() => preview(total, Number(entry || 0), entryDate, Number(count || 0), firstDate), [count, entry, entryDate, firstDate, total])
  return <Modal open={open} onClose={() => !busy && onClose()} title="Gerar prestações" description={description} size="large">
    <ModalForm submitting={busy} submitLabel={busy ? 'Gerando...' : 'Gerar prestações'} onCancel={onClose} onSubmit={(event) => {
      event.preventDefault()
      if (typeof lines === 'string') return
      onSubmit({ entryAmount: Number(entry || 0), entryDueDate: entryDate, installments: Number(count), firstInstallmentDueDate: Number(entry || 0) > 0 && firstDate ? firstDate : null })
    }}>
      <FormError message={error || (typeof lines === 'string' ? lines : '')} />
      <p className="finance-dialog__hint">Ex.: compra em 10 vezes = valor da entrada + 9 prestações. Sem entrada, o valor total é dividido igualmente e a conta atual vira a parcela 1.</p>
      <div className="form-grid form-grid--four">
        <FormField label="Valor total"><input value={money(total)} disabled /></FormField>
        <FormField label="Valor da entrada"><input type="number" min="0" step="0.01" value={entry} onChange={(event) => setEntry(event.target.value)} /></FormField>
        <FormField label={Number(entry || 0) > 0 ? 'Data da entrada' : 'Vencimento da 1ª parcela'}><input type="date" required value={entryDate} onChange={(event) => setEntryDate(event.target.value)} /></FormField>
        <FormField label="Prestações"><input type="number" min="1" max="120" required value={count} onChange={(event) => setCount(event.target.value)} /></FormField>
        {Number(entry || 0) > 0 && <FormField label="1ª prestação (opcional)" hint="Padrão: um mês após a entrada"><input type="date" value={firstDate} onChange={(event) => setFirstDate(event.target.value)} /></FormField>}
      </div>
      {typeof lines !== 'string' && <div className="table-wrap"><table className="data-table finance-preview-table"><thead><tr><th>Lançamento</th><th>Vencimento</th><th className="num">Valor</th></tr></thead><tbody>{lines.map((line) => <tr key={line.label}><td>{line.label}</td><td>{dateText(line.dueDate)}</td><td className="num">{money(line.amount)}</td></tr>)}</tbody><tfoot><tr><td colSpan={2}>Total</td><td className="num">{money(lines.reduce((sum, line) => sum + line.amount, 0))}</td></tr></tfoot></table></div>}
    </ModalForm>
  </Modal>
}
