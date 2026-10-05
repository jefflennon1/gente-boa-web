import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck2, Eye, LoaderCircle, Plus, Save, Trash2, TrendingUp } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { modulesApi, modulesKeys, type ServicePriceAdjustmentPreview } from '../api/modules'
import type { ServicePriceAdjustmentPayload, SystemParameters } from '../types'
import { formatDate, money } from '../lib/format'
import { Button, FormError, FormField } from './ui'

type OverrideRow = { key: number; contractId: string; percentage: string }

/**
 * Reajuste anual programado: na data informada aplica o percentual à tabela de serviços e aos contratos ativos
 * (regra da cliente, POP p.29), com percentual próprio para alguns contratos e renovação da vigência.
 */
export function ScheduledAdjustmentForm({ parameters, onSaved }: { parameters: SystemParameters; onSaved: (message: string) => void }) {
  const queryClient = useQueryClient()
  const [enabled, setEnabled] = useState(Boolean(parameters.serviceAdjustmentEnabled))
  const [percentage, setPercentage] = useState(parameters.serviceAdjustmentPercentage == null ? '' : String(parameters.serviceAdjustmentPercentage))
  const [scheduledDate, setScheduledDate] = useState(parameters.serviceAdjustmentDate ?? '')
  // Novo agendamento: por padrão a regra da cliente (contratos + tabela de serviços).
  const [includeServices, setIncludeServices] = useState(parameters.serviceAdjustmentIncludeServices ?? true)
  const [includeContracts, setIncludeContracts] = useState(parameters.serviceAdjustmentEnabled ? Boolean(parameters.serviceAdjustmentIncludeContracts) : true)
  const [renewContracts, setRenewContracts] = useState(parameters.serviceAdjustmentRenewContracts ?? true)
  const [overrides, setOverrides] = useState<OverrideRow[]>([])
  const [formError, setFormError] = useState('')
  const [preview, setPreview] = useState<ServicePriceAdjustmentPreview | null>(null)

  const overridesQuery = useQuery({ queryKey: [...queryKeys.systemParameters, 'adjustment-overrides'], queryFn: api.systemParameters.serviceAdjustmentOverrides })
  const contractsQuery = useQuery({ queryKey: [...modulesKeys.readjustment, 'active', 'all'], queryFn: () => modulesApi.readjustment.activeContracts(), enabled: includeContracts })
  const contracts = contractsQuery.data?.contracts ?? []
  const contractLabel = useMemo(() => new Map(contracts.map((contract) => [contract.contractId, `#${contract.contractId} · ${contract.clientTradeName || contract.clientName || `Cliente ${contract.clientId}`}`])), [contracts])

  useEffect(() => {
    if (overridesQuery.data) setOverrides(overridesQuery.data.map((item, index) => ({ key: index, contractId: String(item.contractId), percentage: String(item.percentage) })))
  }, [overridesQuery.data])

  function payload(): ServicePriceAdjustmentPayload | string {
    const value = percentage.trim() === '' ? null : Number(percentage)
    if (enabled && (value === null || !scheduledDate)) return 'Informe o percentual e a data para ativar o reajuste.'
    if (enabled && !includeServices && !includeContracts) return 'Selecione a tabela de serviços e/ou os contratos ativos.'
    const rows = overrides.filter((row) => row.contractId && row.percentage.trim() !== '')
    if (new Set(rows.map((row) => row.contractId)).size !== rows.length) return 'Há contratos repetidos nas exceções.'
    return {
      enabled,
      percentage: value,
      scheduledDate: scheduledDate || null,
      includeServices,
      includeContracts,
      renewContracts,
      contractOverrides: rows.map((row) => ({ contractId: Number(row.contractId), percentage: Number(row.percentage) })),
    }
  }

  const saveMutation = useMutation({
    mutationFn: api.systemParameters.updateServiceAdjustment,
    onSuccess: async (updated, sent) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.systemParameters })
      setFormError('')
      const appliedNow = updated.serviceAdjustmentAppliedDate === sent.scheduledDate && sent.enabled
      onSaved(appliedNow
        ? `Reajuste aplicado: ${updated.serviceAdjustmentAffectedServices ?? 0} serviço(s) e ${updated.serviceAdjustmentAffectedContracts ?? 0} contrato(s).`
        : 'Agendamento de reajuste atualizado.')
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })
  const previewMutation = useMutation({
    mutationFn: api.systemParameters.previewServiceAdjustment,
    onSuccess: (data) => { setFormError(''); setPreview(data) },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = payload()
    if (typeof result === 'string') { setFormError(result); return }
    saveMutation.mutate(result)
  }

  function simulate() {
    const result = payload()
    if (typeof result === 'string') { setFormError(result); return }
    if (result.percentage === null) { setFormError('Informe o percentual para simular.'); return }
    previewMutation.mutate(result)
  }

  const contractPreview = preview?.contractPreview ?? null
  return <form className="panel system-parameters-form service-adjustment-form" onSubmit={submit}>
    <header className="system-parameters-form__header">
      <span className="system-parameters-form__icon"><TrendingUp size={21} /></span>
      <div><span>Automação financeira</span><h2>Reajuste anual</h2><p>Programa o reajuste percentual dos contratos ativos e da tabela de serviços na data informada.</p></div>
      <label className={`service-adjustment-toggle ${enabled ? 'service-adjustment-toggle--active' : ''}`}>
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        <span aria-hidden="true"><i /></span><strong>{enabled ? 'Ativado' : 'Desativado'}</strong>
      </label>
    </header>
    <div className="system-parameters-form__body">
      <FormError message={formError} />
      <div className="service-adjustment-intro"><CalendarCheck2 size={20} /><span><strong>Aplicação única na data programada</strong>
        <small>Contratos já reajustados no mesmo ano (por exemplo, em Relatórios &gt; Contratos ativos e reajuste) ficam de fora para não receberem dois reajustes. Cada contrato reajustado entra no histórico de renovações.</small></span></div>
      <div className="form-grid form-grid--two system-parameters-financial">
        <FormField label="Percentual geral de reajuste (%)" hint="Exemplo: informe 6 para aumentar os valores em 6%"><input type="number" min="0.01" max="100" step="0.0001" required={enabled} disabled={!enabled} value={percentage} onChange={(event) => setPercentage(event.target.value)} /></FormField>
        <FormField label="Data de aplicação" hint="Se a data for hoje, o reajuste será aplicado ao salvar"><input type="date" required={enabled} disabled={!enabled} value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} /></FormField>
      </div>

      <section className="service-adjustment-scope">
        <strong>O que será reajustado</strong>
        <div className="adjustment-scope-options">
          <label className="checkbox-inline"><input type="checkbox" checked={includeContracts} disabled={!enabled} onChange={(event) => setIncludeContracts(event.target.checked)} /> Contratos ativos <small>valor da hora, minuto extra e minuto excedente de cada contrato</small></label>
          <label className="checkbox-inline"><input type="checkbox" checked={renewContracts} disabled={!enabled || !includeContracts} onChange={(event) => setRenewContracts(event.target.checked)} /> Renovar a vigência dos contratos <small>nova data de renovação no mês de reajuste</small></label>
          <label className="checkbox-inline"><input type="checkbox" checked={includeServices} disabled={!enabled} onChange={(event) => setIncludeServices(event.target.checked)} /> Tabela de serviços <small>valores usados em novos contratos e atendimentos avulsos</small></label>
        </div>
        <small>Todos os valores são arredondados para duas casas decimais.</small>
      </section>

      {includeContracts && <section className="service-adjustment-scope">
        <strong>Contratos com percentual próprio</strong>
        <small className="adjustment-overrides__hint">Alguns clientes têm percentual diferente do geral. Os contratos não listados aqui usam o percentual geral.</small>
        {overrides.length > 0 && <div className="adjustment-overrides">{overrides.map((row) => <div key={row.key} className="adjustment-overrides__row">
          <select value={row.contractId} disabled={!enabled} onChange={(event) => setOverrides((current) => current.map((item) => item.key === row.key ? { ...item, contractId: event.target.value } : item))}>
            <option value="">Selecione o contrato</option>
            {row.contractId && !contractLabel.has(Number(row.contractId)) && <option value={row.contractId}>#{row.contractId} (não está ativo)</option>}
            {contracts.map((contract) => <option key={contract.contractId} value={contract.contractId}>{contractLabel.get(contract.contractId)}</option>)}
          </select>
          <input type="number" step="0.0001" min="-50" max="100" placeholder="%" disabled={!enabled} value={row.percentage} onChange={(event) => setOverrides((current) => current.map((item) => item.key === row.key ? { ...item, percentage: event.target.value } : item))} />
          <button type="button" className="row-action row-action--danger" title="Remover" disabled={!enabled} onClick={() => setOverrides((current) => current.filter((item) => item.key !== row.key))}><Trash2 size={15} /></button>
        </div>)}</div>}
        <Button type="button" variant="ghost" icon={<Plus size={15} />} disabled={!enabled} onClick={() => setOverrides((current) => [...current, { key: Date.now(), contractId: '', percentage: '' }])}>Adicionar contrato com percentual próprio</Button>
      </section>}

      {preview && <section className="service-adjustment-scope adjustment-preview">
        <strong>Prévia do reajuste</strong>
        <div className="adjustment-preview__cards">
          <span><small>Serviços da tabela</small><b>{preview.services}</b></span>
          <span><small>Contratos reajustados</small><b>{preview.contracts}</b></span>
          <span><small>Mensal atual</small><b>{money(contractPreview?.currentMonthly ?? 0)}</b></span>
          <span><small>Mensal reajustado</small><b>{money(contractPreview?.newMonthly ?? 0)}</b></span>
        </div>
        {preview.skippedContractIds.length > 0 && <small>{preview.skippedContractIds.length} contrato(s) já reajustado(s) neste ano ficarão de fora: {preview.skippedContractIds.map((id) => `#${id}`).join(', ')}.</small>}
        {contractPreview && contractPreview.changes.length > 0 && <div className="table-wrap adjustment-preview__table"><table className="data-table"><thead><tr><th>Contrato</th><th>Cliente</th><th className="num">%</th><th>Nova renovação</th><th className="num">Mensal atual</th><th className="num">Mensal reajustado</th></tr></thead>
          <tbody>{contractPreview.changes.map((change) => <tr key={change.contractId}><td>#{change.contractId}</td><td>{change.clientName}</td><td className="num">{change.percentage.toLocaleString('pt-BR')}</td><td>{formatDate(change.newRenewalDate)}</td><td className="num">{money(change.currentMonthly)}</td><td className="num">{money(change.newMonthly)}</td></tr>)}</tbody></table></div>}
      </section>}

      <section className="service-adjustment-history service-adjustment-history--four">
        <span><small>Última data processada</small><strong>{formatDate(parameters.serviceAdjustmentAppliedDate)}</strong></span>
        <span><small>Executado em</small><strong>{formatDate(parameters.serviceAdjustmentAppliedAt, true)}</strong></span>
        <span><small>Serviços reajustados</small><strong>{parameters.serviceAdjustmentAffectedServices ?? 'Nenhuma execução'}</strong></span>
        <span><small>Contratos reajustados</small><strong>{parameters.serviceAdjustmentAffectedContracts ?? '—'}</strong></span>
      </section>
    </div>
    <footer className="system-parameters-form__footer">
      <span>{enabled ? 'O reajuste será executado automaticamente na data informada.' : 'Ative a configuração para programar um novo reajuste.'}</span>
      <Button type="button" variant="secondary" icon={previewMutation.isPending ? <LoaderCircle className="api-state__spinner" size={16} /> : <Eye size={16} />} disabled={!enabled || previewMutation.isPending} onClick={simulate}>{previewMutation.isPending ? 'Simulando...' : 'Simular'}</Button>
      <Button type="submit" icon={saveMutation.isPending ? <LoaderCircle className="api-state__spinner" size={16} /> : <Save size={17} />} disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Salvando...' : 'Salvar reajuste'}</Button>
    </footer>
  </form>
}
