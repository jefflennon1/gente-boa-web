import { http } from './client'

export interface TrackingBreakdown { service: number; transfer: number; material: number; warranty: number; total: number }

export interface Workday {
  employeeId: number
  employeeName: string
  nickname: string | null
  position: string | null
  active: boolean
  workdayId: number | null
  date: string
  workload: string
  entryTime: string | null
  lunchStart: string | null
  lunchEnd: string | null
  lunchTotal: string | null
  exitTime: string | null
  workloadMinutes: number
  workedMinutes: number
  workedPercentage: number
  registered: TrackingBreakdown
  notes: string | null
}

export type DetailKind = 'SERVICE' | 'TRANSFER' | 'MATERIAL' | 'WARRANTY'

export interface DetailRow {
  id: number
  date: string
  employeeId: number
  serviceOrderId: number | null
  kind: DetailKind
  categoryFlag: string | null
  clientId: number | null
  clientName: string | null
  description: string | null
  startTime: string | null
  endTime: string | null
  minutes: number
  fromServiceOrderTimer: boolean
}

export interface DayDetail { workday: Workday; rows: DetailRow[]; registered: TrackingBreakdown }

export interface WorkdayPayload { date: string; employeeId: number; workload: string; entryTime: string; lunchStart: string; lunchEnd: string; exitTime: string; notes: string }
export interface DetailPayload { date: string; employeeId: number; serviceOrderId: number | null; kind: 'SERVICE' | 'TRANSFER' | 'MATERIAL'; description: string; startTime: string; endTime: string }

export interface PeriodReportRow { employeeId: number | null; employeeName: string; workloadMinutes: number; registered: TrackingBreakdown; laborOrders: number; warrantyOrders: number; otherOrders: number; totalOrders: number }
export interface PeriodReport { startDate: string; endDate: string; rows: PeriodReportRow[]; totals: PeriodReportRow }
export interface OvertimeDay { date: string; entryTime: string | null; lunchStart: string | null; lunchEnd: string | null; lunchTotal: string; exitTime: string | null; workloadMinutes: number; workedMinutes: number }
export interface OvertimeWeek { startDate: string; endDate: string; days: OvertimeDay[]; workloadMinutes: number; workedMinutes: number; extraMinutes: number; extraValue: number }
export interface OvertimeEmployee { employeeId: number; employeeName: string; weeks: OvertimeWeek[]; workloadMinutes: number; workedMinutes: number; extraMinutes: number; extraValue: number }
export interface OvertimeReport { startDate: string; endDate: string; hourValue: number; employees: OvertimeEmployee[] }
export interface DailyReportEntry { workday: Workday; rows: DetailRow[] }

export const employeeTrackingApi = {
  async day(date: string, includeTerminated: boolean) {
    const { data } = await http.get<Workday[]>('/employee-tracking/day', { params: { date, includeTerminated } })
    return data
  },
  async saveWorkday(payload: WorkdayPayload) {
    const { data } = await http.put<Workday>('/employee-tracking/day', payload)
    return data
  },
  async detail(date: string, employeeId: number) {
    const { data } = await http.get<DayDetail>('/employee-tracking/detail', { params: { date, employeeId } })
    return data
  },
  async createDetail(payload: DetailPayload) {
    const { data } = await http.post<DayDetail>('/employee-tracking/detail', payload)
    return data
  },
  async updateDetail(id: number, payload: DetailPayload) {
    const { data } = await http.put<DayDetail>(`/employee-tracking/detail/${id}`, payload)
    return data
  },
  async deleteDetail(id: number) {
    const { data } = await http.delete<DayDetail>(`/employee-tracking/detail/${id}`)
    return data
  },
  async dailyReport(params: { startDate: string; endDate: string; employeeId?: number }) {
    const { data } = await http.get<DailyReportEntry[]>('/employee-tracking/reports/daily', { params, timeout: 60_000 })
    return data
  },
  async periodReport(params: { startDate: string; endDate: string; includeTerminated?: boolean }) {
    const { data } = await http.get<PeriodReport>('/employee-tracking/reports/period', { params, timeout: 60_000 })
    return data
  },
  async overtimeReport(params: { startDate: string; endDate: string; employeeId?: number; hourValue?: number }) {
    const { data } = await http.get<OvertimeReport>('/employee-tracking/reports/overtime', { params, timeout: 60_000 })
    return data
  },
}

export const employeeTrackingKeys = { all: ['employee-tracking'] as const }

export function hours(minutes?: number | null) {
  const value = Math.max(0, Math.round(minutes ?? 0))
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

export function percent(part: number, total: number) {
  return total > 0 ? `${((part * 100) / total).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '0,00%'
}

export const detailKindLabels: Record<DetailKind, string> = { SERVICE: 'Atendimento', TRANSFER: 'Translado entre OS', MATERIAL: 'Compra de material', WARRANTY: 'Garantia' }
