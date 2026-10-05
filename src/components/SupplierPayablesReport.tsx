import { useMutation } from '@tanstack/react-query'
import { FileSpreadsheet, Printer, Search } from 'lucide-react'
import { useRef, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { financeApi } from '../api/finance'
import { dateText, downloadCsv, moneyText, printElement, todayIso } from '../lib/export'
import type { FinancialReportRow } from '../types-finance'
import { Button, EmptyState, ErrorState, LoadingState, Modal } from './ui'

type Scope = 'ALL' | 'OPEN' | 'PAID' | 'OVERDUE'

const scopeLabels: Record<Scope, string> = { ALL: 'Todas', OPEN: 'Abertas', PAID: 'Quitadas', OVERDUE: 'Atrasadas' }

/** Relatório de contas a pagar de um fornecedor (POP p.19): todas, abertas, quitadas ou atrasadas. */
export function SupplierPayablesReport({ supplier, onClose }: { supplier: { id: number; name: string } | null; onClose: () => void }) {
  const [scope, setScope] = useState<Scope>('ALL')
  const [startDate, setStartDate] = useState('2000-01-01')
  const [endDate, setEndDate] = useState(`${new Date().getFullYear() + 2}-12-31`)
  const printRef = useRef<HTMLDivElement>(null)
  const mutation = useMutation({
    mutationFn: () => financeApi.reports.payablesByPeriod({ startDate, endDate, supplierId: supplier!.id, scope, orderBy: 'DUE_DATE' }),
  })
  const data = mutation.data
  const title = `Contas a pagar - ${supplier?.name ?? ''} (${scopeLabels[scope]})`

  function exportExcel() {
    if (!data) return
    downloadCsv(title, ['Nº CP', 'Lançamento', 'Vencimento', 'Pagamento', 'Descrição', 'OS', 'Centro de custo', 'Subcentro', 'Valor', 'Pago', 'Saldo'],
      data.rows.map((row) => [row.id, dateText(row.registeredAt), dateText(row.dueAt), dateText(row.paidAt), row.description, row.serviceOrderId, row.costCenterName, row.subCostCenterName, row.amountDue, row.amountPaid, row.balance]))
  }

  return <Modal open={supplier !== null} onClose={onClose} title="Contas a pagar do fornecedor" description={supplier ? `${supplier.name} · código #${supplier.id}` : undefined} size="xlarge">
    <div className="modal__body">
      <form className="report-filters" data-allow-enter-submit="true" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
        <label><span>Situação</span><select value={scope} onChange={(event) => setScope(event.target.value as Scope)}>{(Object.keys(scopeLabels) as Scope[]).map((key) => <option key={key} value={key}>{scopeLabels[key]}</option>)}</select></label>
        <label><span>Vencimento de</span><input type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <label><span>até</span><input type="date" required value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        <div className="report-filters__actions">
          <Button type="submit" icon={<Search size={16} />} disabled={mutation.isPending}>{mutation.isPending ? 'Gerando...' : 'Visualizar'}</Button>
          <Button type="button" variant="secondary" icon={<Printer size={16} />} disabled={!data} onClick={() => printElement(printRef.current, title)}>Imprimir / PDF</Button>
          <Button type="button" variant="secondary" icon={<FileSpreadsheet size={16} />} disabled={!data} onClick={exportExcel}>Excel</Button>
        </div>
      </form>
      {mutation.isPending ? <LoadingState label="Gerando relatório..." /> : mutation.isError ? <ErrorState message={apiErrorMessage(mutation.error)} /> : !data ? <EmptyState title="Escolha a situação" description="Selecione Todas, Abertas, Quitadas ou Atrasadas e clique em Visualizar." /> : <div className="report-document" ref={printRef}>
        <div className="print-header"><div><h1>GENTE BOA SERVIÇOS</h1><p>Contas a pagar por fornecedor · {scopeLabels[scope]}</p><p><strong>{supplier?.name}</strong> (#{supplier?.id})</p></div><small>Vencimentos de {dateText(startDate)} a {dateText(endDate)}<br />Emitido em {dateText(todayIso())}</small></div>
        {data.rows.length === 0 ? <p className="muted">Nenhuma conta encontrada.</p> : <PayablesTable rows={data.rows} />}
        <div className="print-boxes">
          <div className="print-box"><small>Quantidade</small><strong>{data.totals.count}</strong></div>
          <div className="print-box"><small>Valor total</small><strong>R$ {moneyText(data.totals.amountDue)}</strong></div>
          <div className="print-box"><small>Total pago</small><strong>R$ {moneyText(data.totals.amountPaid)}</strong></div>
          <div className="print-box"><small>Saldo em aberto</small><strong>R$ {moneyText(data.totals.balance)}</strong></div>
        </div>
        {data.truncated && <p className="muted">Relatório limitado às primeiras linhas. Reduza o período para ver tudo.</p>}
      </div>}
    </div>
  </Modal>
}

function PayablesTable({ rows }: { rows: FinancialReportRow[] }) {
  const today = todayIso()
  return <table><thead><tr><th>Nº CP</th><th>Vencimento</th><th>Pagamento</th><th>Descrição</th><th>OS</th><th>Centro / subcentro</th><th className="num">Valor</th><th className="num">Pago</th><th className="num">Saldo</th></tr></thead>
    <tbody>{rows.map((row) => <tr key={row.id}><td>{row.id}</td><td>{dateText(row.dueAt)}{row.balance > 0 && row.dueAt && row.dueAt.slice(0, 10) < today ? ' *' : ''}</td><td>{dateText(row.paidAt)}</td><td>{row.description}</td><td>{row.serviceOrderId || ''}</td><td>{[row.costCenterName, row.subCostCenterName].filter(Boolean).join(' / ')}</td><td className="num">{moneyText(row.amountDue)}</td><td className="num">{moneyText(row.amountPaid)}</td><td className="num">{moneyText(row.balance)}</td></tr>)}</tbody></table>
}
