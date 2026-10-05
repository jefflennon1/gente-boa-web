import { useMutation } from '@tanstack/react-query'
import { Printer, Search } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { hours } from '../api/employeeTracking'
import { modulesApi, type MonthlySummary as Summary, type SummaryLine } from '../api/modules'
import { Button, EmptyState, ErrorState, LoadingState, PageHeader } from '../components/ui'
import { dateText, monthBounds, moneyText, printElement } from '../lib/export'

/** Resumo mensal / ata de reunião (POP p.50). */
export function MonthlySummary() {
  const bounds = useMemo(() => {
    const previous = new Date()
    previous.setDate(1)
    previous.setMonth(previous.getMonth() - 1)
    return monthBounds(previous)
  }, [])
  const [startDate, setStartDate] = useState(bounds.start)
  const [endDate, setEndDate] = useState(bounds.end)
  const printRef = useRef<HTMLDivElement>(null)
  const mutation = useMutation({ mutationFn: () => modulesApi.monthlySummary.find(startDate, endDate) })
  const data = mutation.data
  return <>
    <PageHeader eyebrow="Relatórios" title="Resumo mensal (ata de reunião)" subtitle="Resumo comercial, operacional e financeiro do período." actions={<Button icon={<Printer size={18} />} disabled={!data} onClick={() => printElement(printRef.current, 'Resumo Mensal')}>Imprimir / PDF</Button>} />
    <section className="panel data-panel">
      <form className="inline-filters" data-allow-enter-submit="true" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
        <label><span>Período de</span><input type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <label><span>até</span><input type="date" required value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        <Button type="submit" icon={<Search size={16} />} disabled={mutation.isPending}>{mutation.isPending ? 'Gerando...' : 'Gerar resumo'}</Button>
      </form>
      {mutation.isPending ? <LoadingState label="Consolidando o resumo do período..." /> : mutation.isError ? <ErrorState message={apiErrorMessage(mutation.error)} /> : !data ? <EmptyState title="Informe o período" description="Escolha o período (normalmente o mês anterior) e clique em Gerar resumo." /> : <div className="report-document" ref={printRef}><SummaryDocument data={data} /></div>}
    </section>
  </>
}

function LineTable({ title, lines, valueLabel = 'Valor', money = true }: { title: string; lines: SummaryLine[]; valueLabel?: string; money?: boolean }) {
  return <table><thead><tr><th>{title}</th><th className="num">Qtde.</th><th className="num">%</th><th className="num">{valueLabel}</th><th className="num">%</th></tr></thead>
    <tbody>{lines.map((line) => <tr key={line.label} className={line.label.startsWith('Total') ? 'total-row' : ''}><td>{line.label}</td><td className="num">{line.quantity}</td><td className="num">{moneyText(line.quantityPercentage)}</td><td className="num">{money ? moneyText(line.value) : line.value}</td><td className="num">{moneyText(line.valuePercentage)}</td></tr>)}</tbody></table>
}

function SummaryDocument({ data }: { data: Summary }) {
  const { commercial, operational, financial } = data
  return <>
    <div className="print-header"><div><h1>Resumo Mensal</h1><small>Período {dateText(data.startDate)} a {dateText(data.endDate)}</small></div><small>Emitido em {dateText(new Date().toISOString())}</small></div>
    <h2>Resumo Comercial</h2>
    <LineTable title="Contratos" lines={[commercial.closed, commercial.canceled, commercial.active]} valueLabel="Valor mensal" />
    {commercial.closedContracts.length > 0 && <><h3>Contratos fechados no período</h3><table><thead><tr><th>Contrato</th><th>Cliente</th><th>Data</th><th className="num">Horas</th><th className="num">Mensal</th></tr></thead><tbody>{commercial.closedContracts.map((item) => <tr key={String(item.contractId)}><td>{String(item.contractId)}</td><td>{String(item.clientName ?? '')}</td><td>{dateText(String(item.contractDate ?? ''))}</td><td className="num">{String(item.hours)}</td><td className="num">{moneyText(Number(item.monthlyValue))}</td></tr>)}</tbody></table></>}
    {commercial.canceledContracts.length > 0 && <><h3>Contratos cancelados no período</h3><table><thead><tr><th>Contrato</th><th>Cliente</th><th>Cancelamento</th><th className="num">Horas</th><th className="num">Mensal</th></tr></thead><tbody>{commercial.canceledContracts.map((item) => <tr key={String(item.contractId)}><td>{String(item.contractId)}</td><td>{String(item.clientName ?? '')}</td><td>{dateText(String(item.cancellationDate ?? ''))}</td><td className="num">{String(item.hours)}</td><td className="num">{moneyText(Number(item.monthlyValue))}</td></tr>)}</tbody></table></>}
    <div className="summary-columns">
      <div><LineTable title="Quantidade de Ordens de Serviço" lines={data.ordersByType} /></div>
      <div><LineTable title="Tipos de Ordem de Serviço" lines={data.ordersByCategory} /></div>
    </div>
    <h2>Resumo Operacional</h2>
    <div className="summary-columns">
      <div><LineTable title="Pedidos de compra (fornecedor)" lines={operational.purchaseOrders} /></div>
      <div><table><thead><tr><th>Preço médio (R$/hora)</th><th className="num">Contrato</th><th className="num">Avulso</th><th className="num">Geral</th></tr></thead><tbody><tr><td>Total</td><td className="num">{moneyText(operational.contractHourPrice)}</td><td className="num">{moneyText(operational.oneOffHourPrice)}</td><td className="num">{moneyText(operational.generalHourPrice)}</td></tr></tbody></table></div>
    </div>
    <table><thead><tr><th>Acomp. das horas contratadas</th><th className="num">Contratadas</th><th className="num">Utilizadas</th><th className="num">%</th><th className="num">Clientes</th><th className="num">Utilizaram</th><th className="num">% que utilizou</th><th className="num">Qtd. OS</th></tr></thead>
      <tbody>{operational.contractHours.map((line) => <tr key={line.label} className={line.label === 'Total' ? 'total-row' : ''}><td>{line.label}</td><td className="num">{hours(line.contractedMinutes)}</td><td className="num">{hours(line.usedMinutes)}</td><td className="num">{moneyText(line.usedPercentage)}</td><td className="num">{line.clients}</td><td className="num">{line.clientsUsing}</td><td className="num">{moneyText(line.usingPercentage)}</td><td className="num">{line.orders}</td></tr>)}</tbody></table>
    <div className="print-boxes"><div className="print-box"><small>Horas avulsas utilizadas</small><strong>{hours(operational.oneOffMinutes)} ({moneyText(operational.oneOffPercentage)}%)</strong></div><div className="print-box"><small>Horas TOTAL utilizadas</small><strong>{hours(operational.totalMinutes)}</strong></div></div>
    <h2>Resumo Financeiro</h2>
    <div className="summary-columns">
      <div><table><thead><tr><th>Fluxo de caixa do período</th><th className="num">Qtde.</th><th className="num">Valor</th></tr></thead><tbody><tr><td>Contas recebidas</td><td className="num">{financial.receivedCount}</td><td className="num">{moneyText(financial.received)}</td></tr><tr><td>Contas pagas</td><td className="num">{financial.paidCount}</td><td className="num">{moneyText(financial.paid)}</td></tr><tr className="total-row"><td>Resultado do exercício</td><td /><td className="num">{moneyText(financial.result)}</td></tr></tbody></table></div>
      <div><table><thead><tr><th>Caixa e banco</th><th className="num">Saldo</th><th className="num">%</th></tr></thead><tbody>{financial.availability.map((line) => <tr key={line.label}><td>{line.label}</td><td className="num">{moneyText(line.value)}</td><td className="num">{moneyText(line.valuePercentage)}</td></tr>)}<tr className="total-row"><td>Total disponível</td><td className="num">{moneyText(financial.totalAvailable)}</td><td /></tr></tbody></table></div>
    </div>
    <LineTable title="Informações diversas (vencimentos do período)" lines={[financial.overdue, financial.materialSales, financial.equipmentRental]} />
  </>
}
