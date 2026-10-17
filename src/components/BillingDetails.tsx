import { CalendarDays, FileBarChart, FileText, Mail, ReceiptText, Upload } from 'lucide-react'
import { enumLabel, formatDate, money } from '../lib/format'
import type { BillDetail, ClientStatementDetail } from '../types'
import { Badge } from './ui'
import { TaxRetentionNotice } from './TaxRetention'

// Blocos de detalhe de cobrança compartilhados entre a tela de Boletos e o modal "Dados do cliente".

export function BillDetails({ bill, paid }: { bill: BillDetail; paid: boolean }) {
  const receivableOrders = [...new Set((bill.receivables || []).map((item) => item.serviceOrderId).filter((id): id is number => Boolean(id)))]
  const receivableContracts = [...new Set((bill.receivables || []).map((item) => item.contractId).filter((id): id is number => Boolean(id)))]
  return <div className="detail-modal-content bill-detail">
    <div className="detail-modal__hero-row"><div className="detail-drawer__hero"><span className="detail-avatar"><ReceiptText /></span><div><span>Boleto #{bill.number || bill.id}{bill.serviceOrderId ? ` · ${bill.serviceOrderId}` : ' · Contas a receber'}</span><h2>{bill.clientTradeName || bill.clientName || `Cliente #${bill.clientId}`}</h2><p>Vencimento em {formatDate(bill.dueAt)}</p></div></div><Badge tone={paid ? 'green' : 'orange'}>{paid ? 'Pago' : 'Pendente'}</Badge></div>
    <TaxRetentionNotice retention={bill.taxRetention} />
    <div className="detail-metrics bill-detail__metrics"><span><small>Valor total</small><strong>{money(bill.amount)}</strong></span><span><small>Serviços</small><strong>{money(bill.serviceAmount)}</strong></span><span><small>Materiais</small><strong>{money(bill.materialAmount)}</strong></span><span><small>Tempo realizado</small><strong>{bill.actualHours || '00:00'}</strong></span></div>
    <div className="detail-sections-grid">
      <section className="drawer-section"><h3>Cliente</h3><dl><div><dt>Código</dt><dd>{bill.clientId || '—'}</dd></div><div><dt>Razão social</dt><dd>{bill.clientName || 'Não informada'}</dd></div><div><dt>Nome fantasia</dt><dd>{bill.clientTradeName || 'Não informado'}</dd></div><div><dt>CPF / CNPJ</dt><dd>{bill.clientDocument || 'Não informado'}</dd></div><div><dt>Telefone</dt><dd>{bill.clientPhone || 'Não informado'}</dd></div><div><dt>E-mail</dt><dd>{bill.clientEmail || 'Não informado'}</dd></div><div className="drawer-section__wide"><dt>Endereço</dt><dd>{bill.clientAddress || 'Não informado'}</dd></div></dl></section>
      <section className="drawer-section"><h3>Origem da cobrança</h3><dl><div><dt>OS</dt><dd>{bill.serviceOrderId ? `${bill.serviceOrderId}` : receivableOrders.length ? receivableOrders.map((id) => `${id}`).join(', ') : 'Sem OS vinculada'}</dd></div><div><dt>Contrato</dt><dd>{bill.contractId ? `#${bill.contractId}` : receivableContracts.length ? receivableContracts.map((id) => `#${id}`).join(', ') : bill.serviceOrderId ? 'Atendimento avulso' : 'Lançamentos avulsos'}</dd></div><div><dt>Data</dt><dd>{formatDate(bill.serviceOrderDate || bill.processedAt)}</dd></div><div><dt>Origem</dt><dd>{bill.serviceOrderOrigin ? enumLabel(bill.serviceOrderOrigin) : 'Contas a receber'}</dd></div><div><dt>Categoria</dt><dd>{enumLabel(bill.serviceOrderCategory)}</dd></div><div><dt>Tempo cobrado</dt><dd>{bill.billableHours || '00:00'}</dd></div><div className="drawer-section__wide"><dt>Descrição</dt><dd>{bill.serviceOrderDescription || 'Boleto agrupado a partir das contas a receber selecionadas.'}</dd></div></dl></section>
    </div>
    <section className="drawer-section bill-composition"><h3>Composição da cobrança</h3><div className="bill-composition__grid"><Value label="Serviços e minutos extras" value={bill.serviceAmount} /><Value label="Materiais" value={bill.materialAmount} /><Value label="Taxa do boleto" value={bill.billFeeAmount} /><Value label="Transporte" value={bill.transportAmount} /><Value label="Aluguel" value={bill.rentalAmount} /><Value label="Outros" value={bill.otherAmount} /><Value label="Desconto" value={-bill.discountAmount} /><Value label="Total" value={bill.amount} total /></div></section>
    <DetailTable title="Serviços cobrados" empty="Nenhum serviço vinculado." headers={['Código', 'Descrição', 'Qtd.', 'Tempo', 'Valor mínimo', 'Minuto', 'Extra', 'Avulso', 'Total']} rows={bill.services.map((item) => [item.serviceId, item.description || 'Não informado', item.quantity || 0, item.hours || '00:00', money(item.minimumAmount), money(item.minuteAmount), money(item.extraMinuteAmount), money(item.oneOffMinuteAmount), money(item.totalAmount)])} />
    <DetailTable title="Materiais utilizados" empty="Nenhum material cobrado." headers={['Código', 'Material', 'Unidade', 'Marca', 'Qtd.', 'Unitário', 'Total']} rows={bill.materials.map((item) => [item.materialId, item.description || 'Não informado', item.unit || '—', item.brand || '—', item.quantity || 0, money(item.unitAmount), money(item.totalAmount)])} />
    {bill.serviceOrderNotes && <section className="drawer-section"><h3>Observações</h3><p>{bill.serviceOrderNotes}</p></section>}
    <div className="bill-detail__dates"><span><CalendarDays size={15} /> Processado em {formatDate(bill.processedAt, true)}</span><span><FileText size={15} /> Vencimento em {formatDate(bill.dueAt)}</span><span><Upload size={15} /> Boleto bancário: {bill.bankDocumentAvailable ? `${bill.bankDocumentName || 'PDF anexado'} em ${formatDate(bill.bankDocumentUploadedAt, true)}` : 'não anexado; envio automático suspenso'}</span><span><Mail size={15} /> E-mail: {bill.emailSentAt ? `enviado em ${formatDate(bill.emailSentAt, true)}` : 'ainda não enviado'}</span></div>
  </div>
}

export function ClientStatementDetails({ statement }: { statement: ClientStatementDetail }) {
  const locations = statement.attendanceLocations ?? []
  const services = statement.orders.flatMap((order) => order.services.map((item) => [
    `${order.serviceOrderId || '—'}`, item.description || `Serviço #${item.serviceId}`, item.quantity || 0,
    item.hours || '00:00', money(item.totalAmount),
  ]))
  return <div className="detail-modal-content client-statement-detail">
    <section className="statement-location-section">
      <div className="statement-location-section__heading"><div><span>Rateio por local de atendimento</span><strong>{locations.length} {locations.length === 1 ? 'local rastreado' : 'locais rastreados'}</strong></div><Badge tone="blue">{formatMinutes(statement.usedMinutes)} utilizados</Badge></div>
      {locations.length === 0 ? <p className="muted">Nenhum local foi vinculado aos atendimentos deste período.</p> : <div className="statement-location-list">{locations.map((location, index) => {
        const address = [location.address, location.complement, location.district, location.city, location.zipCode].filter(Boolean).join(' - ')
        return <article className="statement-location-card" key={location.locationId ?? `legacy-${index}`}>
          <header><div><small>{location.locationId ? `Local #${location.locationId}` : 'Registro legado'}</small><h3>{location.description || 'Local sem descricao'}</h3></div><strong>{money(location.totalAmount)}</strong></header>
          <p>{address || 'Endereco nao informado'}</p>
          <div className="statement-location-card__metrics"><span><small>Tempo</small><strong>{formatMinutes(location.usedMinutes)}</strong></span><span><small>Rateio</small><strong>{Number(location.allocationPercentage || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</strong></span><span><small>OS</small><strong>{location.serviceOrderCount}</strong></span><span><small>Servicos</small><strong>{money(location.serviceAmount)}</strong></span></div>
          <footer><span>{location.contactName || 'Contato nao informado'}{location.contactPhone ? ` - ${location.contactPhone}` : ''}</span><span>{location.contractId ? `Contrato #${location.contractId}` : 'Sem contrato no local'}</span><span>{location.serviceOrderIds.map((id) => `${id}`).join(', ')}</span></footer>
          {location.referencePoint && <p className="statement-location-card__reference">Referencia: {location.referencePoint}</p>}
        </article>
      })}</div>}
    </section>
    <div className="detail-modal__hero-row"><div className="detail-drawer__hero"><span className="detail-avatar"><FileBarChart /></span><div><span>Extrato de {formatDate(statement.periodStart)} a {formatDate(statement.periodEnd)}</span><h2>{statement.clientTradeName || statement.clientName || `Cliente #${statement.clientId}`}</h2><p>{statement.clientDocument || 'CPF/CNPJ não informado'} · {statement.contractId ? `Contrato #${statement.contractId}` : 'Cliente avulso'}</p></div></div><Badge tone="blue">{statement.serviceOrderCount} atendimento(s)</Badge></div>
    <div className="client-statement-balance-grid"><Value label="Horas contratadas" valueText={formatMinutes(statement.contractedMinutes)} /><Value label="Horas utilizadas" valueText={formatMinutes(statement.usedMinutes)} /><Value label="Saldo disponível" valueText={formatMinutes(statement.availableMinutes)} /><Value label="Horas excedentes" valueText={formatMinutes(statement.extraMinutes)} /></div>
    <div className="detail-sections-grid">
      <section className="drawer-section"><h3>Cliente</h3><dl><div><dt>Código</dt><dd>{statement.clientId}</dd></div><div><dt>Razão social</dt><dd>{statement.clientName || 'Não informada'}</dd></div><div><dt>Nome fantasia</dt><dd>{statement.clientTradeName || 'Não informado'}</dd></div><div><dt>CPF / CNPJ</dt><dd>{statement.clientDocument || 'Não informado'}</dd></div><div><dt>Telefone</dt><dd>{statement.clientPhone || 'Não informado'}</dd></div><div><dt>E-mail</dt><dd>{statement.clientEmail || 'Não informado'}</dd></div><div className="drawer-section__wide"><dt>Endereço</dt><dd>{statement.clientAddress || 'Não informado'}</dd></div></dl></section>
      <section className="drawer-section bill-composition"><h3>Resumo financeiro</h3><div className="bill-composition__grid"><Value label="Serviços" value={statement.serviceAmount} /><Value label="Taxas e adicionais" value={statement.additionalAmount} /><Value label="Descontos" value={-statement.discountAmount} /><Value label="Total no período (sem materiais)" value={statement.totalAmount} total /></div></section>
    </div>
    <DetailTable title="Ordens de serviço do período" empty="Nenhuma ordem de serviço encontrada." headers={['OS', 'Data', 'Descrição', 'Tempo', 'Serviços', 'Total sem materiais']} rows={statement.orders.map((order) => [`${order.serviceOrderId || '—'}`, formatDate(order.serviceOrderDate), order.serviceOrderDescription || 'Não informada', order.actualHours || '00:00', money(order.serviceAmount), money(Number(order.amount || 0) - Number(order.materialAmount || 0))])} />
    <DetailTable title="Serviços realizados" empty="Nenhum serviço registrado." headers={['OS', 'Serviço', 'Qtd.', 'Tempo', 'Total']} rows={services} />
  </div>
}

export function Value({ label, value = 0, valueText, total = false }: { label: string; value?: number; valueText?: string; total?: boolean }) {
  return <span className={total ? 'bill-composition__total' : ''}><small>{label}</small><strong>{valueText ?? money(value)}</strong></span>
}

export function DetailTable({ title, empty, headers, rows }: { title: string; empty: string; headers: string[]; rows: Array<Array<string | number>> }) {
  return <section className="drawer-section bill-detail-table"><h3>{title}</h3>{rows.length === 0 ? <p>{empty}</p> : <div className="table-wrap"><table className="data-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${title}-${index}`}>{row.map((value, cell) => <td key={`${index}-${cell}`}>{value}</td>)}</tr>)}</tbody></table></div>}</section>
}

export function formatMinutes(minutes: number) {
  const safe = Math.max(0, Math.round(Number(minutes || 0)))
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}
