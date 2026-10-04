import { useMemo, useState } from 'react'
import { Timer } from 'lucide-react'
import { formatDate } from '../lib/format'
import type { ClientBillingContext } from '../types'
import { Badge } from './ui'

interface ClientHourTrackingProps {
  clientId: number | null
  clientName: string
  context?: ClientBillingContext
}

export function ClientHourTracking({ clientId, clientName, context }: ClientHourTrackingProps) {
  const balances = context?.monthlyBalances || []
  const trackings = context?.trackings || []
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const activeKey = selectedKey && balances.some((item) => balanceKey(item.year, item.month, item.contractId) === selectedKey)
    ? selectedKey
    : balances[0] ? balanceKey(balances[0].year, balances[0].month, balances[0].contractId) : null
  const selected = balances.find((item) => balanceKey(item.year, item.month, item.contractId) === activeKey)
  const monthTrackings = useMemo(() => selected ? trackings.filter((item) => {
    const date = item.startedAt || item.endedAt
    if (!date) return false
    const parsed = new Date(date)
    return parsed.getFullYear() === selected.year && parsed.getMonth() + 1 === selected.month
  }) : [], [selected, trackings])

  return <div className="detail-modal-content bill-related-detail">
    <div className="detail-modal__hero-row"><div className="detail-drawer__hero"><span className="detail-avatar"><Timer /></span><div><span>Cliente #{clientId || '—'}</span><h2>{clientName}</h2><p>Controle mensal de horas contratadas, utilizadas e disponíveis</p></div></div><Badge tone="blue">{balances.length} competência(s)</Badge></div>

    <section className="drawer-section bill-detail-table">
      <h3>Acompanhamento mensal</h3>
      {balances.length === 0 ? <p>Nenhuma competência de horas foi encontrada para este cliente.</p> : <div className="table-wrap"><table className="data-table hour-balance-table"><thead><tr><th>Competência</th><th>Ano</th><th>Cliente</th><th>Contrato</th><th>Unidade</th><th>Contratada</th><th>Utilizada</th><th>Saldo</th><th>Situação</th></tr></thead><tbody>{balances.map((item) => {
        const key = balanceKey(item.year, item.month, item.contractId)
        return <tr key={key} className={key === activeKey ? 'receivable-row--selected' : ''} onClick={() => setSelectedKey(key)}>
          <td><strong>{monthLabel(item.month)}</strong></td><td>{item.year}</td><td><strong>{clientName}</strong><small className="table-secondary">Código {clientId || '—'}</small></td><td>{item.contractId ? `#${item.contractId}` : '—'}</td><td>{item.unit || 'HORAS'}</td><td className="hour-balance-value">{item.contracted || '00:00'}</td><td className="hour-balance-value"><strong>{item.used || '00:00'}</strong></td><td className={`hour-balance-value ${item.balanceMinutes < 0 ? 'hour-balance-value--negative' : ''}`}><strong>{item.balance || '00:00'}</strong></td><td>{item.balanceMinutes < 0 ? <Badge tone="red">Saldo negativo</Badge> : item.balanceMinutes === 0 ? <Badge tone="orange">Saldo esgotado</Badge> : <Badge tone="green">Saldo disponível</Badge>}</td>
        </tr>
      })}</tbody></table></div>}
    </section>

    {selected && <section className="drawer-section bill-detail-table"><h3>Apontamentos de {monthLabel(selected.month)}/{selected.year}</h3>{monthTrackings.length === 0 ? <p>Nenhum apontamento detalhado foi encontrado nessa competência.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Registro</th><th>OS</th><th>Serviço</th><th>Profissional</th><th>Início</th><th>Fim</th><th>Duração</th><th>Descrição</th></tr></thead><tbody>{monthTrackings.map((item) => <tr key={item.id}><td>{item.id}</td><td>{item.serviceOrderId || '—'}</td><td>{item.serviceDescription || (item.serviceId ? `Serviço #${item.serviceId}` : '—')}</td><td>{item.employeeName || 'Não informado'}</td><td>{trackingDateTime(item.startedAt, item.startTime)}</td><td>{trackingDateTime(item.endedAt, item.endTime)}</td><td>{item.duration || '00:00'}</td><td>{item.running ? 'Em andamento' : item.serviceDescription || 'Concluído'}</td></tr>)}</tbody></table></div>}</section>}
  </div>
}

function balanceKey(year: number, month: number, contractId: number | null) {
  return `${year}-${month}-${contractId || 0}`
}

function monthLabel(month: number) {
  const date = new Date(2000, Math.max(0, month - 1), 1)
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(date)
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`
}

function trackingDateTime(date: string | null, time: string | null) {
  if (!date && !time) return '—'
  return `${date ? formatDate(date) : ''}${date && time ? ' · ' : ''}${time || ''}`
}
