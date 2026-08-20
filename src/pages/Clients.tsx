import { useEffect, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Building2, ChevronLeft, ChevronRight, CircleDollarSign, Edit3, FileSignature, Plus, RefreshCw, Search, Trash2, UserRoundCheck, UsersRound, Wrench } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { useAuth } from '../auth'
import { useRouter } from '../router'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { enumLabel, formatDate, money } from '../lib/format'
import type { Client, ClientAddress, ClientAddressPayload, ClientKind, ClientListSortBy, ClientPayload, ClientStatus, SortDirection } from '../types'
import { Badge, Button, ConfirmDialog, DetailModal, EmptyState, ErrorState, FormError, FormField, LoadingState, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'

type StatusFilter = 'TODOS' | 'ATIVO' | 'INATIVO'

type AddressFields = {
  nrcep: string
  dsender: string
  dscompl: string
  dsbairr: string
  dscidad: string
  dsestad: string
  dsponto: string
}

type ClientAddressRow = {
  key: number
  id?: number
  description: string
  street: string
  complement: string
  district: string
  city: string
  state: string
  zipCode: string
  map: string
  accountName: string
  phone: string
  reference: string
  cepLoading: boolean
  cepError: string
}

const emptyAddressFields: AddressFields = { nrcep: '', dsender: '', dscompl: '', dsbairr: '', dscidad: '', dsestad: '', dsponto: '' }
let clientAddressRowKey = 0

function emptyClientAddressRow(): ClientAddressRow {
  return { key: ++clientAddressRowKey, description: '', street: '', complement: '', district: '', city: '', state: '', zipCode: '', map: '', accountName: '', phone: '', reference: '', cepLoading: false, cepError: '' }
}

function clientAddressRowFrom(address: ClientAddress): ClientAddressRow {
  return {
    key: ++clientAddressRowKey,
    id: address.id,
    description: address.description ?? '',
    street: address.street ?? '',
    complement: address.complement ?? '',
    district: address.district ?? '',
    city: address.city ?? '',
    state: address.state ?? '',
    zipCode: formatCep(address.zipCode),
    map: address.map ?? '',
    accountName: address.accountName ?? '',
    phone: address.phone ?? '',
    reference: address.reference ?? '',
    cepLoading: false,
    cepError: '',
  }
}

const sortOptions: { value: '' | ClientListSortBy; label: string }[] = [
  { value: '', label: 'Ativos primeiro' },
  { value: 'NAME', label: 'Razão social' },
  { value: 'STATUS', label: 'Situação cadastral' },
  { value: 'SERVICE_ORDER_COUNT', label: 'Quantidade de OS' },
  { value: 'TOTAL_VALUE', label: 'Valor das OS' },
]

function textValue(data: FormData, field: string) {
  return String(data.get(field) ?? '').trim()
}

function nullableNumber(data: FormData, field: string) {
  const value = textValue(data, field)
  return value === '' ? null : Number(value)
}

function blankToNull(value: string) {
  return value.trim() || null
}

function localDateTimeNow() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 19)
}

function flagIsOn(value?: string | null) {
  return ['1', 'S', 'SIM', 'TRUE'].includes(value?.toUpperCase() ?? '')
}

function yesNo(value?: string | null) {
  return flagIsOn(value) ? 'Sim' : 'Não'
}

function formatCep(value?: string | null) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

function addressFieldsFrom(client?: Client | null): AddressFields {
  return {
    nrcep: formatCep(client?.nrcep),
    dsender: client?.dsender ?? client?.address ?? '',
    dscompl: client?.dscompl ?? '',
    dsbairr: client?.dsbairr ?? '',
    dscidad: client?.dscidad ?? client?.city ?? '',
    dsestad: client?.dsestad ?? '',
    dsponto: client?.dsponto ?? '',
  }
}

export function Clients() {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()
  const { navigate } = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('TODOS')
  const [sortBy, setSortBy] = useState<'' | ClientListSortBy>('')
  const [direction, setDirection] = useState<SortDirection>('ASC')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<Client | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null)
  const [toast, setToast] = useState('')
  const [formError, setFormError] = useState('')
  const [addressFields, setAddressFields] = useState<AddressFields>(emptyAddressFields)
  const [additionalAddresses, setAdditionalAddresses] = useState<ClientAddressRow[]>([])
  const [cepLookupValue, setCepLookupValue] = useState<string | null>(null)
  const debouncedSearch = useDebouncedValue(search)

  const clientsQuery = useQuery({
    queryKey: [...queryKeys.clients, 'list', debouncedSearch, statusFilter, sortBy, direction, page, pageSize],
    queryFn: () => api.clients.list({
      query: debouncedSearch || undefined,
      status: statusFilter === 'TODOS' ? undefined : statusFilter,
      sortBy: sortBy || undefined,
      direction: sortBy ? direction : undefined,
      page,
      size: pageSize,
    }),
    placeholderData: keepPreviousData,
  })

  const detailQuery = useQuery({
    queryKey: [...queryKeys.clients, 'detail', detailId],
    queryFn: () => api.clients.find(detailId as number),
    enabled: detailId !== null,
  })

  const editContractsQuery = useQuery({
    queryKey: [...queryKeys.contracts, 'client', selected?.id],
    queryFn: () => api.contracts.byClient(selected?.id as number, { page: 0, size: 20 }),
    enabled: modalOpen && selected !== null,
  })

  const cepQuery = useQuery({
    queryKey: [...queryKeys.addresses, 'cep', cepLookupValue],
    queryFn: () => api.addresses.findByCep(cepLookupValue as string),
    enabled: modalOpen && cepLookupValue !== null,
    retry: false,
  })

  useEffect(() => {
    const totalPages = clientsQuery.data?.totalPages ?? 0
    if (totalPages > 0 && page >= totalPages) setPage(totalPages - 1)
  }, [clientsQuery.data?.totalPages, page])

  useEffect(() => {
    if (!cepLookupValue || !cepQuery.data) return
    setAddressFields((current) => {
      if (current.nrcep.replace(/\D/g, '') !== cepLookupValue) return current
      return {
        ...current,
        nrcep: formatCep(cepQuery.data.cep || cepLookupValue),
        dsender: cepQuery.data.logradouro ?? '',
        dscompl: cepQuery.data.complemento ?? '',
        dsbairr: cepQuery.data.bairro ?? '',
        dscidad: cepQuery.data.localidade ?? '',
        dsestad: (cepQuery.data.uf ?? '').toUpperCase(),
      }
    })
  }, [cepLookupValue, cepQuery.data])

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: ClientPayload }) => id ? api.clients.update(id, payload) : api.clients.create(payload),
    onSuccess: (savedClient, variables) => {
      const isUpdate = Boolean(variables.id)
      setModalOpen(false)
      setSelected(null)

      if (isUpdate) {
        setDetailId(null)
        showToast(`Cadastro de ${savedClient.name || `cliente #${savedClient.id}`} atualizado com sucesso.`)
      } else {
        const searchValue = savedClient.name?.trim() || savedClient.document?.trim() || ''
        queryClient.setQueryData([...queryKeys.clients, 'detail', savedClient.id], savedClient)
        setSearch(searchValue)
        setStatusFilter('TODOS')
        setSortBy('')
        setDirection('ASC')
        setPage(0)
        setDetailId(savedClient.id)
        showToast(`${savedClient.name || `Cliente #${savedClient.id}`} cadastrado com sucesso.`)
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.clients })
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.clients.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: [...queryKeys.clients, 'detail', id], exact: true })
    },
    onSuccess: (_, id) => {
      setClientToDelete(null)
      setDetailId(null)
      showToast('Cliente removido com sucesso.')
      queryClient.removeQueries({ queryKey: [...queryKeys.clients, 'detail', id], exact: true })
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === queryKeys.clients[0] && query.queryKey[1] !== 'detail',
      })
    },
    onError: (error) => showToast(apiErrorMessage(error)),
  })

  const clients = clientsQuery.data?.content ?? []
  const total = clientsQuery.data?.total ?? 0
  const totalPages = clientsQuery.data?.totalPages ?? 0
  const activeOnPage = clients.filter((client) => client.status === 'ATIVO').length
  const ordersOnPage = clients.reduce((sum, client) => sum + client.serviceOrderCount, 0)
  const valueOnPage = clients.reduce((sum, client) => sum + client.totalValue, 0)
  const contractsOnPage = clients.filter((client) => client.contract).length
  const firstResult = total === 0 ? 0 : page * pageSize + 1
  const lastResult = Math.min((page + 1) * pageSize, total)

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }

  function resetPage() {
    setPage(0)
  }

  function openNew() {
    setSelected(null)
    setAddressFields(emptyAddressFields)
    setAdditionalAddresses([])
    setCepLookupValue(null)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(client: Client) {
    setSelected(client)
    setAddressFields(addressFieldsFrom(client))
    setAdditionalAddresses((client.addresses ?? []).map(clientAddressRowFrom))
    setCepLookupValue(null)
    setDetailId(null)
    setFormError('')
    setModalOpen(true)
  }

  function updateAddressField(field: keyof AddressFields, value: string) {
    setAddressFields((current) => ({ ...current, [field]: value }))
  }

  function changeCep(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 8)
    updateAddressField('nrcep', formatCep(digits))
    setCepLookupValue(digits.length === 8 ? digits : null)
  }

  function updateAdditionalAddress(key: number, changes: Partial<ClientAddressRow>) {
    setAdditionalAddresses((addresses) => addresses.map((address) => address.key === key ? { ...address, ...changes } : address))
  }

  function changeAdditionalAddressCep(key: number, value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 8)
    updateAdditionalAddress(key, { zipCode: formatCep(digits), cepLoading: false, cepError: '' })
    if (digits.length === 8) void lookupAdditionalAddressCep(key, digits)
  }

  async function lookupAdditionalAddressCep(key: number, cep: string) {
    updateAdditionalAddress(key, { cepLoading: true, cepError: '' })
    try {
      const address = await api.addresses.findByCep(cep)
      setAdditionalAddresses((addresses) => addresses.map((current) => {
        if (current.key !== key || current.zipCode.replace(/\D/g, '') !== cep) return current
        return {
          ...current,
          zipCode: formatCep(address.cep || cep),
          street: address.logradouro ?? '',
          complement: address.complemento ?? '',
          district: address.bairro ?? '',
          city: address.localidade ?? '',
          state: (address.uf ?? '').toUpperCase(),
          cepLoading: false,
          cepError: '',
        }
      }))
    } catch (error) {
      setAdditionalAddresses((addresses) => addresses.map((current) => {
        if (current.key !== key || current.zipCode.replace(/\D/g, '') !== cep) return current
        return { ...current, cepLoading: false, cepError: apiErrorMessage(error) }
      }))
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const data = new FormData(event.currentTarget)
    const kind = String(data.get('kind')) as ClientKind
    const name = textValue(data, 'nmrazao')
    const cnpj = textValue(data, 'nrcnpj')
    const cpf = textValue(data, 'nrcpf')
    const document = kind === 'PESSOA_JURIDICA' ? cnpj : cpf
    const status = String(data.get('status')) as ClientStatus

    if (!document) {
      setFormError(`Informe o ${kind === 'PESSOA_JURIDICA' ? 'CNPJ' : 'CPF'} do cliente.`)
      return
    }

    const addresses: ClientAddressPayload[] = additionalAddresses.map((address) => ({
      ...(address.id == null ? {} : { id: address.id }),
      description: blankToNull(address.description),
      street: blankToNull(address.street),
      complement: blankToNull(address.complement),
      district: blankToNull(address.district),
      city: blankToNull(address.city),
      state: blankToNull(address.state.toUpperCase()),
      zipCode: blankToNull(address.zipCode.replace(/\D/g, '')),
      map: blankToNull(address.map),
      accountName: blankToNull(address.accountName),
      phone: blankToNull(address.phone),
      reference: blankToNull(address.reference),
    }))

    const payload: ClientPayload = {
      nmrazao: name,
      nmfanta: textValue(data, 'nmfanta'),
      flclien: kind === 'PESSOA_JURIDICA' ? 'J' : 'F',
      nrcnpj: kind === 'PESSOA_JURIDICA' ? cnpj : null,
      nrcpf: kind === 'PESSOA_FISICA' ? cpf : null,
      dsinscr: textValue(data, 'dsinscr'),
      dtanive: textValue(data, 'dtanive'),
      dtcadas: selected?.dtcadas ?? localDateTimeNow(),
      idusuar: selected?.idusuar ?? currentUser?.id ?? null,
      dsusuario: selected?.dsusuario || currentUser?.name || null,
      nrtele1: textValue(data, 'nrtele1'),
      nrtele2: textValue(data, 'nrtele2'),
      nrfax: textValue(data, 'nrfax'),
      dsemail: textValue(data, 'dsemail'),
      dsindic: textValue(data, 'dsindic'),
      idindic: nullableNumber(data, 'idindic'),
      idfunci: nullableNumber(data, 'idfunci'),
      nmcont1: textValue(data, 'nmcont1'),
      nrtelc1: textValue(data, 'nrtelc1'),
      nmcont2: textValue(data, 'nmcont2'),
      nrtelc2: textValue(data, 'nrtelc2'),
      nmcont3: textValue(data, 'nmcont3'),
      nrtelc3: textValue(data, 'nrtelc3'),
      nmcont4: textValue(data, 'nmcont4'),
      nrtelc4: textValue(data, 'nrtelc4'),
      dsender: textValue(data, 'dsender'),
      dscompl: textValue(data, 'dscompl'),
      dsbairr: textValue(data, 'dsbairr'),
      dscidad: textValue(data, 'dscidad'),
      dsestad: textValue(data, 'dsestad').toUpperCase(),
      nrcep: textValue(data, 'nrcep').replace(/\D/g, ''),
      dsponto: textValue(data, 'dsponto'),
      flaudit: textValue(data, 'flaudit'),
      fliss: textValue(data, 'fliss'),
      vliss: nullableNumber(data, 'vliss'),
      flinss: textValue(data, 'flinss'),
      vlinss: nullableNumber(data, 'vlinss'),
      flenvio: textValue(data, 'flenvio'),
      flaniv: textValue(data, 'flaniv'),
      flenvioboleto: textValue(data, 'flenvioboleto'),
      flenvioextrato: textValue(data, 'flenvioextrato'),
      dsobser: textValue(data, 'dsobser'),
      flstatu: status === 'INATIVO' ? 'N' : 'L',
      idtabel: selected?.idtabel ?? null,
      dtliber: selected?.dtliber ?? null,
      idliber: selected?.idliber ?? null,
      addresses,
    }
    saveMutation.mutate({ id: selected?.id, payload })
  }

  return (
    <>
      <PageHeader eyebrow="Relacionamento" title="Clientes" subtitle="Listagem paginada com situação, volume de serviços e valor acumulado." actions={<Button icon={<Plus size={18} />} onClick={openNew}>Novo cliente</Button>} />

      <section className="stats-grid stats-grid--four">
        <StatCard label="Ativos nesta página" value={String(activeOnPage)} helper={`${clients.length} clientes exibidos`} icon={<UsersRound />} tone="blue" />
        <StatCard label="Contratos nesta página" value={String(contractsOnPage)} helper="Cadastros com tabela vinculada" icon={<UserRoundCheck />} tone="purple" />
        <StatCard label="Ordens de serviço" value={String(ordersOnPage)} helper="Total dos clientes exibidos" icon={<Wrench />} tone="orange" />
        <StatCard label="Valor das OS" value={money(valueOnPage)} helper="Soma na página atual" icon={<CircleDollarSign />} tone="green" />
      </section>

      <section className="panel data-panel">
        <div className="data-toolbar data-toolbar--clients">
          <div className="search-box"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); resetPage() }} placeholder="Buscar por código, nome, nome fantasia, CPF ou CNPJ..." /></div>
          <div className="segmented-control" aria-label="Filtrar situação">{(['TODOS', 'ATIVO', 'INATIVO'] as const).map((item) => <button key={item} className={statusFilter === item ? 'active' : ''} onClick={() => { setStatusFilter(item); resetPage() }}>{item === 'TODOS' ? 'Todos' : item === 'ATIVO' ? 'Ativos' : 'Inativos'}</button>)}</div>
          <label className="toolbar-select"><span>Ordenar por</span><select value={sortBy} onChange={(event) => { setSortBy(event.target.value as '' | ClientListSortBy); resetPage() }}>{sortOptions.map((option) => <option key={option.value || 'default'} value={option.value}>{option.label}</option>)}</select></label>
          <label className="toolbar-select toolbar-select--compact"><span>Direção</span><select value={direction} disabled={!sortBy} onChange={(event) => { setDirection(event.target.value as SortDirection); resetPage() }}><option value="ASC">Crescente</option><option value="DESC">Decrescente</option></select></label>
        </div>

        {clientsQuery.isLoading ? <LoadingState label="Carregando clientes..." /> : clientsQuery.isError ? <ErrorState message={apiErrorMessage(clientsQuery.error)} onRetry={() => clientsQuery.refetch()} /> : clients.length === 0 ? <EmptyState title="Nenhum cliente encontrado" description="Altere os filtros ou cadastre um novo cliente." /> : (
          <div className={`table-wrap ${clientsQuery.isFetching ? 'table-wrap--refreshing' : ''}`}>
            <table className="data-table clients-table">
              <thead><tr><th>Nome fantasia</th><th>Razão social</th><th>Contato</th><th>Cidade</th><th>Contrato</th><th>Ordens de serviço</th><th>Valor das OS</th><th /></tr></thead>
              <tbody>{clients.map((client) => <tr key={client.id} onClick={() => setDetailId(client.id)}>
                <td><div className="entity-cell"><span className="entity-avatar"><Building2 size={18} /></span><span><strong>{client.tradeName || 'Não informado'}</strong><small>Código #{client.id}</small></span></div></td>
                <td><strong className="table-primary">{client.name || 'Sem razão social'}</strong><small className="table-secondary">{client.document || 'Documento não informado'} · {enumLabel(client.kind)}</small></td>
                <td><strong className="table-primary">{client.phone || 'Sem telefone'}</strong><small className="table-secondary">{client.email || 'Sem e-mail'}</small></td>
                <td>{client.city || 'Não informada'}</td>
                <td>{client.contract ? <Badge tone="blue">Contratado</Badge> : <span className="muted">Avulso</span>}</td>
                <td><strong>{client.serviceOrderCount.toLocaleString('pt-BR')}</strong></td>
                <td><strong>{money(client.totalValue)}</strong></td>
                <td><button className="row-action" onClick={(event) => { event.stopPropagation(); setDetailId(client.id) }} aria-label={`Abrir ${client.tradeName || client.name || `cliente #${client.id}`}`}><ChevronRight size={18} /></button></td>
              </tr>)}</tbody>
            </table>
          </div>
        )}

        <footer className="table-footer table-footer--pagination">
          <span>Mostrando <strong>{firstResult}–{lastResult}</strong> de <strong>{total}</strong> clientes</span>
          <div className="pagination-controls">
            <label>Por página <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); resetPage() }}><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label>
            <button disabled={page === 0 || clientsQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button>
            <span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span>
            <button disabled={page + 1 >= totalPages || clientsQuery.isFetching} onClick={() => setPage((value) => value + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button>
          </div>
        </footer>
      </section>

      <Modal open={modalOpen} onClose={() => !saveMutation.isPending && setModalOpen(false)} title={selected ? 'Editar cliente' : 'Novo cliente'} description="Dados cadastrais, contatos, endereço, tributação e preferências de envio." size="large">
        <ModalForm onSubmit={submit} onCancel={() => setModalOpen(false)} submitting={saveMutation.isPending} submitLabel={saveMutation.isPending ? 'Salvando...' : selected ? 'Salvar alterações' : 'Cadastrar cliente'}>
          <FormError message={formError} />
          <div className="form-section-title"><span>1</span><div><strong>Dados cadastrais</strong><small>Identificação conforme a tabela de clientes</small></div></div>
          <div className="form-grid form-grid--two">
            <FormField label="Código"><input readOnly value={selected?.id ?? 'Gerado ao salvar'} /></FormField>
            <FormField label="Usuário responsável"><input readOnly value={selected?.dsusuario || currentUser?.name || 'Usuário autenticado'} /></FormField>
            <FormField label="Tipo de pessoa"><select name="kind" defaultValue={selected?.kind || 'PESSOA_JURIDICA'}><option value="PESSOA_JURIDICA">Pessoa jurídica</option><option value="PESSOA_FISICA">Pessoa física</option></select></FormField>
            <FormField label="Situação"><select name="status" defaultValue={selected?.status || 'ATIVO'}><option value="ATIVO">Ativo</option><option value="INATIVO">Inativo</option></select></FormField>
            <FormField label="Razão social / Nome"><input name="nmrazao" required maxLength={100} defaultValue={selected?.nmrazao ?? selected?.name ?? ''} /></FormField>
            <FormField label="Fantasia / Apelido"><input name="nmfanta" maxLength={100} defaultValue={selected?.nmfanta ?? ''} /></FormField>
            <FormField label="CNPJ" hint="Obrigatório para pessoa jurídica"><input name="nrcnpj" maxLength={20} defaultValue={selected?.nrcnpj ?? (selected?.kind === 'PESSOA_JURIDICA' ? selected.document ?? '' : '')} /></FormField>
            <FormField label="CPF" hint="Obrigatório para pessoa física"><input name="nrcpf" maxLength={15} defaultValue={selected?.nrcpf ?? (selected?.kind === 'PESSOA_FISICA' ? selected.document ?? '' : '')} /></FormField>
            <FormField label="RG / Inscrição estadual"><input name="dsinscr" maxLength={30} defaultValue={selected?.dsinscr ?? ''} /></FormField>
            <FormField label="Data de aniversário" hint="Formato usado no legado: DD/MM"><input name="dtanive" inputMode="numeric" maxLength={7} placeholder="DD/MM" defaultValue={selected?.dtanive ?? ''} /></FormField>
          </div>

          <div className="form-section-title"><span>2</span><div><strong>Telefones e contatos</strong><small>Contato principal, indicação e pessoas de referência</small></div></div>
          <div className="form-grid form-grid--three">
            <FormField label="Telefone"><input name="nrtele1" maxLength={15} defaultValue={selected?.nrtele1 ?? selected?.phone ?? ''} /></FormField>
            <FormField label="Celular"><input name="nrtele2" maxLength={15} defaultValue={selected?.nrtele2 ?? ''} /></FormField>
            <FormField label="Fax"><input name="nrfax" maxLength={15} defaultValue={selected?.nrfax ?? ''} /></FormField>
          </div>
          <div className="form-grid form-grid--two form-grid--spaced">
            <FormField label="E-mail"><input name="dsemail" type="email" maxLength={50} defaultValue={selected?.dsemail ?? selected?.email ?? ''} /></FormField>
            <FormField label="Indicado por"><input name="dsindic" maxLength={50} defaultValue={selected?.dsindic ?? ''} /></FormField>
            <FormField label="Código do indicador"><input name="idindic" type="number" min="0" defaultValue={selected?.idindic ?? ''} /></FormField>
            <FormField label="Código do promotor de vendas"><input name="idfunci" type="number" min="0" defaultValue={selected?.idfunci ?? ''} /></FormField>
          </div>
          <div className="form-grid form-grid--two form-grid--spaced">
            <FormField label="Contato 1 (nome)"><input name="nmcont1" maxLength={50} defaultValue={selected?.nmcont1 ?? ''} /></FormField>
            <FormField label="Fone do contato 1"><input name="nrtelc1" maxLength={50} defaultValue={selected?.nrtelc1 ?? ''} /></FormField>
            <FormField label="Contato 2 (nome)"><input name="nmcont2" maxLength={50} defaultValue={selected?.nmcont2 ?? ''} /></FormField>
            <FormField label="Fone do contato 2"><input name="nrtelc2" maxLength={50} defaultValue={selected?.nrtelc2 ?? ''} /></FormField>
            <FormField label="Contato 3 (nome)"><input name="nmcont3" maxLength={50} defaultValue={selected?.nmcont3 ?? ''} /></FormField>
            <FormField label="Fone do contato 3"><input name="nrtelc3" maxLength={50} defaultValue={selected?.nrtelc3 ?? ''} /></FormField>
            <FormField label="Contato 4 (nome)"><input name="nmcont4" maxLength={50} defaultValue={selected?.nmcont4 ?? ''} /></FormField>
            <FormField label="Fone do contato 4"><input name="nrtelc4" maxLength={50} defaultValue={selected?.nrtelc4 ?? ''} /></FormField>
          </div>

          {/* <div className="form-section-title form-section-title--with-action"><span>3</span><div><strong>Endereços do cliente</strong><small>Endereço de cobrança principal e locais adicionais</small></div><button type="button" className="section-add-button" onClick={() => setAdditionalAddresses((addresses) => [...addresses, emptyClientAddressRow()])}><Plus size={15} />Adicionar endereço</button></div> */}
          <div className="primary-address-label"><strong>Endereço de cobrança principal</strong><small>Utilizado no cadastro principal do cliente</small></div>
          {cepLookupValue && cepQuery.isError && <FormError message={apiErrorMessage(cepQuery.error)} />}
          <div className="form-grid form-grid--two">
            <FormField label="CEP" hint={cepQuery.isFetching ? 'Consultando endereço...' : cepLookupValue && cepQuery.isSuccess ? 'Endereço encontrado e preenchido.' : 'Digite os 8 números do CEP.'}><div className="cep-input-control"><input name="nrcep" inputMode="numeric" autoComplete="postal-code" maxLength={9} value={addressFields.nrcep} onChange={(event) => changeCep(event.target.value)} placeholder="00000-000" />{cepQuery.isFetching && <RefreshCw className="api-state__spinner" size={16} />}</div></FormField>
            <FormField label="Endereço"><input name="dsender" maxLength={200} autoComplete="street-address" value={addressFields.dsender} onChange={(event) => updateAddressField('dsender', event.target.value)} /></FormField>
            <FormField label="Complemento"><input name="dscompl" maxLength={100} value={addressFields.dscompl} onChange={(event) => updateAddressField('dscompl', event.target.value)} /></FormField>
            <FormField label="Bairro"><input name="dsbairr" maxLength={100} value={addressFields.dsbairr} onChange={(event) => updateAddressField('dsbairr', event.target.value)} /></FormField>
            <FormField label="Cidade"><input name="dscidad" maxLength={100} autoComplete="address-level2" value={addressFields.dscidad} onChange={(event) => updateAddressField('dscidad', event.target.value)} /></FormField>
            <FormField label="UF"><input name="dsestad" maxLength={2} autoComplete="address-level1" value={addressFields.dsestad} onChange={(event) => updateAddressField('dsestad', event.target.value.toUpperCase())} /></FormField>
            <FormField label="Ponto de referência"><input name="dsponto" maxLength={200} value={addressFields.dsponto} onChange={(event) => updateAddressField('dsponto', event.target.value)} /></FormField>
          </div>
{/* 
          {additionalAddresses.length === 0 ? <div className="additional-addresses-empty"><FileSignature size={18} /><span>Nenhum endereço adicional. Clique em “Adicionar endereço” para incluir um local.</span></div> : <div className="additional-address-list">{additionalAddresses.map((address, index) => <article className="additional-address-card" key={address.key}>
            <header><div><span>Endereço adicional {index + 1}</span><strong>{address.description || 'Novo local'}{address.id != null ? ` · código #${address.id}` : ''}</strong></div><button type="button" onClick={() => setAdditionalAddresses((addresses) => addresses.filter((item) => item.key !== address.key))} aria-label={`Remover endereço adicional ${index + 1}`}><Trash2 size={16} /></button></header>
            {address.cepError && <FormError message={address.cepError} />}
            <div className="client-address-fields">
              <FormField label="Descrição do local"><input required maxLength={100} value={address.description} onChange={(event) => updateAdditionalAddress(address.key, { description: event.target.value })} placeholder="Ex.: Residência, filial ou condomínio" /></FormField>
              <FormField label="CEP" hint={address.cepLoading ? 'Consultando endereço...' : 'Digite os 8 números do CEP.'}><div className="cep-input-control"><input inputMode="numeric" maxLength={9} value={address.zipCode} onChange={(event) => changeAdditionalAddressCep(address.key, event.target.value)} placeholder="00000-000" />{address.cepLoading && <RefreshCw className="api-state__spinner" size={16} />}</div></FormField>
              <FormField label="Nome da conta / contato"><input maxLength={200} value={address.accountName} onChange={(event) => updateAdditionalAddress(address.key, { accountName: event.target.value })} /></FormField>
              <FormField label="Endereço"><input required maxLength={300} value={address.street} onChange={(event) => updateAdditionalAddress(address.key, { street: event.target.value })} /></FormField>
              <FormField label="Complemento"><input maxLength={100} value={address.complement} onChange={(event) => updateAdditionalAddress(address.key, { complement: event.target.value })} /></FormField>
              <FormField label="Bairro"><input maxLength={50} value={address.district} onChange={(event) => updateAdditionalAddress(address.key, { district: event.target.value })} /></FormField>
              <FormField label="Cidade"><input maxLength={50} value={address.city} onChange={(event) => updateAdditionalAddress(address.key, { city: event.target.value })} /></FormField>
              <FormField label="UF"><input maxLength={2} value={address.state} onChange={(event) => updateAdditionalAddress(address.key, { state: event.target.value.toUpperCase() })} /></FormField>
              <FormField label="Telefone"><input maxLength={50} value={address.phone} onChange={(event) => updateAdditionalAddress(address.key, { phone: event.target.value })} /></FormField>
              <FormField label="Mapa"><input maxLength={50} value={address.map} onChange={(event) => updateAdditionalAddress(address.key, { map: event.target.value })} placeholder="Código ou referência do mapa" /></FormField>
              <FormField label="Ponto de referência"><textarea rows={2} maxLength={300} value={address.reference} onChange={(event) => updateAdditionalAddress(address.key, { reference: event.target.value })} /></FormField>
            </div>
          </article>)}</div>} */}

          <div className="form-section-title"><span>4</span><div><strong>Tributação</strong><small>Auditoria e retenções do cadastro legado</small></div></div>
          <div className="form-grid form-grid--three">
            <FormField label="Auditado"><select name="flaudit" defaultValue={flagIsOn(selected?.flaudit) ? '1' : '0'}><option value="0">Não</option><option value="1">Sim</option></select></FormField>
            <FormField label="Retém ISS"><select name="fliss" defaultValue={flagIsOn(selected?.fliss) ? '1' : '0'}><option value="0">Não</option><option value="1">Sim</option></select></FormField>
            <FormField label="Valor / alíquota de ISS"><input name="vliss" type="number" min="0" step="0.01" defaultValue={selected?.vliss ?? ''} /></FormField>
            <FormField label="Retém INSS"><select name="flinss" defaultValue={flagIsOn(selected?.flinss) ? '1' : '0'}><option value="0">Não</option><option value="1">Sim</option></select></FormField>
            <FormField label="Valor / alíquota de INSS"><input name="vlinss" type="number" min="0" step="0.01" defaultValue={selected?.vlinss ?? ''} /></FormField>
          </div>

          <div className="form-section-title"><span>5</span><div><strong>Preferências de envio</strong><small>Boleto, extrato e comunicações</small></div></div>
          <div className="form-grid form-grid--two">
            <FormField label="Envios habilitados"><select name="flenvio" defaultValue={selected?.flenvio || 'N'}><option value="N">Não</option><option value="S">Sim</option></select></FormField>
            <FormField label="Enviar felicitação de aniversário"><select name="flaniv" defaultValue={selected?.flaniv || 'N'}><option value="N">Não</option><option value="S">Sim</option></select></FormField>
            <FormField label="Tipo de envio do boleto"><select name="flenvioboleto" defaultValue={selected?.flenvioboleto || 'E-mail'}><option value="E-mail">E-mail</option><option value="Cobrança">Cobrança</option></select></FormField>
            <FormField label="Envio de extrato"><select name="flenvioextrato" defaultValue={selected?.flenvioextrato || 'NÃO'}><option value="NÃO">Não</option><option value="SIM">Sim</option></select></FormField>
          </div>

          <div className="form-section-title"><span>6</span><div><strong>Observações</strong><small>Informações complementares do cliente</small></div></div>
          <FormField label="Observações"><textarea name="dsobser" rows={5} defaultValue={selected?.dsobser ?? ''} /></FormField>
          <div className="client-form-contracts">
            <header><span className="client-form-contracts__icon"><FileSignature size={18} /></span><div><strong>Contratos do cliente</strong><small>{selected ? 'Dados consultados diretamente no módulo de contratos' : 'Disponível após salvar o cadastro do cliente'}</small></div>{selected && <Button type="button" variant="secondary" icon={<ArrowUpRight size={15} />} onClick={() => { setModalOpen(false); navigate(`/contratos?clientId=${selected.id}`) }}>Gerenciar contratos</Button>}</header>
            {!selected ? <div className="client-form-contracts__empty"><span>Salve o cliente primeiro para cadastrar e vincular contratos.</span></div> : editContractsQuery.isLoading ? <div className="client-form-contracts__state"><RefreshCw className="api-state__spinner" size={17} /><span>Carregando contratos completos...</span></div> : editContractsQuery.isError ? <div className="client-form-contracts__state client-form-contracts__state--error"><span>Não foi possível consultar os contratos.</span><button type="button" onClick={() => editContractsQuery.refetch()}>Tentar novamente</button></div> : (editContractsQuery.data?.content.length ?? 0) === 0 ? <div className="client-form-contracts__empty"><span>Nenhum contrato cadastrado para este cliente.</span><button type="button" onClick={() => { setModalOpen(false); navigate(`/contratos?clientId=${selected.id}`) }}>Cadastrar contrato <ArrowUpRight size={14} /></button></div> : <div className="client-form-contracts__list">{editContractsQuery.data?.content.map((contract) => <article key={contract.id}><span className="client-form-contracts__number">#{contract.id}</span><div><strong>Contrato {contract.id}</strong><small>Início {formatDate(contract.contractDate)} · renovação {formatDate(contract.renewalDate)} · {contract.services?.length ?? 0} serviços</small></div><span><small>Vencimento</small><strong>{contract.dueDay ? `Dia ${contract.dueDay}` : 'Não informado'}</strong></span><span><small>Adesão</small><strong>{money(contract.adhesionFee)}</strong></span><Badge tone={contract.status === 'ATIVO' ? 'green' : 'neutral'}>{enumLabel(contract.status)}</Badge></article>)}</div>}
          </div>
        </ModalForm>
      </Modal>

      <DetailModal
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        title={detailQuery.data ? `Cliente #${detailQuery.data.id} · ${detailQuery.data.name || detailQuery.data.nmfanta}` : 'Detalhes do cliente'}
        description="Cadastro completo, contatos, endereço, preferências e histórico contratual."
        size="xlarge"
        actions={detailQuery.data ? <><Button variant="danger" icon={<Trash2 size={17} />} disabled={deleteMutation.isPending} onClick={() => setClientToDelete(detailQuery.data)}>Excluir</Button><Button icon={<Edit3 size={17} />} onClick={() => openEdit(detailQuery.data)}>Editar cadastro</Button></> : undefined}
      >
        {detailQuery.isLoading ? <LoadingState label="Carregando cadastro completo..." /> : detailQuery.isError ? <ErrorState message={apiErrorMessage(detailQuery.error)} onRetry={() => detailQuery.refetch()} /> : detailQuery.data ? <ClientDetail client={detailQuery.data} /> : null}
      </DetailModal>

      <ConfirmDialog
        open={Boolean(clientToDelete)}
        title={`Excluir ${clientToDelete?.name || 'este cliente'}?`}
        description="O cadastro será removido permanentemente. Esta ação não poderá ser desfeita."
        confirmLabel="Excluir cliente"
        busy={deleteMutation.isPending}
        onCancel={() => setClientToDelete(null)}
        onConfirm={() => clientToDelete && !deleteMutation.isPending && deleteMutation.mutate(clientToDelete.id)}
      />

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </>
  )
}

function ClientDetail({ client }: { client: Client }) {
  const { navigate } = useRouter()
  const contractsQuery = useQuery({
    queryKey: [...queryKeys.contracts, 'client', client.id],
    queryFn: () => api.contracts.byClient(client.id, { page: 0, size: 10 }),
  })

  return <div className="detail-modal-content">
    <div className="detail-modal__hero-row"><div className="detail-drawer__hero"><span className="detail-avatar"><Building2 /></span><div><span>Cliente #{client.id}</span>
      
    <h2>{client.nmfanta || client.name ||'Sem nome'}</h2><p>{client.document || 'Documento não informado'}</p></div></div></div>
    <div className="detail-metrics"><span><small>Tipo de pessoa</small><strong>{enumLabel(client.kind)}</strong></span><span><small>Fantasia / Apelido</small><strong>{client.nmfanta || 'Não informado'}</strong></span><span><small>Data de cadastro</small><strong>{formatDate(client.dtcadas, true)}</strong></span><span><small>Usuário responsável</small><strong>{client.dsusuario || 'Não informado'}</strong></span></div>
    <div className="detail-sections-grid">
    <section className="drawer-section"><h3>Documentos e contato principal</h3><dl>
      <div><dt>CNPJ</dt><dd>{client.nrcnpj || 'Não informado'}</dd></div>
      <div><dt>CPF</dt><dd>{client.nrcpf || 'Não informado'}</dd></div>
      <div><dt>RG / Inscrição estadual</dt><dd>{client.dsinscr || 'Não informado'}</dd></div>
      <div><dt>Aniversário</dt><dd>{client.dtanive || 'Não informado'}</dd></div>
      <div><dt>E-mail</dt><dd>{client.email || 'Não informado'}</dd></div>
      <div><dt>Telefone</dt><dd>{client.phone || 'Não informado'}</dd></div>
      <div><dt>Celular</dt><dd>{client.nrtele2 || 'Não informado'}</dd></div>
      <div><dt>Fax</dt><dd>{client.nrfax || 'Não informado'}</dd></div>
      <div><dt>Indicado por</dt><dd>{client.dsindic || 'Não informado'}</dd></div>
    </dl></section>
    <section className="drawer-section"><h3>Pessoas de contato</h3><dl>
      <div><dt>{client.nmcont1 || 'Contato 1'}</dt><dd>{client.nrtelc1 || 'Sem telefone'}</dd></div>
      <div><dt>{client.nmcont2 || 'Contato 2'}</dt><dd>{client.nrtelc2 || 'Sem telefone'}</dd></div>
      <div><dt>{client.nmcont3 || 'Contato 3'}</dt><dd>{client.nrtelc3 || 'Sem telefone'}</dd></div>
      <div><dt>{client.nmcont4 || 'Contato 4'}</dt><dd>{client.nrtelc4 || 'Sem telefone'}</dd></div>
    </dl></section>
    <section className="drawer-section"><h3>Endereço de cobrança</h3><dl>
      <div><dt>Endereço</dt><dd>{client.address || 'Não informado'}</dd></div>
      <div><dt>Complemento</dt><dd>{client.dscompl || 'Não informado'}</dd></div>
      <div><dt>Bairro</dt><dd>{client.dsbairr || 'Não informado'}</dd></div>
      <div><dt>Cidade / UF</dt><dd>{[client.city, client.dsestad].filter(Boolean).join(' / ') || 'Não informado'}</dd></div>
      <div><dt>CEP</dt><dd>{formatCep(client.nrcep) || 'Não informado'}</dd></div>
      <div><dt>Ponto de referência</dt><dd>{client.dsponto || 'Não informado'}</dd></div>
    </dl></section>
    <section className="drawer-section"><h3>Tributação e envios</h3><dl>
      <div><dt>Auditado</dt><dd>{yesNo(client.flaudit)}</dd></div>
      <div><dt>Retém ISS</dt><dd>{yesNo(client.fliss)}{client.vliss != null ? ` · ${money(client.vliss)}` : ''}</dd></div>
      <div><dt>Retém INSS</dt><dd>{yesNo(client.flinss)}{client.vlinss != null ? ` · ${money(client.vlinss)}` : ''}</dd></div>
      <div><dt>Envio de boleto</dt><dd>{client.flenvioboleto || 'Não informado'}</dd></div>
      <div><dt>Envio de extrato</dt><dd>{client.flenvioextrato || 'Não informado'}</dd></div>
      <div><dt>Comunicações habilitadas</dt><dd>{yesNo(client.flenvio)}</dd></div>
    </dl></section>
    {/* <section className="drawer-section drawer-section--wide"><div className="drawer-section__heading"><h3>Locais e endereços adicionais</h3><span>{client.addresses?.length ?? 0}</span></div>
      {(client.addresses?.length ?? 0) === 0 ? <p className="drawer-section__text">Nenhum endereço adicional vinculado a este cliente.</p> : <div className="client-address-detail-list">{client.addresses?.map((address, index) => <article key={address.id}>
        <header><span className="client-address-detail-list__number">{index + 1}</span><div><strong>{address.description || `Endereço ${index + 1}`}</strong><small>Código #{address.id}</small></div></header>
        <p>{[address.street, address.complement, address.district].filter(Boolean).join(' · ') || 'Endereço não informado'}</p>
        <div className="client-address-detail-list__meta">
          <span><small>Cidade / UF</small><strong>{[address.city, address.state].filter(Boolean).join(' / ') || 'Não informado'}</strong></span>
          <span><small>CEP</small><strong>{formatCep(address.zipCode) || 'Não informado'}</strong></span>
          <span><small>Conta / contato</small><strong>{address.accountName || 'Não informado'}</strong></span>
          <span><small>Telefone</small><strong>{address.phone || 'Não informado'}</strong></span>
        </div>
        {(address.reference || address.map) && <footer>{address.reference && <span><small>Referência</small><strong>{address.reference}</strong></span>}{address.map && <span><small>Mapa</small><strong>{address.map}</strong></span>}</footer>}
      </article>)}</div>}
    </section> */}
    {client.dsobser && <section className="drawer-section drawer-section--wide"><h3>Observações</h3><p className="drawer-section__text">{client.dsobser}</p></section>}
    <section className="drawer-section drawer-section--contract drawer-section--wide"><h3>Contratos</h3>
      {contractsQuery.isLoading ? <p className="drawer-section__text">Consultando histórico...</p> : contractsQuery.isError ? <p className="drawer-section__text">Não foi possível consultar os contratos deste cliente.</p> : (contractsQuery.data?.content.length ?? 0) === 0 ? <p className="drawer-section__text">Nenhum contrato cadastrado para este cliente.</p> : <div className="client-contract-history">{contractsQuery.data?.content.map((contract) => <article key={contract.id}><span><strong>Contrato #{contract.id}</strong><small>{formatDate(contract.contractDate)} · renovação {formatDate(contract.renewalDate)}</small></span><Badge tone={contract.status === 'ATIVO' ? 'green' : 'neutral'}>{enumLabel(contract.status)}</Badge></article>)}</div>}
      <button className="drawer-section__action" onClick={() => navigate(`/contratos?clientId=${client.id}`)}>Abrir contratos deste cliente <ChevronRight size={15} /></button>
    </section>
    </div>
  </div>
}
