import { useMutation, useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, Printer, Search } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { financeApi, financeKeys } from '../api/finance'
import { ClientPicker, SupplierPicker, type PickerValue } from '../components/AsyncPicker'
import { Button, EmptyState, ErrorState, LoadingState, PageHeader, Toast } from '../components/ui'
import { dateText, downloadCsv, monthBounds, moneyText, printElement } from '../lib/export'
import type { CostCenterReport, FinancialPeriodReport, FinancialReportRow } from '../types-finance'

type ReportKey = 'payables-period' | 'payables-center' | 'receivables-period' | 'receivables-center'

const reportOptions: Array<{ key: ReportKey; title: string; detail: string }> = [
  { key: 'payables-period', title: 'Contas a pagar por período', detail: 'Fornecedor, OS, ordenação por vencimento ou pagamento e abrangência.' },
  { key: 'payables-center', title: 'Contas a pagar por centro de custo', detail: 'Detalhado ou resumido, com centro e subcentro.' },
  { key: 'receivables-period', title: 'Contas a receber por período', detail: 'Cliente, OS, abrangência e forma de pagamento.' },
  { key: 'receivables-center', title: 'Contas a receber por centro de custo', detail: 'Detalhado ou resumido, com centro e subcentro.' },
]

type Filters = {
  startDate: string
  endDate: string
  party: PickerValue
  serviceOrderId: string
  orderBy: 'DUE' | 'PAYMENT'
  scope: 'ALL' | 'OPEN' | 'PAID' | 'OVERDUE'
  paymentType: 'ALL' | 'CASH' | 'TRANSFER' | 'BILL'
  costCenterId: string
  subCostCenterId: string
  type: 'DETAILED' | 'SUMMARY'
  status: 'ALL' | 'OPEN' | 'PAID'
}

/** Relatórios Diversos > Financeiro (POP p.43-46). */
export function FinancialReports() {
  const period = useMemo(() => monthBounds(), [])
  const [report, setReport] = useState<ReportKey>('payables-period')
  const [filters, setFilters] = useState<Filters>({ startDate: period.start, endDate: period.end, party: null, serviceOrderId: '', orderBy: 'DUE', scope: 'ALL', paymentType: 'ALL', costCenterId: '', subCostCenterId: '', type: 'DETAILED', status: 'PAID' })
  const [toast, setToast] = useState('')
  const printRef = useRef<HTMLDivElement>(null)
  const isPayable = report.startsWith('payables')
  const isCenter = report.endsWith('center')
  const centersQuery = useQuery({ queryKey: [...financeKeys.costCenters, isPayable ? 'Despesas' : 'Receitas'], queryFn: () => financeApi.costCenters.list(isPayable ? 'Despesas' : 'Receitas') })
  const centers = centersQuery.data ?? []
  const subCenters = centers.find((center) => String(center.id) === filters.costCenterId)?.subCenters ?? centers.flatMap((center) => center.subCenters)

  const runMutation = useMutation({
    mutationFn: async (): Promise<FinancialPeriodReport | CostCenterReport> => {
      const base = { startDate: filters.startDate, endDate: filters.endDate }
      if (report === 'payables-period') return financeApi.reports.payablesByPeriod({ ...base, supplierId: filters.party?.id, serviceOrderId: filters.serviceOrderId ? Number(filters.serviceOrderId) : undefined, orderBy: filters.orderBy, scope: filters.scope })
      if (report === 'receivables-period') return financeApi.reports.receivablesByPeriod({ ...base, clientId: filters.party?.id, serviceOrderId: filters.serviceOrderId ? Number(filters.serviceOrderId) : undefined, orderBy: filters.orderBy, scope: filters.scope, paymentType: filters.paymentType })
      const centerParams = { ...base, costCenterId: filters.costCenterId ? Number(filters.costCenterId) : undefined, subCostCenterId: filters.subCostCenterId ? Number(filters.subCostCenterId) : undefined, status: filters.status, type: filters.type }
      return report === 'payables-center' ? financeApi.reports.payablesByCostCenter(centerParams) : financeApi.reports.receivablesByCostCenter(centerParams)
    },
    onError: (error) => setToast(apiErrorMessage(error)),
  })
  const result = runMutation.data
  const title = reportOptions.find((option) => option.key === report)!.title

  function update<K extends keyof Filters>(key: K, value: Filters[K]) { setFilters((current) => ({ ...current, [key]: value })) }
  function selectReport(key: ReportKey) { setReport(key); runMutation.reset(); setFilters((current) => ({ ...current, party: null, costCenterId: '', subCostCenterId: '' })) }

  function exportExcel() {
    if (!result) return
    const rows: FinancialReportRow[] = 'rows' in result ? result.rows : result.centers.flatMap((center) => center.subCenters.flatMap((sub) => sub.rows))
    if ('centers' in result && result.type === 'SUMMARY') {
      downloadCsv(title, ['Centro', 'Subcentro', 'Valor devido', 'Valor pago', 'Saldo', '%'], result.centers.flatMap((center) => [[`${center.id ?? ''} ${center.name}`, '', center.amountDue, center.amountPaid, center.balance, center.percentage], ...center.subCenters.map((sub) => ['', `${sub.id ?? ''} ${sub.name}`, sub.amountDue, sub.amountPaid, sub.balance, sub.percentage])]))
      return
    }
    downloadCsv(title, ['Código', 'Cadastro', 'Vencimento', 'Pagamento', isPayable ? 'Fornecedor' : 'Cliente', 'Descrição', 'OS', 'Boleto', 'Centro', 'Subcentro', 'Devido', 'Pago', 'Espécie', 'Transferência', 'Boleto (valor)', 'Saldo', 'Situação'], rows.map((row) => [row.id, dateText(row.registeredAt), dateText(row.dueAt), dateText(row.paidAt), row.partyName, row.description, row.serviceOrderId, row.billNumber, row.costCenterName, row.subCostCenterName, row.amountDue, row.amountPaid, row.cash, row.transfer, row.bill, row.balance, row.status === 'PAID' ? 'Quitada' : 'Aberta']))
  }

  return <>
    <PageHeader eyebrow="Relatórios" title="Relatórios financeiros" subtitle="Contas a pagar e a receber por período e por centro de custo, com impressão e exportação para Excel." />
    <section className="report-picker">{reportOptions.map((option) => <button key={option.key} className={report === option.key ? 'active' : ''} onClick={() => selectReport(option.key)}><strong>{option.title}</strong><small>{option.detail}</small></button>)}</section>
    <section className="panel data-panel">
      <form className="report-filters" data-allow-enter-submit="true" onSubmit={(event) => { event.preventDefault(); runMutation.mutate() }}>
        <label><span>Período de</span><input type="date" required value={filters.startDate} onChange={(event) => update('startDate', event.target.value)} /></label>
        <label><span>até</span><input type="date" required value={filters.endDate} min={filters.startDate} onChange={(event) => update('endDate', event.target.value)} /></label>
        {!isCenter && <>
          <label className="report-filters__wide"><span>{isPayable ? 'Fornecedor' : 'Cliente'}</span>{isPayable ? <SupplierPicker value={filters.party} onChange={(value) => update('party', value)} /> : <ClientPicker value={filters.party} onChange={(value) => update('party', value)} />}</label>
          <label><span>Ord. serviço</span><input type="number" min="1" value={filters.serviceOrderId} onChange={(event) => update('serviceOrderId', event.target.value)} /></label>
          <label><span>Ordenamento</span><select value={filters.orderBy} onChange={(event) => update('orderBy', event.target.value as Filters['orderBy'])}><option value="DUE">Vencimento</option><option value="PAYMENT">{isPayable ? 'Pagamento' : 'Recebimento'}</option></select></label>
          <label><span>Abrangência</span><select value={filters.scope} onChange={(event) => update('scope', event.target.value as Filters['scope'])}><option value="ALL">Todas</option><option value="OPEN">Abertas</option><option value="PAID">Quitadas</option><option value="OVERDUE">Atrasadas</option></select></label>
          {!isPayable && <label><span>Tp. pagamento</span><select value={filters.paymentType} onChange={(event) => update('paymentType', event.target.value as Filters['paymentType'])}><option value="ALL">Todos</option><option value="CASH">Dinheiro</option><option value="TRANSFER">Transferência</option><option value="BILL">Boleto</option></select></label>}
        </>}
        {isCenter && <>
          <label><span>Centro de custo</span><select value={filters.costCenterId} onChange={(event) => setFilters((current) => ({ ...current, costCenterId: event.target.value, subCostCenterId: '' }))}><option value="">Todos</option>{centers.map((center) => <option key={center.id} value={center.id}>{center.id} · {center.description}</option>)}</select></label>
          <label><span>Subcentro</span><select value={filters.subCostCenterId} onChange={(event) => update('subCostCenterId', event.target.value)}><option value="">Todos</option>{subCenters.map((sub) => <option key={sub.id} value={sub.id}>{sub.id} · {sub.description}</option>)}</select></label>
          <label><span>Tipo</span><select value={filters.type} onChange={(event) => update('type', event.target.value as Filters['type'])}><option value="DETAILED">Detalhado</option><option value="SUMMARY">Resumido</option></select></label>
          <label><span>Status</span><select value={filters.status} onChange={(event) => update('status', event.target.value as Filters['status'])}><option value="PAID">Quitadas</option><option value="OPEN">Abertas</option><option value="ALL">Todos</option></select></label>
        </>}
        <div className="report-filters__actions"><Button type="submit" icon={<Search size={16} />} disabled={runMutation.isPending}>{runMutation.isPending ? 'Gerando...' : 'Visualizar'}</Button><Button type="button" variant="secondary" icon={<Printer size={16} />} disabled={!result} onClick={() => printElement(printRef.current, title)}>Imprimir / PDF</Button><Button type="button" variant="secondary" icon={<FileSpreadsheet size={16} />} disabled={!result} onClick={exportExcel}>Excel</Button></div>
      </form>
      {runMutation.isPending ? <LoadingState label="Gerando relatório..." /> : runMutation.isError ? <ErrorState message={apiErrorMessage(runMutation.error)} /> : !result ? <EmptyState title="Defina os filtros" description="Escolha o relatório, informe os filtros e clique em Visualizar." /> : <div className="report-document" ref={printRef}>
        {'rows' in result ? <PeriodReportView report={result} title={title} payable={isPayable} /> : <CostCenterReportView report={result} title={title} payable={isPayable} />}
      </div>}
    </section>
    {toast && <Toast variant="error" message={toast} onClose={() => setToast('')} />}
  </>
}

function PeriodReportView({ report, title, payable }: { report: FinancialPeriodReport; title: string; payable: boolean }) {
  const dateOf = (row: FinancialReportRow) => (report.orderBy === 'PAYMENT' ? row.paidAt : row.dueAt)?.slice(0, 10) ?? ''
  const groups = new Map<string, FinancialReportRow[]>()
  report.rows.forEach((row) => { const key = dateOf(row); groups.set(key, [...(groups.get(key) ?? []), row]) })
  const scopeLabel = { ALL: 'Todas', OPEN: 'Abertas', PAID: 'Quitadas', OVERDUE: 'Atrasadas' }[report.scope as 'ALL'] ?? report.scope
  return <>
    <div className="print-header"><div><h1>GENTE BOA SERVIÇOS</h1><p>{title.replace('por período', 'por Período')} · {scopeLabel}</p><small>Contas com {report.orderBy === 'PAYMENT' ? (payable ? 'pagamento' : 'recebimento') : 'vencimento'} de {dateText(report.startDate)} a {dateText(report.endDate)}</small></div><small>{report.totals.count} título(s)</small></div>
    {report.truncated && <p className="muted">Exibindo os primeiros 20.000 registros. Reduza o período para ver todos.</p>}
    {[...groups.entries()].map(([date, rows]) => <div key={date} className="print-group">
      <h3>Data de {report.orderBy === 'PAYMENT' ? (payable ? 'pagamento' : 'recebimento') : 'vencimento'}: {dateText(date) || 'Sem data'}</h3>
      <table><thead><tr><th>Cód.</th><th>Data cad.</th><th>OS</th>{!payable && <th>Boleto</th>}<th>{payable ? 'Fornecedor' : 'Cliente'}</th><th>Descrição</th><th className="num">Vl. devido</th><th className="num">Vl. pago</th><th className="num">Espécie</th><th className="num">Transf.</th><th className="num">Boleto</th><th className="num">Saldo</th><th>Status</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={`${row.kind}-${row.id}`}><td>{row.id}</td><td>{dateText(row.registeredAt)}</td><td>{row.serviceOrderId ?? ''}</td>{!payable && <td>{row.billNumber || ''}</td>}<td>{row.partyName}</td><td>{row.description}</td><td className="num">{moneyText(row.amountDue)}</td><td className="num">{moneyText(row.amountPaid)}</td><td className="num">{moneyText(row.cash)}</td><td className="num">{moneyText(row.transfer)}</td><td className="num">{moneyText(row.bill)}</td><td className="num">{moneyText(row.balance)}</td><td>{row.status === 'PAID' ? 'QUITADO' : 'ABERTO'}</td></tr>)}</tbody>
        <tfoot><tr><td colSpan={payable ? 5 : 6}>Total de títulos na data: {rows.length}</td><td className="num">{moneyText(rows.reduce((sum, row) => sum + row.amountDue, 0))}</td><td className="num">{moneyText(rows.reduce((sum, row) => sum + row.amountPaid, 0))}</td><td colSpan={3} /><td className="num">{moneyText(rows.reduce((sum, row) => sum + row.balance, 0))}</td><td /></tr></tfoot>
      </table>
    </div>)}
    <div className="print-boxes"><div className="print-box"><small>Valor devido</small><strong>{moneyText(report.totals.amountDue)}</strong></div><div className="print-box"><small>Valor pago</small><strong>{moneyText(report.totals.amountPaid)}</strong></div><div className="print-box"><small>Saldo</small><strong>{moneyText(report.totals.balance)}</strong></div><div className="print-box"><small>Espécie / Transf. / Boleto</small><strong>{moneyText(report.totals.cash)} / {moneyText(report.totals.transfer)} / {moneyText(report.totals.bill)}</strong></div></div>
  </>
}

function CostCenterReportView({ report, title, payable }: { report: CostCenterReport; title: string; payable: boolean }) {
  const statusLabel = { PAID: 'Quitadas', OPEN: 'Abertas', ALL: 'Todas' }[report.status as 'PAID'] ?? report.status
  return <>
    <div className="print-header"><div><h1>Relação Geral de {payable ? 'Contas à Pagar' : 'Contas à Receber'} por Centro de Custo ({report.type === 'SUMMARY' ? 'Resumido' : 'Detalhado'})</h1><small>Período de {dateText(report.startDate)} a {dateText(report.endDate)} - {statusLabel}</small></div><small>{title}</small></div>
    {report.centers.length === 0 && <p className="muted">Nenhum lançamento encontrado.</p>}
    {report.centers.map((center) => <div key={center.id ?? 'none'} className="print-group">
      <table><thead><tr><th>Centro de custo: {center.id ?? '—'} &nbsp; {center.name}</th><th className="num">Valor devido</th><th className="num">{payable ? 'Valor pago' : 'Valor recebido'}</th><th className="num">Saldo</th><th className="num">%</th></tr></thead>
        <tbody>
          <tr className="total-row"><td>Total do centro</td><td className="num">{moneyText(center.amountDue)}</td><td className="num">{moneyText(center.amountPaid)}</td><td className="num">{moneyText(center.balance)}</td><td className="num">{moneyText(center.percentage)}</td></tr>
          {center.subCenters.map((sub) => <SubCenterRows key={sub.id ?? 'none'} sub={sub} detailed={report.type === 'DETAILED'} payable={payable} />)}
        </tbody>
      </table>
    </div>)}
    <div className="print-boxes"><div className="print-box"><small>Valores totais do período · devido</small><strong>{moneyText(report.totals.amountDue)}</strong></div><div className="print-box"><small>{payable ? 'Pago' : 'Recebido'}</small><strong>{moneyText(report.totals.amountPaid)}</strong></div><div className="print-box"><small>Saldo</small><strong>{moneyText(report.totals.balance)}</strong></div></div>
  </>
}

function SubCenterRows({ sub, detailed, payable }: { sub: CostCenterReport['centers'][number]['subCenters'][number]; detailed: boolean; payable: boolean }) {
  return <>
    <tr><td>&nbsp;&nbsp;Sub-centro de custo: {sub.id ?? '—'} &nbsp; {sub.name}</td><td className="num">{moneyText(sub.amountDue)}</td><td className="num">{moneyText(sub.amountPaid)}</td><td className="num">{moneyText(sub.balance)}</td><td className="num">{moneyText(sub.percentage)}</td></tr>
    {detailed && sub.rows.map((row) => <tr key={`${row.kind}-${row.id}`} className="muted"><td>&nbsp;&nbsp;&nbsp;&nbsp;{payable ? 'CP' : 'CR'} {row.id} · {dateText(payable ? row.paidAt ?? row.dueAt : row.paidAt ?? row.dueAt)} · {row.partyName} · {row.description}</td><td className="num">{moneyText(row.amountDue)}</td><td className="num">{moneyText(row.amountPaid)}</td><td className="num">{moneyText(row.balance)}</td><td /></tr>)}
  </>
}
