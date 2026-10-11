import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Edit3, MapPin, Plus, Search, Trash2 } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { useAuth } from '../auth'
import { ClientPicker, type PickerValue } from '../components/AsyncPicker'
import { formatCep } from '../components/ClientDetail'
import { Badge, Button, CollapsibleFilters, ConfirmDialog, EmptyState, ErrorState, FormError, FormField, LoadingState, Modal, ModalForm, PageHeader, Toast } from '../components/ui'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { enumLabel, formatDate } from '../lib/format'
import { useRouter } from '../router'
import type { AttendanceLocation, AttendanceLocationListItem, AttendanceLocationPayload } from '../types'

type LocationForm = {
  client: PickerValue
  contractId: number
  description: string
  zipCode: string
  address: string
  complement: string
  district: string
  city: string
  contactName: string
  contactPhone: string
  requester: string
  cnpj: string
  referencePoint: string
}

const emptyForm: LocationForm = { client: null, contractId: 0, description: '', zipCode: '', address: '', complement: '', district: '', city: '', contactName: '', contactPhone: '', requester: '', cnpj: '', referencePoint: '' }

function clientLabel(item: Pick<AttendanceLocationListItem, 'clientName' | 'clientTradeName'>, clientId: number) {
  return `${item.clientTradeName || item.clientName || 'Cliente'} · #${clientId}`
}

function formFrom(item: AttendanceLocationListItem): LocationForm {
  const location = item.location
  return {
    client: { id: location.clientId, label: clientLabel(item, location.clientId) },
    contractId: location.contractId || 0,
    description: location.description ?? '',
    zipCode: formatCep(location.zipCode),
    address: location.address ?? '',
    complement: location.complement ?? '',
    district: location.district ?? '',
    city: location.city ?? '',
    contactName: location.contactName ?? '',
    contactPhone: location.contactPhone ?? '',
    requester: location.requester ?? '',
    cnpj: location.cnpj ?? '',
    referencePoint: location.referencePoint ?? '',
  }
}

function locationAddress(location: AttendanceLocation) {
  return [location.address, location.complement, location.district, location.city, formatCep(location.zipCode)].filter(Boolean).join(' · ')
}

/** Cadastro dos locais (endereços) onde cada cliente pode solicitar atendimento. */
export function AttendanceLocations() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { search: routeSearch } = useRouter()
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState<PickerValue>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [editing, setEditing] = useState<AttendanceLocationListItem | 'new' | null>(null)
  const [form, setForm] = useState<LocationForm>(emptyForm)
  const [formError, setFormError] = useState('')
  const [cepStatus, setCepStatus] = useState('')
  const [toDelete, setToDelete] = useState<AttendanceLocationListItem | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [toast, setToast] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim())

  // Atalho vindo do modal "Dados do cliente": /locais-de-atendimento?clientId=123
  const requestedClientId = Number(new URLSearchParams(routeSearch).get('clientId')) || null
  const requestedClientQuery = useQuery({ queryKey: [...queryKeys.clients, 'detail', requestedClientId], queryFn: () => api.clients.find(requestedClientId!), enabled: requestedClientId !== null })
  useEffect(() => {
    if (!requestedClientId) return
    const client = requestedClientQuery.data
    setClientFilter({ id: requestedClientId, label: client ? `${client.nmfanta || client.name || 'Cliente'} · #${requestedClientId}` : `Cliente #${requestedClientId}` })
    setPage(0)
  }, [requestedClientId, requestedClientQuery.data])

  const locationsQuery = useQuery({
    queryKey: [...queryKeys.attendanceLocations, 'search', debouncedSearch, clientFilter?.id ?? null, page, pageSize],
    queryFn: () => api.attendanceLocations.search({ query: debouncedSearch || undefined, clientId: clientFilter?.id, page, size: pageSize }),
    placeholderData: keepPreviousData,
  })
  const formClientId = form.client?.id ?? null
  const contractsQuery = useQuery({
    queryKey: [...queryKeys.contracts, 'client', formClientId, 'locations'],
    queryFn: () => api.contracts.byClient(formClientId!, { page: 0, size: 50 }),
    enabled: editing !== null && formClientId !== null,
  })

  const saveMutation = useMutation({
    mutationFn: (payload: AttendanceLocationPayload) => editing && editing !== 'new'
      ? api.attendanceLocations.update(editing.location.id, payload)
      : api.attendanceLocations.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.attendanceLocations })
      showToast(editing === 'new' ? 'Local de atendimento cadastrado.' : 'Local de atendimento atualizado.')
      closeForm()
    },
    onError: (error) => setFormError(apiErrorMessage(error, 'Não foi possível salvar o local de atendimento.')),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.attendanceLocations.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.attendanceLocations })
      setToDelete(null)
      showToast('Local de atendimento excluído.')
    },
    onError: (error) => setDeleteError(apiErrorMessage(error, 'Não foi possível excluir o local de atendimento.')),
  })

  const rows = locationsQuery.data?.content ?? []
  const total = locationsQuery.data?.total ?? 0
  const totalPages = locationsQuery.data?.totalPages ?? 0
  const firstResult = total === 0 ? 0 : page * pageSize + 1
  const lastResult = Math.min(total, (page + 1) * pageSize)
  const contracts = contractsQuery.data?.content ?? []

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }

  function openNew() {
    setEditing('new')
    setForm({ ...emptyForm, client: clientFilter })
    setFormError('')
    setCepStatus('')
  }

  function openEdit(item: AttendanceLocationListItem) {
    setEditing(item)
    setForm(formFrom(item))
    setFormError('')
    setCepStatus('')
  }

  function closeForm() {
    if (saveMutation.isPending) return
    setEditing(null)
  }

  function update(patch: Partial<LocationForm>) {
    setForm((current) => ({ ...current, ...patch }))
  }

  async function lookupCep() {
    const digits = form.zipCode.replace(/\D/g, '')
    if (digits.length !== 8) return
    setCepStatus('Buscando endereço...')
    try {
      const address = await api.addresses.findByCep(digits)
      setForm((current) => ({
        ...current,
        zipCode: formatCep(address.cep || digits),
        address: current.address || address.logradouro || '',
        district: address.bairro || current.district,
        city: address.localidade || current.city,
      }))
      setCepStatus('Endereço preenchido pelo CEP. Confira o número.')
    } catch {
      setCepStatus('CEP não encontrado. Preencha o endereço manualmente.')
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.client) {
      setFormError('Selecione o cliente do local de atendimento.')
      return
    }
    const text = (value: string) => value.trim() || null
    // Na edição, os campos que a tela não mostra (dados legados de banco, pagamento e spread) são mantidos.
    const original = editing && editing !== 'new' ? editing.location : null
    saveMutation.mutate({
      bank1: null, agency1: null, account1: null, bank2: null, agency2: null, account2: null,
      paymentMethod: null, paymentCondition: null, spreadDescription: null, spreadValue: null, spreadGroup: null,
      ...(original ? (({ id: _id, registeredAt: _registeredAt, ...rest }) => rest)(original) : {}),
      clientId: form.client.id,
      contractId: form.contractId,
      description: form.description.trim(),
      address: form.address.trim(),
      complement: text(form.complement),
      district: text(form.district),
      city: text(form.city),
      zipCode: text(form.zipCode.replace(/\D/g, '')),
      contactName: text(form.contactName),
      contactPhone: text(form.contactPhone),
      requester: text(form.requester),
      cnpj: text(form.cnpj),
      referencePoint: text(form.referencePoint),
      username: original?.username ?? user?.name ?? null,
    })
  }

  return <>
    <PageHeader eyebrow="Cadastros" title="Locais de atendimento" subtitle="Endereços onde cada cliente pode solicitar atendimento. São usados nas ordens de serviço e no rateio de horas dos contratos." actions={<Button icon={<Plus size={18} />} onClick={openNew}>Novo local</Button>} />

    <section className="panel data-panel">
      <CollapsibleFilters summary="Local, endereço, bairro, cidade, contato ou cliente" activeCount={(search.trim() ? 1 : 0) + (clientFilter ? 1 : 0)} onClear={() => { setSearch(''); setClientFilter(null); setPage(0) }} contentClassName="structured-filters attendance-locations-filters">
        <label className="structured-filter-field structured-filter-field--wide"><span>Buscar</span><div className="search-box"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Descrição, endereço, bairro, cidade, contato, código ou cliente" /></div></label>
        <div className="structured-filter-field structured-filter-field--wide"><span>Cliente</span><ClientPicker value={clientFilter} onChange={(value) => { setClientFilter(value); setPage(0) }} /></div>
      </CollapsibleFilters>

      {locationsQuery.isLoading ? <LoadingState label="Carregando locais de atendimento..." /> : locationsQuery.isError ? <ErrorState message={apiErrorMessage(locationsQuery.error)} onRetry={() => locationsQuery.refetch()} /> : rows.length === 0 ? <EmptyState title="Nenhum local encontrado" description="Altere a busca ou cadastre um novo local de atendimento." /> : <div className={`table-wrap ${locationsQuery.isFetching ? 'table-wrap--refreshing' : ''}`}>
        <table className="data-table attendance-locations-table"><thead><tr><th>Código</th><th>Cliente</th><th>Local</th><th>Endereço</th><th>Contato</th><th>Contrato</th><th>Cadastro</th><th /></tr></thead><tbody>{rows.map((item) => {
          const location = item.location
          return <tr key={location.id} onClick={() => openEdit(item)}>
            <td><strong>#{location.id}</strong></td>
            <td><strong className="table-primary">{item.clientTradeName || item.clientName || `Cliente #${location.clientId}`}</strong><small className="table-secondary">Cliente #{location.clientId}</small></td>
            <td><strong className="table-primary">{location.description || 'Sem descrição'}</strong>{item.usedByServiceOrders && <small className="table-secondary"><Badge tone="blue">Usado em OS</Badge></small>}</td>
            <td>{locationAddress(location) || 'Não informado'}{location.referencePoint && <small className="table-secondary">Ref.: {location.referencePoint}</small>}</td>
            <td>{location.contactName || '—'}{location.contactPhone && <small className="table-secondary">{location.contactPhone}</small>}</td>
            <td>{location.contractId ? `#${location.contractId}` : 'Sem contrato'}</td>
            <td>{formatDate(location.registeredAt)}</td>
            <td><div className="attendance-locations-actions">
              <button type="button" className="row-action" onClick={(event) => { event.stopPropagation(); openEdit(item) }} aria-label={`Editar ${location.description}`}><Edit3 size={16} /></button>
              <button type="button" className="row-action" disabled={item.usedByServiceOrders} title={item.usedByServiceOrders ? 'Local usado em ordem de serviço: não pode ser excluído' : 'Excluir local'} onClick={(event) => { event.stopPropagation(); setDeleteError(''); setToDelete(item) }} aria-label={`Excluir ${location.description}`}><Trash2 size={16} /></button>
            </div></td>
          </tr>
        })}</tbody></table>
      </div>}

      <footer className="table-footer table-footer--pagination">
        <span>Mostrando <strong>{firstResult}–{lastResult}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong> locais</span>
        <div className="pagination-controls">
          <label>Por página <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}>{[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
          <button disabled={page === 0 || locationsQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button>
          <span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span>
          <button disabled={page + 1 >= totalPages || locationsQuery.isFetching} onClick={() => setPage((value) => value + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button>
        </div>
      </footer>
    </section>

    <Modal open={editing !== null} onClose={closeForm} title={editing === 'new' ? 'Novo local de atendimento' : `Editar local #${editing?.location.id ?? ''}`} description="Endereço onde o cliente recebe os atendimentos." size="large">
      <ModalForm onSubmit={submit} onCancel={closeForm} submitting={saveMutation.isPending} submitLabel={saveMutation.isPending ? 'Salvando...' : editing === 'new' ? 'Cadastrar local' : 'Salvar alterações'}>
        <FormError message={formError} />
        <div className="attendance-location-form-grid">
          <div className="form-field attendance-location-form-grid__wide"><span>Cliente</span><ClientPicker value={form.client} required onChange={(value) => update({ client: value, contractId: 0 })} /></div>
          <FormField label="Descrição do local"><input required maxLength={50} value={form.description} onChange={(event) => update({ description: event.target.value })} placeholder="Ex.: Sede, filial ou condomínio" /></FormField>
          <FormField label="Contrato" hint="Opcional. Vincula o local a um contrato do cliente."><select value={form.contractId} disabled={!form.client || contractsQuery.isLoading} onChange={(event) => update({ contractId: Number(event.target.value) })}><option value={0}>Sem contrato</option>{contracts.map((contract) => <option key={contract.id} value={contract.id}>Contrato #{contract.id} · {enumLabel(contract.status)}</option>)}</select></FormField>
          <FormField label="CNPJ do local"><input maxLength={25} value={form.cnpj} onChange={(event) => update({ cnpj: event.target.value })} /></FormField>
          <FormField label="CEP" hint={cepStatus || 'Ao sair do campo, o endereço é buscado pelo CEP.'}><input maxLength={10} inputMode="numeric" value={form.zipCode} onChange={(event) => update({ zipCode: event.target.value })} onBlur={lookupCep} /></FormField>
          <FormField label="Endereço"><input required maxLength={200} value={form.address} onChange={(event) => update({ address: event.target.value })} placeholder="Rua, avenida e número" /></FormField>
          <FormField label="Complemento"><input maxLength={100} value={form.complement} onChange={(event) => update({ complement: event.target.value })} /></FormField>
          <FormField label="Bairro"><input maxLength={100} value={form.district} onChange={(event) => update({ district: event.target.value })} /></FormField>
          <FormField label="Cidade"><input maxLength={100} value={form.city} onChange={(event) => update({ city: event.target.value })} /></FormField>
          <FormField label="Contato no local"><input maxLength={50} value={form.contactName} onChange={(event) => update({ contactName: event.target.value })} /></FormField>
          <FormField label="Telefone do contato"><input maxLength={18} value={form.contactPhone} onChange={(event) => update({ contactPhone: event.target.value })} /></FormField>
          <FormField label="Solicitante"><input maxLength={100} value={form.requester} onChange={(event) => update({ requester: event.target.value })} /></FormField>
          <FormField label="Ponto de referência"><textarea rows={3} maxLength={300} value={form.referencePoint} onChange={(event) => update({ referencePoint: event.target.value })} /></FormField>
        </div>
      </ModalForm>
    </Modal>

    <ConfirmDialog
      open={toDelete !== null}
      title={`Excluir ${toDelete?.location.description || 'este local'}?`}
      description="O local será removido do cadastro do cliente. Locais já usados em ordens de serviço não podem ser excluídos."
      confirmLabel="Excluir local"
      icon={<MapPin size={24} />}
      busy={deleteMutation.isPending}
      error={deleteError}
      onCancel={() => { if (!deleteMutation.isPending) setToDelete(null) }}
      onConfirm={() => toDelete && !deleteMutation.isPending && deleteMutation.mutate(toDelete.location.id)}
    />

    {toast && <Toast message={toast} onClose={() => setToast('')} />}
  </>
}
