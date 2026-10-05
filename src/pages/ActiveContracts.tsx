import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, CircleDollarSign, Clock3, FileSignature, FileSpreadsheet, History, Percent, Printer, Search } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { modulesApi, modulesKeys, type ReadjustmentPayload, type ReadjustmentPreview } from '../api/modules'
import { queryKeys } from '../api/services'
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, FormError, LoadingState, PageHeader, StatCard, Toast } from '../components/ui'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { dateText, downloadCsv, moneyText, printElement } from '../lib/export'
import { money } from '../lib/format'

type Tab = 'relation' | 'readjust' | 'history'

/** Relação de contratos ativos e reajuste anual (POP p.29, "super importante"). */
export function ActiveContracts() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('relation')
  const [search, setSearch] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [percentage, setPercentage] = useState('')
  const [adjustUnit, setAdjustUnit] = useState(true)
  const [adjustExtra, setAdjustExtra] = useState(true)
  const [adjustMinute, setAdjustMinute] = useState(true)
  const [renewTerm, setRenewTerm] = useState(true)
  const [excluded, setExcluded] = useState<Record<number, boolean>>({})
  const [overrides, setOverrides] = useState<Record<number, string>>({})
  const [preview, setPreview] = useState<ReadjustmentPreview | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState('')
  const [historyYear, setHistoryYear] = useState('')
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)
  const printRef = useRef<HTMLDivElement>(null)
  const debouncedSearch = useDebouncedValue(search.trim())
  const relationQuery = useQuery({ queryKey: [...modulesKeys.readjustment, 'relation', debouncedSearch, dueDay], queryFn: () => modulesApi.readjustment.activeContracts({ query: debouncedSearch || undefined, dueDay: dueDay ? Number(dueDay) : undefined }) })
  const historyQuery = useQuery({ queryKey: [...modulesKeys.readjustment, 'history', historyYear], queryFn: () => modulesApi.readjustment.history({ year: historyYear ? Number(historyYear) : undefined }), enabled: tab === 'history' })
  const relation = relationQuery.data
  const contracts = relation?.contracts ?? []
  const selectedIds = contracts.filter((contract) => !excluded[contract.contractId]).map((contract) => contract.contractId)

  function showToast(message: string, variant: 'success' | 'error' = 'success') {
    setToast({ message, variant })
    window.setTimeout(() => setToast(null), variant === 'error' ? 6000 : 4000)
  }

  function payload(): ReadjustmentPayload | null {
    const value = Number(percentage.replace(',', '.'))
    if (!percentage || !Number.isFinite(value)) { setError('Informe o percentual de reajuste do ano.'); return null }
    if (selectedIds.length === 0) { setError('Selecione ao menos um contrato.'); return null }
    setError('')
    return {
      percentage: value, contractIds: selectedIds, adjustUnitValue: adjustUnit, adjustExtraValue: adjustExtra, adjustMinuteValue: adjustMinute, renewTerm,
      overrides: Object.entries(overrides).filter(([id, item]) => item.trim() !== '' && !excluded[Number(id)]).map(([id, item]) => ({ contractId: Number(id), percentage: Number(item.replace(',', '.')) })),
    }
  }

  const previewMutation = useMutation({
    mutationFn: (body: ReadjustmentPayload) => modulesApi.readjustment.preview(body),
    onSuccess: setPreview,
    onError: (failure) => setError(apiErrorMessage(failure)),
  })
  const applyMutation = useMutation({
    mutationFn: (body: ReadjustmentPayload) => modulesApi.readjustment.apply(body),
    onSuccess: async (result) => {
      setConfirmOpen(false)
      setPreview(null)
      setExcluded({})
      setOverrides({})
      await Promise.all([queryClient.invalidateQueries({ queryKey: modulesKeys.readjustment }), queryClient.invalidateQueries({ queryKey: queryKeys.contracts }), queryClient.invalidateQueries({ queryKey: queryKeys.accountsReceivable })])
      showToast(`Reajuste aplicado em ${result.contracts} contrato(s). Mensal: ${money(result.currentMonthly)} → ${money(result.newMonthly)}.`)
    },
    onError: (failure) => { setConfirmOpen(false); setError(apiErrorMessage(failure)) },
  })

  const previewChanged = useMemo(() => preview !== null, [preview])

  function exportRelation() {
    downloadCsv('contratos-ativos', ['Contrato', 'Início', 'Renovação', 'Venc.', 'Cliente (código)', 'Cliente', 'Serviço', 'Qtde horas', 'Bonif.', 'Valor', 'Valor hora', 'Extra', 'Extra/Min', 'Locais'],
      contracts.flatMap((contract) => contract.services.map((service) => [contract.contractId, dateText(contract.contractDate), dateText(contract.renewalDate), contract.dueDay, contract.clientId, contract.clientName, service.serviceName, service.quantity, service.bonusQuantity ?? 0, service.totalValue, service.unitValue, service.extraValue, service.minuteValue, contract.locations.map((location) => location.description).filter(Boolean).join(' / ')])))
  }

  return <>
    <PageHeader eyebrow="Relatórios" title="Contratos ativos e reajuste" subtitle="Relação de contratos ativos com horas, valor da hora e minuto excedente, reajuste anual em lote e histórico de renovações." actions={<><Button variant="secondary" icon={<FileSpreadsheet size={18} />} disabled={!contracts.length} onClick={exportRelation}>Excel</Button><Button icon={<Printer size={18} />} disabled={!contracts.length} onClick={() => printElement(printRef.current, 'Relação de Contratos Ativos')}>Imprimir relação</Button></>} />
    <section className="stats-grid stats-grid--three">
      <StatCard label="Contratos ativos" value={String(relation?.totalContracts ?? 0)} helper={dueDay ? `Vencimento dia ${dueDay}` : 'Todos os vencimentos'} icon={<FileSignature />} tone="blue" />
      <StatCard label="Horas contratadas" value={String(relation?.totalHours ?? 0)} helper="Soma mensal" icon={<Clock3 />} tone="purple" />
      <StatCard label="Valor mensal" value={money(relation?.totalMonthly)} helper="Soma das mensalidades" icon={<CircleDollarSign />} tone="green" />
    </section>
    <nav className="system-parameters-menu" aria-label="Seções">
      <button className={tab === 'relation' ? 'active' : ''} onClick={() => setTab('relation')}>Relação de contratos ativos</button>
      <button className={tab === 'readjust' ? 'active' : ''} onClick={() => setTab('readjust')}>Reajuste anual</button>
      <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>Histórico de renovações</button>
    </nav>

    <section className="panel data-panel">
      {tab !== 'history' && <div className="inline-filters">
        <label className="inline-filters__wide"><span>Busca</span><div className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cliente, código do cliente ou do contrato" /></div></label>
        <label><span>Vencimento</span><select value={dueDay} onChange={(event) => setDueDay(event.target.value)}><option value="">Todos</option><option value="10">Dia 10</option><option value="20">Dia 20</option></select></label>
      </div>}

      {tab === 'relation' && (relationQuery.isLoading ? <LoadingState label="Carregando contratos ativos..." /> : relationQuery.isError ? <ErrorState message={apiErrorMessage(relationQuery.error)} onRetry={() => relationQuery.refetch()} /> : contracts.length === 0 ? <EmptyState title="Nenhum contrato ativo" description="Altere os filtros." /> : <div className="report-document" ref={printRef}>
        <div className="print-header"><div><h1>GENTE BOA SERVIÇOS</h1><p>Relação de Contratos Ativos</p><small>Total de contratos: {contracts.length} · Horas: {relation?.totalHours} · Mensal: {moneyText(relation?.totalMonthly)}</small></div><small>{dateText(new Date().toISOString())}</small></div>
        <table><thead><tr><th>Contrato</th><th>Dt. início</th><th>Renovação</th><th>Venc.</th><th>ID</th><th>Cliente</th><th>Serviço</th><th className="num">Qtde</th><th className="num">Bonif.</th><th className="num">Valor</th><th className="num">Hora</th><th className="num">Extra</th><th className="num">Extra/Min</th></tr></thead>
          <tbody>{contracts.map((contract) => [
            ...contract.services.map((service, index) => <tr key={`${contract.contractId}-${service.sequence}`} className={index === 0 ? 'total-row' : ''}><td>{index === 0 ? contract.contractId : ''}</td><td>{index === 0 ? dateText(contract.contractDate) : ''}</td><td>{index === 0 ? dateText(contract.renewalDate) : ''}</td><td>{index === 0 ? contract.dueDay : ''}</td><td>{index === 0 ? contract.clientId : ''}</td><td>{index === 0 ? contract.clientTradeName || contract.clientName : ''}</td><td>{service.serviceName}</td><td className="num">{service.quantity}</td><td className="num">{service.bonusQuantity ?? 0}</td><td className="num">{moneyText(service.totalValue)}</td><td className="num">{moneyText(service.unitValue)}</td><td className="num">{moneyText(service.extraValue)}</td><td className="num">{moneyText(service.minuteValue)}</td></tr>),
            ...contract.locations.map((location) => <tr key={`${contract.contractId}-location-${location.id}`} className="muted"><td colSpan={6}>&nbsp;&nbsp;{location.description || 'Local'}</td><td colSpan={3}>{[location.address, location.complement].filter(Boolean).join(', ')}</td><td colSpan={2}>{location.contactName}</td><td colSpan={2}>{location.contactPhone}</td></tr>),
          ])}</tbody></table>
      </div>)}

      {tab === 'readjust' && <div className="readjust-panel">
        <FormError message={error} />
        <p className="finance-dialog__hint">Informe o percentual do ano e gere a prévia. Nada é alterado até você confirmar. Para clientes com percentual diferente, preencha a coluna “% próprio”. Ao confirmar, os valores dos contratos são atualizados, o histórico de renovação é gravado e as parcelas futuras (sem boleto) passam a usar o novo valor.</p>
        <div className="inline-filters readjust-panel__controls">
          <label><span>% de reajuste do ano</span><input type="number" step="0.01" value={percentage} onChange={(event) => { setPercentage(event.target.value); setPreview(null) }} placeholder="Ex.: 5,32" /></label>
          <label className="checkbox-inline"><input type="checkbox" checked={adjustUnit} onChange={(event) => { setAdjustUnit(event.target.checked); setPreview(null) }} /> Valor da hora</label>
          <label className="checkbox-inline"><input type="checkbox" checked={adjustExtra} onChange={(event) => { setAdjustExtra(event.target.checked); setPreview(null) }} /> Valor extra</label>
          <label className="checkbox-inline"><input type="checkbox" checked={adjustMinute} onChange={(event) => { setAdjustMinute(event.target.checked); setPreview(null) }} /> Minuto excedente</label>
          <label className="checkbox-inline"><input type="checkbox" checked={renewTerm} onChange={(event) => { setRenewTerm(event.target.checked); setPreview(null) }} /> Renovar vigência (+1 ano a partir da renovação)</label>
          <Button icon={<Percent size={16} />} disabled={previewMutation.isPending} onClick={() => { const body = payload(); if (body) previewMutation.mutate(body) }}>{previewMutation.isPending ? 'Calculando...' : 'Gerar prévia'}</Button>
          {previewChanged && <Button icon={<CheckCircle2 size={16} />} onClick={() => setConfirmOpen(true)}>Confirmar reajuste</Button>}
        </div>
        {!preview ? (relationQuery.isLoading ? <LoadingState /> : <div className="table-wrap"><table className="data-table"><thead><tr><th className="check-column"><input type="checkbox" checked={contracts.length > 0 && selectedIds.length === contracts.length} onChange={(event) => { setExcluded(event.target.checked ? {} : Object.fromEntries(contracts.map((contract) => [contract.contractId, true]))); setPreview(null) }} /></th><th>Contrato</th><th>Cliente</th><th>Venc.</th><th>Renovação</th><th className="num">Horas</th><th className="num">Mensal</th><th className="num">Minuto</th><th>% próprio</th></tr></thead>
          <tbody>{contracts.map((contract) => <tr key={contract.contractId}><td className="check-column"><input type="checkbox" checked={!excluded[contract.contractId]} onChange={(event) => { setExcluded((current) => ({ ...current, [contract.contractId]: !event.target.checked })); setPreview(null) }} /></td><td><strong>{contract.contractId}</strong></td><td>{contract.clientTradeName || contract.clientName}</td><td>{contract.dueDay}</td><td>{dateText(contract.renewalDate)}</td><td className="num">{contract.contractedHours}</td><td className="num">{money(contract.monthlyValue)}</td><td className="num">{money(contract.services[0]?.minuteValue ?? 0)}</td><td><input className="time-input" type="number" step="0.01" placeholder="Padrão" value={overrides[contract.contractId] ?? ''} onChange={(event) => { setOverrides((current) => ({ ...current, [contract.contractId]: event.target.value })); setPreview(null) }} /></td></tr>)}</tbody></table></div>)
          : <div className="table-wrap"><table className="data-table"><thead><tr><th>Contrato</th><th>Cliente</th><th className="num">%</th><th className="num">Mensal atual</th><th className="num">Novo mensal</th><th className="num">Hora</th><th className="num">Extra</th><th className="num">Minuto</th><th>Nova vigência</th></tr></thead>
            <tbody>{preview.changes.map((change) => { const main = change.services[0]; return <tr key={change.contractId}><td><strong>{change.contractId}</strong></td><td>{change.clientName}</td><td className="num">{change.percentage.toLocaleString('pt-BR')}%</td><td className="num">{money(change.currentMonthly)}</td><td className="num"><strong>{money(change.newMonthly)}</strong></td><td className="num">{main ? `${money(main.currentUnitValue)} → ${money(main.newUnitValue)}` : '—'}</td><td className="num">{main ? `${money(main.currentExtraValue)} → ${money(main.newExtraValue)}` : '—'}</td><td className="num">{main ? `${money(main.currentMinuteValue)} → ${money(main.newMinuteValue)}` : '—'}</td><td>{dateText(change.newContractDate)} a {dateText(change.newRenewalDate)}</td></tr> })}</tbody>
            <tfoot><tr><td colSpan={3}>{preview.contracts} contrato(s)</td><td className="num">{money(preview.currentMonthly)}</td><td className="num">{money(preview.newMonthly)}</td><td colSpan={4}>Diferença mensal: {money(preview.newMonthly - preview.currentMonthly)}</td></tr></tfoot></table></div>}
      </div>}

      {tab === 'history' && <>
        <div className="inline-filters"><label><span>Ano do reajuste</span><input type="number" min="2000" max="2100" value={historyYear} onChange={(event) => setHistoryYear(event.target.value)} placeholder="Todos" /></label></div>
        {historyQuery.isLoading ? <LoadingState label="Carregando histórico..." /> : historyQuery.isError ? <ErrorState message={apiErrorMessage(historyQuery.error)} /> : (historyQuery.data?.length ?? 0) === 0 ? <EmptyState title="Sem renovações" description="Nenhum reajuste registrado no período." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Contrato</th><th>Cliente</th><th>Dt. contrato</th><th>Renovação</th><th>Alterado em</th><th className="num">Total anterior</th><th className="num">Total atualizado</th><th className="num">Minuto anterior</th><th className="num">Minuto atualizado</th><th className="num">%</th></tr></thead>
          <tbody>{historyQuery.data!.map((row) => <tr key={row.id}><td><strong>{row.contractId}</strong></td><td>{row.clientName}</td><td>{dateText(row.contractDate)}</td><td>{dateText(row.renewalDate)}</td><td>{dateText(row.changedAt)}</td><td className="num">{money(row.previousTotal)}</td><td className="num">{money(row.newTotal)}</td><td className="num">{money(row.previousMinute)}</td><td className="num">{money(row.newMinute)}</td><td className="num"><Badge tone="blue">{row.percentage.toLocaleString('pt-BR')}%</Badge></td></tr>)}</tbody></table></div>}
      </>}
    </section>

    <ConfirmDialog open={confirmOpen} variant="primary" icon={<History size={22} />} eyebrow="Reajuste anual" title={`Aplicar reajuste em ${preview?.contracts ?? 0} contrato(s)?`} description={`O valor mensal passará de ${money(preview?.currentMonthly)} para ${money(preview?.newMonthly)}. O histórico de renovação será gravado para cada contrato.`} confirmLabel="Aplicar reajuste" busyLabel="Aplicando..." busy={applyMutation.isPending} onCancel={() => setConfirmOpen(false)} onConfirm={() => { const body = payload(); if (body) applyMutation.mutate(body) }} />
    {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
  </>
}
