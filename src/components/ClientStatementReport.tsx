import { useQuery } from '@tanstack/react-query'
import { api } from '../api/services'
import { enumLabel, formatDate } from '../lib/format'
import type { BillDetail, ClientStatementDetail, ClientStatementLocation } from '../types'
import { formatMinutes } from './BillingDetails'
import { TaxRetentionNotice } from './TaxRetention'

const num = (value: number) => Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const sum = <T,>(items: T[], value: (item: T) => number) => items.reduce((total, item) => total + Number(value(item) || 0), 0)

/** Valores de uma OS separados como no relatório de boletos: mão de obra, material, diversos e desconto. */
function orderValues(order: BillDetail) {
  const labor = sum(order.services, (item) => item.totalAmount)
  const material = sum(order.materials, (item) => item.totalAmount)
  const misc = Number(order.billFeeAmount || 0) + Number(order.transportAmount || 0) + Number(order.rentalAmount || 0) + Number(order.otherAmount || 0)
  const discount = Math.abs(Number(order.discountAmount || 0))
  return { labor, material, misc, discount, total: labor + material + misc - discount }
}

const categoryLabels: Record<string, string> = { MAO_DE_OBRA: 'Mão de obra', GARANTIA: 'Garantia', VISITA_TECNICA: 'Visita técnica', CANCELAMENTO: 'Cancelamento', DESLOCAMENTO: 'Deslocamento', ORCAMENTO: 'Orçamento', TRANSPORTE: 'Transporte', SERVICO_TERCEIRIZADO: 'Serviço terceirizado' }
const orderType = (order: BillDetail) => `${enumLabel(order.serviceOrderOrigin)} · ${categoryLabels[order.serviceOrderCategory ?? ''] ?? enumLabel(order.serviceOrderCategory)}`

/** Endereço completo do local: endereço, complemento, bairro, cidade, CEP e ponto de referência. */
function locationAddress(location: ClientStatementLocation) {
  const address = [location.address, location.complement, location.district, location.city, location.zipCode ? `CEP ${location.zipCode}` : null].filter(Boolean).join(', ')
  return location.referencePoint ? [address, `Ref.: ${location.referencePoint}`].filter(Boolean).join(' · ') : address
}

function minutesOf(value?: string | null) {
  const match = /^(\d+):(\d{2})$/.exec(value?.trim() ?? '')
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0
}

function longDate(date: Date) {
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Extrato do cliente em formato de relatório (para conferência): dados do cliente, uso de horas, rateio por local,
 * resumo de valores, lista das ordens de serviço e o detalhamento de cada uma (atendimentos, serviços e materiais).
 */
export function ClientStatementReport({ statement }: { statement: ClientStatementDetail }) {
  const companyQuery = useQuery({ queryKey: ['company-profile'], queryFn: () => api.companyProfile.find(), staleTime: 60 * 60 * 1000 })
  const company = companyQuery.data
  const locationOf = (order: BillDetail) => statement.attendanceLocations.find((location) => order.serviceOrderId != null && location.serviceOrderIds.includes(order.serviceOrderId))
  const orders = [...statement.orders].sort((a, b) => String(a.serviceOrderDate ?? '').localeCompare(String(b.serviceOrderDate ?? '')) || Number(a.serviceOrderId) - Number(b.serviceOrderId))
  const values = orders.map(orderValues)
  const totals = {
    labor: sum(values, (item) => item.labor),
    material: sum(values, (item) => item.material),
    misc: sum(values, (item) => item.misc),
    discount: sum(values, (item) => item.discount),
    total: sum(values, (item) => item.total),
  }
  const misc = {
    billFee: sum(orders, (order) => order.billFeeAmount),
    transport: sum(orders, (order) => order.transportAmount),
    rental: sum(orders, (order) => order.rentalAmount),
    other: sum(orders, (order) => order.otherAmount),
  }
  const hasDiscount = totals.discount > 0
  const miscParts = ([['taxa de boleto', misc.billFee], ['transporte', misc.transport], ['aluguel', misc.rental], ['outros', misc.other]] as Array<[string, number]>)
    .filter(([, amount]) => amount !== 0).map(([label, amount]) => `${label} ${num(amount)}`)
  const clientName = statement.clientTradeName || statement.clientName || `Cliente #${statement.clientId}`
  const usedIds = new Set<number>()
  const groups: Array<{ key: string; title: string; location: ClientStatementLocation | null; orders: Array<{ order: BillDetail; value: ReturnType<typeof orderValues> }>; minutes: number }> = [
    ...statement.attendanceLocations.map((location, index) => {
      const items = orders.map((order, orderIndex) => ({ order, value: values[orderIndex] })).filter(({ order }) => order.serviceOrderId != null && location.serviceOrderIds.includes(order.serviceOrderId))
      items.forEach(({ order }) => usedIds.add(order.id))
      return { key: `l-${location.locationId ?? `legado-${index}`}`, title: location.description || 'Sem descrição', location, orders: items, minutes: Number(location.usedMinutes || 0) }
    }),
  ]
  const unassigned = orders.map((order, orderIndex) => ({ order, value: values[orderIndex] })).filter(({ order }) => !usedIds.has(order.id))
  if (unassigned.length) groups.push({ key: 'sem-local', title: 'Sem local de atendimento', location: null, orders: unassigned, minutes: unassigned.reduce((total, { order }) => total + minutesOf(order.billableHours || order.actualHours), 0) })
  const locationGroups = groups.filter((group) => group.orders.length > 0).map((group) => ({
    ...group,
    labor: sum(group.orders, ({ value }) => value.labor),
    material: sum(group.orders, ({ value }) => value.material),
    misc: sum(group.orders, ({ value }) => value.misc),
    discount: sum(group.orders, ({ value }) => value.discount),
    total: sum(group.orders, ({ value }) => value.total),
  }))

  return <article className="statement-report">
    <header className="statement-report__header">
      <img src="/images/gente-boa-logo.png" alt={company?.tradeName || 'Gente Boa'} />
      <h2>Extrato do Cliente</h2>
      <div><p>{company?.city || 'Fortaleza'}, {longDate(new Date())}</p><p>Período: {formatDate(statement.periodStart)} a {formatDate(statement.periodEnd)}</p></div>
    </header>

    <section>
      <h3>Cliente</h3>
      <table className="statement-report__table statement-report__fields"><tbody>
        <tr><th>Cliente</th><td>{statement.clientId} - {clientName}</td><th>CPF / CNPJ</th><td>{statement.clientDocument || 'Não informado'}</td></tr>
        <tr><th>Razão social</th><td>{statement.clientName || 'Não informada'}</td><th>Contrato</th><td>{statement.contractId ? `#${statement.contractId}` : 'Avulso (sem contrato)'}</td></tr>
        <tr><th>Telefone</th><td>{statement.clientPhone || 'Não informado'}</td><th>E-mail</th><td>{statement.clientEmail || 'Não informado'}</td></tr>
        <tr><th>Endereço</th><td colSpan={3}>{statement.clientAddress || 'Não informado'}</td></tr>
      </tbody></table>
      <TaxRetentionNotice retention={statement.taxRetention} className="statement-report__retention" />
    </section>

    <section>
      <h3>Utilização de horas</h3>
      <table className="statement-report__table"><thead><tr><th>Horas contratadas</th><th>Horas utilizadas</th><th>Saldo do período</th><th>Horas excedentes</th><th>Ordens de serviço</th><th>Locais de atendimento</th></tr></thead>
        <tbody><tr>
          <td>{statement.contractId ? formatMinutes(statement.contractedMinutes) : '—'}</td>
          <td>{formatMinutes(statement.usedMinutes)}</td>
          <td>{statement.contractId ? formatMinutes(statement.availableMinutes) : '—'}</td>
          <td className={statement.extraMinutes > 0 ? 'statement-report__alert' : ''}>{statement.contractId ? formatMinutes(statement.extraMinutes) : '—'}</td>
          <td>{orders.length}</td>
          <td>{statement.attendanceLocations.length} cadastrado(s) · {statement.attendanceLocations.filter((location) => location.serviceOrderCount > 0).length} com OS</td>
        </tr></tbody>
      </table>
    </section>

    {statement.attendanceLocations.length > 0 && <section>
      <h3>Locais de atendimento</h3>
      <table className="statement-report__table"><thead><tr><th>Código</th><th>Descrição</th><th>Endereço</th><th>Contato</th><th className="num">OS</th><th className="num">Tempo</th></tr></thead>
        <tbody>{statement.attendanceLocations.map((location, index) => <tr key={location.locationId ?? `legado-${index}`}>
          <td>{location.locationId ?? '—'}</td>
          <td><strong>{location.description || 'Sem descrição'}</strong></td>
          <td>{locationAddress(location) || 'Não informado'}</td>
          <td>{[location.contactName, location.contactPhone].filter(Boolean).join(' · ') || '—'}</td>
          <td className="num">{location.serviceOrderCount}</td>
          <td className="num">{formatMinutes(location.usedMinutes)}</td>
        </tr>)}</tbody>
      </table>
    </section>}

    <section>
      <h3>Resumo de valores</h3>
      <table className="statement-report__table statement-report__summary"><tbody>
        <tr><th>Mão de obra (serviços)</th><td className="num">{num(totals.labor)}</td></tr>
        <tr><th>Materiais</th><td className="num">{num(totals.material)}</td></tr>
        {totals.misc !== 0 && <tr><th>Outras despesas{miscParts.length > 0 && <small> ({miscParts.join(' · ')})</small>}</th><td className="num">{num(totals.misc)}</td></tr>}
        {hasDiscount && <tr><th>Descontos</th><td className="num">-{num(totals.discount)}</td></tr>}
        <tr className="statement-report__total"><th>Total do período</th><td className="num">R$ {num(totals.total)}</td></tr>
      </tbody></table>
    </section>

    <section>
      <h3>Ordens de serviço</h3>
      {orders.length === 0 ? <p className="statement-report__empty">Nenhuma ordem de serviço no período.</p> : <table className="statement-report__table"><thead><tr><th>OS</th><th>Data</th><th>Local</th><th>Tipo</th><th className="num">Horas</th><th className="num">Vl. Mão de Obra</th><th className="num">Vl. Material</th><th className="num">Vl. Diversos</th>{hasDiscount && <th className="num">Desconto</th>}<th className="num">Vl. Total</th></tr></thead>
        <tbody>{orders.map((order, index) => <tr key={order.id}>
          <td>{order.serviceOrderId}</td><td>{formatDate(order.serviceOrderDate)}</td><td>{locationOf(order)?.description || '—'}</td>
          <td>{orderType(order)}</td>
          <td className="num">{order.billableHours || order.actualHours || '00:00'}</td>
          <td className="num">{num(values[index].labor)}</td><td className="num">{num(values[index].material)}</td><td className="num">{num(values[index].misc)}</td>
          {hasDiscount && <td className="num">{values[index].discount ? `-${num(values[index].discount)}` : '0,00'}</td>}
          <td className="num"><strong>{num(values[index].total)}</strong></td>
        </tr>)}</tbody>
        <tfoot><tr><th colSpan={4}>Totais</th><th className="num">{formatMinutes(statement.usedMinutes)}</th><th className="num">{num(totals.labor)}</th><th className="num">{num(totals.material)}</th><th className="num">{num(totals.misc)}</th>{hasDiscount && <th className="num">-{num(totals.discount)}</th>}<th className="num">{num(totals.total)}</th></tr></tfoot>
      </table>}
    </section>

    {orders.length > 0 && <section>
      <h3>Detalhamento por local de atendimento</h3>
      {locationGroups.map((group) => <div key={group.key} className="statement-report__location">
        <p className="statement-report__location-title"><span>Local de atendimento: <strong>{group.title}</strong></span>{group.location && <span>{[group.location.address, group.location.complement, group.location.district, group.location.city].filter(Boolean).join(', ')}{group.location.contactName ? ` · Contato: ${group.location.contactName}${group.location.contactPhone ? ` (${group.location.contactPhone})` : ''}` : ''}</span>}</p>
        {group.orders.map(({ order, value }) => <div key={order.id} className="statement-report__order">
          <table className="statement-report__order-head"><tbody>
            <tr><td><b>OS:</b> {order.serviceOrderId}</td><td><b>Data:</b> {formatDate(order.serviceOrderDate)}</td><td><b>Solicitante:</b> {order.serviceOrderRequester || 'Não informado'}</td><td><b>Categoria:</b> {orderType(order)}</td></tr>
            <tr><td colSpan={3}><b>Descrição:</b> {order.serviceOrderDescription || '—'}</td><td className="statement-report__order-time"><b>Tempo total:</b> {order.billableHours || order.actualHours || '00:00'}</td></tr>
            {order.serviceOrderNotes && <tr><td colSpan={4}><b>Observação:</b> {order.serviceOrderNotes}</td></tr>}
          </tbody></table>
          <table className="statement-report__table"><thead><tr><th>Dt. realizado</th><th>Funcionário</th><th className="num">Hr. inicial</th><th className="num">Hr. final</th><th className="num">Parcial</th></tr></thead>
            <tbody>{order.attendances.length === 0 ? <tr><td colSpan={5}>Nenhum atendimento registrado.</td></tr> : order.attendances.map((attendance) => <tr key={attendance.scheduleId}><td>{formatDate(attendance.date)}</td><td>{attendance.professional || 'Aguardando'}</td><td className="num">{attendance.start || '--:--'}</td><td className="num">{attendance.end || '--:--'}</td><td className="num">{attendance.duration || '00:00'}</td></tr>)}</tbody>
          </table>
          <table className="statement-report__table"><thead><tr><th className="num">Qtd.</th><th>Item</th><th className="num">Tempo</th><th className="num">Vl. Unitário</th><th className="num">Vl. Total</th></tr></thead>
            <tbody>
              {order.services.map((service, serviceIndex) => <tr key={`s-${service.serviceId}-${serviceIndex}`}><td className="num">{Number(service.quantity || 1)}</td><td>Serviço: {service.description || `#${service.serviceId}`}</td><td className="num">{service.hours || '—'}</td><td className="num">{num(Number(service.totalAmount || 0) / Number(service.quantity || 1))}</td><td className="num">{num(service.totalAmount)}</td></tr>)}
              {order.materials.map((material, materialIndex) => <tr key={`m-${material.materialId}-${materialIndex}`}><td className="num">{Number(material.quantity || 0).toLocaleString('pt-BR')} {material.unit || ''}</td><td>Material: {material.description || `#${material.materialId}`}{material.brand ? ` (${material.brand})` : ''}</td><td className="num">—</td><td className="num">{num(material.unitAmount)}</td><td className="num">{num(material.totalAmount)}</td></tr>)}
              {([['Taxa de boleto', order.billFeeAmount], ['Transporte', order.transportAmount], ['Aluguel de equipamento', order.rentalAmount], ['Outros valores', order.otherAmount]] as Array<[string, number]>).filter(([, amount]) => Number(amount || 0) !== 0).map(([label, amount]) => <tr key={label}><td className="num">1</td><td>Despesa: {label}</td><td className="num">—</td><td className="num">{num(amount)}</td><td className="num">{num(amount)}</td></tr>)}
              {value.discount > 0 && <tr><td className="num">—</td><td>Desconto</td><td className="num">—</td><td className="num">—</td><td className="num">-{num(value.discount)}</td></tr>}
              {order.services.length + order.materials.length === 0 && <tr><td colSpan={5}>Sem serviços ou materiais lançados.</td></tr>}
            </tbody>
            <tfoot><tr><th colSpan={4}>Total da OS {order.serviceOrderId}</th><th className="num">{num(value.total)}</th></tr></tfoot>
          </table>
        </div>)}
      </div>)}
    </section>}

    {locationGroups.length > 0 && <section>
      <h3>Rateio por local de atendimento</h3>
      <table className="statement-report__table"><thead><tr><th>Local de atendimento</th><th className="num">Qtd.</th><th className="num">Tempo</th><th className="num">% Rat.</th><th className="num">Vr. Horas</th><th className="num">Vr. Material</th><th className="num">Vr. Diversos</th><th className="num">Vl. Total</th></tr></thead>
        <tbody>{locationGroups.map((group) => <tr key={group.key}>
          <td>{group.title}</td><td className="num">{group.orders.length}</td><td className="num">{formatMinutes(group.minutes)}</td>
          <td className="num">{statement.usedMinutes > 0 ? (group.minutes / statement.usedMinutes * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0,0'}</td>
          <td className="num">{num(group.labor)}</td><td className="num">{num(group.material)}</td><td className="num">{num(group.misc - group.discount)}</td><td className="num"><strong>{num(group.total)}</strong></td>
        </tr>)}</tbody>
        <tfoot><tr><th>Totais</th><th className="num">{orders.length}</th><th className="num">{formatMinutes(statement.usedMinutes)}</th><th className="num">100,0</th><th className="num">{num(totals.labor)}</th><th className="num">{num(totals.material)}</th><th className="num">{num(totals.misc - totals.discount)}</th><th className="num">{num(totals.total)}</th></tr></tfoot>
      </table>
    </section>}

    <p className="statement-report__footer">Extrato para conferência do cliente · não é documento fiscal · OS canceladas não são consideradas.</p>
  </article>
}
