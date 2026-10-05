import { http } from './client'

/* ---------- Contratos ativos e reajuste (POP p.29) ---------- */
export interface ContractServiceLine { sequence: number; serviceId: number; serviceName: string | null; unit: string | null; quantity: number; bonusQuantity: number | null; unitValue: number; totalValue: number; extraValue: number; minuteValue: number }
export interface ContractLocation { id: number; description: string | null; address: string | null; complement: string | null; district: string | null; city: string | null; contactName: string | null; contactPhone: string | null }
export interface ActiveContract { contractId: number; clientId: number | null; clientName: string | null; clientTradeName: string | null; contractDate: string | null; renewalDate: string | null; dueDay: number | null; lastAdjustmentDate: string | null; contractedHours: number; monthlyValue: number; services: ContractServiceLine[]; locations: ContractLocation[] }
export interface ActiveContractsRelation { totalContracts: number; totalHours: number; totalMonthly: number; contracts: ActiveContract[] }
export interface ReadjustmentPayload { percentage: number; contractIds: number[]; overrides?: Array<{ contractId: number; percentage: number }>; adjustUnitValue: boolean; adjustExtraValue: boolean; adjustMinuteValue: boolean; renewTerm: boolean; effectiveDate?: string | null }
export interface ServiceChange { sequence: number; serviceName: string; quantity: number; currentUnitValue: number; newUnitValue: number; currentTotal: number; newTotal: number; currentExtraValue: number; newExtraValue: number; currentMinuteValue: number; newMinuteValue: number }
export interface ContractChange { contractId: number; clientId: number | null; clientName: string | null; percentage: number; currentContractDate: string | null; currentRenewalDate: string | null; newContractDate: string | null; newRenewalDate: string | null; currentMonthly: number; newMonthly: number; services: ServiceChange[] }
export interface ReadjustmentPreview { percentage: number; contracts: number; currentMonthly: number; newMonthly: number; changes: ContractChange[]; applied: boolean }
/** Prévia do reajuste programado em Parâmetros do sistema (tabela de serviços + contratos ativos). */
export interface ServicePriceAdjustmentPreview { services: number; contracts: number; skippedContractIds: number[]; contractPreview: ReadjustmentPreview | null }
export interface RenewalHistory { id: number; contractId: number; clientId: number | null; clientName: string | null; contractDate: string | null; renewalDate: string | null; changedAt: string | null; previousTotal: number; newTotal: number; previousExtra: number; newExtra: number; previousMinute: number; newMinute: number; percentage: number }

/* ---------- Modelos de documentos (POP p.27-28) ---------- */
export type TemplateKey = 'CONTRATO' | 'BOAS_VINDAS'
export interface TemplateVariable { name: string; description: string }
export interface DocumentTemplate { key: TemplateKey; title: string; body: string; updatedAt: string | null; updatedBy: string | null; customized: boolean; variables: TemplateVariable[]; blocks: TemplateVariable[] }

/* ---------- Relatórios de clientes, canais de venda e resumo mensal ---------- */
export interface ClientReportRow { id: number; name: string | null; tradeName: string | null; personType: 'F' | 'J'; document: string | null; phone: string | null; email: string | null; address: string | null; complement: string | null; district: string | null; city: string | null; state: string | null; zipCode: string | null; birthday: string | null; channel: string | null; registeredAt: string | null; contracted: boolean }
export interface ChannelReport { startDate: string | null; endDate: string | null; channels: Array<{ channel: string; clients: number; contracted: number }>; clients: ClientReportRow[] }
export interface SalesChannel { id: number; description: string; clients: number }
export interface SummaryLine { label: string; quantity: number; quantityPercentage: number; value: number; valuePercentage: number }
export interface HoursLine { label: string; contractedMinutes: number; usedMinutes: number; usedPercentage: number; clients: number; clientsUsing: number; usingPercentage: number; orders: number }
export interface MonthlySummary {
  startDate: string
  endDate: string
  commercial: { closed: SummaryLine; canceled: SummaryLine; active: SummaryLine; closedContracts: Array<Record<string, unknown>>; canceledContracts: Array<Record<string, unknown>> }
  ordersByType: SummaryLine[]
  ordersByCategory: SummaryLine[]
  operational: { purchaseOrders: SummaryLine[]; contractHourPrice: number; oneOffHourPrice: number; generalHourPrice: number; contractHours: HoursLine[]; oneOffMinutes: number; oneOffPercentage: number; totalMinutes: number }
  financial: { receivedCount: number; received: number; paidCount: number; paid: number; result: number; availability: SummaryLine[]; totalAvailable: number; overdue: SummaryLine; materialSales: SummaryLine; equipmentRental: SummaryLine }
}

/* ---------- Extrato explicativo do boleto (POP p.40-41) ---------- */
export interface BillStatementSummaryLine { label: string; amount: number }
export interface BillStatementAttendance { serviceOrderId: number; date: string | null; category: string; location: string; description: string; minutes: number; time: string }
export interface BillStatementPurchaseItem { product: string | null; unit: string | null; quantity: number | null; unitValue: number; total: number }
export interface BillStatementPurchaseOrder { id: number; supplierName: string | null; supplierTradeName: string | null; payableId: number | null; invoiceNumber: string | null; date: string | null; items: BillStatementPurchaseItem[]; total: number }
export interface BillStatementLocationOrder { date: string | null; serviceOrderId: number; time: string; block: string | null; description: string; amount: number; purchaseOrders: BillStatementPurchaseOrder[] }
export interface BillStatementLocationGroup { locationId: number | null; description: string; orders: BillStatementLocationOrder[]; minutes: number; time: string }
export interface BillStatementAllocationRow { locationId: number | null; location: string; minutes: number; time: string; percentage: number; labor: number; materials: number; oneOff: number; thirdParty: number; other: number; total: number }
export interface BillStatement {
  billId: number | null
  billNumber: number | null
  preview: boolean
  dueDate: string | null
  issueDate: string
  city: string
  clientId: number | null
  clientName: string | null
  clientAddress: string | null
  summary: BillStatementSummaryLine[]
  total: number
  attendances: BillStatementAttendance[]
  locations: BillStatementLocationGroup[]
  totalMinutes: number
  totalTime: string
  allocation: BillStatementAllocationRow[]
  allocationTotal: BillStatementAllocationRow
  company: { name: string | null; address: string | null } | null
}
/** Boleto ainda não gerado: contas a receber selecionadas ou cliente + vencimento. */
export type BillStatementPreviewPayload = { receivableIds: number[] } | { clientId: number; dueDate: string }
/** Origem do extrato exibido no modal. */
export type BillStatementSource = { billId: number } | BillStatementPreviewPayload

export type ListSummary = Record<string, number | string | Record<string, number>>

export const modulesApi = {
  readjustment: {
    async activeContracts(params: { dueDay?: number; query?: string } = {}) {
      const { data } = await http.get<ActiveContractsRelation>('/contract-readjustment/active-contracts', { params, timeout: 60_000 })
      return data
    },
    async preview(payload: ReadjustmentPayload) {
      const { data } = await http.post<ReadjustmentPreview>('/contract-readjustment/preview', payload, { timeout: 60_000 })
      return data
    },
    async apply(payload: ReadjustmentPayload) {
      const { data } = await http.post<ReadjustmentPreview>('/contract-readjustment/apply', payload, { timeout: 120_000 })
      return data
    },
    async history(params: { contractId?: number; year?: number } = {}) {
      const { data } = await http.get<RenewalHistory[]>('/contract-readjustment/history', { params })
      return data
    },
  },
  templates: {
    async find(key: TemplateKey) {
      const { data } = await http.get<DocumentTemplate>(`/document-templates/${key}`)
      return data
    },
    async save(key: TemplateKey, payload: { title: string; body: string }) {
      const { data } = await http.put<DocumentTemplate>(`/document-templates/${key}`, payload)
      return data
    },
    async reset(key: TemplateKey) {
      const { data } = await http.delete<DocumentTemplate>(`/document-templates/${key}`)
      return data
    },
    async preview(key: TemplateKey, contractId: number, payload: { title: string; body: string }) {
      const { data } = await http.post<Blob>(`/document-templates/${key}/preview`, payload, { params: { contractId }, responseType: 'blob', timeout: 60_000 })
      return data
    },
    async welcomeLetter(contractId: number) {
      const { data } = await http.get<Blob>(`/contracts/${contractId}/welcome-letter`, { responseType: 'blob', timeout: 60_000 })
      return data
    },
  },
  clientReports: {
    async listing(params: Record<string, string | undefined>) {
      const { data } = await http.get<ClientReportRow[]>('/client-reports/listing', { params, timeout: 60_000 })
      return data
    },
    async birthdays(params: { from?: string; to?: string; contractedOnly?: boolean }) {
      const { data } = await http.get<ClientReportRow[]>('/client-reports/birthdays', { params, timeout: 60_000 })
      return data
    },
    async byChannel(params: { startDate?: string; endDate?: string; channel?: string }) {
      const { data } = await http.get<ChannelReport>('/client-reports/by-channel', { params, timeout: 60_000 })
      return data
    },
  },
  salesChannels: {
    async list() {
      const { data } = await http.get<SalesChannel[]>('/sales-channels')
      return data
    },
    async create(description: string) {
      const { data } = await http.post<SalesChannel>('/sales-channels', { description })
      return data
    },
    async update(id: number, description: string) {
      const { data } = await http.put<SalesChannel>(`/sales-channels/${id}`, { description })
      return data
    },
    async remove(id: number) {
      await http.delete(`/sales-channels/${id}`)
    },
  },
  monthlySummary: {
    async find(startDate: string, endDate: string) {
      const { data } = await http.get<MonthlySummary>('/monthly-summary', { params: { startDate, endDate }, timeout: 120_000 })
      return data
    },
  },
  summaries: {
    async get(screen: string, params: Record<string, unknown> = {}) {
      const { data } = await http.get<ListSummary>(`/summaries/${screen}`, { params, timeout: 60_000 })
      return data
    },
  },
  bills: {
    async statement(billId: number) {
      const { data } = await http.get<Blob>(`/bills/${billId}/statement`, { responseType: 'blob', timeout: 60_000 })
      return data
    },
    async statementData(billId: number) {
      const { data } = await http.get<BillStatement>(`/bills/${billId}/statement-data`, { timeout: 60_000 })
      return data
    },
    async statementPreview(payload: BillStatementPreviewPayload) {
      const { data } = await http.post<BillStatement>('/bills/statement-preview', payload, { timeout: 60_000 })
      return data
    },
    async statementPreviewPdf(payload: BillStatementPreviewPayload) {
      const { data } = await http.post<Blob>('/bills/statement-preview/pdf', payload, { responseType: 'blob', timeout: 60_000 })
      return data
    },
  },
  users: {
    async permissionCatalog() {
      const { data } = await http.get<Record<string, string>>('/users/permission-catalog')
      return data
    },
  },
}

export const modulesKeys = {
  readjustment: ['contract-readjustment'] as const,
  templates: ['document-templates'] as const,
  clientReports: ['client-reports'] as const,
  salesChannels: ['sales-channels'] as const,
  monthlySummary: ['monthly-summary'] as const,
  summaries: ['summaries'] as const,
}

/** Abre um PDF (Blob) em nova aba. */
export function openPdf(blob: Blob) {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000)
}

export function summaryNumber(summary: ListSummary | undefined, key: string) {
  const value = summary?.[key]
  return typeof value === 'number' ? value : Number(value ?? 0)
}
