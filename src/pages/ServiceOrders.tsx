import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, CheckCircle2, ChevronRight, CircleAlert, Clock3, Columns3, Edit3, List, MapPin, Plus, Search, Trash2, UserRound, Wrench } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { enumLabel, formatDate, money, toDateInput } from '../lib/format'
import type { Priority, ServiceCategory, ServiceOrder, ServiceOrderPayload, ServiceOrderStatus } from '../types'
import { Badge, Button, ConfirmDialog, DetailModal, EmptyState, ErrorState, FormError, FormField, LoadingState, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'

const stages: ServiceOrderStatus[] = ['ABERTA', 'ENCAMINHADA', 'AGENDADA', 'EM_ATENDIMENTO', 'FINALIZADA', 'CANCELADA']
const flowStages: ServiceOrderStatus[] = stages.filter((status) => status !== 'CANCELADA')

const statusTone: Record<ServiceOrderStatus, 'orange' | 'blue' | 'purple' | 'green' | 'neutral' | 'red'> = {
  ABERTA: 'orange', ENCAMINHADA: 'blue', AGENDADA: 'purple', EM_ATENDIMENTO: 'green', FINALIZADA: 'neutral', CANCELADA: 'red',
}

function orderPayload(order: ServiceOrder, overrides: Partial<ServiceOrderPayload> = {}): ServiceOrderPayload {
  const { id: _id, code: _code, client: _client, clientName: _clientName, ...persisted } = order
  const status = overrides.status ?? order.status
  const category = overrides.category ?? order.category
  const scheduledDate = overrides.scheduledDate ?? order.scheduledDate ?? toDateInput(order.dtordem)
  const scheduledTime = overrides.scheduledTime ?? order.scheduledTime
  const technician = overrides.technician ?? order.technician
  const location = overrides.location ?? order.location
  const service = overrides.service ?? order.service ?? ''
  const description = overrides.description ?? order.description
  return {
    ...persisted,
    idclien: order.idclien ?? order.client?.id ?? 0,
    ...overrides,
    service,
    tpservic: service,
    category,
    flcateg: category === 'ELETRICA' ? 'E' : 'M',
    scheduledDate,
    dtordem: `${scheduledDate}T00:00:00`,
    scheduledTime,
    hrabert: scheduledTime,
    technician,
    idopera: technician && /^\d+$/.test(technician) ? Number(technician) : null,
    location,
    idlocal: location && /^\d+$/.test(location) ? Number(location) : null,
    description,
    dsdescr: description,
    status,
    flstatu: status === 'FINALIZADA' ? 'F' : status === 'CANCELADA' ? 'C' : 'A',
  }
}

export function ServiceOrders() {
  const queryClient = useQueryClient()
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState<'Todas' | 'Urgentes'>('Todas')
  const [date, setDate] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<ServiceOrder | null>(null)
  const [detail, setDetail] = useState<ServiceOrder | null>(null)
  const [orderToDelete, setOrderToDelete] = useState<ServiceOrder | null>(null)
  const [toast, setToast] = useState('')
  const [formError, setFormError] = useState('')
  const debouncedSearch = useDebouncedValue(search)

  const ordersQuery = useQuery({
    queryKey: [...queryKeys.serviceOrders, debouncedSearch, date],
    queryFn: () => api.serviceOrders.list({ query: date ? undefined : debouncedSearch || undefined, date: date || undefined }),
  })
  const clientsQuery = useQuery({ queryKey: queryKeys.clients, queryFn: () => api.clients.list() })

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: ServiceOrderPayload }) => id ? api.serviceOrders.update(id, payload) : api.serviceOrders.create(payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.serviceOrders })
      setModalOpen(false)
      setSelected(null)
      showToast(variables.id ? 'Ordem de serviço atualizada.' : 'Ordem de serviço cadastrada.')
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })

  const advanceMutation = useMutation({
    mutationFn: ({ order, status }: { order: ServiceOrder; status: ServiceOrderStatus }) => api.serviceOrders.update(order.id, orderPayload(order, { status })),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.serviceOrders })
      showToast(`OS-${updated.id} avançou para “${enumLabel(updated.status)}”.`)
    },
    onError: (error) => showToast(apiErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.serviceOrders.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.serviceOrders })
      setOrderToDelete(null)
      setModalOpen(false)
      setDetail(null)
      showToast('Ordem de serviço removida.')
    },
    onError: (error) => { setOrderToDelete(null); showToast(apiErrorMessage(error)) },
  })

  const orders = ordersQuery.data?.content ?? []
  const filtered = useMemo(() => orders.filter((order) => {
    const matchesLocalSearch = date && debouncedSearch
      ? [order.code, order.clientName, order.service, order.technician].some((value) => value?.toLowerCase().includes(debouncedSearch.toLowerCase()))
      : true
    return matchesLocalSearch && (priority === 'Todas' || order.priority === 'URGENTE')
  }), [date, debouncedSearch, orders, priority])

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }

  function openNew() {
    setSelected(null)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(order: ServiceOrder) {
    setDetail(null)
    setSelected(order)
    setFormError('')
    setModalOpen(true)
  }

  function advance(order: ServiceOrder) {
    const currentIndex = flowStages.indexOf(order.status)
    if (currentIndex < 0 || currentIndex === flowStages.length - 1) return
    advanceMutation.mutate({ order, status: flowStages[currentIndex + 1] })
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const data = new FormData(event.currentTarget)
    const scheduledDate = String(data.get('date'))
    const scheduledTime = String(data.get('time')) || null
    const technician = String(data.get('technician')).trim()
    const location = String(data.get('location')).trim()
    const service = String(data.get('service')).trim()
    const category = String(data.get('category')) as ServiceCategory
    const description = String(data.get('description')).trim()
    const status = String(data.get('status')) as ServiceOrderStatus
    const base = selected ? orderPayload(selected) : {} as ServiceOrderPayload
    const payload: ServiceOrderPayload = {
      ...base,
      idclien: Number(data.get('idclien')),
      nmsolic: String(data.get('requester')).trim(),
      service,
      tpservic: service,
      category,
      flcateg: category === 'ELETRICA' ? 'E' : 'M',
      description,
      dsdescr: description,
      dsobser: String(data.get('notes')).trim(),
      location,
      idlocal: location && /^\d+$/.test(location) ? Number(location) : null,
      technician,
      idopera: technician && /^\d+$/.test(technician) ? Number(technician) : null,
      scheduledDate,
      dtordem: `${scheduledDate}T00:00:00`,
      scheduledTime,
      hrabert: scheduledTime,
      priority: String(data.get('priority')) as Priority,
      status,
      flstatu: status === 'FINALIZADA' ? 'F' : status === 'CANCELADA' ? 'C' : 'A',
      vlcobra: Number(data.get('chargedAmount') || 0),
      vlmater: Number(data.get('materialAmount') || 0),
      vlhorar: Number(data.get('hourAmount') || 0),
    }
    saveMutation.mutate({ id: selected?.id, payload })
  }

  return (
    <>
      <PageHeader eyebrow="Operação" title="Ordens de serviço" subtitle="Atendimentos, agenda e execução sincronizados com o backend." actions={<Button icon={<Plus size={18} />} onClick={openNew}>Nova OS</Button>} />
      <section className="stats-grid stats-grid--four">
        <StatCard label="Abertas" value={String(orders.filter((order) => order.status === 'ABERTA').length)} helper={`${orders.filter((order) => order.priority === 'URGENTE').length} urgentes`} icon={<CircleAlert />} tone="orange" />
        <StatCard label="Em atendimento" value={String(orders.filter((order) => order.status === 'EM_ATENDIMENTO').length)} helper="Execução em andamento" icon={<Wrench />} tone="green" />
        <StatCard label="Agendadas" value={String(orders.filter((order) => order.status === 'AGENDADA').length)} helper="Com data marcada" icon={<Clock3 />} tone="purple" />
        <StatCard label="Finalizadas" value={String(orders.filter((order) => order.status === 'FINALIZADA').length)} helper={`${ordersQuery.data?.total ?? 0} registros.`} icon={<CheckCircle2 />} tone="blue" />
      </section>

      <section className="panel data-panel os-panel">
        <div className="data-toolbar">
          <div className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar OS ou cliente..." /></div>
          <div className="segmented-control"><button className={priority === 'Todas' ? 'active' : ''} onClick={() => setPriority('Todas')}>Todas</button><button className={priority === 'Urgentes' ? 'active' : ''} onClick={() => setPriority('Urgentes')}>Urgentes</button></div>
          <label className="date-filter"><CalendarDays size={16} /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Filtrar por data" /></label>
          <div className="view-toggle"><button className={view === 'kanban' ? 'active' : ''} onClick={() => setView('kanban')} aria-label="Visualização em colunas"><Columns3 size={17} /></button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="Visualização em lista"><List size={17} /></button></div>
        </div>

        {ordersQuery.isLoading ? <LoadingState label="Carregando ordens de serviço..." /> : ordersQuery.isError ? <ErrorState message={apiErrorMessage(ordersQuery.error)} onRetry={() => ordersQuery.refetch()} /> : filtered.length === 0 ? <EmptyState title="Nenhuma ordem encontrada" description="Altere os filtros ou cadastre uma nova OS." /> : view === 'kanban' ? (
          <div className="kanban-board">
            {stages.map((stage) => {
              const stageOrders = filtered.filter((order) => order.status === stage)
              return <section className={`kanban-column kanban-column--${stage.toLowerCase()}`} key={stage}><header><span><i />{enumLabel(stage)}</span><b>{stageOrders.length}</b></header><div className="kanban-column__body">
                {stageOrders.map((order) => <article className="os-card" key={order.id} onClick={() => setDetail(order)}>
                  <div className="os-card__top"><span>OS-{order.id}</span>{order.priority === 'URGENTE' && <Badge tone="red">Urgente</Badge>}</div>
                  <h3>{order.clientName || order.client?.name || 'Cliente não identificado'}</h3><p>{order.description || `Serviço ${order.service || 'não informado'}`}</p>
                  <div className="os-meta"><span><Clock3 size={14} />{order.scheduledTime?.slice(0, 5) || 'Sem hora'}</span><span><UserRound size={14} />{order.technician ? `ID ${order.technician}` : 'Sem técnico'}</span><span><MapPin size={14} />{order.location || 'Sem local'}</span></div>
                  {!['FINALIZADA', 'CANCELADA'].includes(stage) ? <button disabled={advanceMutation.isPending} onClick={(event) => { event.stopPropagation(); advance(order) }}>Avançar etapa <ChevronRight size={15} /></button> : <span className="os-complete"><CheckCircle2 size={15} /> {stage === 'FINALIZADA' ? 'Atendimento concluído' : 'Atendimento cancelado'}</span>}
                </article>)}
                {stageOrders.length === 0 && <div className="kanban-empty">Nenhuma OS nesta etapa.</div>}
              </div></section>
            })}
          </div>
        ) : (
          <div className="table-wrap"><table className="data-table os-table"><thead><tr><th>OS / Cliente</th><th>Serviço</th><th>Agenda</th><th>Técnico</th><th>Valor</th><th>Status</th><th /></tr></thead><tbody>{filtered.map((order) => <tr key={order.id} onClick={() => setDetail(order)}><td><strong>OS-{order.id}</strong><small className="table-secondary">{order.clientName || order.client?.name || 'Cliente não identificado'}</small></td><td><strong className="table-primary">{order.description || order.service || 'Não informado'}</strong><small className="table-secondary">{enumLabel(order.category)}</small></td><td>{order.scheduledTime?.slice(0, 5) || 'Sem hora'}<small className="table-secondary">{formatDate(order.scheduledDate)}</small></td><td>{order.technician ? `ID ${order.technician}` : 'Não atribuído'}</td><td>{money(order.vlcobra)}</td><td><Badge tone={statusTone[order.status]}>{enumLabel(order.status)}</Badge></td><td><button className="row-action" aria-label={`Visualizar OS-${order.id}`}><ChevronRight size={18} /></button></td></tr>)}</tbody></table></div>
        )}
        <footer className="table-footer"><span>Mostrando <strong>{filtered.length}</strong> de {ordersQuery.data?.total ?? 0} ordens</span><button className="table-link" onClick={() => setDate('')}>Limpar data</button></footer>
      </section>

      <DetailModal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `Ordem de serviço OS-${detail.id}` : 'Detalhes da ordem de serviço'}
        description="Dados do atendimento, agenda, execução e valores registrados."
        size="large"
        actions={detail ? <><Button variant="danger" icon={<Trash2 size={16} />} disabled={deleteMutation.isPending} onClick={() => setOrderToDelete(detail)}>Excluir</Button>{!['FINALIZADA', 'CANCELADA'].includes(detail.status) && <Button variant="secondary" icon={<ChevronRight size={16} />} disabled={advanceMutation.isPending} onClick={() => { advance(detail); setDetail(null) }}>Avançar etapa</Button>}<Button icon={<Edit3 size={16} />} onClick={() => openEdit(detail)}>Editar OS</Button></> : undefined}
      >
        {detail && <ServiceOrderDetail order={detail} />}
      </DetailModal>

      <Modal open={modalOpen} onClose={() => !saveMutation.isPending && setModalOpen(false)} title={selected ? `Editar OS-${selected.id}` : 'Nova ordem de serviço'} description="Campos alinhados ao modelo ServiceOrder do backend." size="large">
        <ModalForm onSubmit={submit} onCancel={() => setModalOpen(false)} submitting={saveMutation.isPending} submitLabel={saveMutation.isPending ? 'Salvando...' : selected ? 'Salvar alterações' : 'Criar ordem'}>
          <FormError message={formError} />
          <div className="form-section-title"><span>1</span><div><strong>Atendimento</strong><small>Cliente, solicitante e descrição</small></div></div>
          <div className="form-grid form-grid--two">
            <FormField label="Cliente"><select name="idclien" defaultValue={selected?.idclien ?? selected?.client?.id ?? ''} required><option value="">Selecione</option>{clientsQuery.data?.content.map((client) => <option key={client.id} value={client.id}>{client.name || `Cliente #${client.id}`}</option>)}</select></FormField>
            <FormField label="Solicitante"><input name="requester" maxLength={250} defaultValue={selected?.nmsolic ?? ''} /></FormField>
            <FormField label="Código do serviço" hint="Campo tpservic do backend (1 caractere)"><input name="service" maxLength={1} required defaultValue={selected?.service ?? ''} /></FormField>
            <FormField label="Categoria"><select name="category" defaultValue={selected?.category || 'SERVICOS_GERAIS'}>{(['ELETRICA', 'HIDRAULICA', 'INSTALACAO', 'VISITA_TECNICA', 'SERVICOS_GERAIS'] as ServiceCategory[]).map((item) => <option key={item} value={item}>{enumLabel(item)}</option>)}</select></FormField>
            <FormField label="Descrição"><textarea name="description" required rows={3} defaultValue={selected?.description ?? ''} /></FormField>
            <FormField label="Observações"><textarea name="notes" rows={3} defaultValue={selected?.dsobser ?? ''} /></FormField>
          </div>
          <div className="form-section-title"><span>2</span><div><strong>Agenda e execução</strong><small>IDs operacionais seguem o modelo legado</small></div></div>
          <div className="form-grid form-grid--four">
            <FormField label="Data"><input name="date" type="date" required defaultValue={toDateInput(selected?.scheduledDate)} /></FormField>
            <FormField label="Hora"><input name="time" type="time" defaultValue={selected?.scheduledTime?.slice(0, 5) ?? ''} /></FormField>
            <FormField label="ID do técnico"><input name="technician" type="number" min="1" defaultValue={selected?.technician ?? ''} /></FormField>
            <FormField label="ID do local"><input name="location" type="number" min="1" defaultValue={selected?.location ?? ''} /></FormField>
            <FormField label="Prioridade"><select name="priority" defaultValue={selected?.priority || 'NORMAL'}><option value="NORMAL">Normal</option><option value="URGENTE">Urgente</option></select></FormField>
            <FormField label="Status"><select name="status" defaultValue={selected?.status || 'ABERTA'}>{stages.map((stage) => <option key={stage} value={stage}>{enumLabel(stage)}</option>)}</select></FormField>
          </div>
          <div className="form-section-title"><span>3</span><div><strong>Valores</strong><small>Cobrança, material e hora</small></div></div>
          <div className="form-grid form-grid--four">
            <FormField label="Valor cobrado"><input name="chargedAmount" type="number" min="0" step="0.01" defaultValue={selected?.vlcobra ?? 0} /></FormField>
            <FormField label="Material"><input name="materialAmount" type="number" min="0" step="0.01" defaultValue={selected?.vlmater ?? 0} /></FormField>
            <FormField label="Valor da hora"><input name="hourAmount" type="number" min="0" step="0.01" defaultValue={selected?.vlhorar ?? 0} /></FormField>
          </div>
          {selected && <div className="destructive-row"><span><strong>Excluir ordem</strong><small>Esta ação remove o registro da API.</small></span><Button type="button" variant="danger" icon={<Trash2 size={16} />} disabled={deleteMutation.isPending} onClick={() => setOrderToDelete(selected)}>Excluir</Button></div>}
        </ModalForm>
      </Modal>
      <ConfirmDialog open={Boolean(orderToDelete)} title={`Excluir OS-${orderToDelete?.id}?`} description="A ordem de serviço será removida permanentemente. Esta ação não poderá ser desfeita." confirmLabel="Excluir ordem" busy={deleteMutation.isPending} onCancel={() => setOrderToDelete(null)} onConfirm={() => orderToDelete && !deleteMutation.isPending && deleteMutation.mutate(orderToDelete.id)} />
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </>
  )
}

function ServiceOrderDetail({ order }: { order: ServiceOrder }) {
  return <div className="detail-modal-content">
    <div className="detail-modal__hero-row"><div className="detail-drawer__hero"><span className="detail-avatar"><Wrench /></span><div><span>OS-{order.id}</span><h2>{order.clientName || order.client?.name || 'Cliente não identificado'}</h2><p>{order.description || 'Descrição não informada'}</p></div></div><Badge tone={statusTone[order.status]}>{enumLabel(order.status)}</Badge></div>
    <div className="detail-metrics"><span><small>Data agendada</small><strong>{formatDate(order.scheduledDate)}</strong></span><span><small>Horário</small><strong>{order.scheduledTime?.slice(0, 5) || 'Não informado'}</strong></span><span><small>Prioridade</small><strong>{enumLabel(order.priority || 'NORMAL')}</strong></span><span><small>Valor cobrado</small><strong>{money(order.vlcobra)}</strong></span></div>
    <div className="detail-sections-grid">
      <section className="drawer-section"><h3>Atendimento</h3><dl><div><dt>Cliente</dt><dd>{order.clientName || order.client?.name || 'Não informado'}</dd></div><div><dt>Solicitante</dt><dd>{order.nmsolic || 'Não informado'}</dd></div><div><dt>Categoria</dt><dd>{enumLabel(order.category)}</dd></div><div><dt>Código do serviço</dt><dd>{order.service || 'Não informado'}</dd></div></dl></section>
      <section className="drawer-section"><h3>Execução</h3><dl><div><dt>Técnico / operador</dt><dd>{order.technician || order.idopera || 'Não atribuído'}</dd></div><div><dt>Local</dt><dd>{order.location || order.idlocal || 'Não informado'}</dd></div><div><dt>Valor de material</dt><dd>{money(order.vlmater)}</dd></div><div><dt>Valor da hora</dt><dd>{money(order.vlhorar)}</dd></div></dl></section>
      {(order.description || order.dsobser) && <section className="drawer-section drawer-section--wide"><h3>Descrição e observações</h3>{order.description && <p className="drawer-section__text">{order.description}</p>}{order.dsobser && <p className="drawer-section__text detail-text-spaced">{order.dsobser}</p>}</section>}
    </div>
  </div>
}
