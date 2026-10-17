import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Download, ExternalLink, FileBarChart, Printer, UserRoundSearch } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { monthBounds } from '../lib/export'
import { formatDate } from '../lib/format'
import { ClientPicker, type PickerValue } from './AsyncPicker'
import { ClientStatementReport } from './ClientStatementReport'
import { Button, EmptyState, ErrorState, LoadingState, Modal } from './ui'

/**
 * Extrato do cliente ("conta de bar"): tudo o que o cliente utilizou no período — OS finalizadas e em andamento,
 * horas, serviços, materiais e valores — independente de boleto gerado. O cliente é obrigatório.
 */
export function ClientStatementTab({ showToast }: { showToast: (message: string) => void }) {
  // Período padrão: do 1º dia do mês atual ao último dia do mês seguinte (ex.: 01/10 a 30/11).
  const initial = useMemo(() => {
    const today = new Date()
    return { start: monthBounds(today).start, end: monthBounds(new Date(today.getFullYear(), today.getMonth() + 1, 1)).end }
  }, [])
  const [client, setClient] = useState<PickerValue>(null)
  const [startDate, setStartDate] = useState(initial.start)
  const [endDate, setEndDate] = useState(initial.end)
  const [pdf, setPdf] = useState<{ url: string; name: string } | null>(null)
  const validPeriod = Boolean(startDate && endDate && startDate <= endDate)

  const statementQuery = useQuery({
    queryKey: [...queryKeys.clientStatements, 'tab', client?.id ?? null, startDate, endDate],
    queryFn: () => api.clientStatements.find(client!.id, startDate, endDate),
    enabled: client !== null && validPeriod,
  })
  const pdfMutation = useMutation({
    mutationFn: () => api.clientStatements.pdf(client!.id, startDate, endDate),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      setPdf((current) => {
        if (current) URL.revokeObjectURL(current.url)
        return { url, name: `extrato-${client?.id}-${startDate}-a-${endDate}.pdf` }
      })
    },
    onError: (error) => showToast(apiErrorMessage(error, 'Não foi possível gerar o PDF do extrato.')),
  })
  useEffect(() => () => { if (pdf) URL.revokeObjectURL(pdf.url) }, [pdf])

  function download() {
    if (!pdf) return
    const link = document.createElement('a')
    link.href = pdf.url
    link.download = pdf.name
    link.click()
  }

  function print() {
    const frame = document.getElementById('client-statement-tab-pdf') as HTMLIFrameElement | null
    frame?.contentWindow?.print()
  }

  return <section className="panel data-panel client-statement-tab">
    <div className="report-filters">
      <label className="report-filters__wide"><span>Cliente *</span><ClientPicker value={client} required onChange={setClient} /></label>
      <label><span>De</span><input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} /></label>
      <label><span>Até</span><input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} /></label>
      <div className="report-filters__actions">
        <Button type="button" icon={<FileBarChart size={16} />} disabled={!client || !validPeriod || pdfMutation.isPending} onClick={() => pdfMutation.mutate()}>{pdfMutation.isPending ? 'Gerando PDF...' : 'Baixar PDF'}</Button>
      </div>
    </div>

    <div className="client-statement-tab__body">
      {!client ? <EmptyState title="Informe o cliente" description="O extrato mostra tudo o que o cliente utilizou no período, com ou sem boleto gerado. Selecione o cliente pelo nome, código ou documento." />
        : !validPeriod ? <EmptyState title="Período inválido" description="A data inicial deve ser anterior ou igual à data final." />
          : statementQuery.isLoading ? <LoadingState label="Consolidando o extrato do cliente..." />
            : statementQuery.isError ? <ErrorState message={apiErrorMessage(statementQuery.error)} onRetry={() => statementQuery.refetch()} />
              : statementQuery.data ? <>
                <p className="client-statement-tab__note"><UserRoundSearch size={15} /> Ordens de serviço de {formatDate(startDate)} a {formatDate(endDate)}, finalizadas e em andamento (canceladas não entram). Atendimentos com o cronômetro ligado entram com o tempo até agora.</p>
                <ClientStatementReport statement={statementQuery.data} />
              </> : null}
    </div>

    <Modal open={pdf !== null} onClose={() => setPdf(null)} title="Extrato do cliente" description={client ? `${client.label} · ${formatDate(startDate)} a ${formatDate(endDate)}` : undefined} size="xlarge">
      <div className="modal__body contract-document-modal__body">
        {pdf && <iframe id="client-statement-tab-pdf" className="contract-document-frame" src={pdf.url} title="Visualização do extrato em PDF" />}
      </div>
      <footer className="modal__footer detail-modal__footer">
        <Button variant="secondary" icon={<ExternalLink size={16} />} onClick={() => pdf && window.open(pdf.url, '_blank', 'noopener,noreferrer')}>Abrir em nova aba</Button>
        <Button variant="secondary" icon={<Printer size={16} />} onClick={print}>Imprimir</Button>
        <Button icon={<Download size={16} />} onClick={download}>Baixar PDF</Button>
      </footer>
    </Modal>
  </section>
}
