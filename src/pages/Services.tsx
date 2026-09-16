import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BriefcaseBusiness, ChevronLeft, ChevronRight, CircleDollarSign, Edit3, Plus, Search, Timer, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { api, queryKeys } from '../api/services'
import { Button, ConfirmDialog, EmptyState, ErrorState, FormError, FormField, LoadingState, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { money } from '../lib/format'
import type { ServiceCatalogItem, ServiceCatalogPayload } from '../types'

type ToastState = { message: string; variant: 'success' | 'error' } | null

function numericInput(value: number | null | undefined) {
  return String(Number(value ?? 0))
}

function sameValue(left: number | null | undefined, right: number | null | undefined) {
  return Math.round(Number(left ?? 0) * 100) === Math.round(Number(right ?? 0) * 100)
}

export function Services() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [selected, setSelected] = useState<ServiceCatalogItem | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [serviceToDelete, setServiceToDelete] = useState<ServiceCatalogItem | null>(null)
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState<ToastState>(null)
  const [minuteValue, setMinuteValue] = useState('0')
  const [extraValue, setExtraValue] = useState('0')
  const [oneOffValue, setOneOffValue] = useState('0')
  const [extraEdited, setExtraEdited] = useState(false)
  const [oneOffEdited, setOneOffEdited] = useState(false)
  const debouncedSearch = useDebouncedValue(search.trim())

  const servicesQuery = useQuery({
    queryKey: [...queryKeys.serviceCatalog, 'management', debouncedSearch, page, pageSize],
    queryFn: () => api.serviceCatalog.list({ query: debouncedSearch || undefined, page, size: pageSize }),
    placeholderData: keepPreviousData,
  })

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: ServiceCatalogPayload }) => id
      ? api.serviceCatalog.update(id, payload)
      : api.serviceCatalog.create(payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.serviceCatalog })
      setModalOpen(false)
      setSelected(null)
      showToast(variables.id ? 'Serviço atualizado.' : 'Serviço cadastrado.')
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.serviceCatalog.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.serviceCatalog })
      setServiceToDelete(null)
      setModalOpen(false)
      setSelected(null)
      showToast('Serviço excluído.')
    },
    onError: (error) => {
      setServiceToDelete(null)
      showToast(apiErrorMessage(error), 'error')
    },
  })

  const services = servicesQuery.data?.content ?? []
  const total = servicesQuery.data?.total ?? 0
  const totalPages = servicesQuery.data?.totalPages ?? 0
  const firstResult = total === 0 ? 0 : page * pageSize + 1
  const lastResult = Math.min((page + 1) * pageSize, total)
  const averageMinuteValue = services.length
    ? services.reduce((sum, service) => sum + Number(service.legacyMinuteValue ?? 0), 0) / services.length
    : 0
  const customExtraValues = services.filter((service) => !sameValue(service.extraValue, service.legacyMinuteValue)).length
  const customOneOffValues = services.filter((service) => !sameValue(service.oneOffValue, service.legacyMinuteValue)).length

  function showToast(message: string, variant: 'success' | 'error' = 'success') {
    setToast({ message, variant })
    window.setTimeout(() => setToast(null), 3500)
  }

  function openNew() {
    setSelected(null)
    setMinuteValue('0')
    setExtraValue('0')
    setOneOffValue('0')
    setExtraEdited(false)
    setOneOffEdited(false)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(service: ServiceCatalogItem) {
    const minute = numericInput(service.legacyMinuteValue)
    setSelected(service)
    setMinuteValue(minute)
    setExtraValue(numericInput(service.extraValue ?? service.legacyMinuteValue))
    setOneOffValue(numericInput(service.oneOffValue ?? service.legacyMinuteValue))
    setExtraEdited(service.extraValue != null && !sameValue(service.extraValue, service.legacyMinuteValue))
    setOneOffEdited(service.oneOffValue != null && !sameValue(service.oneOffValue, service.legacyMinuteValue))
    setFormError('')
    setModalOpen(true)
  }

  function changeMinuteValue(value: string) {
    setMinuteValue(value)
    if (!extraEdited) setExtraValue(value)
    if (!oneOffEdited) setOneOffValue(value)
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const data = new FormData(event.currentTarget)
    const optionalNumber = (name: string) => {
      const value = String(data.get(name) ?? '').trim()
      return value === '' ? null : Number(value)
    }
    const payload: ServiceCatalogPayload = {
      groupId: optionalNumber('groupId'),
      description: String(data.get('description') ?? '').trim(),
      unit: String(data.get('unit') ?? '').trim() || null,
      defaultPrice: optionalNumber('defaultPrice'),
      minimumValue: optionalNumber('minimumValue'),
      legacyMinuteValue: Number(minuteValue || 0),
      extraValue: Number(extraValue || 0),
      oneOffValue: Number(oneOffValue || 0),
    }
    saveMutation.mutate({ id: selected?.id, payload })
  }

  return <>
    <PageHeader eyebrow="Operação" title="Serviços" subtitle="Cadastro de serviços e valores utilizados em contratos e ordens de serviço." actions={<Button icon={<Plus size={18} />} onClick={openNew}>Novo serviço</Button>} />

    <section className="stats-grid stats-grid--four">
      <StatCard label="Serviços cadastrados" value={total.toLocaleString('pt-BR')} helper={`${services.length} nesta página`} icon={<BriefcaseBusiness />} tone="blue" />
      <StatCard label="Valor minuto médio" value={money(averageMinuteValue)} helper="Média da página atual" icon={<Timer />} tone="green" />
      <StatCard label="Valores extras próprios" value={String(customExtraValues)} helper="Diferentes do valor minuto" icon={<CircleDollarSign />} tone="orange" />
      <StatCard label="Valores avulsos próprios" value={String(customOneOffValues)} helper="Diferentes do valor minuto" icon={<CircleDollarSign />} tone="purple" />
    </section>

    <section className="panel data-panel">
      <div className="data-toolbar data-toolbar--clients">
        <div className="search-box"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Buscar por código, serviço ou unidade..." /></div>
      </div>

      {servicesQuery.isLoading ? <LoadingState label="Carregando serviços..." /> : servicesQuery.isError ? <ErrorState message={apiErrorMessage(servicesQuery.error)} onRetry={() => servicesQuery.refetch()} /> : services.length === 0 ? <EmptyState title="Nenhum serviço encontrado" description="Altere a busca ou cadastre um novo serviço." /> : <div className={`table-wrap ${servicesQuery.isFetching ? 'table-wrap--refreshing' : ''}`}>
        <table className="data-table services-table"><thead><tr><th>Código</th><th>Serviço</th><th>Unidade</th><th>Valor minuto</th><th>Valor contrato</th><th>Valor extra</th><th>Valor avulso</th><th /></tr></thead><tbody>{services.map((service) => <tr key={service.id} onClick={() => openEdit(service)}>
          <td><strong>#{service.id}</strong></td>
          <td><strong className="table-primary">{service.description || 'Sem descrição'}</strong><small className="table-secondary">Grupo {service.groupId ?? 'não informado'}</small></td>
          <td>{service.unit || '—'}</td>
          <td><strong>{money(service.legacyMinuteValue)}</strong></td>
          <td>{money(service.defaultPrice)}</td>
          <td>{money(service.extraValue ?? service.legacyMinuteValue)}</td>
          <td>{money(service.oneOffValue ?? service.legacyMinuteValue)}</td>
          <td><button className="row-action" onClick={(event) => { event.stopPropagation(); openEdit(service) }} aria-label={`Editar ${service.description || `serviço #${service.id}`}`}><Edit3 size={16} /></button></td>
        </tr>)}</tbody></table>
      </div>}

      <footer className="table-footer table-footer--pagination">
        <span>Mostrando <strong>{firstResult}–{lastResult}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong> serviços</span>
        <div className="pagination-controls">
          <label>Por página <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label>
          <button disabled={page === 0 || servicesQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button>
          <span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span>
          <button disabled={page + 1 >= totalPages || servicesQuery.isFetching} onClick={() => setPage((value) => value + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button>
        </div>
      </footer>
    </section>

    <Modal open={modalOpen} onClose={() => !saveMutation.isPending && setModalOpen(false)} title={selected ? `Editar serviço #${selected.id}` : 'Novo serviço'} description="Defina os valores utilizados na cobrança do serviço." size="large">
      <ModalForm onSubmit={submit} onCancel={() => setModalOpen(false)} submitting={saveMutation.isPending} submitLabel={saveMutation.isPending ? 'Salvando...' : selected ? 'Salvar alterações' : 'Cadastrar serviço'}>
        <FormError message={formError} />
        <div className="form-grid form-grid--three service-form-grid">
          <FormField label="Código"><input value={selected?.id ?? 'Gerado ao salvar'} disabled /></FormField>
          <FormField label="Grupo"><input name="groupId" type="number" min="0" step="1" defaultValue={selected?.groupId ?? ''} /></FormField>
          <FormField label="Unidade"><input name="unit" maxLength={50} placeholder="HORAS, UNIDADE..." defaultValue={selected?.unit ?? ''} /></FormField>
          <FormField label="Serviço"><input name="description" required maxLength={50} defaultValue={selected?.description ?? ''} autoFocus /></FormField>
          <FormField label="Valor minuto"><input type="number" min="0" step="0.01" required value={minuteValue} onChange={(event) => changeMinuteValue(event.target.value)} /></FormField>
          <FormField label="Valor contrato"><input name="defaultPrice" type="number" min="0" step="0.01" defaultValue={selected?.defaultPrice ?? 0} /></FormField>
          <FormField label="Valor extra"><input type="number" min="0" step="0.01" required value={extraValue} onChange={(event) => { setExtraEdited(true); setExtraValue(event.target.value) }} /></FormField>
          <FormField label="Valor avulso"><input type="number" min="0" step="0.01" required value={oneOffValue} onChange={(event) => { setOneOffEdited(true); setOneOffValue(event.target.value) }} /></FormField>
          <FormField label="Valor mínimo"><input name="minimumValue" type="number" min="0" step="0.01" defaultValue={selected?.minimumValue ?? 0} /></FormField>
        </div>
        {selected && <div className="destructive-row"><span><strong>Excluir serviço</strong><small>Serviços vinculados a contratos ou ordens de serviço não poderão ser excluídos.</small></span><Button type="button" variant="danger" icon={<Trash2 size={16} />} onClick={() => setServiceToDelete(selected)}>Excluir</Button></div>}
      </ModalForm>
    </Modal>

    <ConfirmDialog open={serviceToDelete !== null} title={`Excluir serviço #${serviceToDelete?.id ?? ''}?`} description="Esta ação remove o serviço do cadastro. Vínculos existentes impedem a exclusão." confirmLabel="Excluir serviço" busy={deleteMutation.isPending} onCancel={() => setServiceToDelete(null)} onConfirm={() => serviceToDelete && deleteMutation.mutate(serviceToDelete.id)} />
    {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
  </>
}
