import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Clock3, Columns3, Edit3, FilePlus2, List, MapPin, Play, Plus, Search, Square, Trash2, UserRound, Wrench, X } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { useAuth } from '../auth'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { enumLabel, formatDate, money, toDateInput } from '../lib/format'
import type { AttendanceLocation, AttendanceLocationPayload, Client, ClientSearchOption, Employee, Material, PagedResponse, ServiceCatalogItem, ServiceCategory, ServiceOrder, ServiceOrderListItem, ServiceOrderMaterialItem, ServiceOrderMaterialOrder, ServiceOrderOperationalFlag, ServiceOrderOrigin, ServiceOrderPayload, ServiceOrderSchedule, ServiceOrderServiceItem, ServiceOrderStatus, ServiceOrderTracking, Supplier } from '../types'
import { Badge, Button, CollapsibleFilters, ConfirmDialog, DetailModal, EmptyState, ErrorState, FormError, FormField, LoadingState, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'
import { useRouter } from '../router'
import { EmployeePicker, SupplierPicker, type PickerValue } from '../components/AsyncPicker'

const stages: ServiceOrderStatus[] = ['ABERTA', 'FINALIZADA', 'CANCELADA']
const flowStages: ServiceOrderStatus[] = stages.filter((status) => status !== 'CANCELADA')
const categories: Array<{ value: ServiceCategory; label: string }> = [
  { value: 'MAO_DE_OBRA', label: 'Mão de obra' },
  { value: 'GARANTIA', label: 'Garantia' },
  { value: 'VISITA_TECNICA', label: 'Visita técnica' },
  { value: 'CANCELAMENTO', label: 'Cancelamento' },
  { value: 'DESLOCAMENTO', label: 'Deslocamento' },
]
const legacyCategories: Array<{ value: ServiceCategory; label: string }> = [
  { value: 'ORCAMENTO', label: 'Orçamento' },
  { value: 'TRANSPORTE', label: 'Transporte' },
  { value: 'SERVICO_TERCEIRIZADO', label: 'Serviço terceirizado' },
]
const categoryFlags: Record<ServiceCategory, string> = { MAO_DE_OBRA: 'M', GARANTIA: 'G', VISITA_TECNICA: 'V', CANCELAMENTO: 'C', DESLOCAMENTO: 'D', ORCAMENTO: 'O', TRANSPORTE: 'T', SERVICO_TERCEIRIZADO: 'E' }
const originLabels: Record<string, string> = { C: 'Contratada', A: 'Avulsa', E: 'Experiência', O: 'Obras' }
const serviceTypes = [
  { value: 'E', label: 'Elétricos' },
  { value: 'H', label: 'Hidráulico' },
  { value: 'A', label: 'Ambos' },
  // { value: 'L', label: 'Alvenaria' },
  // { value: 'I', label: 'Hidro' },
  // { value: 'O', label: 'Outros' },
]

const waitingEmployee = {
  employeeId: 1,
  employeeName: 'AGUARDANDO',
  employeeNickname: 'AAGUARDANDO',
  employeePosition: null,
  employeePhone: null,
}

const statusTone: Record<ServiceOrderStatus, 'orange' | 'blue' | 'purple' | 'green' | 'neutral' | 'red'> = {
  ABERTA: 'orange', ENCAMINHADA: 'blue', AGENDADA: 'purple', EM_ATENDIMENTO: 'green', FINALIZADA: 'neutral', CANCELADA: 'red',
}

type ScheduleDraft = ServiceOrderSchedule & { rowKey: string }
type ServiceDraft = ServiceOrderServiceItem & { rowKey: string }
type MaterialDraft = ServiceOrderMaterialItem & { rowKey: string }
type DateFilterMode = 'none' | 'day' | 'range' | 'month' | 'week'
type ServiceOrderFilter = 'Todas' | 'Urgentes' | 'ABERTA' | 'EM_ATENDIMENTO' | 'FINALIZADA' | 'CANCELADA'

type DateBounds = {
  startDate?: string
  endDate?: string
}

type TimerAction = {
  mode: 'start' | 'stop'
  orderId: number
  trackingId?: number
  scheduleId: number
  serviceId: number
  serviceDescription: string
  employeeId: number | null
  employeeName: string
}

function localToday() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function localDateTimeNow() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 16)
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
  if (mode === 'day' && date) return { startDate: date, endDate: date }
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
  const minutes = endHour * 60 + endMinute - startHour * 60 - startMinute
  return minutes < 0 ? minutes + 24 * 60 : minutes
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

function LiveElapsed({ startedAt }: { startedAt: string | null }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  const started = startedAt ? new Date(startedAt).getTime() : Number.NaN
  const elapsed = Number.isFinite(started) ? Math.max(0, Math.floor((now - started) / 60_000)) : 0
  return <>{asDuration(elapsed)}</>
}

function currencyValue(value: number) {
  return Math.round((Math.max(0, value) + Number.EPSILON) * 100) / 100
}

function clientDisplay(client: Client | ClientSearchOption) {
  if ('tradeName' in client) return client.tradeName || client.legalName || `Cliente #${client.id}`
  return client.nmfanta || client.name || client.nmrazao || `Cliente #${client.id}`
}

function clientSearchAddress(client: ClientSearchOption) {
  const cityState = [client.city, client.state].filter(Boolean).join(' / ')
  return [client.street, client.complement, client.district, cityState, client.zipCode].filter(Boolean).join(' · ')
}

function employeeDisplay(employee: Employee) {
  return employee.name || employee.nickname || `Funcionário #${employee.id}`
}

function scheduleEmployeeDisplay(schedule: ServiceOrderSchedule) {
  return schedule.employeeName || schedule.employeeNickname || (schedule.employeeId && schedule.employeeId !== 1 ? `Funcionário #${schedule.employeeId}` : 'AGUARDANDO')
}

const operationalFlags: Array<{ flag: ServiceOrderOperationalFlag; label: string; tone: 'red' | 'orange' | 'blue' | 'purple' | 'green' }> = [
  { flag: 'URGENT', label: 'Urgente', tone: 'red' },
  { flag: 'SCHEDULED_TIME', label: 'Hora marcada', tone: 'orange' },
  { flag: 'ROUTED', label: 'Encaminhada', tone: 'blue' },
  { flag: 'STARTED', label: 'Iniciada', tone: 'purple' },
  { flag: 'FINISHED', label: 'Finalizada', tone: 'green' },
]

function listFlagValue(order: ServiceOrderListItem, flag: ServiceOrderOperationalFlag) {
  if (flag === 'URGENT') return order.priority === 'URGENTE'
  if (flag === 'SCHEDULED_TIME') return order.scheduledTime
  if (flag === 'ROUTED') return order.routed
  if (flag === 'STARTED') return order.started
  return order.finished
}

function detailFlagValue(order: ServiceOrder, flag: ServiceOrderOperationalFlag) {
  const schedules = order.schedules ?? []
  if (flag === 'URGENT') return order.priority === 'URGENTE' || schedules.some((item) => item.urgentFlag === 'S')
  if (flag === 'SCHEDULED_TIME') return schedules.some((item) => item.scheduledTimeFlag === 'S')
  if (flag === 'ROUTED') return schedules.some((item) => item.routedFlag === 'S')
  if (flag === 'STARTED') return schedules.some((item) => item.startedFlag === 'S')
  return order.status === 'FINALIZADA' || schedules.some((item) => item.finishedFlag === 'S')
}

function OperationalCheckbox({ active, label, tone, disabled, onChange }: { active: boolean; label: string; tone: 'red' | 'orange' | 'blue' | 'purple' | 'green'; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return <label className={`os-operational-check os-operational-check--${tone} ${active ? 'is-checked' : ''}`} title={`${label}: ${active ? 'marcado' : 'desmarcado'}`} onClick={(event) => event.stopPropagation()}>
    <input type="checkbox" checked={active} disabled={disabled} aria-label={label} onChange={(event) => onChange(event.target.checked)} />
    <span aria-hidden="true"><CheckCircle2 size={16} strokeWidth={2.5} /></span>
  </label>
}

function patchListFlag(order: ServiceOrderListItem, flag: ServiceOrderOperationalFlag, checked: boolean): ServiceOrderListItem {
  if (flag === 'URGENT') return { ...order, priority: checked ? 'URGENTE' : 'NORMAL' }
  if (flag === 'SCHEDULED_TIME') return { ...order, scheduledTime: checked }
  if (flag === 'ROUTED') return { ...order, routed: checked }
  if (flag === 'STARTED') return { ...order, started: checked }
  return { ...order, finished: checked, status: checked ? 'FINALIZADA' : 'ABERTA' }
}

function patchDetailFlag(order: ServiceOrder, flag: ServiceOrderOperationalFlag, checked: boolean): ServiceOrder {
  const field = flag === 'URGENT' ? 'urgentFlag' : flag === 'SCHEDULED_TIME' ? 'scheduledTimeFlag' : flag === 'ROUTED' ? 'routedFlag' : flag === 'STARTED' ? 'startedFlag' : 'finishedFlag'
  const value = checked ? 'S' : 'N'
  const currentSchedules = order.schedules ?? []
  const schedules = currentSchedules.length
    ? currentSchedules.map((item) => ({ ...item, [field]: value }))
    : flag === 'FINISHED' ? currentSchedules : [{ serviceOrderId: order.id, scheduleId: 1, expectedDate: order.dtordem || localDateTimeNow(), [field]: value }]
  return {
    ...order,
    schedules,
    priority: flag === 'URGENT' ? checked ? 'URGENTE' : 'NORMAL' : order.priority,
    status: flag === 'FINISHED' ? checked ? 'FINALIZADA' : 'ABERTA' : order.status,
    flstatu: flag === 'FINISHED' ? checked ? 'F' : 'A' : order.flstatu,
  }
}

function finalizationError(
  serviceItems: ServiceOrderServiceItem[],
  schedules: ServiceOrderSchedule[],
  catalog: ServiceCatalogItem[],
) {
  if (serviceItems.length === 0) {
    return 'Não há serviço cadastrado, ordem de serviço não pode ser encerrada.'
  }
  for (const service of serviceItems) {
    const appointments = schedules.filter((schedule) => schedule.serviceId === service.serviceId || (serviceItems.length === 1 && !schedule.serviceId))
    const incomplete = appointments.find((schedule) => !schedule.actualStart || !schedule.actualEnd)
    if (appointments.length === 0 || incomplete) {
      const description = catalog.find((item) => item.id === service.serviceId)?.description || `Serviço #${service.serviceId}`
      const employee = incomplete
        ? incomplete.employeeName || incomplete.employeeNickname || (incomplete.employeeId ? `Funcionário #${incomplete.employeeId}` : 'não informado')
        : 'não informado'
      return `Ordem de serviço não pode ser finalizada, preencha o horário de início e hora final do serviço: ${description} feito pelo funcionário ${employee}.`
    }
  }
  return ''
}

function attendanceLocationDisplay(location: AttendanceLocation) {
  const address = [location.address, location.complement, location.district, location.city, location.zipCode].filter(Boolean).join(' · ')
  return location.description && address ? `${location.description} — ${address}` : location.description || address || `Local #${location.id}`
}

export function ServiceOrders() {
  const queryClient = useQueryClient()
  const { navigate, pathname, search: routeSearch } = useRouter()
  const [view, setView] = useState<'kanban' | 'list'>('list')
  const [search, setSearch] = useState('')
  const [cpfFilter, setCpfFilter] = useState('')
  const [cnpjFilter, setCnpjFilter] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [contractCode, setContractCode] = useState('')
  const [attendanceLocationId, setAttendanceLocationId] = useState('')
  const [orderFilter, setOrderFilter] = useState<ServiceOrderFilter>('Todas')
  const [originFilter, setOriginFilter] = useState<'' | 'C' | 'A' | 'O' | 'E'>('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [technicianFilter, setTechnicianFilter] = useState<PickerValue>(null)
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('day')
  const [date, setDate] = useState(localToday())
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [month, setMonth] = useState('')
  const [weekDate, setWeekDate] = useState(localToday())
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<ServiceOrder | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [orderToDelete, setOrderToDelete] = useState<number | null>(null)
  const [toast, setToast] = useState('')

  // Busca geral (Ctrl+K): /ordens-de-servico?id=N abre o registro direto.
  useEffect(() => {
    const requestedId = Number(new URLSearchParams(routeSearch).get('id'))
    if (!requestedId) return
    setDetailId(requestedId)
    navigate(pathname, { replace: true })
  }, [routeSearch, pathname, navigate])
  const [formError, setFormError] = useState('')
  const [timerAction, setTimerAction] = useState<TimerAction | null>(null)
  const [timerDateTime, setTimerDateTime] = useState(localDateTimeNow())
  const [timerError, setTimerError] = useState('')
  const [timerLoadingId, setTimerLoadingId] = useState<number | null>(null)
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
    cpfFilter,
    cnpjFilter,
    orderNumber,
    contractCode,
    attendanceLocationId,
    dateBounds.startDate ?? '',
    dateBounds.endDate ?? '',
    orderFilter,
    originFilter,
    categoryFilter,
    technicianFilter?.id ?? '',
    page,
    pageSize,
  ] as const

  const ordersQuery = useQuery({
    queryKey: ordersQueryKey,
    queryFn: () => api.serviceOrders.list({
      clientName: debouncedSearch || undefined,
      cpf: cpfFilter || undefined,
      cnpj: cnpjFilter || undefined,
      orderNumber: orderNumber ? Number(orderNumber) : undefined,
      contractCode: contractCode ? Number(contractCode) : undefined,
      attendanceLocationId: attendanceLocationId ? Number(attendanceLocationId) : undefined,
      startDate: dateBounds.startDate,
      endDate: dateBounds.endDate,
      urgentOnly: orderFilter === 'Urgentes' || undefined,
      status: orderFilter === 'ABERTA' || orderFilter === 'EM_ATENDIMENTO' || orderFilter === 'FINALIZADA' || orderFilter === 'CANCELADA' ? orderFilter : undefined,
      origin: originFilter || undefined,
      category: categoryFilter || undefined,
      technicianId: technicianFilter?.id,
      page,
      size: pageSize,
    }),
    enabled: !periodError,
    placeholderData: keepPreviousData,
  })
  const summaryQuery = useQuery({
    queryKey: [...queryKeys.serviceOrders, 'summary', ...ordersQueryKey.slice(2, 11), originFilter, categoryFilter, technicianFilter?.id ?? ''],
    queryFn: () => api.serviceOrders.summary({
      clientName: debouncedSearch || undefined,
      cpf: cpfFilter || undefined,
      cnpj: cnpjFilter || undefined,
      orderNumber: orderNumber ? Number(orderNumber) : undefined,
      contractCode: contractCode ? Number(contractCode) : undefined,
      attendanceLocationId: attendanceLocationId ? Number(attendanceLocationId) : undefined,
      startDate: dateBounds.startDate,
      endDate: dateBounds.endDate,
      origin: originFilter || undefined,
      category: categoryFilter || undefined,
      technicianId: technicianFilter?.id,
    }),
    enabled: !periodError,
    placeholderData: keepPreviousData,
  })
  const summary = summaryQuery.data
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
      showToast(`${updated.id} alterada para “${enumLabel(updated.status)}”.`)
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(ordersQueryKey, context.previous)
      showToast(apiErrorMessage(error))
    },
  })
  const operationalFlagMutation = useMutation({
    mutationFn: ({ id, flag, checked }: { id: number; flag: ServiceOrderOperationalFlag; checked: boolean }) => api.serviceOrders.updateOperationalFlag(id, flag, checked),
    onMutate: async ({ id, flag, checked }) => {
      const detailKey = [...queryKeys.serviceOrders, 'detail', id] as const
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ordersQueryKey, exact: true }),
        queryClient.cancelQueries({ queryKey: detailKey, exact: true }),
      ])
      const previousList = queryClient.getQueryData<PagedResponse<ServiceOrderListItem>>(ordersQueryKey)
      const previousDetail = queryClient.getQueryData<ServiceOrder>(detailKey)
      queryClient.setQueryData<PagedResponse<ServiceOrderListItem>>(ordersQueryKey, (current) => current ? {
        ...current,
        content: current.content.map((order) => order.id === id ? patchListFlag(order, flag, checked) : order),
      } : current)
      queryClient.setQueryData<ServiceOrder>(detailKey, (current) => current ? patchDetailFlag(current, flag, checked) : current)
      return { previousList, previousDetail, detailKey }
    },
    onSuccess: async (updated, variables) => {
      queryClient.setQueryData<ServiceOrder>([...queryKeys.serviceOrders, 'detail', variables.id], updated)
      await queryClient.invalidateQueries({ queryKey: queryKeys.serviceOrders })
      const label = operationalFlags.find((item) => item.flag === variables.flag)?.label || 'Indicador'
      showToast(`${label} ${variables.checked ? 'marcada' : 'desmarcada'} na OS ${variables.id}.`)
    },
    onError: (error, _variables, context) => {
      if (context?.previousList) queryClient.setQueryData(ordersQueryKey, context.previousList)
      if (context?.previousDetail) queryClient.setQueryData(context.detailKey, context.previousDetail)
      showToast(apiErrorMessage(error, 'Não foi possível salvar o indicador da ordem de serviço.'))
    },
  })
  const trackingMutation = useMutation({
    mutationFn: async ({ action, dateTime }: { action: TimerAction; dateTime: string }) => action.mode === 'start'
      ? api.serviceOrders.startTracking(action.orderId, {
          scheduleId: action.scheduleId,
          serviceId: action.serviceId,
          employeeId: action.employeeId,
          startedAt: `${dateTime}:00`,
        })
      : api.serviceOrders.stopTracking(action.orderId, action.trackingId!, `${dateTime}:00`),
    onSuccess: async (tracking) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.serviceOrders })
      setTimerAction(null)
      setTimerError('')
      showToast(tracking.running
        ? `Atendimento da ${tracking.serviceOrderId} iniciado às ${tracking.startTime}.`
        : `Atendimento da ${tracking.serviceOrderId} encerrado com ${tracking.duration || '00:00'}.`)
    },
    onError: (error) => setTimerError(apiErrorMessage(error)),
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
  const invoiceMutation = useMutation({
    mutationFn: (serviceOrderId: number) => api.invoices.createFromServiceOrder(serviceOrderId),
    onSuccess: async (invoice) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices })
      setDetailId(null)
      navigate(`/notas-fiscais?invoiceId=${invoice.id}`)
    },
    onError: (error) => showToast(apiErrorMessage(error, 'Não foi possível gerar a nota fiscal da ordem de serviço.')),
  })

  const orders = ordersQuery.data?.content ?? []
  const total = ordersQuery.data?.total ?? 0
  const totalPages = ordersQuery.data?.totalPages ?? 0
  const firstResult = total === 0 ? 0 : page * pageSize + 1
  const lastResult = Math.min((page + 1) * pageSize, total)
  const advancedFilterCount = [search, orderNumber, contractCode, attendanceLocationId, cpfFilter, cnpjFilter].filter((value) => value.trim()).length

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
    if (mode === 'day' && !date) setDate(today)
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

  function clearAdvancedFilters() {
    setSearch('')
    setOrderNumber('')
    setContractCode('')
    setAttendanceLocationId('')
    setCpfFilter('')
    setCnpjFilter('')
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

  async function advance(order: ServiceOrderListItem | ServiceOrder) {
    const currentIndex = flowStages.indexOf(order.status)
    if (currentIndex < 0 || currentIndex === flowStages.length - 1) return
    const nextStatus = flowStages[currentIndex + 1]
    if (nextStatus === 'FINALIZADA') {
      try {
        const completeOrder = await queryClient.fetchQuery({
          queryKey: [...queryKeys.serviceOrders, 'detail', order.id],
          queryFn: () => api.serviceOrders.find(order.id),
        })
        const validationMessage = finalizationError(
          completeOrder.serviceItems ?? [],
          completeOrder.schedules ?? [],
          catalogQuery.data?.content ?? [],
        )
        if (validationMessage) {
          showToast(validationMessage)
          return
        }
      } catch (error) {
        showToast(apiErrorMessage(error, 'Não foi possível verificar os dados da ordem de serviço.'))
        return
      }
    }
    advanceMutation.mutate({ id: order.id, status: nextStatus })
  }

  async function openTimer(order: ServiceOrderListItem | ServiceOrder) {
    setTimerLoadingId(order.id)
    try {
      const completeOrder = await queryClient.fetchQuery({
        queryKey: [...queryKeys.serviceOrders, 'detail', order.id],
        queryFn: () => api.serviceOrders.find(order.id),
      })
      const trackingDetails = completeOrder.trackingDetails ?? []
      const running = trackingDetails.find((tracking) => tracking.running)
      if (running) {
        if (running.scheduleId == null || running.serviceId == null) {
          showToast('O acompanhamento em andamento não possui serviço ou agendamento vinculado.')
          return
        }
        setTimerAction({
          mode: 'stop', orderId: order.id, trackingId: running.id, scheduleId: running.scheduleId,
          serviceId: running.serviceId, serviceDescription: running.serviceDescription,
          employeeId: running.employeeId, employeeName: running.employeeName,
        })
        setTimerDateTime(localDateTimeNow())
        setTimerError('')
        return
      }
      const services = completeOrder.serviceItems ?? []
      if (services.length === 0) {
        showToast('Não há serviço cadastrado para iniciar o atendimento.')
        return
      }
      const trackedScheduleIds = new Set(trackingDetails.filter((tracking) => Boolean(tracking.startTime)).map((tracking) => tracking.scheduleId).filter((id): id is number => id != null))
      const schedule = (completeOrder.schedules ?? []).find((item) => item.scheduleId != null && !trackedScheduleIds.has(item.scheduleId))
      if (!schedule || schedule.scheduleId == null) {
        showToast('Não há um novo agendamento disponível para iniciar.')
        return
      }
      const serviceId = schedule.serviceId ?? (services.length === 1 ? services[0].serviceId : null)
      if (serviceId == null) {
        showToast('Selecione o serviço executado no agendamento antes de iniciar.')
        return
      }
      const serviceDescription = catalogQuery.data?.content.find((service) => service.id === serviceId)?.description || `Serviço #${serviceId}`
      const employeeName = schedule.employeeName || schedule.employeeNickname
        || (schedule.employeeId ? `Funcionário #${schedule.employeeId}` : 'Funcionário não informado')
      setTimerAction({
        mode: 'start', orderId: order.id, scheduleId: schedule.scheduleId, serviceId,
        serviceDescription, employeeId: schedule.employeeId ?? null, employeeName,
      })
      setTimerDateTime(schedule.actualStart
        ? `${toDateInput(schedule.actualDate) || localToday()}T${schedule.actualStart}`
        : localDateTimeNow())
      setTimerError('')
    } catch (error) {
      showToast(apiErrorMessage(error, 'Não foi possível carregar o acompanhamento da ordem.'))
    } finally {
      setTimerLoadingId(null)
    }
  }

  function submitTimer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!timerAction || !timerDateTime) return
    trackingMutation.mutate({ action: timerAction, dateTime: timerDateTime })
  }

  const detail = detailQuery.data

  return <>
    <PageHeader eyebrow="Operação" title="Ordens de serviço" subtitle="Cadastro operacional alinhado ao fluxo legado da Gente Boa." actions={<Button icon={<Plus size={18} />} onClick={openNew}>Nova OS</Button>} />
    <section className="stats-grid stats-grid--four">
      <StatCard label="Total geral" value={(summary?.total ?? 0).toLocaleString('pt-BR')} helper={`${(summary?.urgent ?? 0).toLocaleString('pt-BR')} urgentes · ${(summary?.canceled ?? 0).toLocaleString('pt-BR')} canceladas`} icon={<Wrench />} tone="blue" />
      <StatCard label="Abertas" value={(summary?.open ?? 0).toLocaleString('pt-BR')} helper="Ainda não iniciadas" icon={<CircleAlert />} tone="orange" />
      <StatCard label="Em andamento" value={(summary?.inProgress ?? 0).toLocaleString('pt-BR')} helper="Atendimento iniciado" icon={<Clock3 />} tone="purple" />
      <StatCard label="Concluídas" value={(summary?.finished ?? 0).toLocaleString('pt-BR')} helper="Finalizadas no filtro" icon={<CheckCircle2 />} tone="green" />
    </section>

    <section className="panel data-panel os-panel">
      <CollapsibleFilters summary="Cliente, OS, contrato, local, CPF ou CNPJ" activeCount={advancedFilterCount} onClear={clearAdvancedFilters}>
          <label className="structured-filter-field"><span>Nome do cliente</span><div className="search-box"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); resetPage() }} placeholder="Razão social ou nome fantasia" /></div></label>
          <label className="structured-filter-field"><span>Número da OS</span><input type="number" min="1" value={orderNumber} onChange={(event) => { setOrderNumber(event.target.value); resetPage() }} /></label>
          <label className="structured-filter-field"><span>Contrato</span><input type="number" min="1" value={contractCode} onChange={(event) => { setContractCode(event.target.value); resetPage() }} /></label>
          <label className="structured-filter-field"><span>Código do local</span><input type="number" min="1" value={attendanceLocationId} onChange={(event) => { setAttendanceLocationId(event.target.value); resetPage() }} /></label>
          <label className="structured-filter-field"><span>CPF</span><input inputMode="numeric" value={cpfFilter} onChange={(event) => { setCpfFilter(event.target.value.replace(/\D/g, '')); resetPage() }} placeholder="Somente números" /></label>
          <label className="structured-filter-field"><span>CNPJ</span><input inputMode="numeric" value={cnpjFilter} onChange={(event) => { setCnpjFilter(event.target.value.replace(/\D/g, '')); resetPage() }} placeholder="Somente números" /></label>
          <label className="structured-filter-field"><span>Tipo</span><select value={originFilter} onChange={(event) => { setOriginFilter(event.target.value as typeof originFilter); resetPage() }}><option value="">Geral</option><option value="C">Contratada</option><option value="A">Avulsa</option><option value="O">Obras</option><option value="E">Experiência</option></select></label>
          <label className="structured-filter-field"><span>Categoria</span><select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); resetPage() }}><option value="">Geral</option>{[...categories, ...legacyCategories].map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="structured-filter-field"><span>Técnico</span><EmployeePicker value={technicianFilter} onChange={(value) => { setTechnicianFilter(value); resetPage() }} /></label>
      </CollapsibleFilters>
      <div className="data-toolbar data-toolbar--orders">
        <div className="segmented-control os-status-filter"><button className={orderFilter === 'Todas' ? 'active' : ''} onClick={() => { setOrderFilter('Todas'); resetPage() }}>Todas</button><button className={orderFilter === 'Urgentes' ? 'active' : ''} onClick={() => { setOrderFilter('Urgentes'); resetPage() }}>Urgentes</button><button className={orderFilter === 'ABERTA' ? 'active' : ''} onClick={() => { setOrderFilter('ABERTA'); resetPage() }}>Abertas</button><button className={orderFilter === 'EM_ATENDIMENTO' ? 'active' : ''} onClick={() => { setOrderFilter('EM_ATENDIMENTO'); resetPage() }}>Em andamento</button><button className={orderFilter === 'FINALIZADA' ? 'active' : ''} onClick={() => { setOrderFilter('FINALIZADA'); resetPage() }}>Finalizadas</button><button className={orderFilter === 'CANCELADA' ? 'active' : ''} onClick={() => { setOrderFilter('CANCELADA'); resetPage() }}>Canceladas</button></div>
        <label className="toolbar-select toolbar-select--compact os-period-mode"><span>Período</span><select value={dateFilterMode} onChange={(event) => changeDateFilterMode(event.target.value as DateFilterMode)}><option value="day">Dia</option><option value="range">Entre datas</option><option value="week">Semana</option><option value="month">Mês</option><option value="none">Todas as datas</option></select></label>
        {dateFilterMode === 'day' && <label className="os-date-field"><span>Dia</span><div><CalendarDays size={15} /><input type="date" value={date} onChange={(event) => { setDate(event.target.value); resetPage() }} aria-label="Filtrar por dia" /></div></label>}
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
            {stageOrders.map((order) => <article className={`os-card ${order.scheduledTime ? 'os-card--scheduled' : ''}`} key={order.id} onClick={() => setDetailId(order.id)}>
              <div className="os-card__top"><span>OS-{order.id}</span><div>{order.priority === 'URGENTE' && <Badge tone="red">Urgente</Badge>}<span className="os-card__origin">{order.origin === 'C' ? 'Contrato' : 'Avulsa'}</span></div></div>
              {order.scheduledTime && <div className="os-card__appointment"><Clock3 size={16} /><span><strong>Hora marcada</strong><small>{order.scheduledAt ? formatDate(order.scheduledAt) : formatDate(order.orderedAt)}{order.scheduledStart ? ` às ${order.scheduledStart}` : ''}{order.scheduledEnd ? `–${order.scheduledEnd}` : ''}</small></span></div>}
              <h3>{order.clientTradeName || order.clientName || 'Cliente não identificado'}</h3>{order.clientTradeName && order.clientName && <small className="os-card__company-name">{order.clientName}</small>}
              <div className="os-card__client-summary"><span>Cliente #{order.clientId || '—'}</span><span>{order.completedAttendances || 0} {(order.completedAttendances || 0) === 1 ? 'atendimento concluído' : 'atendimentos concluídos'}</span></div>
              <dl className="os-card__details">
                <div><dt><UserRound size={13} />Solicitante</dt><dd>{order.requester || 'Não informado'}</dd></div>
                <div><dt><MapPin size={13} />Endereço</dt><dd>{order.serviceAddress || 'Não informado'}</dd></div>
                <div><dt><Wrench size={13} />Descrição</dt><dd>{order.description || 'Não informada'}</dd></div>
                {order.orderNotes && <div><dt>Obs. atendimento</dt><dd>{order.orderNotes}</dd></div>}
                {order.referencePoint && <div><dt>Ponto de referência</dt><dd>{order.referencePoint}</dd></div>}
                {order.clientNotes && <div><dt>Obs. cliente</dt><dd>{order.clientNotes}</dd></div>}
                {order.searchTarget && <div><dt>Procurar por</dt><dd>{order.searchTarget}</dd></div>}
              </dl>
              <div className={`os-card__services ${order.serviceDescriptions.length === 0 ? 'os-card__services--empty' : ''}`}><strong>Serviços</strong><span>{order.serviceDescriptions.length ? order.serviceDescriptions.join(' · ') : 'NENHUM SERVIÇO VINCULADO'}</span></div>
              <div className="os-meta"><span><CalendarDays size={14} />Abertura: {formatDate(order.orderedAt)}</span></div>
              {order.tracking?.startTime && <div className={`os-timer-status ${order.tracking.running ? 'os-timer-status--running' : ''}`}><Clock3 size={14} /><span><strong>{order.tracking.running ? <>Em andamento · <LiveElapsed startedAt={order.tracking.startedAt} /></> : `Atendimento realizado: ${order.tracking.duration || '00:00'}`}</strong><small>{order.tracking.employeeName}{order.tracking.running ? ` · Início ${order.tracking.startTime}` : ''}</small></span></div>}
              {!['FINALIZADA', 'CANCELADA'].includes(stage) ? <div className="os-card__actions"><button type="button" className={`os-timer-button ${order.tracking?.running ? 'os-timer-button--stop' : ''}`} disabled={order.serviceDescriptions.length === 0 || timerLoadingId === order.id || trackingMutation.isPending} title={order.serviceDescriptions.length === 0 ? 'Nenhum serviço vinculado à ordem de serviço' : undefined} onClick={(event) => { event.preventDefault(); event.stopPropagation(); openTimer(order) }}>{order.tracking?.running ? <><Square size={14} /> Parar</> : <><Play size={14} /> Iniciar</>}</button><button type="button" disabled={advanceMutation.isPending} onClick={(event) => { event.preventDefault(); event.stopPropagation(); advance(order) }}>Finalizar OS <CheckCircle2 size={15} /></button></div> : <span className="os-complete"><CheckCircle2 size={15} /> {stage === 'FINALIZADA' ? 'Atendimento concluído' : 'Atendimento cancelado'}</span>}
            </article>)}
            {stageOrders.length === 0 && <div className="kanban-empty">Nenhuma OS nesta etapa.</div>}
          </div></section>
        })}
      </div> : <div className={`table-wrap ${ordersQuery.isFetching ? 'table-wrap--refreshing' : ''}`}><table className="data-table os-table"><thead><tr><th>OS</th><th>Cliente</th>
      {/* <th>Solicitante</th> */}
      <th>Descrição / Serviço</th><th>Abertura</th><th>Profissional</th><th>Previsão</th>
      {/* <th>Tipo</th> */}
      {/* <th>Valor</th> */}
      {/* <th>Situação</th> */}
      <th className="os-status-heading">Urgente</th><th className="os-status-heading">Hora marcada</th><th className="os-status-heading">Encaminhada</th><th className="os-status-heading">Iniciada</th><th className="os-status-heading">Finalizada</th> </tr></thead><tbody>{orders.map((order) => {
        const professionals = order.professionalNames?.length ? order.professionalNames : ['AGUARDANDO']
        const waitingProfessional = professionals.some((name) => name.trim().toUpperCase().includes('AGUARDANDO'))
        return <tr key={order.id} onClick={() => setDetailId(order.id)}>
          <td><strong>{order.id}</strong></td>
          <td><strong className="table-primary">{order.clientTradeName || order.clientName || 'Cliente não identificado'}</strong><small className="table-secondary">Cliente #{order.clientId || '—'}</small></td>
          {/* <td>{order.requester || '—'}</td> */}
          <td><strong className="table-primary">{order.description || 'Não informado'}</strong><small className={`table-secondary ${order.serviceDescriptions.length === 0 ? 'service-description-empty' : ''}`}>{order.serviceDescriptions.length ? order.serviceDescriptions.join(' · ') : 'NENHUM SERVIÇO VINCULADO'}</small></td>
          <td>{formatDate(order.orderedAt)}</td>
          <td><span className={waitingProfessional ? 'os-professional os-professional--waiting' : 'os-professional'} title={professionals.join(', ')}>{professionals.join(', ')}</span></td>
          <td className="os-forecast-cell"><strong className="table-primary">{order.forecastAt ? formatDate(order.forecastAt) : '—'}</strong>{(order.forecastStart || order.forecastEnd) && <small className="table-secondary">{order.forecastStart || '--:--'} às {order.forecastEnd || '--:--'}</small>}</td>
          {/* <td>{order.origin === 'C' ? 'Contrato' : 'Avulsa'}</td> */}
          {/* <td>{money(order.totalValue)}</td> */}
          {/* <td><Badge tone={statusTone[order.status]}>{enumLabel(order.status)}</Badge></td> */}
          {operationalFlags.map((item) => <td className="os-status-cell" key={item.flag}><OperationalCheckbox active={listFlagValue(order, item.flag)} label={item.label} tone={item.tone} disabled={order.status === 'CANCELADA' || operationalFlagMutation.isPending} onChange={(checked) => operationalFlagMutation.mutate({ id: order.id, flag: item.flag, checked })} /></td>)}
          {/* <td><button className="row-action" aria-label={`Visualizar ${order.id}`}><ChevronRight size={18} /></button></td> */}
        </tr>
      })}</tbody></table></div>}
      <footer className="table-footer table-footer--pagination">
        <span>Mostrando <strong>{firstResult}–{lastResult}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong> ordens</span>
        <div className="os-pagination-area">
          {dateFilterMode !== 'none' && <button className="table-link" onClick={clearPeriod}>Limpar período</button>}
          <div className="pagination-controls">
            <label className="dynamic-page-size">Itens <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); resetPage() }}>{[5, 10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
            <span>10 por página</span>
            <button disabled={page === 0 || ordersQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button>
            <span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span>
            <button disabled={page + 1 >= totalPages || ordersQuery.isFetching} onClick={() => setPage((value) => value + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button>
          </div>
        </div>
      </footer>
    </section>

    <DetailModal open={detailId !== null} onClose={() => setDetailId(null)} title={detail ? `Ordem de serviço ${detail.id}` : 'Detalhes da ordem de serviço'} description="Dados do atendimento, agenda, serviços e valores registrados." size="xlarge" actions={detail ? <><Button variant="danger" icon={<Trash2 size={16} />} disabled={deleteMutation.isPending} onClick={() => setOrderToDelete(detail.id)}>Excluir</Button>{detail.status === 'FINALIZADA' && <Button variant="secondary" icon={<FilePlus2 size={16} />} disabled={invoiceMutation.isPending} onClick={() => invoiceMutation.mutate(detail.id)}>{invoiceMutation.isPending ? 'Gerando NF...' : 'Gerar NF'}</Button>}{!['FINALIZADA', 'CANCELADA'].includes(detail.status) && <Button variant="secondary" icon={detail.trackingDetails?.some((tracking) => tracking.running) ? <Square size={16} /> : <Play size={16} />} disabled={!detail.serviceItems?.length || trackingMutation.isPending || timerLoadingId === detail.id} title={!detail.serviceItems?.length ? 'Nenhum serviço vinculado à ordem de serviço' : undefined} onClick={() => openTimer(detail)}>{detail.trackingDetails?.some((tracking) => tracking.running) ? 'Parar atendimento' : 'Iniciar atendimento'}</Button>}{!['FINALIZADA', 'CANCELADA'].includes(detail.status) && <Button variant="secondary" icon={<CheckCircle2 size={16} />} disabled={advanceMutation.isPending} onClick={() => advance(detail)}>Finalizar OS</Button>}<Button icon={<Edit3 size={16} />} onClick={() => openEdit(detail)}>Editar OS</Button></> : undefined}>
      {detailQuery.isLoading ? <LoadingState label="Carregando a ordem de serviço..." /> : detailQuery.isError ? <ErrorState message={apiErrorMessage(detailQuery.error)} onRetry={() => detailQuery.refetch()} /> : detail ? <ServiceOrderDetail order={detail} catalog={catalogQuery.data?.content ?? []} flagSaving={operationalFlagMutation.isPending} onFlagChange={(flag, checked) => operationalFlagMutation.mutate({ id: detail.id, flag, checked })} /> : null}
    </DetailModal>

    <Modal open={timerAction !== null} onClose={() => !trackingMutation.isPending && setTimerAction(null)} title={timerAction?.mode === 'stop' ? 'Parar atendimento' : 'Iniciar atendimento'} description={timerAction ? `${timerAction.orderId} · ${timerAction.serviceDescription}` : undefined} size="medium">
      <ModalForm onSubmit={submitTimer} onCancel={() => setTimerAction(null)} submitting={trackingMutation.isPending} submitLabel={trackingMutation.isPending ? 'Registrando...' : timerAction?.mode === 'stop' ? 'Confirmar parada' : 'Confirmar início'}>
        {timerError && <FormError message={timerError} />}
        <div className="os-timer-confirmation"><span className={timerAction?.mode === 'stop' ? 'os-timer-confirmation__icon os-timer-confirmation__icon--stop' : 'os-timer-confirmation__icon'}>{timerAction?.mode === 'stop' ? <Square size={22} /> : <Play size={22} />}</span><div><strong>{timerAction?.mode === 'stop' ? 'Confirma o horário final' : 'Confirma o horário inicial'} do serviço {timerAction?.serviceDescription}?</strong><small><UserRound size={13} /> {timerAction?.employeeName}</small></div></div>
        <FormField label={timerAction?.mode === 'stop' ? 'Data e hora final' : 'Data e hora inicial'}><input type="datetime-local" value={timerDateTime} onChange={(event) => setTimerDateTime(event.target.value)} required /></FormField>
      </ModalForm>
    </Modal>

    <Modal open={modalOpen} onClose={() => !saveMutation.isPending && setModalOpen(false)} title={selected ? `Editar ${selected.id}` : 'Nova ordem de serviço'} description="Preenchimento baseado na tela operacional do sistema Delphi." size="xlarge">
      <ServiceOrderForm key={formKey} selected={selected} catalog={catalogQuery.data?.content ?? []} formError={formError} submitting={saveMutation.isPending} onCancel={() => setModalOpen(false)} onDelete={(id) => setOrderToDelete(id)} onNotify={showToast} onSubmit={(payload) => saveMutation.mutate({ id: selected?.id, payload })} />
    </Modal>
    <ConfirmDialog open={orderToDelete !== null} title={`Excluir ${orderToDelete ?? ''}?`} description="A ordem de serviço e seus agendamentos e serviços serão removidos permanentemente." confirmLabel="Excluir ordem" busy={deleteMutation.isPending} onCancel={() => setOrderToDelete(null)} onConfirm={() => orderToDelete !== null && !deleteMutation.isPending && deleteMutation.mutate(orderToDelete)} />
    {toast && <Toast message={toast} onClose={() => setToast('')} />}
  </>
}

function ServiceOrderForm({ selected, catalog, formError, submitting, onCancel, onDelete, onNotify, onSubmit }: {
  selected: ServiceOrder | null
  catalog: ServiceCatalogItem[]
  formError: string
  submitting: boolean
  onCancel: () => void
  onDelete: (id: number) => void
  onNotify: (message: string) => void
  onSubmit: (payload: ServiceOrderPayload) => void
}) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const initialDate = toDateInput(selected?.dtordem || selected?.scheduledDate) || localToday()
  const [tab, setTab] = useState<'general' | 'materials'>('general')
  const [clientId, setClientId] = useState(selected?.idclien ? String(selected.idclien) : '')
  const [clientSearch, setClientSearch] = useState('')
  const [clientPickerOpen, setClientPickerOpen] = useState(false)
  const [selectedClientOption, setSelectedClientOption] = useState<ClientSearchOption | null>(null)
  const [employeePickerIndex, setEmployeePickerIndex] = useState<number | null>(null)
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [clientError, setClientError] = useState('')
  const [requestDate, setRequestDate] = useState(initialDate)
  const [orderOrigin, setOrderOrigin] = useState<ServiceOrderOrigin>(selected?.flordem === 'C' || selected?.flordem === 'E' || selected?.flordem === 'O' ? selected.flordem : 'A')
  const [requester, setRequester] = useState(selected?.nmsolic ?? '')
  const [locationId, setLocationId] = useState(selected?.idlocal ? String(selected.idlocal) : '')
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [status, setStatus] = useState<ServiceOrderStatus>(selected?.status || 'ABERTA')
  const [category, setCategory] = useState<ServiceCategory>(selected?.category || 'MAO_DE_OBRA')
  const [serviceType, setServiceType] = useState(selected?.tpservic || 'E')
  const [searchTarget, setSearchTarget] = useState(selected?.procurarpor ?? '')
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
  const [supplierId, setSupplierId] = useState(selected?.materialOrder?.supplierId ? String(selected.materialOrder.supplierId) : '')
  const [supplierLabel, setSupplierLabel] = useState(selected?.materialOrder?.supplierId ? `${selected.materialOrder.supplierTradeName || selected.materialOrder.supplierName || 'Fornecedor'} · #${selected.materialOrder.supplierId}` : '')
  const [materialSearch, setMaterialSearch] = useState('')
  const [materialToAdd, setMaterialToAdd] = useState('')
  const [purchaseEntryDate, setPurchaseEntryDate] = useState(toDateInput(selected?.materialOrder?.entryDate) || initialDate)
  const [purchasePayableDueDate, setPurchasePayableDueDate] = useState(toDateInput(selected?.materialOrder?.payableDueDate) || toDateInput(selected?.materialOrder?.entryDate) || initialDate)
  const [purchaseInvoice, setPurchaseInvoice] = useState(selected?.materialOrder?.invoiceNumber ?? '')
  const [purchaseDiscount, setPurchaseDiscount] = useState(String(selected?.materialOrder?.discountPercentage ?? 0))
  const [purchaseFreight, setPurchaseFreight] = useState(String(selected?.materialOrder?.freightValue ?? 0))
  const [purchaseInsurance, setPurchaseInsurance] = useState(String(selected?.materialOrder?.insuranceValue ?? 0))
  const [purchaseStandard, setPurchaseStandard] = useState(String(selected?.materialOrder?.standardValue ?? 0))
  const [purchaseGbMargin, setPurchaseGbMargin] = useState(String(selected?.materialOrder?.gbMarginValue ?? 0))
  const [purchaseRental, setPurchaseRental] = useState(String(selected?.materialOrder?.rentalValue ?? 0))
  const [purchaseNotes, setPurchaseNotes] = useState(selected?.materialOrder?.notes ?? '')
  const [materialError, setMaterialError] = useState('')
  const [scheduleError, setScheduleError] = useState('')
  const initialSingleServiceId = selected?.serviceItems?.length === 1 ? selected.serviceItems[0].serviceId : null
  const [schedules, setSchedules] = useState<ScheduleDraft[]>(() => selected?.schedules?.length
    ? selected.schedules.map((item, index) => ({ ...item, ...(!item.employeeId ? waitingEmployee : {}), serviceId: item.serviceId ?? initialSingleServiceId, rowKey: `schedule-${item.scheduleId ?? index}` }))
    : [{ rowKey: 'schedule-new-0', expectedDate: dateTime(initialDate), expectedStart: '', expectedEnd: '', expectedDuration: '00:00', ...waitingEmployee, serviceId: initialSingleServiceId }])
  const [serviceItems, setServiceItems] = useState<ServiceDraft[]>(() => selected?.serviceItems?.map((item, index) => ({ ...item, rowKey: `service-${item.serviceId}-${index}` })) ?? [])
  const [materialItems, setMaterialItems] = useState<MaterialDraft[]>(() => selected?.materialOrder?.items?.map((item, index) => ({ ...item, rowKey: `material-${item.materialId}-${index}` })) ?? [])

  const debouncedClientSearch = useDebouncedValue(clientSearch.trim())
  const debouncedEmployeeSearch = useDebouncedValue(employeeSearch.trim())
  const clientSearchReady = debouncedClientSearch.length >= 2 || /^\d+$/.test(debouncedClientSearch)
  const clientOptionsQuery = useQuery({
    queryKey: [...queryKeys.clients, 'service-order-search', debouncedClientSearch, requestDate],
    queryFn: () => api.clients.search(debouncedClientSearch, requestDate),
    enabled: clientPickerOpen && clientSearchReady,
  })
  const clientQuery = useQuery({ queryKey: [...queryKeys.clients, 'detail', Number(clientId)], queryFn: () => api.clients.find(Number(clientId)), enabled: Boolean(clientId) })
  const contractContextQuery = useQuery({
    queryKey: [...queryKeys.contracts, 'active-for-client', Number(clientId), requestDate],
    queryFn: () => api.contracts.activeByClient(Number(clientId), requestDate),
    enabled: Boolean(clientId && requestDate),
  })
  const attendanceLocationsQuery = useQuery({
    queryKey: [...queryKeys.attendanceLocations, 'client', Number(clientId)],
    queryFn: () => api.attendanceLocations.byClient(Number(clientId)),
    enabled: Boolean(clientId),
  })
  const selectedAttendanceLocationQuery = useQuery({
    queryKey: [...queryKeys.attendanceLocations, 'client', Number(clientId), 'location', Number(locationId)],
    queryFn: () => api.attendanceLocations.findForClient(Number(locationId), Number(clientId)),
    enabled: Boolean(clientId && locationId),
    retry: false,
  })
  const employeesQuery = useQuery({
    queryKey: [...queryKeys.employees, 'service-order-search', debouncedEmployeeSearch],
    queryFn: () => api.employees.search(debouncedEmployeeSearch),
    enabled: employeePickerIndex !== null,
  })
  const employeeAvailabilityMutation = useMutation({
    mutationFn: ({ employee, active }: { employee: Employee; active: boolean }) => api.employees.updateAvailability(employee.id, active),
    onSuccess: (employee) => {
      queryClient.setQueriesData<Employee[]>({ queryKey: [...queryKeys.employees, 'service-order-search'] }, (current) => current?.map((item) => item.id === employee.id ? employee : item))
      onNotify(employee.active
        ? `${employeeDisplay(employee)} foi reativado.`
        : `${employeeDisplay(employee)} foi desativado. Ao reabrir esta busca, ele não aparecerá mais.`)
    },
    onError: (error) => onNotify(apiErrorMessage(error, 'Não foi possível alterar a disponibilidade do funcionário.')),
  })
  const createAttendanceLocationMutation = useMutation({
    mutationFn: (payload: AttendanceLocationPayload) => api.attendanceLocations.create(payload),
    onSuccess: async (location) => {
      await queryClient.invalidateQueries({ queryKey: [...queryKeys.attendanceLocations, 'client', location.clientId] })
      setLocationId(String(location.id))
      setLocationModalOpen(false)
      setLocationError('')
      onNotify(`Local “${location.description}” cadastrado e selecionado.`)
    },
    onError: (error) => setLocationError(apiErrorMessage(error, 'Não foi possível cadastrar o local de atendimento.')),
  })
  const systemParametersQuery = useQuery({ queryKey: queryKeys.systemParameters, queryFn: api.systemParameters.get })
  const debouncedMaterialSearch = useDebouncedValue(materialSearch)
  const materialsQuery = useQuery({ queryKey: [...queryKeys.materials, 'order-form', debouncedMaterialSearch], queryFn: () => api.materials.list({ query: debouncedMaterialSearch || undefined, size: 100 }) })
  const selectedClient = clientId
    ? clientQuery.data ?? (Number(clientId) === selected?.idclien ? selected?.client : null)
    : null
  const selectedClientLabel = selectedClient
    ? clientDisplay(selectedClient)
    : selectedClientOption
      ? clientDisplay(selectedClientOption)
      : selected?.clientName || (clientId ? `Cliente #${clientId}` : 'Selecionar cliente')
  const clientOptions = clientOptionsQuery.data ?? []
  const activeContract = contractContextQuery.data?.contract ?? null
  const contractBalance = contractContextQuery.data?.balance ?? null
  const shouldInferOrderOrigin = Boolean(clientId)
  const activeContractServices = activeContract?.services
    ?.map((service) => `${service.serviceDescription || service.serviceName || `Serviço #${service.serviceId}`}: ${service.quantity} ${service.unit || 'hora(s)'}`)
    .join(', ') ?? ''
  const attendanceLocations = useMemo(() => {
    const locations = attendanceLocationsQuery.data ?? []
    const selectedLocation = selectedAttendanceLocationQuery.data
    return selectedLocation && !locations.some((location) => location.id === selectedLocation.id)
      ? [selectedLocation, ...locations]
      : locations
  }, [attendanceLocationsQuery.data, selectedAttendanceLocationQuery.data])
  const minimumMinutes = orderOrigin === 'C'
    ? systemParametersQuery.data?.contractMinimumMinutes ?? 20
    : systemParametersQuery.data?.oneOffMinimumMinutes ?? 30
  const actualMinutes = schedules.reduce((sum, item) => sum + (minutesFromTime(item.actualDuration) || durationMinutes(item.actualStart, item.actualEnd)), 0)
  const billableMinutes = schedules.reduce((sum, item) => {
    const realized = minutesFromTime(item.actualDuration) || durationMinutes(item.actualStart, item.actualEnd)
    return realized > 0 ? sum + Math.max(realized, minimumMinutes) : sum
  }, 0)
  const selectedOrderPeriod = toDateInput(selected?.dtordem || selected?.scheduledDate)?.slice(0, 7)
  const currentPeriod = requestDate.slice(0, 7)
  const previouslyAccountedMinutes = selected?.status === 'FINALIZADA'
    && selected.idcontr === activeContract?.id
    && selectedOrderPeriod === currentPeriod
    ? minutesFromTime(selected.qthorac)
    : 0
  const balanceBeforeThisOrder = (contractBalance?.balanceMinutes ?? 0) + previouslyAccountedMinutes
  const officialMinutesByService = useMemo(() => {
    const totals = new Map<number, number>()
    schedules.forEach((schedule) => {
      if (!schedule.serviceId) return
      const realized = minutesFromTime(schedule.actualDuration) || durationMinutes(schedule.actualStart, schedule.actualEnd)
      if (realized > 0) totals.set(schedule.serviceId, (totals.get(schedule.serviceId) ?? 0) + Math.max(realized, minimumMinutes))
    })
    return totals
  }, [minimumMinutes, schedules])
  const overageMinutesByService = useMemo(() => {
    const totals = new Map<number, { regular: number; extra: number }>()
    let remainingContractMinutes = orderOrigin === 'C' ? balanceBeforeThisOrder : 0
    schedules.forEach((schedule) => {
      if (!schedule.serviceId) return
      const realized = minutesFromTime(schedule.actualDuration) || durationMinutes(schedule.actualStart, schedule.actualEnd)
      if (realized <= 0) return
      const accounted = Math.max(realized, minimumMinutes)
      const overage = Math.max(0, realized - minimumMinutes)
      const current = totals.get(schedule.serviceId) ?? { regular: 0, extra: 0 }
      if (orderOrigin === 'C') {
        const balanceAfterMinimum = Math.max(0, remainingContractMinutes - minimumMinutes)
        const regular = Math.min(overage, balanceAfterMinimum)
        totals.set(schedule.serviceId, { regular: current.regular + regular, extra: current.extra + overage - regular })
        remainingContractMinutes = Math.max(0, remainingContractMinutes - accounted)
      } else {
        totals.set(schedule.serviceId, { regular: current.regular + overage, extra: current.extra })
      }
    })
    return totals
  }, [balanceBeforeThisOrder, minimumMinutes, orderOrigin, schedules])
  const scheduledServiceIds = useMemo(() => new Set(schedules.map((schedule) => schedule.serviceId).filter((id): id is number => Boolean(id))), [schedules])
  const pricedServiceItems = useMemo(() => serviceItems.map((item) => {
    const serviceMinutes = officialMinutesByService.get(item.serviceId) ?? 0
    const quantity = Math.max(1, numberValue(item.quantity))
    const overage = overageMinutesByService.get(item.serviceId) ?? { regular: 0, extra: 0 }
    const overageValue = orderOrigin === 'C'
      ? overage.regular * numberValue(item.minuteValue) + overage.extra * numberValue(item.extraValue ?? item.minuteValue)
      : overage.regular * numberValue(item.oneOffValue ?? item.minuteValue)
    const totalValue = serviceMinutes > 0
      ? numberValue(item.minimumValue) * quantity + overageValue
      : quantity * numberValue(item.unitValue)
    const unitValue = totalValue / quantity
    return {
      ...item,
      quantity,
      hours: scheduledServiceIds.has(item.serviceId) ? asDuration(serviceMinutes) : item.hours,
      unitValue: currencyValue(unitValue),
      totalValue: currencyValue(totalValue),
    }
  }), [officialMinutesByService, orderOrigin, overageMinutesByService, scheduledServiceIds, serviceItems])
  const serviceSubtotal = pricedServiceItems.reduce((sum, item) => sum + numberValue(item.totalValue), 0)
  const materialGross = materialItems.reduce((sum, item) => sum + numberValue(item.quantity) * numberValue(item.unitValue), 0)
  const materialDiscountValue = materialGross * Math.min(100, numberValue(purchaseDiscount)) / 100
  const materialFob = Math.max(0, materialGross - materialDiscountValue)
  const materialCif = materialFob + numberValue(purchaseFreight) + numberValue(purchaseInsurance)
  const materialAmount = materialCif + numberValue(purchaseStandard) + numberValue(purchaseGbMargin) + numberValue(purchaseRental)
  const discountAmount = serviceSubtotal * numberValue(discount) / 100
  const total = serviceSubtotal + materialAmount + numberValue(ticketFee) + numberValue(transport) + numberValue(rental) - discountAmount
  const totalMinutes = schedules.reduce((sum, item) => sum + (minutesFromTime(item.expectedDuration) || durationMinutes(item.expectedStart, item.expectedEnd)), 0)
  const projectedBalanceMinutes = Math.max(0, balanceBeforeThisOrder - billableMinutes)
  const operationalRule = orderOrigin === 'C'
    ? systemParametersQuery.data?.contractRules || `Cada atendimento desconta no mínimo ${minimumMinutes} minutos das horas contratadas.`
    : systemParametersQuery.data?.oneOffRules || `Cada atendimento é cobrado pelo mínimo de ${minimumMinutes} minutos.`
  const materialOptions = materialsQuery.data?.content ?? []

  useEffect(() => {
    if (!shouldInferOrderOrigin || !contractContextQuery.isSuccess) return
    setOrderOrigin(contractContextQuery.data.hasContract ? 'C' : 'A')
  }, [contractContextQuery.data, contractContextQuery.isSuccess, shouldInferOrderOrigin])

  function selectClient(client: ClientSearchOption) {
    setClientId(String(client.id))
    setSelectedClientOption(client)
    setClientSearch('')
    setLocationId('')
    setClientPickerOpen(false)
    setClientError('')
    setOrderOrigin('A')
  }

  function openClientPicker() {
    setClientSearch('')
    setClientPickerOpen(true)
    setClientError('')
  }

  function openLocationModal() {
    if (!clientId) return
    setLocationError('')
    setLocationModalOpen(true)
  }

  function submitAttendanceLocation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!clientId) return
    const data = new FormData(event.currentTarget)
    const value = (name: string) => String(data.get(name) ?? '').trim() || null
    createAttendanceLocationMutation.mutate({
      clientId: Number(clientId),
      contractId: activeContract?.id ?? 0,
      description: value('description') ?? '',
      address: value('address') ?? '',
      complement: value('complement'),
      district: value('district'),
      city: value('city'),
      zipCode: value('zipCode'),
      contactName: value('contactName'),
      referencePoint: value('referencePoint'),
      bank1: null,
      agency1: null,
      account1: null,
      bank2: null,
      agency2: null,
      account2: null,
      paymentMethod: null,
      paymentCondition: null,
      spreadDescription: null,
      spreadValue: null,
      spreadGroup: null,
      contactPhone: value('contactPhone'),
      cnpj: value('cnpj'),
      username: user?.name ?? null,
      requester: value('requester'),
    })
  }

  function updateSchedule(index: number, patch: Partial<ScheduleDraft>) {
    setScheduleError('')
    setSchedules((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item
      const next = { ...item, ...patch }
      if ('expectedStart' in patch || 'expectedEnd' in patch) next.expectedDuration = asDuration(durationMinutes(next.expectedStart, next.expectedEnd))
      if ('actualStart' in patch || 'actualEnd' in patch) next.actualDuration = asDuration(durationMinutes(next.actualStart, next.actualEnd))
      return next
    }))
  }

  function closeEmployeePicker() {
    setEmployeePickerIndex(null)
    setEmployeeSearch('')
    void queryClient.invalidateQueries({ queryKey: queryKeys.employees, refetchType: 'all' })
  }

  function openEmployeePicker(index: number) {
    setEmployeePickerIndex(index)
    setEmployeeSearch('')
  }

  function selectEmployee(employee: Employee) {
    if (employeePickerIndex === null) return
    updateSchedule(employeePickerIndex, {
      employeeId: employee.id,
      employeeName: employee.name,
      employeeNickname: employee.nickname,
      employeePosition: employee.position,
      employeePhone: employee.phone || employee.secondaryPhone || employee.tertiaryPhone,
    })
    closeEmployeePicker()
  }

  function clearEmployee(index: number) {
    updateSchedule(index, waitingEmployee)
  }

  function addSchedule() {
    const onlyServiceId = serviceItems.length === 1 ? serviceItems[0].serviceId : null
    setSchedules((current) => [...current, { rowKey: `schedule-new-${Date.now()}`, expectedDate: dateTime(requestDate), expectedStart: '', expectedEnd: '', expectedDuration: '00:00', ...waitingEmployee, serviceId: onlyServiceId }])
    setScheduleError('')
  }

  function addService() {
    const firstAvailable = catalog.find((item) => !serviceItems.some((row) => row.serviceId === item.id))
    if (!firstAvailable) return
    setServiceItems((current) => [...current, serviceDraft(firstAvailable)])
    if (serviceItems.length === 0) {
      setSchedules((current) => current.map((schedule) => schedule.serviceId ? schedule : { ...schedule, serviceId: firstAvailable.id }))
    }
    setScheduleError('')
  }

  function changeService(index: number, serviceId: number) {
    const service = catalog.find((item) => item.id === serviceId)
    if (!service) return
    const previousServiceId = serviceItems[index]?.serviceId
    setServiceItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...serviceDraft(service), rowKey: item.rowKey } : item))
    if (previousServiceId) {
      setSchedules((current) => current.map((schedule) => schedule.serviceId === previousServiceId ? { ...schedule, serviceId } : schedule))
    }
    setScheduleError('')
  }

  function removeService(index: number) {
    const removedServiceId = serviceItems[index]?.serviceId
    const remaining = serviceItems.filter((_, itemIndex) => itemIndex !== index)
    const fallbackServiceId = remaining.length === 1 ? remaining[0].serviceId : null
    setServiceItems(remaining)
    setSchedules((current) => current.map((schedule) => schedule.serviceId === removedServiceId
      ? { ...schedule, serviceId: fallbackServiceId }
      : schedule))
    setScheduleError('')
  }

  function updateService(index: number, patch: Partial<ServiceDraft>) {
    setServiceItems((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item
      const next = { ...item, ...patch }
      next.totalValue = numberValue(next.quantity) * numberValue(next.unitValue)
      return next
    }))
  }

  function selectScheduleService(index: number, serviceId: number | null) {
    updateSchedule(index, { serviceId })
    if (serviceId != null) {
      const service = catalog.find((item) => item.id === serviceId)
      if (service) {
        setServiceItems((current) => current.some((item) => item.serviceId === serviceId)
          ? current
          : [...current, serviceDraft(service)])
      }
    }
    setScheduleError('')
  }

  function addMaterial() {
    const material = materialOptions.find((item) => item.id === Number(materialToAdd))
    if (!material) {
      setMaterialError('Pesquise e selecione um material antes de adicionar.')
      return
    }
    if (materialItems.some((item) => item.materialId === material.id)) {
      setMaterialError('Este material já foi adicionado ao pedido de compra.')
      return
    }
    setMaterialItems((current) => [...current, materialDraft(material)])
    setMaterialToAdd('')
    setMaterialSearch('')
    setMaterialError('')
  }

  function updateMaterial(index: number, patch: Partial<MaterialDraft>) {
    setMaterialItems((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item
      const next = { ...item, ...patch }
      next.totalValue = numberValue(next.quantity) * numberValue(next.unitValue)
      return next
    }))
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!clientId) {
      setClientError('Pesquise e selecione um cliente antes de gravar a ordem.')
      return
    }
    if (!requestDate || !description.trim()) return
    if (shouldInferOrderOrigin && contractContextQuery.isFetching) {
      setClientError('Aguarde a verificação do contrato do cliente antes de gravar a ordem.')
      return
    }
    if (shouldInferOrderOrigin && contractContextQuery.isError) {
      setClientError(`Não foi possível verificar o contrato do cliente. ${apiErrorMessage(contractContextQuery.error)}`)
      return
    }
    if (materialItems.length > 0 && !supplierId) {
      setMaterialError('Selecione o fornecedor do pedido de compra.')
      setTab('materials')
      return
    }
    if (serviceItems.length > 0 && schedules.some((schedule) => !schedule.serviceId)) {
      setScheduleError('Selecione o serviço correspondente em todos os agendamentos.')
      setTab('general')
      return
    }
    if (status === 'FINALIZADA') {
      const validationMessage = finalizationError(serviceItems, schedules, catalog)
      if (validationMessage) {
        setScheduleError(validationMessage)
        setTab('general')
        return
      }
    }
    setScheduleError('')
    const selectedBase = selected ? (() => {
      const { id: _id, code: _code, client: _client, clientName: _clientName, schedules: _schedules, serviceItems: _serviceItems, materialOrder: _materialOrder, ...rest } = selected
      return rest
    })() : {}
    const normalizedSchedules: ServiceOrderSchedule[] = schedules.map((item, index) => {
      const { rowKey: _rowKey, ...persisted } = item
      const date = toDateInput(item.expectedDate) || requestDate
      return { ...persisted, serviceOrderId: selected?.id ?? null, scheduleId: item.scheduleId ?? index + 1, expectedDate: dateTime(date), expectedStart: item.expectedStart || null, expectedEnd: item.expectedEnd || null, expectedDuration: item.expectedDuration || asDuration(durationMinutes(item.expectedStart, item.expectedEnd)), actualDuration: item.actualDuration || asDuration(durationMinutes(item.actualStart, item.actualEnd)), employeeId: item.employeeId ? Number(item.employeeId) : waitingEmployee.employeeId, urgentFlag: urgent ? 'S' : 'N', scheduledTimeFlag: hourMarked ? 'S' : 'N', startedFlag: item.startedFlag || 'N', finishedFlag: item.finishedFlag || 'N', routedFlag: item.routedFlag || 'N', serviceType }
    })
    const normalizedServices: ServiceOrderServiceItem[] = pricedServiceItems.map(({ rowKey: _rowKey, ...item }) => ({ ...item, serviceOrderId: selected?.id ?? null, quantity: Math.max(1, numberValue(item.quantity)), unitValue: currencyValue(numberValue(item.unitValue)), totalValue: currencyValue(numberValue(item.totalValue)), minimumValue: numberValue(item.minimumValue), minuteValue: numberValue(item.minuteValue), extraValue: numberValue(item.extraValue ?? item.minuteValue), oneOffValue: numberValue(item.oneOffValue ?? item.minuteValue) }))
    const normalizedMaterials: ServiceOrderMaterialItem[] = materialItems.map(({ rowKey: _rowKey, ...item }, index) => ({ ...item, itemId: index + 1, purchaseOrderId: selected?.materialOrder?.id ?? null, quantity: Math.max(1, numberValue(item.quantity)), unitValue: numberValue(item.unitValue), totalValue: Math.max(1, numberValue(item.quantity)) * numberValue(item.unitValue) }))
    const materialOrder: ServiceOrderMaterialOrder | null = materialItems.length > 0 || selected?.materialOrder ? {
      ...selected?.materialOrder,
      id: selected?.materialOrder?.id ?? selected?.idpedi ?? null,
      serviceOrderId: selected?.id ?? null,
      supplierId: supplierId ? Number(supplierId) : null,
      entryDate: purchaseEntryDate ? dateTime(purchaseEntryDate) : dateTime(requestDate),
      payableDueDate: purchasePayableDueDate ? dateTime(purchasePayableDueDate) : purchaseEntryDate ? dateTime(purchaseEntryDate) : dateTime(requestDate),
      invoiceNumber: purchaseInvoice.trim() || null,
      discountPercentage: Math.min(100, numberValue(purchaseDiscount)),
      freightValue: numberValue(purchaseFreight),
      insuranceValue: numberValue(purchaseInsurance),
      standardValue: numberValue(purchaseStandard),
      gbMarginValue: numberValue(purchaseGbMargin),
      rentalValue: numberValue(purchaseRental),
      notes: purchaseNotes.trim() || null,
      grossValue: materialGross,
      fobValue: materialFob,
      cifValue: materialCif,
      netValue: materialAmount,
      items: normalizedMaterials,
    } : null
    const firstSchedule = normalizedSchedules[0]
    const payload: ServiceOrderPayload = {
      ...selectedBase,
      idclien: Number(clientId), idcontr: orderOrigin === 'C' ? activeContract?.id ?? selected?.idcontr ?? null : null, dtordem: dateTime(requestDate), flordem: orderOrigin, nmsolic: requester.trim() || null,
      idlocal: locationId ? Number(locationId) : null, idopera: selected?.idopera ?? user?.id ?? null, status,
      flstatu: status === 'FINALIZADA' ? 'F' : status === 'CANCELADA' ? 'C' : 'A', category,
      flcateg: selected && selected.category === category && selected.flcateg ? selected.flcateg : categoryFlags[category] ?? 'M',
      dsdescr: description.trim(), description: description.trim(), dsobser: notes.trim() || null, dscancel: cancellationReason.trim() || null,
      tpservic: serviceType, procurarpor: searchTarget.trim() || null, service: serviceType, priority: urgent ? 'URGENTE' : 'NORMAL', scheduledDate: firstSchedule ? toDateInput(firstSchedule.expectedDate) : requestDate,
      scheduledTime: firstSchedule?.expectedStart || null, technician: firstSchedule?.employeeId ? String(firstSchedule.employeeId) : null, location: locationId || null,
      dtinicial: firstSchedule ? dateTime(toDateInput(firstSchedule.expectedDate), firstSchedule.expectedStart || '00:00') : null, hrabert: firstSchedule?.expectedStart || null,
      qthorat: asDuration(actualMinutes), qthorac: asDuration(billableMinutes), dtvenci: dueDate ? dateTime(dueDate) : null, txbolet: numberValue(ticketFee), vldesco: numberValue(discount), vldesc: discountAmount,
      vltrans: numberValue(transport), vlalug: numberValue(rental), fltrans: numberValue(transport) > 0 ? 'S' : 'N', flalug: numberValue(rental) > 0 ? 'S' : 'N',
      vlmater: materialAmount, idpedi: selected?.materialOrder?.id ?? selected?.idpedi ?? null, vlhorar: serviceSubtotal, vlcobra: Math.max(0, total), schedules: normalizedSchedules, serviceItems: normalizedServices, materialOrder,
    }
    onSubmit(payload)
  }

  return <>
  <ModalForm onSubmit={submit} onCancel={onCancel} submitting={submitting} submitLabel={submitting ? 'Gravando...' : selected ? 'Gravar alterações' : 'Gravar OS'}>
    <FormError message={formError} />
    <div className="os-form-context"><span><small>Ordem de serviço</small><strong>{orderOrigin === 'C' ? 'Contrato' : 'Avulsa'}</strong></span><span><small>Operador</small><strong>{user?.name || 'Usuário atual'}</strong></span><span><small>Cliente</small><strong>{clientId ? selectedClientLabel : 'Selecione o cliente'}</strong></span><Badge tone={statusTone[status]}>{enumLabel(status)}</Badge></div>
    <aside className={`os-accounting-rule os-accounting-rule--${orderOrigin === 'C' ? 'contract' : 'one-off'}`}><Clock3 size={18} /><span><strong>Contabilização mínima: {minimumMinutes} minutos por atendimento</strong><small>{operationalRule}</small></span></aside>
    <div className="os-form-identification">
      <FormField label="Código"><input value={selected?.id ?? 'Automático'} disabled /></FormField>
      <FormField label="Tipo"><select value={orderOrigin} onChange={(event) => setOrderOrigin(event.target.value as ServiceOrderOrigin)}><option value="A">Avulsa</option><option value="C">Contrato</option><option value="E">Experiência</option>{orderOrigin === 'O' && <option value="O">Obras (legado)</option>}</select></FormField>
      <FormField label="Data da requisição"><input type="date" value={requestDate} onChange={(event) => setRequestDate(event.target.value)} required /></FormField>
      <FormField label="Solicitante"><input maxLength={250} value={requester} onChange={(event) => setRequester(event.target.value)} /></FormField>
      <FormField label="Cliente">
        <button type="button" className="os-client-modal-trigger" onClick={openClientPicker}><Search size={16} /><span><strong>{clientId ? selectedClientLabel : 'Buscar cliente'}</strong><small>{clientId ? `Código #${clientId} · Clique para alterar` : 'Nome fantasia, razão social ou código'}</small></span></button>
        {clientError && <small className="os-client-picker__error">{clientError}</small>}
      </FormField>
      <FormField label="Local">
        <div className="os-location-control">
          <select value={locationId} onChange={(event) => setLocationId(event.target.value)} disabled={!clientId || attendanceLocationsQuery.isLoading}>
            <option value="">{!clientId ? 'Selecione primeiro o cliente' : attendanceLocationsQuery.isLoading ? 'Carregando locais...' : attendanceLocations.length ? 'Selecione um local' : 'Nenhum local cadastrado'}</option>
            {attendanceLocations.map((location) => <option key={location.id} value={location.id}>{attendanceLocationDisplay(location)}</option>)}
          </select>
          <button type="button" onClick={openLocationModal} disabled={!clientId} title="Adicionar novo local de atendimento" aria-label="Adicionar novo local de atendimento"><Plus size={17} /></button>
        </div>
        {selectedAttendanceLocationQuery.isError && locationId && <small className="os-client-picker__error">O local #{locationId} não pertence a este cliente ou não existe mais.</small>}
      </FormField>
      <FormField label="Situação"><select value={status} onChange={(event) => setStatus(event.target.value as ServiceOrderStatus)}><option value="ABERTA">Aberta</option><option value="FINALIZADA">Finalizada</option><option value="CANCELADA">Cancelada</option></select></FormField>
    </div>
    {clientId && <aside className={`os-accounting-rule ${activeContract ? 'os-accounting-rule--contract' : 'os-accounting-rule--one-off'}`}>
      <Building2 size={18} />
      <span>
        {contractContextQuery.isLoading || contractContextQuery.isFetching
          ? <><strong>Verificando contrato do cliente...</strong><small>O tipo da ordem será preenchido automaticamente.</small></>
          : contractContextQuery.isError
            ? <><strong>Não foi possível carregar o contrato</strong><small>{apiErrorMessage(contractContextQuery.error)}</small></>
            : activeContract
              ? <><strong>Contrato #{activeContract.id} encontrado</strong><small>{[
                activeContract.contractDate ? `Início ${formatDate(activeContract.contractDate)}` : null,
                activeContract.renewalDate ? `Renovação ${formatDate(activeContract.renewalDate)}` : null,
                activeContract.dueDay ? `Vencimento dia ${activeContract.dueDay}` : null,
                `${activeContract.services?.length ?? 0} serviço(s) contratado(s)`,
              ].filter(Boolean).join(' · ')}</small>{activeContractServices && <small>Serviços: {activeContractServices}</small>}</>
              : <><strong>Cliente sem contrato vigente</strong><small>A ordem foi definida previamente como avulsa para a data selecionada.</small></>}
      </span>
      {activeContract && <div className="os-contract-balance">
        <span><small>Horas contratadas</small><strong>{contractBalance?.contracted ?? asDuration(activeContract.services.reduce((sum, service) => sum + numberValue(service.quantity) * 60, 0))}</strong></span>
        <span><small>Utilizadas no mês</small><strong>{contractBalance?.used ?? '00:00'}</strong></span>
        <span><small>Saldo disponível</small><strong>{contractBalance?.balance ?? asDuration(activeContract.services.reduce((sum, service) => sum + numberValue(service.quantity) * 60, 0))}</strong></span>
        <span className="os-contract-balance__projected"><small>Saldo após esta OS</small><strong>{asDuration(projectedBalanceMinutes)}</strong></span>
      </div>}
    </aside>}
    <div className="os-form-tabs" role="tablist"><button type="button" className={tab === 'general' ? 'active' : ''} onClick={() => setTab('general')}>Dados gerais</button><button type="button" className={tab === 'materials' ? 'active' : ''} onClick={() => setTab('materials')}>Materiais</button></div>

    {tab === 'general' ? <>
      <section className="os-form-section">
        <div className="os-form-section__title"><strong>Categoria da OS</strong><span>Classificação do atendimento</span></div>
        <div className="os-category-row"><div className="os-radio-group">{[...categories, ...legacyCategories.filter((item) => item.value === category)].map((item) => <label key={item.value}><input type="radio" name="os-category" checked={category === item.value} onChange={() => setCategory(item.value)} /><span>{item.label}</span></label>)}</div><div className="os-detail-flags"><label><input type="checkbox" checked={urgent} onChange={(event) => setUrgent(event.target.checked)} /><span>Urgente</span></label><label><input type="checkbox" checked={hourMarked} onChange={(event) => setHourMarked(event.target.checked)} /><span>Hora marcada</span></label></div></div>
      </section>
      <div className="os-description-grid">
        <FormField label="Descrição"><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} required /></FormField>
        <div className="os-service-classification"><FormField label="Procurar por"><input maxLength={150} value={searchTarget} onChange={(event) => setSearchTarget(event.target.value)} placeholder="Informe o que deve ser procurado no atendimento" /></FormField><section className="os-service-type"><strong>Tipo de serviço</strong><div>{serviceTypes.map((item) => <label key={item.value}><input type="radio" name="service-type" checked={serviceType === item.value} onChange={() => setServiceType(item.value)} /><span>{item.label}</span></label>)}</div></section></div>
        <FormField label="Observação"><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></FormField>
        <FormField label="Motivo do cancelamento"><textarea rows={3} value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} disabled={category !== 'CANCELAMENTO' && status !== 'CANCELADA'} /></FormField>
      </div>
      <section className="os-grid-section">
        <header><div><strong>Agendamento de serviços</strong><span>Previsão e profissional responsável por cada visita</span></div><Button type="button" variant="secondary" icon={<Plus size={15} />} onClick={addSchedule}>Adicionar agenda</Button></header>
        <FormError message={scheduleError} />
        <div className="os-edit-table-wrap"><table className="os-edit-table os-schedule-table"><thead><tr><th>Data</th><th>Inicial</th><th>Final</th><th>Previsto</th><th>Funcionário</th><th>Serviço executado</th><th>Dt. realizado</th><th>Hr. inicial</th><th>Hr. final</th><th>Realizado</th><th /></tr></thead><tbody>{schedules.map((item, index) => {
          const linkedService = serviceItems.find((service) => service.serviceId === item.serviceId)
          const actualRequired = status === 'FINALIZADA' && numberValue(linkedService?.minuteValue) > 0
          return <tr key={item.rowKey}>
            <td><input type="date" value={toDateInput(item.expectedDate)} onChange={(event) => updateSchedule(index, { expectedDate: dateTime(event.target.value) })} required /></td>
            <td><input type="time" value={item.expectedStart || ''} onChange={(event) => updateSchedule(index, { expectedStart: event.target.value })} /></td>
            <td><input type="time" value={item.expectedEnd || ''} onChange={(event) => updateSchedule(index, { expectedEnd: event.target.value })} /></td>
            <td><input value={item.expectedDuration || '00:00'} readOnly /></td>
            <td><div className="os-employee-cell"><button type="button" className="os-employee-picker-trigger" onClick={() => openEmployeePicker(index)} title="Buscar funcionário"><Search size={14} /><span><strong>{scheduleEmployeeDisplay(item)}</strong>{item.employeeId && item.employeeId !== waitingEmployee.employeeId && <small>{[item.employeePosition, item.employeePhone, `#${item.employeeId}`].filter(Boolean).join(' · ')}</small>}</span></button>{item.employeeId && item.employeeId !== waitingEmployee.employeeId && <button type="button" className="os-employee-clear" onClick={() => clearEmployee(index)} aria-label={`Remover ${scheduleEmployeeDisplay(item)} do agendamento`}><X size={13} /></button>}</div></td>
            <td><select value={item.serviceId ?? ''} onChange={(event) => selectScheduleService(index, event.target.value ? Number(event.target.value) : null)} disabled={!catalog.length} required={serviceItems.length > 0}><option value="">{catalog.length ? 'Selecione um serviço' : 'Nenhum serviço cadastrado'}</option>{catalog.map((service) => <option key={service.id} value={service.id}>{service.description || `Serviço #${service.id}`}</option>)}</select></td>
            <td><input type="date" value={toDateInput(item.actualDate)} onChange={(event) => updateSchedule(index, { actualDate: event.target.value ? dateTime(event.target.value) : null })} required={actualRequired} /></td>
            <td><input type="time" value={item.actualStart || ''} onChange={(event) => updateSchedule(index, { actualStart: event.target.value })} required={actualRequired} /></td>
            <td><input type="time" value={item.actualEnd || ''} onChange={(event) => updateSchedule(index, { actualEnd: event.target.value })} required={actualRequired} /></td>
            <td><input value={item.actualDuration || '00:00'} readOnly /></td>
            <td><button type="button" className="os-remove-row" disabled={schedules.length === 1} onClick={() => { setSchedules((current) => current.filter((_, rowIndex) => rowIndex !== index)); setScheduleError('') }} aria-label="Remover agendamento"><X size={16} /></button></td>
          </tr>
        })}</tbody></table></div>
        <div className="os-grid-summary os-time-summary"><span><small>Tempo previsto</small><strong>{asDuration(totalMinutes)}</strong></span><span><small>Tempo realizado</small><strong>{asDuration(actualMinutes)}</strong></span><span className="os-time-summary__billable"><small>{orderOrigin === 'C' ? 'Tempo a descontar' : 'Tempo a cobrar'}</small><strong>{asDuration(billableMinutes)}</strong></span></div>
      </section>
      <div className="os-service-workspace">
        <section className="os-additional-values"><header><strong>Valores adicionais</strong><span>Composição da cobrança</span></header><FormField label="Vencimento"><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></FormField><FormField label="Taxa do boleto"><input type="number" min="0" step="0.01" value={ticketFee} onChange={(event) => setTicketFee(event.target.value)} /></FormField><FormField label="Desconto %"><input type="number" min="0" max="100" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} /></FormField>{numberValue(transport) > 0 && <FormField label="Transporte (legado)" hint="Não é mais cobrado; zere para remover"><input type="number" min="0" step="0.01" value={transport} onChange={(event) => setTransport(event.target.value)} /></FormField>}
        {/* <FormField label="Aluguel"><input type="number" min="0" step="0.01" value={rental} onChange={(event) => setRental(event.target.value)} /></FormField> */}
        </section>
        <section className="os-grid-section os-services-section">
          <header><div><strong>Relação de serviços cadastrados</strong><span>Itens de tbordemservicoservico</span></div><Button type="button" variant="secondary" icon={<Plus size={15} />} onClick={addService} disabled={!catalog.length}>Adicionar serviço</Button></header>
          {pricedServiceItems.length ? <div className="os-edit-table-wrap"><table className="os-edit-table os-services-table"><thead><tr><th>Grupo</th><th>Serviço</th><th>Qtd.</th><th>Horas oficiais</th><th>Vl. mínimo</th><th>Vl. unitário</th><th>Vl. total</th><th /></tr></thead><tbody>{pricedServiceItems.map((item, index) => {
            const catalogItem = catalog.find((service) => service.id === item.serviceId)
            const calculatedByTime = numberValue(item.minuteValue) > 0
            return <tr key={item.rowKey}><td><input value={catalogItem?.groupId ?? '—'} readOnly /></td><td><select value={item.serviceId} onChange={(event) => changeService(index, Number(event.target.value))}>{catalog.map((service) => <option key={service.id} value={service.id} disabled={serviceItems.some((row, rowIndex) => rowIndex !== index && row.serviceId === service.id)}>{service.description || `Serviço #${service.id}`}</option>)}</select></td><td><input type="number" min="1" value={item.quantity ?? 1} onChange={(event) => updateService(index, { quantity: Number(event.target.value) })} /></td><td><input type="time" value={item.hours || '00:00'} readOnly title="Somatório do tempo oficial contabilizado nos atendimentos vinculados" /></td><td><input type="number" min="0" step="0.01" value={item.minimumValue ?? 0} onChange={(event) => updateService(index, { minimumValue: Number(event.target.value) })} /></td><td><input type="number" min="0" step="0.01" value={item.unitValue ?? 0} onChange={(event) => updateService(index, { unitValue: Number(event.target.value) })} readOnly={calculatedByTime} title={calculatedByTime ? `${item.hours || '00:00'} × ${money(item.minuteValue)} por minuto, respeitando o valor mínimo` : 'Valor unitário do serviço'} /></td><td><input value={money(item.totalValue)} readOnly /></td><td><button type="button" className="os-remove-row" onClick={() => removeService(index)} aria-label="Remover serviço"><X size={16} /></button></td></tr>
          })}</tbody></table></div> : <div className="os-empty-grid">Nenhum serviço adicionado. Use “Adicionar serviço” para montar a cobrança.</div>}
        </section>
      </div>
      <div className="os-total-strip"><span><small>Serviços</small><strong>{money(serviceSubtotal)}</strong></span><span><small>Pedido de compra</small><strong>{money(materialAmount)}</strong></span><span><small>Desconto</small><strong>- {money(discountAmount)}</strong></span><span className="os-total-strip__primary"><small>Valor a cobrar</small><strong>{money(Math.max(0, total))}</strong></span></div>
    </> : <section className="os-material-tab">
      <div><strong>Pedido de compra</strong><p>Selecione o fornecedor e os materiais comprados para o atendimento. Ao salvar, o pedido gera a conta a pagar do fornecedor e, ao finalizar a OS, a conta a receber do cliente.</p></div>
      <FormError message={materialError} />
      {materialsQuery.isError && <FormError message={`Não foi possível consultar os materiais: ${apiErrorMessage(materialsQuery.error)}`} />}

      <div className="os-purchase-header">
        <FormField label="Pedido de compra"><input value={selected?.materialOrder?.id ?? selected?.idpedi ?? 'Gerado ao salvar'} disabled /></FormField>
        <FormField label="Data de entrada"><input type="date" value={purchaseEntryDate} onChange={(event) => setPurchaseEntryDate(event.target.value)} /></FormField>
        {(selected?.materialOrder?.payableInstallments ?? 1) > 1
          ? <FormField label="Vencimento da conta a pagar" hint={`Conta parcelada em ${selected?.materialOrder?.payableInstallments} prestações: os vencimentos são ajustados em Contas a pagar. Alterações de valor do pedido são redistribuídas entre as prestações.`}><input type="date" value={purchasePayableDueDate} disabled /></FormField>
          : <FormField label="Vencimento da conta a pagar" hint="Fornecedor. A cobrança do cliente usa o vencimento automático (dia do contrato ou próximo dia 10/20)."><input type="date" value={purchasePayableDueDate} onChange={(event) => setPurchasePayableDueDate(event.target.value)} /></FormField>}
        <FormField label="Nota fiscal"><input maxLength={50} value={purchaseInvoice} onChange={(event) => setPurchaseInvoice(event.target.value)} /></FormField>
        <FormField label="Fornecedor"><SupplierPicker value={supplierId ? { id: Number(supplierId), label: supplierLabel || `Fornecedor #${supplierId}` } : null} onChange={(value) => { setSupplierId(value ? String(value.id) : ''); setSupplierLabel(value?.label ?? ''); setMaterialError('') }} /></FormField>
      </div>

      <section className="os-grid-section os-material-order-section">
        <header><div><strong>Relação de materiais</strong><span>Itens de tbordemservicomaterialitem</span></div></header>
        <div className="os-material-picker">
          <FormField label="Pesquisar material" hint="Descrição, marca, unidade ou código"><input value={materialSearch} onChange={(event) => { setMaterialSearch(event.target.value); setMaterialToAdd('') }} placeholder="Digite para pesquisar no cadastro..." /></FormField>
          <FormField label="Material"><select value={materialToAdd} onChange={(event) => setMaterialToAdd(event.target.value)} disabled={materialsQuery.isLoading}><option value="">Selecione</option>{materialOptions.map((material) => <option key={material.id} value={material.id} disabled={materialItems.some((item) => item.materialId === material.id)}>{material.description || `Material #${material.id}`} · {material.brand || 'Sem marca'} · {material.unit || 'UN'}</option>)}</select></FormField>
          <Button type="button" variant="secondary"  style={{maxWidth: 150}} icon={<Plus size={15} />} onClick={addMaterial} disabled={!materialToAdd}>Adicionar material</Button>
        </div>
        {materialItems.length ? <div className="os-edit-table-wrap"><table className="os-edit-table os-materials-order-table"><thead><tr><th>Material</th><th>Marca</th><th>Unidade</th><th>Quantidade</th><th>Valor unitário</th><th>Valor total</th><th /></tr></thead><tbody>{materialItems.map((item, index) => <tr key={item.rowKey}>
          <td><strong>{item.materialDescription || `Material #${item.materialId}`}</strong></td>
          <td>{item.materialBrand || '—'}</td>
          <td>{item.materialUnit || 'UN'}</td>
          <td><input type="number" min="1" step="1" value={item.quantity ?? 1} onChange={(event) => updateMaterial(index, { quantity: Number(event.target.value) })} /></td>
          <td><input type="number" min="0" step="0.01" value={item.unitValue ?? 0} onChange={(event) => updateMaterial(index, { unitValue: Number(event.target.value) })} /></td>
          <td><input value={money(numberValue(item.quantity) * numberValue(item.unitValue))} readOnly /></td>
          <td><button type="button" className="os-remove-row" onClick={() => setMaterialItems((current) => current.filter((_, rowIndex) => rowIndex !== index))} aria-label="Remover material"><X size={16} /></button></td>
        </tr>)}</tbody></table></div> : <div className="os-empty-grid">Nenhum material adicionado. Pesquise no cadastro e monte o pedido de compra.</div>}
      </section>

      <div className="os-purchase-footer">
        {(numberValue(purchaseDiscount) > 0 || numberValue(purchaseFreight) > 0 || numberValue(purchaseInsurance) > 0 || numberValue(purchaseStandard) > 0 || numberValue(purchaseGbMargin) > 0 || numberValue(purchaseRental) > 0) && <p className="finance-dialog__hint">Pedido do sistema anterior com desconto/frete/seguro/sprad/margem/aluguel (total líquido {money(materialAmount)}). Esses campos não são mais usados e foram mantidos como estavam.</p>}
        <FormField label="Observações"><textarea rows={3} maxLength={250} value={purchaseNotes} onChange={(event) => setPurchaseNotes(event.target.value)} /></FormField>
      </div>
      <div className="os-purchase-totals"><span><small>Total bruto</small><strong>{money(materialGross)}</strong></span><span className="os-purchase-totals__primary"><small>Total do pedido</small><strong>{money(materialAmount)}</strong></span></div>
    </section>}
    {selected && <div className="destructive-row"><span><strong>Excluir ordem</strong><small>Também remove os agendamentos e serviços vinculados.</small></span><Button type="button" variant="danger" icon={<Trash2 size={16} />} onClick={() => onDelete(selected.id)}>Excluir</Button></div>}
  </ModalForm>
  <Modal open={clientPickerOpen} onClose={() => setClientPickerOpen(false)} title="Selecionar cliente" description="Pesquise por nome fantasia, razão social ou código e confira o endereço antes de selecionar." size="large">
    <div className="modal__body employee-picker-modal client-picker-modal">
      <div className="search-box employee-picker-modal__search"><Search size={18} /><input autoFocus value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Digite ao menos 2 letras ou o código..." /></div>
      <div className="employee-picker-modal__results">
        {!clientSearchReady ? <EmptyState title="Pesquise um cliente" description="Digite ao menos 2 letras do nome fantasia ou razão social, ou informe o código." /> : clientOptionsQuery.isLoading ? <LoadingState label="Buscando clientes..." /> : clientOptionsQuery.isError ? <ErrorState message={apiErrorMessage(clientOptionsQuery.error)} onRetry={() => clientOptionsQuery.refetch()} /> : clientOptions.length === 0 ? <EmptyState title="Nenhum cliente encontrado" description="Tente outro nome ou código de cliente." /> : clientOptions.map((client) => <button type="button" key={client.id} onClick={() => selectClient(client)}>
          <span className="employee-picker-modal__avatar client-picker-modal__avatar"><Building2 size={19} /></span>
          <span className="employee-picker-modal__identity"><strong>{clientDisplay(client)}</strong><small>{client.legalName && client.legalName !== client.tradeName ? client.legalName : 'Razão social não informada'}</small></span>
          <span className="client-picker-modal__address"><MapPin size={16} /><span><strong>Endereço principal</strong><small>{clientSearchAddress(client) || 'Endereço não informado'}</small></span></span>
          <span className={`client-picker-modal__contract ${client.hasContract ? 'client-picker-modal__contract--active' : ''}`}><strong>{client.hasContract ? 'Com contrato' : 'Sem contrato'}</strong><small>{client.contractId ? `Contrato #${client.contractId}` : 'Nenhum contrato vigente'}</small></span>
          <span className="employee-picker-modal__meta"><strong>Código #{client.id}</strong><small>{client.document || 'CPF/CNPJ não informado'}</small></span>
        </button>)}
      </div>
    </div>
  </Modal>
  <Modal open={locationModalOpen} onClose={() => !createAttendanceLocationMutation.isPending && setLocationModalOpen(false)} title="Novo local de atendimento" description={`Cadastre um endereço vinculado a ${selectedClientLabel}.`} size="large">
    <ModalForm onSubmit={submitAttendanceLocation} onCancel={() => setLocationModalOpen(false)} submitting={createAttendanceLocationMutation.isPending} submitLabel={createAttendanceLocationMutation.isPending ? 'Cadastrando...' : 'Cadastrar local'}>
      <FormError message={locationError} />
      <div className="attendance-location-form-grid">
        <FormField label="Descrição do local"><input name="description" required maxLength={50} placeholder="Ex.: Sede, filial ou condomínio" /></FormField>
        <FormField label="Endereço"><input name="address" required maxLength={200} placeholder="Rua, avenida e número" /></FormField>
        <FormField label="Complemento"><input name="complement" maxLength={100} /></FormField>
        <FormField label="Bairro"><input name="district" maxLength={100} /></FormField>
        <FormField label="Cidade"><input name="city" maxLength={100} /></FormField>
        <FormField label="CEP"><input name="zipCode" maxLength={10} /></FormField>
        <FormField label="Contato no local"><input name="contactName" maxLength={50} /></FormField>
        <FormField label="Telefone do contato"><input name="contactPhone" maxLength={18} /></FormField>
        <FormField label="Solicitante"><input name="requester" maxLength={100} defaultValue={requester} /></FormField>
        <FormField label="CNPJ do local"><input name="cnpj" maxLength={25} /></FormField>
        <FormField label="Ponto de referência"><textarea name="referencePoint" rows={3} maxLength={300} /></FormField>
      </div>
    </ModalForm>
  </Modal>
  <Modal open={employeePickerIndex !== null} onClose={closeEmployeePicker} title="Selecionar funcionário" description="Pesquise por código, nome, apelido ou cargo e escolha o profissional responsável." size="large">
    <div className="modal__body employee-picker-modal">
      <div className="search-box employee-picker-modal__search"><Search size={18} /><input autoFocus value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder="Digite o nome, apelido, cargo ou código..." /></div>
      <div className="employee-picker-modal__results">
        {employeesQuery.isLoading ? <LoadingState label="Buscando funcionários..." /> : employeesQuery.isError ? <ErrorState message={apiErrorMessage(employeesQuery.error)} onRetry={() => employeesQuery.refetch()} /> : (employeesQuery.data?.length ?? 0) === 0 ? <EmptyState title="Nenhum funcionário encontrado" description="Tente outro nome, apelido, cargo ou código." /> : employeesQuery.data?.map((employee) => <article className={`employee-picker-modal__option ${employee.active ? '' : 'employee-picker-modal__option--inactive'}`} key={employee.id}>
          <button type="button" className="employee-picker-modal__select" disabled={!employee.active} onClick={() => selectEmployee(employee)}>
            <span className="employee-picker-modal__avatar"><UserRound size={19} /></span>
            <span className="employee-picker-modal__identity"><strong>{employeeDisplay(employee)}</strong><small>{employee.nickname && employee.nickname !== employee.name ? `${employee.nickname} · ` : ''}Código #{employee.id}</small></span>
            <span className="employee-picker-modal__meta"><strong>{employee.position || 'Cargo não informado'}</strong><small>{employee.phone || employee.secondaryPhone || employee.tertiaryPhone || 'Telefone não informado'}</small></span>
          </button>
          <button type="button" role="switch" aria-checked={employee.active} aria-label={`${employee.active ? 'Desativar' : 'Reativar'} ${employeeDisplay(employee)}`} title={employee.active ? 'Desativar funcionário' : 'Reativar funcionário'} className={`employee-availability-toggle ${employee.active ? 'employee-availability-toggle--active' : ''} employee-picker-modal__availability`} disabled={employeeAvailabilityMutation.isPending && employeeAvailabilityMutation.variables?.employee.id === employee.id} onClick={() => employeeAvailabilityMutation.mutate({ employee, active: !employee.active })}><span aria-hidden="true"><i /></span><strong>{employee.active ? 'Ativo' : 'Inativo'}</strong></button>
        </article>)}
      </div>
    </div>
  </Modal>
  </>
}

function serviceDraft(service: ServiceCatalogItem): ServiceDraft {
  const unitValue = numberValue(service.defaultPrice ?? service.defaultValue)
  return { rowKey: `service-new-${service.id}-${Date.now()}`, serviceId: service.id, quantity: 1, hours: '00:00', unitValue, totalValue: unitValue, minimumValue: numberValue(service.minimumValue), minuteValue: numberValue(service.legacyMinuteValue), extraValue: numberValue(service.extraValue ?? service.legacyMinuteValue), oneOffValue: numberValue(service.oneOffValue ?? service.legacyMinuteValue) }
}

function materialDraft(material: Material): MaterialDraft {
  const unitValue = numberValue(material.unitValue)
  return {
    rowKey: `material-new-${material.id}-${Date.now()}`,
    materialId: material.id,
    quantity: 1,
    unitValue,
    totalValue: unitValue,
    materialDescription: material.description,
    materialUnit: material.unit,
    materialBrand: material.brand,
  }
}

function supplierDisplay(supplier: Supplier) {
  const name = supplier.tradeName || supplier.legalName || `Fornecedor #${supplier.id}`
  return `${name}${supplier.tradeName && supplier.legalName ? ` — ${supplier.legalName}` : ''} · #${supplier.id}`
}

function ServiceOrderDetail({ order, catalog, flagSaving, onFlagChange }: { order: ServiceOrder; catalog: ServiceCatalogItem[]; flagSaving: boolean; onFlagChange: (flag: ServiceOrderOperationalFlag, checked: boolean) => void }) {
  const tradeName = order.client?.nmfanta
  const legalName = order.clientName || order.client?.nmrazao || order.client?.name
  const attendanceLocationQuery = useQuery({
    queryKey: [...queryKeys.attendanceLocations, 'client', order.idclien, 'location', order.idlocal],
    queryFn: () => api.attendanceLocations.findForClient(order.idlocal!, order.idclien!),
    enabled: Boolean(order.idclien && order.idlocal),
    retry: false,
  })
  const attendanceLocation = attendanceLocationQuery.data
  return <div className="detail-modal-content">
    <div className="detail-modal__hero-row"><div className="detail-drawer__hero"><span className="detail-avatar"><Wrench /></span><div><span>OS-{order.id} · {order.flordem === 'C' ? 'Contrato' : 'Avulsa'}</span><h2>{tradeName || legalName || 'Cliente não identificado'}</h2>{tradeName && legalName && <p>{legalName}</p>}</div></div><div className="detail-status-stack">{order.priority === 'URGENTE' && <Badge tone="red">Urgente</Badge>}<Badge tone={statusTone[order.status]}>{enumLabel(order.status)}</Badge></div></div>
    <div className="os-detail-operational-flags" aria-label="Indicadores operacionais da ordem de serviço">{operationalFlags.map((item) => <div key={item.flag} className={`os-detail-operational-flag os-detail-operational-flag--${item.tone} ${detailFlagValue(order, item.flag) ? 'is-checked' : ''}`}><OperationalCheckbox active={detailFlagValue(order, item.flag)} label={item.label} tone={item.tone} disabled={order.status === 'CANCELADA' || flagSaving} onChange={(checked) => onFlagChange(item.flag, checked)} /><span><small>Status rápido</small><strong>{item.label}</strong></span></div>)}</div>
    <div className="detail-metrics"><span><small>Data da requisição</small><strong>{formatDate(order.dtordem)}</strong></span><span><small>Agendamentos</small><strong>{order.schedules?.length ?? 0}</strong></span><span><small>Tempo realizado</small><strong>{order.qthorat || '00:00'}</strong></span><span><small>{order.flordem === 'C' ? 'Tempo descontado' : 'Tempo cobrado'}</small><strong>{order.qthorac || '00:00'}</strong></span><span><small>Valor a cobrar</small><strong>{money(order.vlcobra)}</strong></span></div>
    <div className="detail-sections-grid">
      <section className="drawer-section"><h3>Atendimento</h3><dl><div><dt>Solicitante</dt><dd>{order.nmsolic || 'Não informado'}</dd></div><div><dt>Categoria</dt><dd>{enumLabel(order.category)}</dd></div><div><dt>Tipo de serviço</dt><dd>{serviceTypes.find((item) => item.value === order.tpservic)?.label || 'Não informado'}</dd></div><div><dt>Procurar por</dt><dd>{order.procurarpor || 'Não informado'}</dd></div><div><dt>Local</dt><dd>{attendanceLocation ? attendanceLocationDisplay(attendanceLocation) : order.idlocal ? `Local #${order.idlocal}` : 'Não informado'}</dd></div></dl></section>
      <section className="drawer-section"><h3>Valores</h3><dl><div><dt>Serviços</dt><dd>{money(order.vlhorar)}</dd></div><div><dt>Materiais</dt><dd>{money(order.vlmater)}</dd></div><div><dt>Transporte / aluguel</dt><dd>{money(numberValue(order.vltrans) + numberValue(order.vlalug))}</dd></div><div><dt>Desconto</dt><dd>{order.vldesco ?? 0}%</dd></div></dl></section>
      {order.flordem === 'C' && <section className="drawer-section drawer-section--wide"><h3>Consumo mensal do contrato</h3><dl><div><dt>Horas contratadas</dt><dd>{order.sdcontr || '00:00'}</dd></div><div><dt>Utilizado antes desta OS</dt><dd>{order.sdanter || '00:00'}</dd></div><div><dt>Utilizado no mês</dt><dd>{order.sdutili || '00:00'}</dd></div><div><dt>Saldo do mês</dt><dd>{order.sdfinal || '00:00'}</dd></div><div><dt>Excedente</dt><dd>{order.sdexced || '00:00'}</dd></div></dl></section>}
      <section className="drawer-section drawer-section--wide"><h3>Descrição e observações</h3><p className="drawer-section__text">{order.dsdescr || order.description || 'Descrição não informada'}</p>{order.dsobser && <p className="drawer-section__text detail-text-spaced">{order.dsobser}</p>}{order.dscancel && <p className="drawer-section__text detail-text-spaced"><strong>Cancelamento:</strong> {order.dscancel}</p>}</section>
      <section className="drawer-section drawer-section--wide"><h3>Acompanhamento dos atendimentos</h3>{order.trackingDetails?.length ? <div className="detail-list-grid">{order.trackingDetails.map((tracking) => <span key={tracking.id} className={tracking.running ? 'tracking-detail--running' : ''}><strong>{tracking.serviceDescription} · {tracking.running ? <>Em andamento: <LiveElapsed startedAt={tracking.startedAt} /></> : tracking.duration || '00:00'}</strong><small>Funcionário: {tracking.employeeName} · Início: {formatDate(tracking.startedAt)} às {tracking.startTime} · Final: {tracking.endTime || '--:--'}</small></span>)}</div> : <p className="drawer-section__text">Nenhum acompanhamento iniciado.</p>}</section>
      <section className="drawer-section drawer-section--wide"><h3>Agendamentos</h3>{order.schedules?.length ? <div className="detail-list-grid">{order.schedules.map((item) => {
        const serviceName = catalog.find((service) => service.id === item.serviceId)?.description
        return <span key={item.scheduleId}><strong>Previsto: {formatDate(item.expectedDate)} · {item.expectedStart || '--:--'}–{item.expectedEnd || '--:--'}</strong><small>Funcionário: {item.employeeName || item.employeeNickname || (item.employeeId ? `#${item.employeeId}` : 'Aguardando')}{item.employeePosition ? ` · ${item.employeePosition}` : ''}{item.employeePhone ? ` · ${item.employeePhone}` : ''} · Serviço: {serviceName || (item.serviceId ? `#${item.serviceId}` : 'não vinculado')} · Realizado: {item.actualDate ? formatDate(item.actualDate) : 'sem data'} · {item.actualStart || '--:--'}–{item.actualEnd || '--:--'} ({item.actualDuration || '00:00'})</small></span>
      })}</div> : <p className="drawer-section__text">Nenhum agendamento vinculado.</p>}</section>
      <section className="drawer-section drawer-section--wide"><h3>Serviços</h3>{order.serviceItems?.length ? <div className="detail-list-grid">{order.serviceItems.map((item) => <span key={item.serviceId}><strong>{catalog.find((service) => service.id === item.serviceId)?.description || `Serviço #${item.serviceId}`}</strong><small>Horas oficiais: {item.hours || '00:00'} · {item.quantity || 0} × {money(item.unitValue)} · Total {money(item.totalValue)}</small></span>)}</div> : <p className="drawer-section__text service-description-empty">NENHUM SERVIÇO VINCULADO</p>}</section>
      <section className="drawer-section drawer-section--wide"><h3>Pedido de compra</h3>{order.materialOrder ? <><dl><div><dt>Pedido</dt><dd>#{order.materialOrder.id}</dd></div><div><dt>Fornecedor</dt><dd>{order.materialOrder.supplierTradeName || order.materialOrder.supplierName || `#${order.materialOrder.supplierId}`}</dd></div><div><dt>Data de entrada</dt><dd>{formatDate(order.materialOrder.entryDate)}</dd></div><div><dt>Conta a pagar</dt><dd>{order.materialOrder.payableId ? `#${order.materialOrder.payableId}${(order.materialOrder.payableInstallments ?? 1) > 1 ? ` (${order.materialOrder.payableInstallments} prestações)` : ''} · ${order.materialOrder.payableStatus === 'PAID' ? 'Quitada' : 'Em aberto'}` : 'Não gerada'}</dd></div><div><dt>{(order.materialOrder.payableInstallments ?? 1) > 1 ? 'Próximo vencimento' : 'Vencimento'}</dt><dd>{formatDate(order.materialOrder.payableDueDate)}</dd></div><div><dt>Total líquido</dt><dd>{money(order.materialOrder.netValue)}</dd></div></dl>{order.materialOrder.items?.length ? <div className="detail-list-grid detail-purchase-items">{order.materialOrder.items.map((item) => <span key={`${item.purchaseOrderId}-${item.itemId}`}><strong>{item.materialDescription || `Material #${item.materialId}`}</strong><small>{item.quantity || 0} {item.materialUnit || 'UN'} × {money(item.unitValue)} · Total {money(item.totalValue)}</small></span>)}</div> : <p className="drawer-section__text detail-text-spaced">Nenhum item vinculado ao pedido.</p>}</> : <p className="drawer-section__text">Nenhum pedido de compra vinculado.</p>}</section>
    </div>
  </div>
}
