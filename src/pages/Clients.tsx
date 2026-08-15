import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, CalendarClock, ChevronRight, Clock3, Edit3, FilePenLine, Plus, Search, Trash2, UserRoundCheck, UsersRound } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { enumLabel, formatDate, money } from '../lib/format'
import type { Client, ClientKind, ClientPayload, ClientStatus, DueDay } from '../types'
import { Badge, Button, EmptyState, ErrorState, FormError, FormField, LoadingState, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'

type ClientFilter = 'Todos' | 'Contratos' | 'Avulsos' | 'Atenção'

export function Clients() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ClientFilter>('Todos')
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<Client | null>(null)
  const [detail, setDetail] = useState<Client | null>(null)
  const [toast, setToast] = useState('')
  const [formError, setFormError] = useState('')
  const debouncedSearch = useDebouncedValue(search)

  const clientsQuery = useQuery({
    queryKey: [...queryKeys.clients, debouncedSearch],
    queryFn: () => api.clients.list({ query: debouncedSearch || undefined }),
  })

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: ClientPayload }) => id ? api.clients.update(id, payload) : api.clients.create(payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.clients })
      setModalOpen(false)
      setSelected(null)
      showToast(variables.id ? 'Cadastro do cliente atualizado.' : 'Cliente cadastrado com sucesso.')
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.clients.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.clients })
      setDetail(null)
      showToast('Cliente removido com sucesso.')
    },
    onError: (error) => showToast(apiErrorMessage(error)),
  })

  const clients = clientsQuery.data?.content ?? []
  const filtered = useMemo(() => clients.filter((client) => (
    filter === 'Todos' ||
    (filter === 'Contratos' && client.contract) ||
    (filter === 'Avulsos' && !client.contract) ||
    (filter === 'Atenção' && client.status === 'ATENCAO')
  )), [clients, filter])

  const activeCount = clients.filter((client) => client.status === 'ATIVO').length
  const contractCount = clients.filter((client) => client.contract).length
  const contractedHours = clients.reduce((sum, client) => sum + Number(client.contractedHours ?? 0), 0)
  const monthlyTotal = clients.reduce((sum, client) => sum + Number(client.monthly ?? 0), 0)

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }

  function openNew() {
    setSelected(null)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(client: Client) {
    setSelected(client)
    setDetail(null)
    setFormError('')
    setModalOpen(true)
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const data = new FormData(event.currentTarget)
    const contract = data.get('contract') === 'true'
    const kind = String(data.get('kind')) as ClientKind
    const document = String(data.get('document')).trim()
    const payload: ClientPayload = {
      ...(selected ?? {}),
      name: String(data.get('name')).trim(),
      kind,
      document,
      email: String(data.get('email')).trim(),
      phone: String(data.get('phone')).trim(),
      address: String(data.get('address')).trim(),
      city: String(data.get('city')).trim(),
      dsbairr: String(data.get('district')).trim(),
      dsestad: String(data.get('state')).trim().toUpperCase(),
      nrcep: String(data.get('zipCode')).replace(/\D/g, ''),
      dscompl: String(data.get('complement')).trim(),
      dsobser: String(data.get('notes')).trim(),
      channel: String(data.get('channel')),
      status: String(data.get('status')) as ClientStatus,
      contract,
      idtabel: contract ? (selected?.idtabel || 1) : null,
      contractNumber: contract ? String(data.get('contractNumber')).trim() : null,
      plan: contract ? String(data.get('plan')).trim() : null,
      dueDay: contract ? String(data.get('dueDay')) as DueDay : 'SOB_DEMANDA',
      monthly: Number(data.get('monthly') || 0),
      contractedHours: Number(data.get('contractedHours') || 0),
      hourValue: Number(data.get('hourValue') || 0),
      nrcnpj: kind === 'PESSOA_JURIDICA' ? document : null,
      nrcpf: kind === 'PESSOA_FISICA' ? document : null,
      nmrazao: String(data.get('name')).trim(),
      dsemail: String(data.get('email')).trim(),
      nrtele1: String(data.get('phone')).trim(),
      dsender: String(data.get('address')).trim(),
      dscidad: String(data.get('city')).trim(),
      flclien: kind === 'PESSOA_JURIDICA' ? 'J' : 'F',
      flstatu: data.get('status') === 'INATIVO' ? 'N' : 'L',
    }
    saveMutation.mutate({ id: selected?.id, payload })
  }

  return (
    <>
      <PageHeader eyebrow="Relacionamento" title="Clientes" subtitle="Cadastros e informações comerciais sincronizados com a API." actions={<Button icon={<Plus size={18} />} onClick={openNew}>Novo cliente</Button>} />

      <section className="stats-grid stats-grid--four">
        <StatCard label="Clientes ativos" value={String(activeCount)} helper={`${contractCount} possuem contrato`} icon={<UsersRound />} tone="blue" />
        <StatCard label="Clientes em atenção" value={String(clients.filter((client) => client.status === 'ATENCAO').length)} helper="Exigem acompanhamento" icon={<CalendarClock />} tone="orange" />
        <StatCard label="Horas contratadas" value={`${contractedHours.toLocaleString('pt-BR')}h`} helper="No retorno atual da API" icon={<Clock3 />} tone="green" />
        <StatCard label="Receita recorrente" value={money(monthlyTotal)} helper="Mensalidades cadastradas" icon={<UserRoundCheck />} tone="purple" />
      </section>

      <section className="panel data-panel">
        <div className="data-toolbar">
          <div className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, código, CPF ou CNPJ..." /></div>
          <div className="segmented-control" aria-label="Filtrar clientes">{(['Todos', 'Contratos', 'Avulsos', 'Atenção'] as const).map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div>
        </div>

        {clientsQuery.isLoading ? <LoadingState label="Carregando clientes..." /> : clientsQuery.isError ? <ErrorState message={apiErrorMessage(clientsQuery.error)} onRetry={() => clientsQuery.refetch()} /> : filtered.length === 0 ? <EmptyState title="Nenhum cliente encontrado" description="Altere os filtros ou cadastre um novo cliente." /> : (
          <div className="table-wrap">
            <table className="data-table clients-table">
              <thead><tr><th>Cliente</th><th>Tipo</th><th>Contato</th><th>Localização</th><th>Contrato</th><th>Situação</th><th /></tr></thead>
              <tbody>{filtered.map((client) => (
                <tr key={client.id} onClick={() => setDetail(client)}>
                  <td><div className="entity-cell"><span className="entity-avatar"><Building2 size={18} /></span><span><strong>{client.name || 'Sem nome'}</strong><small>#{client.id} · {client.document || 'Documento não informado'}</small></span></div></td>
                  <td><strong className="table-primary">{enumLabel(client.kind)}</strong><small className="table-secondary">{client.channel || client.dsindic || 'Canal não informado'}</small></td>
                  <td><strong className="table-primary">{client.phone || 'Sem telefone'}</strong><small className="table-secondary">{client.email || 'Sem e-mail'}</small></td>
                  <td>{client.city || 'Não informada'}<small className="table-secondary">{client.dsestad || '—'}</small></td>
                  <td>{client.contract ? <Badge tone="blue">{client.plan || 'Contratado'}</Badge> : <span className="muted">Avulso</span>}</td>
                  <td><Badge tone={client.status === 'ATIVO' ? 'green' : client.status === 'ATENCAO' ? 'orange' : 'neutral'}>{enumLabel(client.status)}</Badge></td>
                  <td><button className="row-action" onClick={(event) => { event.stopPropagation(); setDetail(client) }} aria-label={`Abrir ${client.name}`}><ChevronRight size={18} /></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <footer className="table-footer"><span>Mostrando <strong>{filtered.length}</strong> de {clientsQuery.data?.total ?? 0} clientes</span><span>Dados da API</span></footer>
      </section>

      <Modal open={modalOpen} onClose={() => !saveMutation.isPending && setModalOpen(false)} title={selected ? 'Editar cliente' : 'Novo cliente'} description="Campos alinhados ao modelo Client do backend." size="large">
        <ModalForm onSubmit={submit} onCancel={() => setModalOpen(false)} submitting={saveMutation.isPending} submitLabel={saveMutation.isPending ? 'Salvando...' : selected ? 'Salvar alterações' : 'Cadastrar cliente'}>
          <FormError message={formError} />
          <div className="form-section-title"><span>1</span><div><strong>Dados cadastrais</strong><small>Identificação e contato</small></div></div>
          <div className="form-grid form-grid--two">
            <FormField label="Nome / Razão social"><input name="name" required defaultValue={selected?.name ?? ''} /></FormField>
            <FormField label="Tipo de pessoa"><select name="kind" defaultValue={selected?.kind || 'PESSOA_JURIDICA'}><option value="PESSOA_JURIDICA">Pessoa jurídica</option><option value="PESSOA_FISICA">Pessoa física</option></select></FormField>
            <FormField label="CPF / CNPJ"><input name="document" required defaultValue={selected?.document ?? ''} /></FormField>
            <FormField label="Telefone"><input name="phone" defaultValue={selected?.phone ?? ''} /></FormField>
            <FormField label="E-mail"><input name="email" type="email" defaultValue={selected?.email ?? ''} /></FormField>
            <FormField label="Canal / indicação"><input name="channel" defaultValue={selected?.channel ?? selected?.dsindic ?? ''} /></FormField>
            <FormField label="Situação"><select name="status" defaultValue={selected?.status || 'ATIVO'}><option value="ATIVO">Ativo</option><option value="ATENCAO">Atenção</option><option value="INATIVO">Inativo</option></select></FormField>
          </div>
          <div className="form-section-title"><span>2</span><div><strong>Endereço</strong><small>Localização principal do cliente</small></div></div>
          <div className="form-grid form-grid--two">
            <FormField label="Endereço"><input name="address" defaultValue={selected?.address ?? ''} /></FormField>
            <FormField label="Complemento"><input name="complement" defaultValue={selected?.dscompl ?? ''} /></FormField>
            <FormField label="Bairro"><input name="district" defaultValue={selected?.dsbairr ?? ''} /></FormField>
            <FormField label="Cidade"><input name="city" defaultValue={selected?.city ?? ''} /></FormField>
            <FormField label="UF"><input name="state" maxLength={2} defaultValue={selected?.dsestad ?? ''} /></FormField>
            <FormField label="CEP"><input name="zipCode" maxLength={9} defaultValue={selected?.nrcep ?? ''} /></FormField>
          </div>
          <div className="form-section-title"><span>3</span><div><strong>Contrato e cobrança</strong><small>Informações comerciais previstas pelo modelo</small></div></div>
          <div className="form-grid form-grid--four">
            <FormField label="Tipo"><select name="contract" defaultValue={String(selected?.contract ?? false)}><option value="false">Avulso</option><option value="true">Contratado</option></select></FormField>
            <FormField label="Número do contrato"><input name="contractNumber" defaultValue={selected?.contractNumber ?? ''} /></FormField>
            <FormField label="Plano"><input name="plan" defaultValue={selected?.plan ?? ''} /></FormField>
            <FormField label="Vencimento"><select name="dueDay" defaultValue={selected?.dueDay || 'SOB_DEMANDA'}><option value="DIA_10">Dia 10</option><option value="DIA_20">Dia 20</option><option value="SOB_DEMANDA">Sob demanda</option></select></FormField>
            <FormField label="Horas contratadas"><input name="contractedHours" type="number" min="0" step="0.1" defaultValue={selected?.contractedHours ?? 0} /></FormField>
            <FormField label="Mensalidade"><input name="monthly" type="number" min="0" step="0.01" defaultValue={selected?.monthly ?? 0} /></FormField>
            <FormField label="Valor da hora"><input name="hourValue" type="number" min="0" step="0.01" defaultValue={selected?.hourValue ?? 0} /></FormField>
          </div>
          <FormField label="Observações"><textarea name="notes" rows={3} defaultValue={selected?.dsobser ?? ''} /></FormField>
        </ModalForm>
      </Modal>

      {detail && (
        <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDetail(null)}>
          <aside className="detail-drawer">
            <header><button className="drawer-close" onClick={() => setDetail(null)}>Fechar</button><Badge tone={detail.status === 'ATIVO' ? 'green' : detail.status === 'ATENCAO' ? 'orange' : 'neutral'}>{enumLabel(detail.status)}</Badge></header>
            <div className="detail-drawer__hero"><span className="detail-avatar"><Building2 /></span><div><span>Cliente #{detail.id}</span><h2>{detail.name || 'Sem nome'}</h2><p>{detail.document || 'Documento não informado'}</p></div></div>
            <div className="detail-metrics"><span><small>Plano atual</small><strong>{detail.contract ? detail.plan || 'Contratado' : 'Avulso'}</strong></span><span><small>Mensalidade</small><strong>{money(detail.monthly)}</strong></span><span><small>Vencimento</small><strong>{enumLabel(detail.dueDay)}</strong></span><span><small>Último serviço</small><strong>{formatDate(detail.lastServiceAt, true)}</strong></span></div>
            <section className="drawer-section"><h3>Contato e endereço</h3><dl><div><dt>E-mail</dt><dd>{detail.email || 'Não informado'}</dd></div><div><dt>Telefone</dt><dd>{detail.phone || 'Não informado'}</dd></div><div><dt>Endereço</dt><dd>{detail.address || 'Não informado'}</dd></div><div><dt>Cidade / UF</dt><dd>{[detail.city, detail.dsestad].filter(Boolean).join(' / ') || 'Não informado'}</dd></div></dl></section>
            <footer><Button variant="danger" icon={<Trash2 size={17} />} disabled={deleteMutation.isPending} onClick={() => window.confirm(`Remover ${detail.name}?`) && deleteMutation.mutate(detail.id)}>Excluir</Button><Button icon={<Edit3 size={17} />} onClick={() => openEdit(detail)}>Editar cadastro</Button></footer>
          </aside>
        </div>
      )}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </>
  )
}
