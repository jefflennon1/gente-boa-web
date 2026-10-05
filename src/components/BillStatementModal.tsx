import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileDown, Printer } from 'lucide-react'
import { apiErrorMessage } from '../api/client'
import { modulesApi, openPdf, type BillStatement, type BillStatementAllocationRow, type BillStatementSource } from '../api/modules'
import { dateText, moneyText, printElement } from '../lib/export'
import { Button, ErrorState, LoadingState, Modal } from './ui'

function sourceKey(source: BillStatementSource) {
  if ('billId' in source) return ['bill', source.billId]
  if ('receivableIds' in source) return ['receivables', ...source.receivableIds]
  return ['client', source.clientId, source.dueDate]
}

/**
 * Extrato Explicativo do Boleto (POP p.40-41) no formato do sistema anterior: resumo, atendimentos, detalhamento por
 * local (com os pedidos de compra) e o rateio das despesas por local de atendimento. "Gerar PDF" baixa o mesmo
 * documento montado pela API.
 */
export function BillStatementModal({ source, onClose }: { source: BillStatementSource | null; onClose: () => void }) {
  const documentRef = useRef<HTMLDivElement>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState('')
  const query = useQuery({
    queryKey: ['bill-statement', ...(source ? sourceKey(source) : [])],
    queryFn: () => source && 'billId' in source ? modulesApi.bills.statementData(source.billId) : modulesApi.bills.statementPreview(source as Exclude<BillStatementSource, { billId: number }>),
    enabled: source !== null,
  })
  const statement = query.data

  async function generatePdf() {
    if (!source) return
    setPdfLoading(true)
    setPdfError('')
    try {
      openPdf('billId' in source ? await modulesApi.bills.statement(source.billId) : await modulesApi.bills.statementPreviewPdf(source))
    } catch (error) {
      setPdfError(apiErrorMessage(error, 'Não foi possível gerar o PDF do extrato.'))
    } finally {
      setPdfLoading(false)
    }
  }

  const title = statement ? `Extrato do boleto ${statement.billNumber ?? '(a gerar)'}` : 'Extrato do boleto'
  return <Modal open={source !== null} onClose={onClose} title={title} description={statement?.preview ? 'Prévia do extrato das contas selecionadas: o número do boleto sai na geração.' : 'Extrato explicativo enviado ao cliente junto com o boleto.'} size="xlarge">
    <div className="modal__body bill-statement">
      {query.isLoading ? <LoadingState label="Montando o extrato..." /> : query.isError ? <ErrorState message={apiErrorMessage(query.error)} onRetry={() => query.refetch()} /> : statement && <>
        {pdfError && <ErrorState message={pdfError} />}
        <div ref={documentRef}><StatementDocument statement={statement} /></div>
      </>}
    </div>
    <footer className="modal__footer">
      <Button type="button" variant="secondary" onClick={onClose}>Fechar</Button>
      <Button type="button" variant="secondary" icon={<Printer size={16} />} disabled={!statement} onClick={() => printElement(documentRef.current, title)}>Imprimir</Button>
      <Button type="button" icon={<FileDown size={16} />} disabled={!statement || pdfLoading} onClick={generatePdf}>{pdfLoading ? 'Gerando PDF...' : 'Gerar PDF'}</Button>
    </footer>
  </Modal>
}

function StatementDocument({ statement }: { statement: BillStatement }) {
  return <article className="statement-doc">
    <header className="statement-doc__header">
      <img src="/images/gente-boa-logo.png" alt="Gente Boa Manutenção e Serviços" onError={(event) => { event.currentTarget.style.display = 'none' }} />
      <div>
        <h2>Extrato Explicativo do Boleto</h2>
        <p>{statement.city}, {longDate(statement.issueDate)}</p>
        <p>Dt. Venc. {dateText(statement.dueDate)}</p>
        {statement.preview && <p className="statement-doc__preview">PRÉVIA — boleto ainda não gerado</p>}
      </div>
    </header>
    <div className="statement-doc__client">
      <p>Cliente: {statement.clientId} - {statement.clientName}</p>
      <p>Endereço: {statement.clientAddress}</p>
    </div>
    <p className="statement-doc__number">Boleto: {statement.billNumber ?? 'a gerar'}</p>
    <p className="statement-doc__notice">Em caso de dúvida com relação à Ordem de Serviço (OS) executada, por gentileza solicite uma cópia da OS completa através da nossa Central de Atendimento.</p>

    <table className="statement-doc__summary">
      <thead><tr><th>Resumo</th><th className="num">Valor</th></tr></thead>
      <tbody>{statement.summary.map((line, index) => <tr key={`${line.label}-${index}`}><td>{line.label.endsWith(':') ? line.label : `${line.label}:`}</td><td className="num">{moneyText(line.amount)}</td></tr>)}</tbody>
    </table>
    <p className="statement-doc__total">Valor Total do Boleto Bancário: <strong>{moneyText(statement.total)}</strong></p>

    <table className="statement-doc__table">
      <thead><tr><th>O.S.</th><th>Data</th><th>Categoria</th><th>Local de Atend.</th><th>Descrição</th><th className="num">Tempo Total</th></tr></thead>
      <tbody>{statement.attendances.length === 0 ? <tr><td colSpan={6} className="muted">Nenhum atendimento no período.</td></tr> : statement.attendances.map((item) => <tr key={item.serviceOrderId}><td>{item.serviceOrderId}</td><td>{dateText(item.date)}</td><td>{item.category}</td><td>{item.location}</td><td>{item.description}</td><td className="num">{item.time}</td></tr>)}</tbody>
    </table>
    <p className="statement-doc__count">{statement.attendances.length} Atendimento(s) Realizado(s).</p>

    {statement.locations.map((group) => <section key={`${group.locationId ?? 'cliente'}`} className="statement-doc__location">
      <div className="statement-doc__band">Local de Atendimento: {group.locationId ?? ''} <strong>{group.description}</strong></div>
      <table className="statement-doc__table">
        <thead><tr><th>Data</th><th>OS</th><th>Tempo</th><th>Bloco</th><th>Descrição</th></tr></thead>
        <tbody>{group.orders.map((order) => <OrderRows key={order.serviceOrderId} order={order} />)}</tbody>
      </table>
    </section>)}
    <p className="statement-doc__count">Tempo Total Gasto: {statement.totalTime}</p>

    <h3 className="statement-doc__allocation-title">Rateio das Despesas gerais por Local de Atendimento</h3>
    <div className="table-wrap"><table className="statement-doc__table statement-doc__allocation">
      <thead>
        <tr><th colSpan={3} /><th colSpan={6} className="center">Valor Total Relativo a:</th></tr>
        <tr><th>Local do Atendimento</th><th className="num">Tempo Utilizado</th><th className="num">% Rateado</th><th className="num">Mão-de-Obra</th><th className="num">Materiais</th><th className="num">OS Avulsas</th><th className="num">Serv. Terc.</th><th className="num">Diversos</th><th className="num">Total</th></tr>
      </thead>
      <tbody>{statement.allocation.map((row) => <AllocationLine key={`${row.locationId ?? 'cliente'}`} row={row} />)}</tbody>
      <tfoot><AllocationLine row={statement.allocationTotal} total /></tfoot>
    </table></div>
    <footer className="statement-doc__footer"><strong>{statement.company?.name}</strong>{statement.company?.address && <span>{statement.company.address}</span>}</footer>
  </article>
}

function OrderRows({ order }: { order: BillStatement['locations'][number]['orders'][number] }) {
  return <>
    <tr className="statement-doc__order"><td>{dateText(order.date)}</td><td>{order.serviceOrderId}</td><td>{order.time}</td><td>{order.block}</td><td>{order.description}</td></tr>
    {order.purchaseOrders.map((purchase) => <tr key={purchase.id}><td colSpan={5} className="statement-doc__purchase-cell">
      <table className="statement-doc__purchase">
        <thead>
          <tr><th colSpan={5}>Pedido {purchase.id} · Fornecedor: {purchase.supplierName || '—'}{purchase.payableId ? ` · (CP): ${purchase.payableId}` : ''} · Nome Fantasia: {purchase.supplierTradeName || '—'} · NF: {purchase.invoiceNumber || '—'} · Data: {dateText(purchase.date)}</th></tr>
          <tr><th>Produto</th><th>Unidade</th><th className="num">Quantidade</th><th className="num">Vr. Unitário</th><th className="num">Vr. Total</th></tr>
        </thead>
        <tbody>{purchase.items.map((item, index) => <tr key={index}><td>{item.product}</td><td>{item.unit}</td><td className="num">{item.quantity ?? ''}</td><td className="num">{moneyText(item.unitValue)}</td><td className="num">{moneyText(item.total)}</td></tr>)}</tbody>
        <tfoot><tr><td colSpan={4} className="num">Valor Total</td><td className="num">{moneyText(purchase.total)}</td></tr></tfoot>
      </table>
    </td></tr>)}
    <tr className="statement-doc__order-amount"><td colSpan={5} className="num">{moneyText(order.amount)}</td></tr>
  </>
}

function AllocationLine({ row, total = false }: { row: BillStatementAllocationRow; total?: boolean }) {
  return <tr className={total ? 'total-row' : ''}>
    <td>{total ? '' : row.location}</td><td className="num">{row.time}</td><td className="num">{total ? '' : moneyText(row.percentage)}</td>
    <td className="num">{moneyText(row.labor)}</td><td className="num">{moneyText(row.materials)}</td><td className="num">{moneyText(row.oneOff)}</td>
    <td className="num">{moneyText(row.thirdParty)}</td><td className="num">{moneyText(row.other)}</td><td className="num"><strong>{moneyText(row.total)}</strong></td>
  </tr>
}

function longDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  return `${String(day).padStart(2, '0')} de ${months[month - 1]} de ${year}`
}
