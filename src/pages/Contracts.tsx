import { useEffect, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Building2, ChevronLeft, ChevronRight, CircleDollarSign, Edit3, FileSignature, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { useRouter } from '../router'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { enumLabel, formatDate, money, toDateInput, toDateTimeInput } from '../lib/format'
import type { Contract, ContractListSortBy, ContractPayload, ContractServiceItem, ContractServicePayload, SortDirection } from '../types'
import { Badge, Button, ConfirmDialog, DetailModal, EmptyState, ErrorState, FormError, FormField, LoadingState, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'

type StatusFilter = 'TODOS' | 'ATIVO' | 'CANCELADO'

type ServiceRow = {
  key: number
  sequence?: number
  serviceId: number | null
  serviceName?: string | null
  unit?: string | null
  quantity: number
  unitValue: number
  extraMinuteValue: number
  bonusQuantity: number
}

const sortOptions: { value: ContractListSortBy; label: string }[] = [
  { value: 'CONTRACT_DATE', label: 'Data do contrato' },
  { value: 'RENEWAL_DATE', label: 'Data de renovação' },
  { value: 'CLIENT', label: 'Nome do cliente' },
  { value: 'DUE_DAY', label: 'Dia de vencimento' },
  { value: 'ADHESION_FEE', label: 'Taxa de adesão' },
]

let serviceRowKey = 0

function emptyServiceRow(sequence?: number): ServiceRow {
  return { key: ++serviceRowKey, sequence, serviceId: null, quantity: 1, unitValue: 0, extraMinuteValue: 0, bonusQuantity: 0 }
}

function serviceRowFrom(item: ContractServiceItem): ServiceRow {
  return {
    key: ++serviceRowKey,
    sequence: item.sequence,
    serviceId: item.serviceId,
    serviceName: item.serviceName ?? item.serviceDescription,
    unit: item.unit,
    quantity: Number(item.quantity ?? 1),
    unitValue: Number(item.unitValue ?? 0),
    extraMinuteValue: Number(item.extraMinuteValue ?? 0),
    bonusQuantity: Number(item.bonusQuantity ?? 0),
  }
}

function textValue(data: FormData, field: string) {
  return String(data.get(field) ?? '').trim()
}

function nullableNumber(data: FormData, field: string) {
  const value = textValue(data, field)
  return value === '' ? null : Number(value)
}

function dateTimeFromDate(value: string) {
  return value ? `${value}T00:00:00` : null
}

function renewalInNextDays(value?: string | null, days = 60) {
  if (!value) return false
  const renewal = new Date(value).getTime()
  const now = Date.now()
  return renewal >= now && renewal <= now + days * 86_400_000
}

export function Contracts() {
  const queryClient = useQueryClient()
  const { search: routeSearch, navigate } = useRouter()
  const clientIdParam = new URLSearchParams(routeSearch).get('clientId')
  const clientFilter = clientIdParam && /^\d+$/.test(clientIdParam) && Number(clientIdParam) > 0 ? Number(clientIdParam) : null
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('TODOS')
  const [sortBy, setSortBy] = useState<ContractListSortBy>('CONTRACT_DATE')
  const [direction, setDirection] = useState<SortDirection>('DESC')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [modalOpen, setModalOpen] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [selected, setSelected] = useState<Contract | null>(null)
  const [serviceRows, setServiceRows] = useState<ServiceRow[]>(() => [emptyServiceRow()])
  const [detailId, setDetailId] = useState<number | null>(null)
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null)
  const [contractToCancel, setContractToCancel] = useState<Contract | null>(null)
  const [toast, setToast] = useState('')
  const [formError, setFormError] = useState('')
  const [cancelError, setCancelError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const debouncedSearch = useDebouncedValue(search)

  const contractsQuery = useQuery({
    queryKey: [...queryKeys.contracts, 'list', debouncedSearch, statusFilter, sortBy, direction, page, pageSize, clientFilter],
    queryFn: () => api.contracts.list({
      query: debouncedSearch || undefined,
      clientId: clientFilter ?? undefined,
      status: statusFilter === 'TODOS' ? undefined : statusFilter,
      sortBy,
      direction,
      page,
      size: pageSize,
    }),
    placeholderData: keepPreviousData,
  })

  const clientsQuery = useQuery({
    queryKey: [...queryKeys.clients, 'contract-selector'],
    queryFn: () => api.clients.list({ status: 'ATIVO', sortBy: 'NAME', direction: 'ASC', page: 0, size: 100 }),
  })

  const filteredClientQuery = useQuery({
    queryKey: [...queryKeys.clients, 'detail', clientFilter],
    queryFn: () => api.clients.find(clientFilter as number),
    enabled: clientFilter !== null,
  })

  const servicesQuery = useQuery({
    queryKey: [...queryKeys.serviceCatalog, 'selector'],
    queryFn: () => api.serviceCatalog.list({ page: 0, size: 100 }),
  })

  const detailQuery = useQuery({
    queryKey: [...queryKeys.contracts, 'detail', detailId],
    queryFn: () => api.contracts.find(detailId as number),
    enabled: detailId !== null,
  })

  useEffect(() => {
    const totalPages = contractsQuery.data?.totalPages ?? 0
    if (totalPages > 0 && page >= totalPages) setPage(totalPages - 1)
  }, [contractsQuery.data?.totalPages, page])

  useEffect(() => setPage(0), [clientFilter])

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: ContractPayload }) => id ? api.contracts.update(id, payload) : api.contracts.create(payload),
    onSuccess: (contract) => {
      setModalOpen(false)
      setSelected(null)
      setServiceRows([emptyServiceRow()])
      queryClient.setQueryData([...queryKeys.contracts, 'detail', contract.id], contract)
      setDetailId(contract.id)
      showToast(`Contrato #${contract.id} ${selected ? 'atualizado' : 'cadastrado'} com sucesso.`)
      void queryClient.invalidateQueries({ queryKey: queryKeys.contracts })
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients })
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })

  const cancelMutation = useMutation({
    mutationFn: ({ id, cancellationDate, reason }: { id: number; cancellationDate: string; reason: string }) => api.contracts.cancel(id, { cancellationDate, reason }),
    onSuccess: (contract) => {
      setContractToCancel(null)
      setCancelError('')
      queryClient.setQueryData([...queryKeys.contracts, 'detail', contract.id], contract)
      showToast(`Contrato #${contract.id} cancelado com sucesso.`)
      void queryClient.invalidateQueries({ queryKey: queryKeys.contracts })
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients })
    },
    onError: (error) => setCancelError(apiErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.contracts.remove(id),
    onMutate: async (id) => queryClient.cancelQueries({ queryKey: [...queryKeys.contracts, 'detail', id], exact: true }),
    onSuccess: (_, id) => {
      setContractToDelete(null)
      setDeleteError('')
      setDetailId(null)
      queryClient.removeQueries({ queryKey: [...queryKeys.contracts, 'detail', id], exact: true })
      showToast('Contrato removido com sucesso.')
      void queryClient.invalidateQueries({ queryKey: queryKeys.contracts })
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients })
    },
    onError: (error) => setDeleteError(apiErrorMessage(error, 'Não foi possível excluir este contrato.')),
  })

  const contracts = contractsQuery.data?.content ?? []
  const total = contractsQuery.data?.total ?? 0
  const totalPages = contractsQuery.data?.totalPages ?? 0
  const activeOnPage = contracts.filter((contract) => contract.status === 'ATIVO').length
  const canceledOnPage = contracts.filter((contract) => contract.status === 'CANCELADO').length
  const renewalsOnPage = contracts.filter((contract) => contract.status === 'ATIVO' && renewalInNextDays(contract.renewalDate)).length
  const adhesionOnPage = contracts.reduce((sum, contract) => sum + Number(contract.adhesionFee ?? 0), 0)
  const firstResult = total === 0 ? 0 : page * pageSize + 1
  const lastResult = Math.min((page + 1) * pageSize, total)
  const clientOptions = clientsQuery.data?.content ?? []
  const serviceOptions = servicesQuery.data?.content ?? []
  const filteredClientName = filteredClientQuery.data?.name || clientOptions.find((client) => client.id === clientFilter)?.name || (clientFilter ? `Cliente #${clientFilter}` : '')

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3400)
  }

  function resetPage() {
    setPage(0)
  }

  function openNew() {
    setSelected(null)
    setServiceRows([emptyServiceRow()])
    setFormError('')
    setFormLoading(false)
    setModalOpen(true)
  }

  async function openEdit(contractOrId: Contract | number) {
    setDetailId(null)
    setSelected(null)
    setServiceRows([emptyServiceRow()])
    setFormError('')
    setModalOpen(true)
    setFormLoading(true)
    try {
      const contract = typeof contractOrId === 'number'
        ? await queryClient.fetchQuery({ queryKey: [...queryKeys.contracts, 'detail', contractOrId], queryFn: () => api.contracts.find(contractOrId) })
        : contractOrId
      setSelected(contract)
      setServiceRows(contract.services?.length ? contract.services.map(serviceRowFrom) : [emptyServiceRow()])
    } catch (error) {
      setFormError(apiErrorMessage(error))
    } finally {
      setFormLoading(false)
    }
  }

  function updateServiceRow(index: number, changes: Partial<ServiceRow>) {
    setServiceRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...changes } : row))
  }

  function selectService(index: number, serviceId: number | null) {
    const service = serviceOptions.find((item) => item.id === serviceId)
    updateServiceRow(index, {
      serviceId,
      serviceName: service?.description,
      unit: service?.unit,
      unitValue: service?.defaultValue == null && service?.defaultPrice == null ? 0 : Number(service.defaultValue ?? service.defaultPrice),
    })
  }

  function removeServiceRow(index: number) {
    setServiceRows((rows) => rows.length === 1 ? [emptyServiceRow()] : rows.filter((_, rowIndex) => rowIndex !== index))
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const data = new FormData(event.currentTarget)
    const validRows = serviceRows.filter((row) => row.serviceId !== null)

    if (validRows.length === 0) {
      setFormError('Adicione pelo menos um serviço ao contrato.')
      return
    }
    if (validRows.some((row) => row.quantity <= 0)) {
      setFormError('A quantidade de todos os serviços deve ser maior que zero.')
      return
    }
    if (validRows.some((row) => row.bonusQuantity < 0 || row.bonusQuantity > row.quantity)) {
      setFormError('A quantidade bonificada deve estar entre zero e a quantidade contratada.')
      return
    }

    const contractDate = dateTimeFromDate(textValue(data, 'contractDate'))
    if (!contractDate) {
      setFormError('Informe a data do contrato.')
      return
    }

    const services: ContractServicePayload[] = validRows.map((row) => ({
      ...(row.sequence == null ? {} : { sequence: row.sequence }),
      serviceId: row.serviceId as number,
      quantity: Number(row.quantity),
      unitValue: Number(row.unitValue),
      extraMinuteValue: Number(row.extraMinuteValue) || 0,
      bonusQuantity: Number(row.bonusQuantity) || 0,
    }))

    const payload: ContractPayload = {
      clientId: Number(data.get('clientId')),
      contractDate,
      renewalDate: dateTimeFromDate(textValue(data, 'renewalDate')),
      adhesionFee: nullableNumber(data, 'adhesionFee'),
      dueDay: nullableNumber(data, 'dueDay'),
      gracePeriod: textValue(data, 'gracePeriod') === 'true',
      adjustmentIndexId: nullableNumber(data, 'adjustmentIndexId'),
      salePercentage: nullableNumber(data, 'salePercentage'),
      renewalPercentage: nullableNumber(data, 'renewalPercentage'),
      canceled: selected?.canceled ?? false,
      cancellationDate: selected?.cancellationDate ?? null,
      cancellationReason: selected?.cancellationReason ?? null,
      employeeId: nullableNumber(data, 'employeeId'),
      employeePercentage: nullableNumber(data, 'employeePercentage'),
      supplierId: nullableNumber(data, 'supplierId'),
      statusFlag: textValue(data, 'statusFlag') || null,
      lastAdjustmentDate: textValue(data, 'lastAdjustmentDate') || null,
      services,
    }
    saveMutation.mutate({ id: selected?.id, payload })
  }

  function submitCancellation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!contractToCancel) return
    setCancelError('')
    const data = new FormData(event.currentTarget)
    const date = dateTimeFromDate(textValue(data, 'cancellationDate'))
    const reason = textValue(data, 'reason')
    if (!date || !reason) {
      setCancelError('Informe a data e o motivo do cancelamento.')
      return
    }
    cancelMutation.mutate({ id: contractToCancel.id, cancellationDate: date, reason })
  }

  return (
    <>
      <PageHeader eyebrow="Relacionamento" title="Contratos" subtitle="Contratos de manutenção, serviços vinculados, renovações e cancelamentos." actions={<Button icon={<Plus size={18} />} onClick={openNew}>Novo contrato</Button>} />

      <section className="stats-grid stats-grid--four">
        <StatCard label="Ativos nesta página" value={String(activeOnPage)} helper={`${contracts.length} contratos exibidos`} icon={<FileSignature />} tone="blue" />
        <StatCard label="Renovação em 60 dias" value={String(renewalsOnPage)} helper="Contratos ativos no período" icon={<RefreshCw />} tone="orange" />
        <StatCard label="Cancelados nesta página" value={String(canceledOnPage)} helper="Histórico preservado" icon={<Ban />} tone="purple" />
        <StatCard label="Taxas de adesão" value={money(adhesionOnPage)} helper="Soma da página atual" icon={<CircleDollarSign />} tone="green" />
      </section>

      <section className="panel data-panel">
        {clientFilter !== null && <div className="contract-client-filter"><span className="contract-client-filter__icon"><Building2 size={17} /></span><div><small>Contratos filtrados por cliente</small><strong>{filteredClientQuery.isLoading ? `Carregando cliente #${clientFilter}...` : filteredClientName}</strong></div><button onClick={() => navigate('/contratos', { replace: true })}>Remover filtro <X size={15} /></button></div>}
        <div className="data-toolbar data-toolbar--clients">
          <div className="search-box"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); resetPage() }} placeholder="Buscar por cliente ou código..." /></div>
          <div className="segmented-control" aria-label="Filtrar contratos">{(['TODOS', 'ATIVO', 'CANCELADO'] as const).map((item) => <button key={item} className={statusFilter === item ? 'active' : ''} onClick={() => { setStatusFilter(item); resetPage() }}>{item === 'TODOS' ? 'Todos' : item === 'ATIVO' ? 'Ativos' : 'Cancelados'}</button>)}</div>
          <label className="toolbar-select"><span>Ordenar por</span><select value={sortBy} onChange={(event) => { setSortBy(event.target.value as ContractListSortBy); resetPage() }}>{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="toolbar-select toolbar-select--compact"><span>Direção</span><select value={direction} onChange={(event) => { setDirection(event.target.value as SortDirection); resetPage() }}><option value="ASC">Crescente</option><option value="DESC">Decrescente</option></select></label>
        </div>

        {contractsQuery.isLoading ? <LoadingState label="Carregando contratos..." /> : contractsQuery.isError ? <ErrorState message={apiErrorMessage(contractsQuery.error)} onRetry={() => contractsQuery.refetch()} /> : contracts.length === 0 ? <EmptyState title="Nenhum contrato encontrado" description="Altere os filtros ou cadastre um novo contrato." /> : (
          <div className={`table-wrap ${contractsQuery.isFetching ? 'table-wrap--refreshing' : ''}`}>
            <table className="data-table contracts-table">
              <thead><tr><th>Contrato</th><th>Cliente</th><th>Data do contrato</th><th>Renovação</th><th>Vencimento</th><th>Adesão</th><th>Serviços</th><th>Situação</th><th /></tr></thead>
              <tbody>{contracts.map((contract) => <tr key={contract.id} onClick={() => setDetailId(contract.id)}>
                <td><strong>#{contract.id}</strong></td>
                <td><div className="entity-cell"><span className="entity-avatar"><Building2 size={17} /></span><span><strong>{contract.clientName || `Cliente #${contract.clientId}`}</strong><small>Código do cliente: {contract.clientId}</small></span></div></td>
                <td>{formatDate(contract.contractDate)}</td>
                <td><strong className={renewalInNextDays(contract.renewalDate) && contract.status === 'ATIVO' ? 'contract-renewal-alert' : ''}>{formatDate(contract.renewalDate)}</strong></td>
                <td>{contract.dueDay ? `Dia ${contract.dueDay}` : 'Não informado'}</td>
                <td><strong>{money(contract.adhesionFee)}</strong></td>
                <td>{contract.serviceCount == null ? <span className="muted">Ver detalhes</span> : `${contract.serviceCount} serviço${contract.serviceCount === 1 ? '' : 's'}`}</td>
                <td><Badge tone={contract.status === 'ATIVO' ? 'green' : 'neutral'}>{enumLabel(contract.status)}</Badge></td>
                <td><button className="row-action" onClick={(event) => { event.stopPropagation(); setDetailId(contract.id) }} aria-label={`Abrir contrato ${contract.id}`}><ChevronRight size={18} /></button></td>
              </tr>)}</tbody>
            </table>
          </div>
        )}

        <footer className="table-footer table-footer--pagination">
          <span>Mostrando <strong>{firstResult}–{lastResult}</strong> de <strong>{total}</strong> contratos</span>
          <div className="pagination-controls">
            <label>Por página <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); resetPage() }}><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label>
            <button disabled={page === 0 || contractsQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button>
            <span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span>
            <button disabled={page + 1 >= totalPages || contractsQuery.isFetching} onClick={() => setPage((value) => value + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button>
          </div>
        </footer>
      </section>

      <Modal open={modalOpen} onClose={() => !saveMutation.isPending && setModalOpen(false)} title={selected ? `Editar contrato #${selected.id}` : 'Novo contrato'} description="Cabeçalho contratual e serviços definidos em tbcontratoservico." size="xlarge">
        {formLoading ? <LoadingState label="Carregando contrato completo..." /> : (
          <ModalForm onSubmit={submit} onCancel={() => setModalOpen(false)} submitting={saveMutation.isPending} submitLabel={saveMutation.isPending ? 'Salvando...' : selected ? 'Salvar alterações' : 'Cadastrar contrato'}>
            <FormError message={formError} />
            {clientsQuery.isError && <FormError message={`Não foi possível carregar os clientes: ${apiErrorMessage(clientsQuery.error)}`} />}
            <div className="form-section-title"><span>1</span><div><strong>Dados do contrato</strong><small>Cliente, vigência e vencimento</small></div></div>
            <div className="form-grid form-grid--four">
              <FormField label="Cliente"><select name="clientId" required defaultValue={selected?.clientId ?? clientFilter ?? ''}><option value="" disabled>Selecione o cliente</option>{selected && !clientOptions.some((client) => client.id === selected.clientId) && <option value={selected.clientId}>{selected.clientName || `Cliente #${selected.clientId}`}</option>}{!selected && clientFilter !== null && !clientOptions.some((client) => client.id === clientFilter) && <option value={clientFilter}>{filteredClientName}</option>}{clientOptions.map((client) => <option key={client.id} value={client.id}>{client.name || `Cliente #${client.id}`} · {client.document || 'sem documento'}</option>)}</select></FormField>
              <FormField label="Data do contrato"><input name="contractDate" type="date" required defaultValue={toDateInput(selected?.contractDate)} /></FormField>
              <FormField label="Data de renovação"><input name="renewalDate" type="date" defaultValue={selected?.renewalDate?.slice(0, 10) ?? ''} /></FormField>
              <FormField label="Dia do vencimento"><input name="dueDay" type="number" min="1" max="31" defaultValue={selected?.dueDay ?? 10} /></FormField>
              <FormField label="Taxa de adesão" hint="O banco aceita somente valor inteiro"><input name="adhesionFee" type="number" min="0" step="1" defaultValue={selected?.adhesionFee ?? 0} /></FormField>
              <FormField label="Possui carência"><select name="gracePeriod" defaultValue={String(selected?.gracePeriod ?? false)}><option value="false">Não</option><option value="true">Sim</option></select></FormField>
              <FormField label="Código do índice"><input name="adjustmentIndexId" type="number" min="0" defaultValue={selected?.adjustmentIndexId ?? ''} /></FormField>
              <FormField label="Último reajuste"><input name="lastAdjustmentDate" type="datetime-local" defaultValue={selected?.lastAdjustmentDate ? toDateTimeInput(selected.lastAdjustmentDate) : ''} /></FormField>
            </div>

            <div className="form-section-title"><span>2</span><div><strong>Comercial e responsáveis</strong><small>Percentuais e referências do contrato</small></div></div>
            <div className="form-grid form-grid--four">
              <FormField label="% de venda"><input name="salePercentage" type="number" min="0" max="100" step="1" defaultValue={selected?.salePercentage ?? 0} /></FormField>
              <FormField label="% de renovação"><input name="renewalPercentage" type="number" min="0" max="100" step="1" defaultValue={selected?.renewalPercentage ?? 0} /></FormField>
              <FormField label="Código do funcionário"><input name="employeeId" type="number" min="0" defaultValue={selected?.employeeId ?? ''} /></FormField>
              <FormField label="% do funcionário"><input name="employeePercentage" type="number" min="0" max="100" step="0.01" defaultValue={selected?.employeePercentage ?? ''} /></FormField>
              <FormField label="Código do fornecedor"><input name="supplierId" type="number" min="0" defaultValue={selected?.supplierId ?? ''} /></FormField>
              <FormField label="Flag de situação"><input name="statusFlag" maxLength={2} defaultValue={selected?.statusFlag ?? ''} /></FormField>
            </div>

            <div className="form-section-title"><span>3</span><div><strong>Serviços do contrato</strong><small>Catálogo de tbservico e valores de tbcontratoservico</small></div></div>
            {servicesQuery.isError && <FormError message={`Não foi possível carregar o catálogo: ${apiErrorMessage(servicesQuery.error)}`} />}
            <div className="contract-service-list">
              {serviceRows.map((row, index) => {
                const catalogItem = serviceOptions.find((service) => service.id === row.serviceId)
                const totalEstimate = row.quantity * row.unitValue
                return <article className="contract-service-row" key={row.key}>
                  <header><span>Serviço {index + 1}</span><strong>{catalogItem?.unit || row.unit || 'Unidade não informada'}</strong><button type="button" onClick={() => removeServiceRow(index)} aria-label={`Remover serviço ${index + 1}`}><X size={16} /></button></header>
                  <div className="contract-service-fields">
                    <FormField label="Serviço"><select required value={row.serviceId ?? ''} onChange={(event) => selectService(index, event.target.value ? Number(event.target.value) : null)}><option value="">Selecione</option>{row.serviceId && !serviceOptions.some((service) => service.id === row.serviceId) && <option value={row.serviceId}>{row.serviceName || `Serviço #${row.serviceId}`}</option>}{serviceOptions.map((service) => <option key={service.id} value={service.id}>{service.description || `Serviço #${service.id}`}</option>)}</select></FormField>
                    <FormField label="Quantidade"><input type="number" min="1" value={row.quantity} onChange={(event) => updateServiceRow(index, { quantity: Number(event.target.value) })} /></FormField>
                    <FormField label="Qtd. bonificada"><input type="number" min="0" max={row.quantity} value={row.bonusQuantity} onChange={(event) => updateServiceRow(index, { bonusQuantity: Number(event.target.value) })} /></FormField>
                    <FormField label="Valor unitário"><input type="number" min="0" step="0.01" value={row.unitValue} onChange={(event) => updateServiceRow(index, { unitValue: Number(event.target.value) })} /></FormField>
                    <FormField label="Valor minuto extra"><input type="number" min="0" step="0.01" value={row.extraMinuteValue} onChange={(event) => updateServiceRow(index, { extraMinuteValue: Number(event.target.value) })} /></FormField>
                  </div>
                  <footer><span>Preço padrão: <strong>{money(catalogItem?.defaultValue ?? catalogItem?.defaultPrice)}</strong></span><span>Total estimado: <strong>{money(totalEstimate)}</strong></span></footer>
                </article>
              })}
            </div>
            <Button type="button" variant="secondary" icon={<Plus size={16} />} onClick={() => setServiceRows((rows) => [...rows, emptyServiceRow()])}>Adicionar serviço</Button>
            {selected?.canceled && <div className="warning-box"><Ban size={18} /><span><strong>Contrato cancelado</strong><small>Os dados de cancelamento serão preservados nesta edição.</small></span></div>}
          </ModalForm>
        )}
      </Modal>

      <DetailModal
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        title={detailQuery.data ? `Contrato #${detailQuery.data.id} · ${detailQuery.data.clientName || `Cliente #${detailQuery.data.clientId}`}` : 'Detalhes do contrato'}
        description="Condições comerciais, vigência, serviços contratados e situação atual."
        size="xlarge"
        actions={detailQuery.data ? <><Button variant="danger" icon={<Trash2 size={17} />} onClick={() => { setDeleteError(''); setContractToDelete(detailQuery.data) }}>Excluir</Button>{!detailQuery.data.canceled && <Button variant="secondary" icon={<Ban size={17} />} onClick={() => { setCancelError(''); setContractToCancel(detailQuery.data) }}>Cancelar contrato</Button>}<Button icon={<Edit3 size={17} />} onClick={() => openEdit(detailQuery.data)}>Editar</Button></> : undefined}
      >
        {detailQuery.isLoading ? <LoadingState label="Carregando contrato..." /> : detailQuery.isError ? <ErrorState message={apiErrorMessage(detailQuery.error)} onRetry={() => detailQuery.refetch()} /> : detailQuery.data ? <ContractDetail contract={detailQuery.data} /> : null}
      </DetailModal>

      <Modal open={Boolean(contractToCancel)} onClose={() => !cancelMutation.isPending && setContractToCancel(null)} title={`Cancelar contrato #${contractToCancel?.id ?? ''}`} description="O contrato permanece no histórico e deixa de ser considerado ativo.">
        <ModalForm onSubmit={submitCancellation} onCancel={() => setContractToCancel(null)} submitting={cancelMutation.isPending} submitLabel={cancelMutation.isPending ? 'Cancelando...' : 'Confirmar cancelamento'}>
          <FormError message={cancelError} />
          <div className="form-grid form-grid--two">
            <FormField label="Data do cancelamento"><input name="cancellationDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></FormField>
            <FormField label="Motivo"><textarea name="reason" rows={4} required placeholder="Informe por que o contrato está sendo encerrado" /></FormField>
          </div>
        </ModalForm>
      </Modal>

      <ConfirmDialog
        open={Boolean(contractToDelete)}
        title={`Excluir o contrato #${contractToDelete?.id ?? ''}?`}
        description="Use a exclusão somente para cadastros indevidos. Contratos utilizados devem ser cancelados para preservar o histórico."
        confirmLabel="Excluir contrato"
        busy={deleteMutation.isPending}
        error={deleteError}
        onCancel={() => { setContractToDelete(null); setDeleteError('') }}
        onConfirm={() => { if (contractToDelete && !deleteMutation.isPending) { setDeleteError(''); deleteMutation.mutate(contractToDelete.id) } }}
      />

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </>
  )
}

function ContractDetail({ contract }: { contract: Contract }) {
  return <div className="detail-modal-content">
    <div className="detail-modal__hero-row"><div className="detail-drawer__hero"><span className="detail-avatar"><FileSignature /></span><div><span>Contrato #{contract.id}</span><h2>{contract.clientName || `Cliente #${contract.clientId}`}</h2><p>Cliente #{contract.clientId}</p></div></div><Badge tone={contract.status === 'ATIVO' ? 'green' : 'neutral'}>{enumLabel(contract.status)}</Badge></div>
    <div className="detail-metrics"><span><small>Data do contrato</small><strong>{formatDate(contract.contractDate)}</strong></span><span><small>Renovação</small><strong>{formatDate(contract.renewalDate)}</strong></span><span><small>Vencimento</small><strong>{contract.dueDay ? `Dia ${contract.dueDay}` : 'Não informado'}</strong></span><span><small>Taxa de adesão</small><strong>{money(contract.adhesionFee)}</strong></span></div>
    <div className="detail-sections-grid">
    <section className="drawer-section"><h3>Condições comerciais</h3><dl>
      <div><dt>Carência</dt><dd>{contract.gracePeriod ? 'Sim' : 'Não'}</dd></div>
      <div><dt>Índice de reajuste</dt><dd>{contract.adjustmentIndexId ?? 'Não informado'}</dd></div>
      <div><dt>Percentual de venda</dt><dd>{contract.salePercentage == null ? 'Não informado' : `${contract.salePercentage}%`}</dd></div>
      <div><dt>Percentual de renovação</dt><dd>{contract.renewalPercentage == null ? 'Não informado' : `${contract.renewalPercentage}%`}</dd></div>
      <div><dt>Funcionário</dt><dd>{contract.employeeId ?? 'Não informado'}</dd></div>
      <div><dt>Percentual do funcionário</dt><dd>{contract.employeePercentage == null ? 'Não informado' : `${contract.employeePercentage}%`}</dd></div>
      <div><dt>Fornecedor</dt><dd>{contract.supplierId ?? 'Não informado'}</dd></div>
      <div><dt>Último reajuste</dt><dd>{formatDate(contract.lastAdjustmentDate)}</dd></div>
    </dl></section>
    <section className="drawer-section drawer-section--wide"><h3>Serviços contratados</h3>{(contract.services?.length ?? 0) === 0 ? <p className="drawer-section__text">Nenhum serviço vinculado.</p> : <div className="contract-detail-services">{contract.services.map((service) => <article key={service.sequence}><span>{service.sequence}</span><div><strong>{service.serviceName || service.serviceDescription || `Serviço #${service.serviceId}`}</strong><small>{service.quantity} {service.unit || 'un.'} · {money(service.unitValue)} por unidade</small></div><b>{money(service.totalValue)}</b></article>)}</div>}</section>
    {contract.canceled && <section className="drawer-section contract-cancellation drawer-section--wide"><h3>Cancelamento</h3><dl><div><dt>Data</dt><dd>{formatDate(contract.cancellationDate)}</dd></div><div><dt>Motivo</dt><dd>{contract.cancellationReason || 'Não informado'}</dd></div></dl></section>}
    </div>
  </div>
}
