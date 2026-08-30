import { useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Clock3, Columns3, Edit3, List, Plus, Search, Trash2, UserRound, Wrench, X } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { useAuth } from '../auth'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { enumLabel, formatDate, money, toDateInput } from '../lib/format'
import type { ClientListItem, PagedResponse, ServiceCatalogItem, ServiceCategory, ServiceOrder, ServiceOrderListItem, ServiceOrderPayload, ServiceOrderSchedule, ServiceOrderServiceItem, ServiceOrderStatus } from '../types'
import { Badge, Button, ConfirmDialog, DetailModal, EmptyState, ErrorState, FormError, FormField, LoadingState, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'

const stages: ServiceOrderStatus[] = ['ABERTA', 'FINALIZADA', 'CANCELADA']
const flowStages: ServiceOrderStatus[] = stages.filter((status) => status !== 'CANCELADA')
const categories: Array<{ value: ServiceCategory; label: string }> = [
  { value: 'MAO_DE_OBRA', label: 'Mão de obra' },
  { value: 'GARANTIA', label: 'Garantia' },
  { value: 'VISITA_TECNICA', label: 'Visita técnica' },
  { value: 'CANCELAMENTO', label: 'Cancelamento' },
  { value: 'DESLOCAMENTO', label: 'Deslocamento' },
]
const serviceTypes = [
  { value: 'E', label: 'Elétricos' },
  { value: 'A', label: 'Ambos' },
  // { value: 'L', label: 'Alvenaria' },
  { value: 'H', label: 'Hidráulico' },
  // { value: 'I', label: 'Hidro' },
  // { value: 'O', label: 'Outros' },
]

const statusTone: Record<ServiceOrderStatus, 'orange' | 'blue' | 'purple' | 'green' | 'neutral' | 'red'> = {
  ABERTA: 'orange', ENCAMINHADA: 'blue', AGENDADA: 'purple', EM_ATENDIMENTO: 'green', FINALIZADA: 'neutral', CANCELADA: 'red',
}

type ScheduleDraft = ServiceOrderSchedule & { rowKey: string }
type ServiceDraft = ServiceOrderServiceItem & { rowKey: string }
type DateFilterMode = 'none' | 'date' | 'range' | 'month' | 'week'

type DateBounds = {
  startDate?: string
  endDate?: string
}

function localToday() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function dateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return ''
  return dateInputValue(new Date(year, month - 1, day + days, 12))
}

function resolveDateBounds(mode: DateFilterMode, date: string, rangeStart: string, rangeEnd: string, month: string, weekDate: string): DateBounds {
  if (mode === 'date' && date) return { startDate: date, endDate: date }
  if (mode === 'range') return { startDate: rangeStart || undefined, endDate: rangeEnd || undefined }
  if (mode === 'month' && month) {
    const [year, monthNumber] = month.split('-').map(Number)
    if (!year || !monthNumber) return {}
    return {
      startDate: `${month}-01`,
      endDate: dateInputValue(new Date(year, monthNumber, 0, 12)),
    }
  }
  if (mode === 'week' && weekDate) {
    const [year, monthNumber, day] = weekDate.split('-').map(Number)
    if (!year || !monthNumber || !day) return {}
    const reference = new Date(year, monthNumber - 1, day, 12)
    const sunday = shiftDate(weekDate, -reference.getDay())
    return { startDate: sunday, endDate: shiftDate(sunday, 6) }
  }
  return {}
}

function dateTime(date: string, time = '00:00') {
  return `${date}T${time || '00:00'}:00`
}

function numberValue(value: string | number | null | undefined) {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function durationMinutes(start?: string | null, end?: string | null) {
  if (!start || !end) return 0
  const [startHour, startMinute] = start.split(':').map(Number)
  const [endHour, endMinute] = end.split(':').map(Number)
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return 0
  return Math.max(0, endHour * 60 + endMinute - startHour * 60 - startMinute)
}

function minutesFromTime(value?: string | null) {
  if (!value) return 0
  const [hours, minutes] = value.split(':').map(Number)
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : 0
}

function asDuration(minutes: number) {
  const safe = Math.max(0, Math.round(minutes))
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

function clientDisplay(client: ClientListItem) {
  return client.tradeName || client.name || `Cliente #${client.id}`
}

export function ServiceOrders() {
  const queryClient = useQueryClient()
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState<'Todas' | 'Urgentes'>('Todas')
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('none')
  const [date, setDate] = useState('')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [month, setMonth] = useState('')
  const [weekDate, setWeekDate] = useState(localToday())
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<ServiceOrder | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [orderToDelete, setOrderToDelete] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const [formError, setFormError] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const dateBounds = useMemo(
    () => resolveDateBounds(dateFilterMode, date, rangeStart, rangeEnd, month, weekDate),
    [dateFilterMode, date, month, rangeEnd, rangeStart, weekDate],
  )
  const periodError = dateBounds.startDate && dateBounds.endDate && dateBounds.endDate < dateBounds.startDate
    ? 'A data final deve ser igual ou posterior à data inicial.'
    : ''
  const ordersQueryKey = [
    ...queryKeys.serviceOrders,
    'list',
    debouncedSearch,
    dateBounds.startDate ?? '',
    dateBounds.endDate ?? '',
    priority,
    page,
    pageSize,
  ] as const

  const ordersQuery = useQuery({
    queryKey: ordersQueryKey,
    queryFn: () => api.serviceOrders.list({
      query: debouncedSearch || undefined,
      startDate: dateBounds.startDate,
      endDate: dateBounds.endDate,
      urgentOnly: priority === 'Urgentes' || undefined,
      page,
      size: pageSize,
    }),
    enabled: !periodError,
    placeholderData: keepPreviousData,
  })
  const clientsQuery = useQuery({ queryKey: queryKeys.clients, queryFn: () => api.clients.list({ size: 500 }) })
  const catalogQuery = useQuery({ queryKey: queryKeys.serviceCatalog, queryFn: () => api.serviceCatalog.list({ size: 500 }) })
  const detailQuery = useQuery({ queryKey: [...queryKeys.serviceOrders, 'detail', detailId], queryFn: () => api.serviceOrders.find(detailId!), enabled: detailId !== null })

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
    mutationFn: ({ id, status }: { id: number; status: ServiceOrderStatus }) => api.serviceOrders.updateStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ordersQueryKey, exact: true })
      const previous = queryClient.getQueryData<PagedResponse<ServiceOrderListItem>>(ordersQueryKey)
      queryClient.setQueryData<PagedResponse<ServiceOrderListItem>>(ordersQueryKey, (current) => current ? {
        ...current,
        content: current.content.map((order) => order.id === id ? { ...order, status } : order),
      } : current)
      return { previous }
    },
    onSuccess: async (updated, variables) => {
      queryClient.setQueryData<ServiceOrder>([...queryKeys.serviceOrders, 'detail', variables.id], (current) => current ? { ...current, status: variables.status, flstatu: variables.status === 'FINALIZADA' ? 'F' : variables.status === 'CANCELADA' ? 'C' : 'A' } : current)
      await queryClient.invalidateQueries({ queryKey: queryKeys.serviceOrders })
      setDetailId(null)
      showToast(`OS-${updated.id} alterada para “${enumLabel(updated.status)}”.`)
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(ordersQueryKey, context.previous)
      showToast(apiErrorMessage(error))
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.serviceOrders.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.serviceOrders })
      setOrderToDelete(null)
      setModalOpen(false)
      setDetailId(null)
      showToast('Ordem de serviço removida.')
    },
    onError: (error) => { setOrderToDelete(null); showToast(apiErrorMessage(error)) },
  })

  const orders = ordersQuery.data?.content ?? []
  const total = ordersQuery.data?.total ?? 0
  const totalPages = ordersQuery.data?.totalPages ?? 0
  const firstResult = total === 0 ? 0 : page * pageSize + 1
  const lastResult = Math.min((page + 1) * pageSize, total)

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }

  function resetPage() {
    setPage(0)
  }

  function changeDateFilterMode(mode: DateFilterMode) {
    const today = localToday()
    setDateFilterMode(mode)
    if (mode === 'date' && !date) setDate(today)
    if (mode === 'range') {
      if (!rangeStart) setRangeStart(today)
      if (!rangeEnd) setRangeEnd(today)
    }
    if (mode === 'month' && !month) setMonth(today.slice(0, 7))
    if (mode === 'week' && !weekDate) setWeekDate(today)
    resetPage()
  }

  function clearPeriod() {
    setDateFilterMode('none')
    setDate('')
    setRangeStart('')
    setRangeEnd('')
    setMonth('')
    setWeekDate(localToday())
    resetPage()
  }

  function openNew() {
    setSelected(null)
    setFormError('')
    setFormKey((value) => value + 1)
    setModalOpen(true)
  }

  function openEdit(order: ServiceOrder) {
    setDetailId(null)
    setSelected(order)
    setFormError('')
    setFormKey((value) => value + 1)
    setModalOpen(true)
  }

  function advance(order: ServiceOrderListItem | ServiceOrder) {
    const currentIndex = flowStages.indexOf(order.status)
    if (currentIndex < 0 || currentIndex === flowStages.length - 1) return
    advanceMutation.mutate({ id: order.id, status: flowStages[currentIndex + 1] })
  }

  const detail = detailQuery.data

  return <>
    <PageHeader eyebrow="Operação" title="Ordens de serviço" subtitle="Cadastro operacional alinhado ao fluxo legado da Gente Boa." actions={<Button icon={<Plus size={18} />} onClick={openNew}>Nova OS</Button>} />
    <section className="stats-grid stats-grid--four">
      <StatCard label="Abertas nesta página" value={String(orders.filter((order) => order.status === 'ABERTA').length)} helper={`${orders.length} registros exibidos`} icon={<CircleAlert />} tone="orange" />
      <StatCard label="Urgentes nesta página" value={String(orders.filter((order) => order.priority === 'URGENTE').length)} helper="Sinalizadas na agenda" icon={<Clock3 />} tone="orange" />
      <StatCard label="Finalizadas nesta página" value={String(orders.filter((order) => order.status === 'FINALIZADA').length)} helper="Atendimentos concluídos" icon={<CheckCircle2 />} tone="green" />
      <StatCard label="Canceladas nesta página" value={String(orders.filter((order) => order.status === 'CANCELADA').length)} helper={`${total.toLocaleString('pt-BR')} no resultado filtrado`} icon={<Wrench />} tone="blue" />
    </section>

    <section className="panel data-panel os-panel">
      <div className="data-toolbar data-toolbar--orders">
        <div className="search-box"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); resetPage() }} placeholder="Buscar por código, cliente, solicitante ou descrição..." /></div>
        <div className="segmented-control"><button className={priority === 'Todas' ? 'active' : ''} onClick={() => { setPriority('Todas'); resetPage() }}>Todas</button><button className={priority === 'Urgentes' ? 'active' : ''} onClick={() => { setPriority('Urgentes'); resetPage() }}>Urgentes</button></div>
        <label className="toolbar-select toolbar-select--compact os-period-mode"><span>Período</span><select value={dateFilterMode} onChange={(event) => changeDateFilterMode(event.target.value as DateFilterMode)}><option value="none">Todas as datas</option><option value="date">Data específica</option><option value="range">Entre datas</option><option value="month">Mês</option><option value="week">Semana</option></select></label>
        {dateFilterMode === 'date' && <label className="os-date-field"><span>Data</span><div><CalendarDays size={15} /><input type="date" value={date} onChange={(event) => { setDate(event.target.value); resetPage() }} aria-label="Filtrar por data específica" /></div></label>}
        {dateFilterMode === 'range' && <div className="os-period-fields">
          <label className="os-date-field"><span>De</span><div><CalendarDays size={15} /><input type="date" value={rangeStart} max={rangeEnd || undefined} onChange={(event) => { setRangeStart(event.target.value); resetPage() }} /></div></label>
          <label className="os-date-field"><span>Até</span><div><CalendarDays size={15} /><input type="date" value={rangeEnd} min={rangeStart || undefined} onChange={(event) => { setRangeEnd(event.target.value); resetPage() }} /></div></label>
        </div>}
        {dateFilterMode === 'month' && <label className="os-date-field"><span>Mês</span><div><CalendarDays size={15} /><input type="month" value={month} onChange={(event) => { setMonth(event.target.value); resetPage() }} aria-label="Filtrar por mês" /></div></label>}
        {dateFilterMode === 'week' && <div className="os-week-filter"><label className="os-date-field"><span>Um dia da semana</span><div><CalendarDays size={15} /><input type="date" value={weekDate} onChange={(event) => { setWeekDate(event.target.value); resetPage() }} aria-label="Selecionar semana" /></div></label>{dateBounds.startDate && dateBounds.endDate && <small>Domingo {formatDate(dateBounds.startDate)} a sábado {formatDate(dateBounds.endDate)}</small>}</div>}
        <div className="view-toggle"><button className={view === 'kanban' ? 'active' : ''} onClick={() => setView('kanban')} aria-label="Visualização em colunas"><Columns3 size={17} /></button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="Visualização em lista"><List size={17} /></button></div>
      </div>

      {periodError && <div className="os-filter-error"><CircleAlert size={16} /><span>{periodError}</span></div>}

      {periodError ? null : ordersQuery.isLoading ? <LoadingState label="Carregando ordens de serviço..." /> : ordersQuery.isError ? <ErrorState message={apiErrorMessage(ordersQuery.error)} onRetry={() => ordersQuery.refetch()} /> : orders.length === 0 ? <EmptyState title="Nenhuma ordem encontrada" description="Altere os filtros ou cadastre uma nova OS." /> : view === 'kanban' ? <div className={`kanban-board ${ordersQuery.isFetching ? 'table-wrap--refreshing' : ''}`}>
        {stages.map((stage) => {
          const stageOrders = orders.filter((order) => order.status === stage)
          return <section className={`kanban-column kanban-column--${stage.toLowerCase()}`} key={stage}><header><span><i />{enumLabel(stage)}</span><b>{stageOrders.length}</b></header><div className="kanban-column__body">
            {stageOrders.map((order) => <article className="os-card" key={order.id} onClick={() => setDetailId(order.id)}>
              <div className="os-card__top"><span>OS-{order.id}</span>{order.priority === 'URGENTE' && <Badge tone="red">Urgente</Badge>}</div>
              <h3>{order.clientTradeName || order.clientName || 'Cliente não identificado'}</h3>{order.clientTradeName && order.clientName && <small className="os-card__company-name">{order.clientName}</small>}<p>{order.description || 'Descrição não informada'}</p>
              <div className="os-meta"><span><CalendarDays size={14} />{formatDate(order.orderedAt)}</span><span><UserRound size={14} />{order.requester || 'Sem solicitante'}</span></div>
              {!['FINALIZADA', 'CANCELADA'].includes(stage) ? <button type="button" disabled={advanceMutation.isPending} onClick={(event) => { event.preventDefault(); event.stopPropagation(); advance(order) }}>Finalizar OS <CheckCircle2 size={15} /></button> : <span className="os-complete"><CheckCircle2 size={15} /> {stage === 'FINALIZADA' ? 'Atendimento concluído' : 'Atendimento cancelado'}</span>}
            </article>)}
            {stageOrders.length === 0 && <div className="kanban-empty">Nenhuma OS nesta etapa.</div>}
          </div></section>
        })}
      </div> : <div className={`table-wrap ${ordersQuery.isFetching ? 'table-wrap--refreshing' : ''}`}><table className="data-table os-table"><thead><tr><th>OS / Cliente</th><th>Atendimento</th><th>Data</th><th>Categoria</th><th>Valor</th><th>Status</th><th /></tr></thead><tbody>{orders.map((order) => <tr key={order.id} onClick={() => setDetailId(order.id)}><td><strong>OS-{order.id}</strong><small className="table-secondary">{order.clientTradeName || order.clientName || 'Cliente não identificado'}</small></td><td><strong className="table-primary">{order.description || 'Não informado'}</strong><small className="table-secondary">{order.requester || 'Sem solicitante'}</small></td><td>{formatDate(order.orderedAt)}</td><td>{enumLabel(order.category)}</td><td>{money(order.totalValue)}</td><td><Badge tone={statusTone[order.status]}>{enumLabel(order.status)}</Badge></td><td><button className="row-action" aria-label={`Visualizar OS-${order.id}`}><ChevronRight size={18} /></button></td></tr>)}</tbody></table></div>}
      <footer className="table-footer table-footer--pagination">
        <span>Mostrando <strong>{firstResult}–{lastResult}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong> ordens</span>
        <div className="os-pagination-area">
          {dateFilterMode !== 'none' && <button className="table-link" onClick={clearPeriod}>Limpar período</button>}
          <div className="pagination-controls">
            <label>Por página <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); resetPage() }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label>
            <button disabled={page === 0 || ordersQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button>
            <span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span>
            <button disabled={page + 1 >= totalPages || ordersQuery.isFetching} onClick={() => setPage((value) => value + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button>
          </div>
        </div>
      </footer>
    </section>

    <DetailModal open={detailId !== null} onClose={() => setDetailId(null)} title={detail ? `Ordem de serviço OS-${detail.id}` : 'Detalhes da ordem de serviço'} description="Dados do atendimento, agenda, serviços e valores registrados." size="xlarge" actions={detail ? <><Button variant="danger" icon={<Trash2 size={16} />} disabled={deleteMutation.isPending} onClick={() => setOrderToDelete(detail.id)}>Excluir</Button>{!['FINALIZADA', 'CANCELADA'].includes(detail.status) && <Button variant="secondary" icon={<CheckCircle2 size={16} />} disabled={advanceMutation.isPending} onClick={() => advance(detail)}>Finalizar OS</Button>}<Button icon={<Edit3 size={16} />} onClick={() => openEdit(detail)}>Editar OS</Button></> : undefined}>
      {detailQuery.isLoading ? <LoadingState label="Carregando a ordem de serviço..." /> : detailQuery.isError ? <ErrorState message={apiErrorMessage(detailQuery.error)} onRetry={() => detailQuery.refetch()} /> : detail ? <ServiceOrderDetail order={detail} catalog={catalogQuery.data?.content ?? []} /> : null}
    </DetailModal>

    <Modal open={modalOpen} onClose={() => !saveMutation.isPending && setModalOpen(false)} title={selected ? `Editar OS-${selected.id}` : 'Nova ordem de serviço'} description="Preenchimento baseado na tela operacional do sistema Delphi." size="xlarge">
      <ServiceOrderForm key={formKey} selected={selected} clients={clientsQuery.data?.content ?? []} catalog={catalogQuery.data?.content ?? []} loadingReferences={clientsQuery.isLoading || catalogQuery.isLoading} formError={formError} submitting={saveMutation.isPending} onCancel={() => setModalOpen(false)} onDelete={(id) => setOrderToDelete(id)} onSubmit={(payload) => saveMutation.mutate({ id: selected?.id, payload })} />
    </Modal>
    <ConfirmDialog open={orderToDelete !== null} title={`Excluir OS-${orderToDelete ?? ''}?`} description="A ordem de serviço e seus agendamentos e serviços serão removidos permanentemente." confirmLabel="Excluir ordem" busy={deleteMutation.isPending} onCancel={() => setOrderToDelete(null)} onConfirm={() => orderToDelete !== null && !deleteMutation.isPending && deleteMutation.mutate(orderToDelete)} />
    {toast && <Toast message={toast} onClose={() => setToast('')} />}
  </>
}

function ServiceOrderForm({ selected, clients, catalog, loadingReferences, formError, submitting, onCancel, onDelete, onSubmit }: {
  selected: ServiceOrder | null
  clients: ClientListItem[]
  catalog: ServiceCatalogItem[]
  loadingReferences: boolean
  formError: string
  submitting: boolean
  onCancel: () => void
  onDelete: (id: number) => void
  onSubmit: (payload: ServiceOrderPayload) => void
}) {
  const { user } = useAuth()
  const initialDate = toDateInput(selected?.dtordem || selected?.scheduledDate) || localToday()
  const [tab, setTab] = useState<'general' | 'materials'>('general')
  const [clientId, setClientId] = useState(selected?.idclien ? String(selected.idclien) : '')
  const [requestDate, setRequestDate] = useState(initialDate)
  const [requester, setRequester] = useState(selected?.nmsolic ?? '')
  const [locationId, setLocationId] = useState(selected?.idlocal ? String(selected.idlocal) : '')
  const [status, setStatus] = useState<ServiceOrderStatus>(selected?.status || 'ABERTA')
  const [category, setCategory] = useState<ServiceCategory>(selected?.category || 'MAO_DE_OBRA')
  const [serviceType, setServiceType] = useState(selected?.tpservic || 'E')
  const [description, setDescription] = useState(selected?.dsdescr ?? selected?.description ?? '')
  const [notes, setNotes] = useState(selected?.dsobser ?? '')
  const [cancellationReason, setCancellationReason] = useState(selected?.dscancel ?? '')
  const [urgent, setUrgent] = useState(selected?.priority === 'URGENTE' || selected?.schedules?.some((item) => item.urgentFlag === 'S') || false)
  const [hourMarked, setHourMarked] = useState(selected?.schedules?.some((item) => item.scheduledTimeFlag === 'S') || false)
  const [dueDate, setDueDate] = useState(toDateInput(selected?.dtvenci))
  const [ticketFee, setTicketFee] = useState(String(selected?.txbolet ?? 0))
  const [discount, setDiscount] = useState(String(selected?.vldesco ?? 0))
  const [transport, setTransport] = useState(String(selected?.vltrans ?? 0))
  const [rental, setRental] = useState(String(selected?.vlalug ?? 0))
  const [materialAmount, setMaterialAmount] = useState(String(selected?.vlmater ?? 0))
  const [materialOrderId, setMaterialOrderId] = useState(selected?.idpedi ? String(selected.idpedi) : '')
  const [schedules, setSchedules] = useState<ScheduleDraft[]>(() => selected?.schedules?.length
    ? selected.schedules.map((item, index) => ({ ...item, rowKey: `schedule-${item.scheduleId ?? index}` }))
    : [{ rowKey: 'schedule-new-0', expectedDate: dateTime(initialDate), expectedStart: '', expectedEnd: '', expectedDuration: '00:00', employeeId: null }])
  const [serviceItems, setServiceItems] = useState<ServiceDraft[]>(() => selected?.serviceItems?.map((item, index) => ({ ...item, rowKey: `service-${item.serviceId}-${index}` })) ?? [])

  const clientQuery = useQuery({ queryKey: [...queryKeys.clients, 'detail', clientId], queryFn: () => api.clients.find(Number(clientId)), enabled: Boolean(clientId) })
  const selectedClient = clients.find((client) => client.id === Number(clientId))
  const serviceSubtotal = serviceItems.reduce((sum, item) => sum + numberValue(item.totalValue), 0)
  const discountAmount = serviceSubtotal * numberValue(discount) / 100
  const total = serviceSubtotal + numberValue(materialAmount) + numberValue(ticketFee) + numberValue(transport) + numberValue(rental) - discountAmount
  const totalMinutes = schedules.reduce((sum, item) => sum + (minutesFromTime(item.expectedDuration) || durationMinutes(item.expectedStart, item.expectedEnd)), 0)

  function updateSchedule(index: number, patch: Partial<ScheduleDraft>) {
    setSchedules((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item
      const next = { ...item, ...patch }
      if ('expectedStart' in patch || 'expectedEnd' in patch) next.expectedDuration = asDuration(durationMinutes(next.expectedStart, next.expectedEnd))
      return next
    }))
  }

  function addSchedule() {
    setSchedules((current) => [...current, { rowKey: `schedule-new-${Date.now()}`, expectedDate: dateTime(requestDate), expectedStart: '', expectedEnd: '', expectedDuration: '00:00', employeeId: null }])
  }

  function addService() {
    const firstAvailable = catalog.find((item) => !serviceItems.some((row) => row.serviceId === item.id))
    if (firstAvailable) setServiceItems((current) => [...current, serviceDraft(firstAvailable)])
  }

  function changeService(index: number, serviceId: number) {
    const service = catalog.find((item) => item.id === serviceId)
    if (service) setServiceItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...serviceDraft(service), rowKey: item.rowKey } : item))
  }

  function updateService(index: number, patch: Partial<ServiceDraft>) {
    setServiceItems((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item
      const next = { ...item, ...patch }
      next.totalValue = numberValue(next.quantity) * numberValue(next.unitValue)
      return next
    }))
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!clientId || !requestDate || !description.trim()) return
    const selectedBase = selected ? (() => {
      const { id: _id, code: _code, client: _client, clientName: _clientName, schedules: _schedules, serviceItems: _serviceItems, ...rest } = selected
      return rest
    })() : {}
    const normalizedSchedules: ServiceOrderSchedule[] = schedules.map((item, index) => {
      const { rowKey: _rowKey, ...persisted } = item
      const date = toDateInput(item.expectedDate) || requestDate
      return { ...persisted, serviceOrderId: selected?.id ?? null, scheduleId: item.scheduleId ?? index + 1, expectedDate: dateTime(date), expectedStart: item.expectedStart || null, expectedEnd: item.expectedEnd || null, expectedDuration: item.expectedDuration || asDuration(durationMinutes(item.expectedStart, item.expectedEnd)), employeeId: item.employeeId ? Number(item.employeeId) : null, urgentFlag: urgent ? 'S' : 'N', scheduledTimeFlag: hourMarked ? 'S' : 'N', startedFlag: item.startedFlag || 'N', finishedFlag: item.finishedFlag || 'N', routedFlag: item.routedFlag || 'N', serviceType }
    })
    const normalizedServices: ServiceOrderServiceItem[] = serviceItems.map(({ rowKey: _rowKey, ...item }) => ({ ...item, serviceOrderId: selected?.id ?? null, quantity: Math.max(1, numberValue(item.quantity)), unitValue: numberValue(item.unitValue), totalValue: numberValue(item.quantity) * numberValue(item.unitValue), minimumValue: numberValue(item.minimumValue), minuteValue: numberValue(item.minuteValue) }))
    const firstSchedule = normalizedSchedules[0]
    const payload: ServiceOrderPayload = {
      ...selectedBase,
      idclien: Number(clientId), dtordem: dateTime(requestDate), flordem: selected?.flordem || 'A', nmsolic: requester.trim() || null,
      idlocal: locationId ? Number(locationId) : null, idopera: selected?.idopera ?? user?.id ?? null, status,
      flstatu: status === 'FINALIZADA' ? 'F' : status === 'CANCELADA' ? 'C' : 'A', category,
      flcateg: category === 'GARANTIA' ? 'G' : category === 'VISITA_TECNICA' ? 'V' : category === 'CANCELAMENTO' ? 'C' : category === 'DESLOCAMENTO' ? 'D' : 'M',
      dsdescr: description.trim(), description: description.trim(), dsobser: notes.trim() || null, dscancel: cancellationReason.trim() || null,
      tpservic: serviceType, service: serviceType, priority: urgent ? 'URGENTE' : 'NORMAL', scheduledDate: firstSchedule ? toDateInput(firstSchedule.expectedDate) : requestDate,
      scheduledTime: firstSchedule?.expectedStart || null, technician: firstSchedule?.employeeId ? String(firstSchedule.employeeId) : null, location: locationId || null,
      dtinicial: firstSchedule ? dateTime(toDateInput(firstSchedule.expectedDate), firstSchedule.expectedStart || '00:00') : null, hrabert: firstSchedule?.expectedStart || null,
      qthorac: asDuration(totalMinutes), dtvenci: dueDate ? dateTime(dueDate) : null, txbolet: numberValue(ticketFee), vldesco: numberValue(discount), vldesc: discountAmount,
      vltrans: numberValue(transport), vlalug: numberValue(rental), fltrans: numberValue(transport) > 0 ? 'S' : 'N', flalug: numberValue(rental) > 0 ? 'S' : 'N',
      vlmater: numberValue(materialAmount), idpedi: materialOrderId ? Number(materialOrderId) : null, vlhorar: serviceSubtotal, vlcobra: Math.max(0, total), schedules: normalizedSchedules, serviceItems: normalizedServices,
    }
    onSubmit(payload)
  }

  return <ModalForm onSubmit={submit} onCancel={onCancel} submitting={submitting} submitLabel={submitting ? 'Gravando...' : selected ? 'Gravar alterações' : 'Gravar OS'}>
    <FormError message={formError} />
    <div className="os-form-context"><span><small>Ordem de serviço</small><strong>Avulsa</strong></span><span><small>Operador</small><strong>{user?.name || 'Usuário atual'}</strong></span><span><small>Cliente</small><strong>{selectedClient ? clientDisplay(selectedClient) : 'Selecione o cliente'}</strong></span><Badge tone={statusTone[status]}>{enumLabel(status)}</Badge></div>
    <div className="os-form-identification">
      <FormField label="Código"><input value={selected?.id ?? 'Automático'} disabled /></FormField>
      <FormField label="Tipo"><input value="Avulsa" disabled /></FormField>
      <FormField label="Data da requisição"><input type="date" value={requestDate} onChange={(event) => setRequestDate(event.target.value)} required /></FormField>
      <FormField label="Solicitante"><input maxLength={250} value={requester} onChange={(event) => setRequester(event.target.value)} /></FormField>
      <FormField label="Cliente"><select value={clientId} onChange={(event) => { setClientId(event.target.value); setLocationId('') }} required disabled={loadingReferences}><option value="">Selecione</option>{clients.map((client) => <option key={client.id} value={client.id}>{clientDisplay(client)}{client.name && client.tradeName ? ` — ${client.name}` : ''}</option>)}</select></FormField>
      <FormField label="Local"><select value={locationId} onChange={(event) => setLocationId(event.target.value)} disabled={!clientId || clientQuery.isLoading}><option value="">Endereço principal</option>{clientQuery.data?.addresses?.map((address) => <option key={address.id} value={address.id}>{address.description || address.street || `Local #${address.id}`}</option>)}</select></FormField>
      <FormField label="Situação"><select value={status} onChange={(event) => setStatus(event.target.value as ServiceOrderStatus)}><option value="ABERTA">Aberta</option><option value="FINALIZADA">Finalizada</option><option value="CANCELADA">Cancelada</option></select></FormField>
    </div>
    <div className="os-form-tabs" role="tablist"><button type="button" className={tab === 'general' ? 'active' : ''} onClick={() => setTab('general')}>Dados gerais</button><button type="button" className={tab === 'materials' ? 'active' : ''} onClick={() => setTab('materials')}>Materiais</button></div>

    {tab === 'general' ? <>
      <section className="os-form-section">
        <div className="os-form-section__title"><strong>Categoria da OS</strong><span>Classificação do atendimento</span></div>
        <div className="os-category-row"><div className="os-radio-group">{categories.map((item) => <label key={item.value}><input type="radio" name="os-category" checked={category === item.value} onChange={() => setCategory(item.value)} /><span>{item.label}</span></label>)}</div><div className="os-detail-flags"><label><input type="checkbox" checked={urgent} onChange={(event) => setUrgent(event.target.checked)} /><span>Urgente</span></label><label><input type="checkbox" checked={hourMarked} onChange={(event) => setHourMarked(event.target.checked)} /><span>Hora marcada</span></label></div></div>
      </section>
      <div className="os-description-grid">
        <FormField label="Descrição"><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} required /></FormField>
        <section className="os-service-type"><strong>Procurar por / tipo de serviço</strong><div>{serviceTypes.map((item) => <label key={item.value}><input type="radio" name="service-type" checked={serviceType === item.value} onChange={() => setServiceType(item.value)} /><span>{item.label}</span></label>)}</div></section>
        <FormField label="Observação"><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></FormField>
        <FormField label="Motivo do cancelamento"><textarea rows={3} value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} disabled={category !== 'CANCELAMENTO' && status !== 'CANCELADA'} /></FormField>
      </div>
      <section className="os-grid-section">
        <header><div><strong>Agendamento de serviços</strong><span>Previsão e profissional responsável por cada visita</span></div><Button type="button" variant="secondary" icon={<Plus size={15} />} onClick={addSchedule}>Adicionar agenda</Button></header>
        <div className="os-edit-table-wrap"><table className="os-edit-table os-schedule-table"><thead><tr><th>Data</th><th>Inicial</th><th>Final</th><th>Total</th><th>Funcionário (ID)</th><th>Dt. realizado</th><th>Hr. inicial</th><th>Hr. final</th><th /></tr></thead><tbody>{schedules.map((item, index) => <tr key={item.rowKey}>
          <td><input type="date" value={toDateInput(item.expectedDate)} onChange={(event) => updateSchedule(index, { expectedDate: dateTime(event.target.value) })} required /></td>
          <td><input type="time" value={item.expectedStart || ''} onChange={(event) => updateSchedule(index, { expectedStart: event.target.value })} /></td>
          <td><input type="time" value={item.expectedEnd || ''} onChange={(event) => updateSchedule(index, { expectedEnd: event.target.value })} /></td>
          <td><input value={item.expectedDuration || '00:00'} readOnly /></td>
          <td><input type="number" min="1" value={item.employeeId ?? ''} onChange={(event) => updateSchedule(index, { employeeId: event.target.value ? Number(event.target.value) : null })} placeholder="Aguardando" /></td>
          <td><input type="date" value={toDateInput(item.actualDate)} onChange={(event) => updateSchedule(index, { actualDate: event.target.value ? dateTime(event.target.value) : null })} /></td>
          <td><input type="time" value={item.actualStart || ''} onChange={(event) => updateSchedule(index, { actualStart: event.target.value })} /></td>
          <td><input type="time" value={item.actualEnd || ''} onChange={(event) => updateSchedule(index, { actualEnd: event.target.value })} /></td>
          <td><button type="button" className="os-remove-row" disabled={schedules.length === 1} onClick={() => setSchedules((current) => current.filter((_, rowIndex) => rowIndex !== index))} aria-label="Remover agendamento"><X size={16} /></button></td>
        </tr>)}</tbody></table></div>
        <div className="os-grid-summary"><span>Tempo total previsto</span><strong>{asDuration(totalMinutes)}</strong></div>
      </section>
      <div className="os-service-workspace">
        <section className="os-additional-values"><header><strong>Valores adicionais</strong><span>Composição da cobrança</span></header><FormField label="Vencimento"><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></FormField><FormField label="Taxa do boleto"><input type="number" min="0" step="0.01" value={ticketFee} onChange={(event) => setTicketFee(event.target.value)} /></FormField><FormField label="Desconto %"><input type="number" min="0" max="100" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} /></FormField><FormField label="Transporte"><input type="number" min="0" step="0.01" value={transport} onChange={(event) => setTransport(event.target.value)} /></FormField><FormField label="Aluguel"><input type="number" min="0" step="0.01" value={rental} onChange={(event) => setRental(event.target.value)} /></FormField></section>
        <section className="os-grid-section os-services-section">
          <header><div><strong>Relação de serviços cadastrados</strong><span>Itens de tbordemservicoservico</span></div><Button type="button" variant="secondary" icon={<Plus size={15} />} onClick={addService} disabled={!catalog.length}>Adicionar serviço</Button></header>
          {serviceItems.length ? <div className="os-edit-table-wrap"><table className="os-edit-table os-services-table"><thead><tr><th>Grupo</th><th>Serviço</th><th>Qtd.</th><th>Horas</th><th>Vl. mínimo</th><th>Vl. unitário</th><th>Vl. total</th><th /></tr></thead><tbody>{serviceItems.map((item, index) => {
            const catalogItem = catalog.find((service) => service.id === item.serviceId)
            return <tr key={item.rowKey}><td><input value={catalogItem?.groupId ?? '—'} readOnly /></td><td><select value={item.serviceId} onChange={(event) => changeService(index, Number(event.target.value))}>{catalog.map((service) => <option key={service.id} value={service.id} disabled={serviceItems.some((row, rowIndex) => rowIndex !== index && row.serviceId === service.id)}>{service.description || `Serviço #${service.id}`}</option>)}</select></td><td><input type="number" min="1" value={item.quantity ?? 1} onChange={(event) => updateService(index, { quantity: Number(event.target.value) })} /></td><td><input type="time" value={item.hours || ''} onChange={(event) => updateService(index, { hours: event.target.value })} /></td><td><input type="number" min="0" step="0.01" value={item.minimumValue ?? 0} onChange={(event) => updateService(index, { minimumValue: Number(event.target.value) })} /></td><td><input type="number" min="0" step="0.01" value={item.unitValue ?? 0} onChange={(event) => updateService(index, { unitValue: Number(event.target.value) })} /></td><td><input value={money(item.totalValue)} readOnly /></td><td><button type="button" className="os-remove-row" onClick={() => setServiceItems((current) => current.filter((_, rowIndex) => rowIndex !== index))} aria-label="Remover serviço"><X size={16} /></button></td></tr>
          })}</tbody></table></div> : <div className="os-empty-grid">Nenhum serviço adicionado. Use “Adicionar serviço” para montar a cobrança.</div>}
        </section>
      </div>
      <div className="os-total-strip"><span><small>Serviços</small><strong>{money(serviceSubtotal)}</strong></span><span><small>Materiais</small><strong>{money(numberValue(materialAmount))}</strong></span><span><small>Desconto</small><strong>- {money(discountAmount)}</strong></span><span className="os-total-strip__primary"><small>Valor a cobrar</small><strong>{money(Math.max(0, total))}</strong></span></div>
    </> : <section className="os-material-tab"><div><strong>Resumo de materiais</strong><p>O vínculo financeiro do pedido de material fica registrado na capa da ordem. Os itens detalhados permanecem no fluxo de materiais.</p></div><div className="form-grid form-grid--two"><FormField label="Pedido de material (ID)"><input type="number" min="1" value={materialOrderId} onChange={(event) => setMaterialOrderId(event.target.value)} /></FormField><FormField label="Valor total de materiais"><input type="number" min="0" step="0.01" value={materialAmount} onChange={(event) => setMaterialAmount(event.target.value)} /></FormField></div></section>}
    {selected && <div className="destructive-row"><span><strong>Excluir ordem</strong><small>Também remove os agendamentos e serviços vinculados.</small></span><Button type="button" variant="danger" icon={<Trash2 size={16} />} onClick={() => onDelete(selected.id)}>Excluir</Button></div>}
  </ModalForm>
}

function serviceDraft(service: ServiceCatalogItem): ServiceDraft {
  const unitValue = numberValue(service.defaultPrice ?? service.defaultValue)
  return { rowKey: `service-new-${service.id}-${Date.now()}`, serviceId: service.id, quantity: 1, hours: '00:30', unitValue, totalValue: unitValue, minimumValue: numberValue(service.minimumValue), minuteValue: numberValue(service.legacyMinuteValue) }
}

function ServiceOrderDetail({ order, catalog }: { order: ServiceOrder; catalog: ServiceCatalogItem[] }) {
  const tradeName = order.client?.nmfanta
  const legalName = order.clientName || order.client?.nmrazao || order.client?.name
  return <div className="detail-modal-content">
    <div className="detail-modal__hero-row"><div className="detail-drawer__hero"><span className="detail-avatar"><Wrench /></span><div><span>OS-{order.id} · Avulsa</span><h2>{tradeName || legalName || 'Cliente não identificado'}</h2>{tradeName && legalName && <p>{legalName}</p>}</div></div><div className="detail-status-stack">{order.priority === 'URGENTE' && <Badge tone="red">Urgente</Badge>}<Badge tone={statusTone[order.status]}>{enumLabel(order.status)}</Badge></div></div>
    <div className="detail-metrics"><span><small>Data da requisição</small><strong>{formatDate(order.dtordem)}</strong></span><span><small>Agendamentos</small><strong>{order.schedules?.length ?? 0}</strong></span><span><small>Tempo previsto</small><strong>{order.qthorac || '00:00'}</strong></span><span><small>Valor a cobrar</small><strong>{money(order.vlcobra)}</strong></span></div>
    <div className="detail-sections-grid">
      <section className="drawer-section"><h3>Atendimento</h3><dl><div><dt>Solicitante</dt><dd>{order.nmsolic || 'Não informado'}</dd></div><div><dt>Categoria</dt><dd>{enumLabel(order.category)}</dd></div><div><dt>Tipo de serviço</dt><dd>{serviceTypes.find((item) => item.value === order.tpservic)?.label || 'Não informado'}</dd></div><div><dt>Local</dt><dd>{order.idlocal ? `Local #${order.idlocal}` : 'Endereço principal'}</dd></div></dl></section>
      <section className="drawer-section"><h3>Valores</h3><dl><div><dt>Serviços</dt><dd>{money(order.vlhorar)}</dd></div><div><dt>Materiais</dt><dd>{money(order.vlmater)}</dd></div><div><dt>Transporte / aluguel</dt><dd>{money(numberValue(order.vltrans) + numberValue(order.vlalug))}</dd></div><div><dt>Desconto</dt><dd>{order.vldesco ?? 0}%</dd></div></dl></section>
      <section className="drawer-section drawer-section--wide"><h3>Descrição e observações</h3><p className="drawer-section__text">{order.dsdescr || order.description || 'Descrição não informada'}</p>{order.dsobser && <p className="drawer-section__text detail-text-spaced">{order.dsobser}</p>}{order.dscancel && <p className="drawer-section__text detail-text-spaced"><strong>Cancelamento:</strong> {order.dscancel}</p>}</section>
      <section className="drawer-section drawer-section--wide"><h3>Agendamentos</h3>{order.schedules?.length ? <div className="detail-list-grid">{order.schedules.map((item) => <span key={item.scheduleId}><strong>{formatDate(item.expectedDate)} · {item.expectedStart || '--:--'}–{item.expectedEnd || '--:--'}</strong><small>Funcionário: {item.employeeId || 'Aguardando'} · Tempo: {item.expectedDuration || '00:00'}</small></span>)}</div> : <p className="drawer-section__text">Nenhum agendamento vinculado.</p>}</section>
      <section className="drawer-section drawer-section--wide"><h3>Serviços</h3>{order.serviceItems?.length ? <div className="detail-list-grid">{order.serviceItems.map((item) => <span key={item.serviceId}><strong>{catalog.find((service) => service.id === item.serviceId)?.description || `Serviço #${item.serviceId}`}</strong><small>{item.quantity || 0} × {money(item.unitValue)} · Total {money(item.totalValue)}</small></span>)}</div> : <p className="drawer-section__text">Nenhum serviço vinculado.</p>}</section>
    </div>
  </div>
}
