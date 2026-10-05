import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Download, ExternalLink, Printer, Timer } from 'lucide-react'
import { apiErrorMessage } from '../api/client'
import { api } from '../api/services'
import { formatDate } from '../lib/format'
import type { ClientBillingContext } from '../types'
import { Badge, Button, FormError, Modal } from './ui'

interface ClientHourTrackingProps {
  clientId: number | null
  clientName: string
  context?: ClientBillingContext
}

export function ClientHourTracking({ clientId, clientName, context }: ClientHourTrackingProps) {
  const balances = context?.monthlyBalances || []
  const trackings = context?.trackings || []
  const competenceOptions = useMemo(() => Array.from(new Set(balances.map((item) => competenceValue(item.year, item.month)))).sort().reverse(), [balances])
  const [competence, setCompetence] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [pdfPreview, setPdfPreview] = useState<string | null>(null)
  const [pdfError, setPdfError] = useState('')
  const pdfFrameRef = useRef<HTMLIFrameElement>(null)
  const [selectedYear, selectedMonth] = competence.split('-').map(Number)
  const filteredBalances = competence ? balances.filter((item) => item.year === selectedYear && item.month === selectedMonth) : balances
  const activeKey = selectedKey && filteredBalances.some((item) => balanceKey(item.year, item.month, item.contractId) === selectedKey)
    ? selectedKey
    : filteredBalances[0] ? balanceKey(filteredBalances[0].year, filteredBalances[0].month, filteredBalances[0].contractId) : null
  const monthTrackings = useMemo(() => !competence ? trackings : Number.isInteger(selectedYear) && Number.isInteger(selectedMonth) ? trackings.filter((item) => {
    const date = item.startedAt || item.endedAt
    if (!date) return false
    const parsed = new Date(date)
    return parsed.getFullYear() === selectedYear && parsed.getMonth() + 1 === selectedMonth
  }) : [], [competence, selectedMonth, selectedYear, trackings])
  const hasConsolidatedUsageWithoutDetails = monthTrackings.length === 0 && filteredBalances.some((item) => item.usedMinutes > 0)

  const pdfMutation = useMutation({
    mutationFn: () => api.bills.clientHourTrackingPdf(clientId!, competence),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      setPdfPreview((current) => {
        if (current) URL.revokeObjectURL(current)
        return url
      })
    },
    onError: (error) => setPdfError(apiErrorMessage(error, 'Não foi possível gerar o PDF do acompanhamento de horas.')),
  })

  useEffect(() => {
    setCompetence('')
    setSelectedKey(null)
  }, [clientId])

  useEffect(() => () => {
    if (pdfPreview) URL.revokeObjectURL(pdfPreview)
  }, [pdfPreview])

  function generatePdf() {
    if (!clientId || (competence && !/^\d{4}-\d{2}$/.test(competence))) return
    setPdfError('')
    pdfMutation.mutate()
  }

  function closePdf() {
    setPdfPreview(null)
  }

  function downloadPdf() {
    if (!pdfPreview) return
    const link = document.createElement('a')
    link.href = pdfPreview
    link.download = `acompanhamento-horas-${clientId}-${competence || 'todas-as-competencias'}.pdf`
    link.click()
  }

  return <><div className="detail-modal-content bill-related-detail">
    <div className="detail-modal__hero-row"><div className="detail-drawer__hero"><span className="detail-avatar"><Timer /></span><div><span>Cliente #{clientId || '—'}</span><h2>{clientName}</h2><p>Controle mensal de horas contratadas, utilizadas e disponíveis</p></div></div><Badge tone="blue">{competenceOptions.length} competência(s)</Badge></div>

    <div className="hour-tracking-toolbar">
      <label><span>Competência</span><input type="month" value={competence} onChange={(event) => { setCompetence(event.target.value); setSelectedKey(null) }} /><small>Deixe em branco para exibir todo o histórico.</small></label>
      <Button type="button" icon={<Printer size={16} />} disabled={!clientId || pdfMutation.isPending} onClick={generatePdf}>{pdfMutation.isPending ? 'Gerando PDF...' : 'Imprimir'}</Button>
    </div>
    <FormError message={pdfError} />

    <section className="drawer-section bill-detail-table">
      <h3>Acompanhamento mensal</h3>
      {filteredBalances.length === 0 ? <p>Nenhuma competência de horas foi encontrada para o período selecionado.</p> : <div className="table-wrap"><table className="data-table hour-balance-table"><thead><tr><th>Competência</th><th>Ano</th><th>Cliente</th><th>Contrato</th><th>Unidade</th><th>Contratada</th><th>Utilizada</th><th>Saldo</th><th>Situação</th></tr></thead><tbody>{filteredBalances.map((item) => {
        const key = balanceKey(item.year, item.month, item.contractId)
        return <tr key={key} className={key === activeKey ? 'receivable-row--selected' : ''} onClick={() => setSelectedKey(key)}>
          <td><strong>{monthLabel(item.month)}</strong></td><td>{item.year}</td><td><strong>{clientName}</strong><small className="table-secondary">Código {clientId || '—'}</small></td><td>{item.contractId ? `#${item.contractId}` : '—'}</td><td>{item.unit || 'HORAS'}</td><td className="hour-balance-value">{item.contracted || '00:00'}</td><td className="hour-balance-value"><strong>{item.used || '00:00'}</strong></td><td className={`hour-balance-value ${item.balanceMinutes < 0 ? 'hour-balance-value--negative' : ''}`}><strong>{item.balance || '00:00'}</strong></td><td>{item.balanceMinutes < 0 ? <Badge tone="red">Saldo negativo</Badge> : item.balanceMinutes === 0 ? <Badge tone="orange">Saldo esgotado</Badge> : <Badge tone="green">Saldo disponível</Badge>}</td>
        </tr>
      })}</tbody></table></div>}
    </section>

    <section className="drawer-section bill-detail-table"><h3>{competence ? `Apontamentos de ${monthLabel(selectedMonth)}/${selectedYear}` : 'Todos os apontamentos'}</h3>{monthTrackings.length === 0 ? <p>{hasConsolidatedUsageWithoutDetails ? 'Existem horas utilizadas no consolidado mensal, mas não há apontamentos individuais registrados para este período.' : competence ? 'Nenhum apontamento detalhado foi encontrado nessa competência.' : 'Nenhum apontamento detalhado foi encontrado para este cliente.'}</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Registro</th><th>OS</th><th>Serviço</th><th>Profissional</th><th>Início</th><th>Fim</th><th>Duração</th><th>Descrição</th></tr></thead><tbody>{monthTrackings.map((item) => <tr key={item.id}><td>{item.id}</td><td>{item.serviceOrderId || '—'}</td><td>{item.serviceDescription || (item.serviceId ? `Serviço #${item.serviceId}` : '—')}</td><td>{item.employeeName || 'Não informado'}</td><td>{trackingDateTime(item.startedAt, item.startTime)}</td><td>{trackingDateTime(item.endedAt, item.endTime)}</td><td>{item.duration || '00:00'}</td><td>{item.running ? 'Em andamento' : item.serviceDescription || 'Concluído'}</td></tr>)}</tbody></table></div>}</section>
  </div>

  <Modal open={pdfPreview !== null} onClose={closePdf} title="Acompanhamento de horas" description={`${clientName} · ${competence ? competenceLabel(competence) : 'Todas as competências'}`} size="xlarge">
    <div className="modal__body contract-document-modal__body">
      {pdfPreview && <iframe ref={pdfFrameRef} className="contract-document-frame" src={pdfPreview} title={`Acompanhamento de horas de ${clientName}`} />}
    </div>
    <footer className="modal__footer detail-modal__footer">
      <Button type="button" variant="secondary" icon={<ExternalLink size={16} />} onClick={() => pdfPreview && window.open(pdfPreview, '_blank', 'noopener,noreferrer')}>Abrir em nova aba</Button>
      <Button type="button" variant="secondary" icon={<Download size={16} />} onClick={downloadPdf}>Baixar PDF</Button>
      <Button type="button" icon={<Printer size={16} />} onClick={() => pdfFrameRef.current?.contentWindow?.print()}>Imprimir</Button>
    </footer>
  </Modal></>
}

function balanceKey(year: number, month: number, contractId: number | null) {
  return `${year}-${month}-${contractId || 0}`
}

function competenceValue(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function competenceLabel(value: string) {
  const [year, month] = value.split('-').map(Number)
  return Number.isInteger(year) && Number.isInteger(month) ? `${monthLabel(month)}/${year}` : 'Competência não informada'
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
