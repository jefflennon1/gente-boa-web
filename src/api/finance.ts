import type { PagedResponse, PayableAccount, PayableDateField } from '../types'
import type {
  BatchOperationResult,
  CashDaily,
  CashDayStatus,
  CostCenter,
  CostCenterReport,
  FinancialPeriodReport,
  FinancialSummary,
  InstallmentPayload,
  MultipleSettlementPayload,
  Receivable,
  ReceivableListParams,
  ReceivablePayload,
  ReceivablePaymentPayload,
  SubCostCenter,
} from '../types-finance'
import { http } from './client'

export type PayableFilterParams = {
  query?: string
  supplierId?: number
  payableId?: number
  serviceOrderId?: number
  startDate?: string
  endDate?: string
  dateField?: PayableDateField
  status?: 'ALL' | 'OPEN' | 'PAID' | 'CLOSED' | 'OVERDUE'
  minAmount?: number
  maxAmount?: number
  costCenterId?: number
  subCostCenterId?: number
  movementAccountId?: number
}

export const financeApi = {
  receivables: {
    async list(params: ReceivableListParams = {}) {
      const { data } = await http.get<PagedResponse<Receivable>>('/accounts-receivable/entries', { params: { page: 0, size: 20, ...params } })
      return data
    },
    async summary(params: ReceivableListParams = {}) {
      const { data } = await http.get<FinancialSummary>('/accounts-receivable/entries/summary', { params })
      return data
    },
    async find(id: number) {
      const { data } = await http.get<Receivable>(`/accounts-receivable/entries/${id}`)
      return data
    },
    async create(payload: ReceivablePayload) {
      const { data } = await http.post<Receivable>('/accounts-receivable/entries', payload)
      return data
    },
    async update(id: number, payload: ReceivablePayload) {
      const { data } = await http.put<Receivable>(`/accounts-receivable/entries/${id}`, payload)
      return data
    },
    async remove(id: number) {
      await http.delete(`/accounts-receivable/entries/${id}`)
    },
    async settle(id: number, payload: ReceivablePaymentPayload) {
      const { data } = await http.post<Receivable>(`/accounts-receivable/entries/${id}/payments`, payload)
      return data
    },
    async reversePayment(id: number, paymentId: number) {
      const { data } = await http.delete<Receivable>(`/accounts-receivable/entries/${id}/payments/${paymentId}`)
      return data
    },
    async reverseLegacySettlement(id: number) {
      const { data } = await http.delete<Receivable>(`/accounts-receivable/entries/${id}/legacy-settlement`)
      return data
    },
    async settleMultiple(payload: MultipleSettlementPayload) {
      const { data } = await http.post<BatchOperationResult>('/accounts-receivable/entries/settle-multiple', payload, { timeout: 120_000 })
      return data
    },
    async installments(id: number, payload: InstallmentPayload) {
      const { data } = await http.post<Receivable[]>(`/accounts-receivable/entries/${id}/installments`, payload)
      return data
    },
    async receipt(id: number) {
      const { data } = await http.get<Blob>(`/accounts-receivable/entries/${id}/receipt`, { responseType: 'blob' })
      return data
    },
    async settleBill(billId: number, payload: { paidAt: string; movementAccountId: number; paymentMethod?: string }) {
      const { data } = await http.post<BatchOperationResult>(`/accounts-receivable/entries/bills/${billId}/settle`, payload)
      return data
    },
    async settleBills(billIds: number[], payload: { paidAt: string; movementAccountId: number; paymentMethod?: string }) {
      const { data } = await http.post<BatchOperationResult>('/accounts-receivable/entries/bills/settle-multiple', { billIds, ...payload }, { timeout: 120_000 })
      return data
    },
  },
  payables: {
    async list(params: PayableFilterParams & { page?: number; size?: number } = {}) {
      const { data } = await http.get<PagedResponse<PayableAccount>>('/payables', { params: { page: 0, size: 20, status: 'OPEN', ...params } })
      return data
    },
    async summary(params: PayableFilterParams = {}) {
      const { data } = await http.get<FinancialSummary>('/payables/summary', { params: { status: 'OPEN', ...params } })
      return data
    },
    async settleMultiple(payload: MultipleSettlementPayload) {
      const { data } = await http.post<BatchOperationResult>('/payables/settle-multiple', payload, { timeout: 120_000 })
      return data
    },
    async installments(id: number, payload: InstallmentPayload) {
      const { data } = await http.post<PayableAccount[]>(`/payables/${id}/installments`, payload)
      return data
    },
    async reverseLegacySettlement(id: number) {
      const { data } = await http.delete<PayableAccount>(`/payables/${id}/legacy-settlement`)
      return data
    },
  },
  costCenters: {
    async list(category?: string) {
      const { data } = await http.get<CostCenter[]>('/cost-centers', { params: { category } })
      return data
    },
    async create(payload: { category: string; description: string }) {
      const { data } = await http.post<CostCenter>('/cost-centers', payload)
      return data
    },
    async update(id: number, payload: { category: string; description: string }) {
      const { data } = await http.put<CostCenter>(`/cost-centers/${id}`, payload)
      return data
    },
    async remove(id: number) {
      await http.delete(`/cost-centers/${id}`)
    },
    async createSubCenter(payload: { costCenterId: number; description: string }) {
      const { data } = await http.post<SubCostCenter>('/cost-centers/sub-centers', payload)
      return data
    },
    async updateSubCenter(id: number, payload: { costCenterId: number; description: string }) {
      const { data } = await http.put<SubCostCenter>(`/cost-centers/sub-centers/${id}`, payload)
      return data
    },
    async removeSubCenter(id: number) {
      await http.delete(`/cost-centers/sub-centers/${id}`)
    },
  },
  cash: {
    async daily(params: { startDate: string; endDate: string; movementAccountId?: number }) {
      const { data } = await http.get<CashDaily>('/cash/daily', { params, timeout: 60_000 })
      return data
    },
    async close(startDate: string, endDate: string) {
      const { data } = await http.post<CashDayStatus[]>('/cash/close', { startDate, endDate })
      return data
    },
    async reopen(startDate: string, endDate: string) {
      const { data } = await http.post<CashDayStatus[]>('/cash/reopen', { startDate, endDate })
      return data
    },
  },
  reports: {
    async payablesByPeriod(params: { startDate: string; endDate: string; supplierId?: number; serviceOrderId?: number; orderBy?: string; scope?: string }) {
      const { data } = await http.get<FinancialPeriodReport>('/financial-reports/payables-by-period', { params, timeout: 60_000 })
      return data
    },
    async receivablesByPeriod(params: { startDate: string; endDate: string; clientId?: number; serviceOrderId?: number; orderBy?: string; scope?: string; paymentType?: string }) {
      const { data } = await http.get<FinancialPeriodReport>('/financial-reports/receivables-by-period', { params, timeout: 60_000 })
      return data
    },
    async payablesByCostCenter(params: { startDate: string; endDate: string; costCenterId?: number; subCostCenterId?: number; status?: string; type?: string }) {
      const { data } = await http.get<CostCenterReport>('/financial-reports/payables-by-cost-center', { params, timeout: 60_000 })
      return data
    },
    async receivablesByCostCenter(params: { startDate: string; endDate: string; costCenterId?: number; subCostCenterId?: number; status?: string; type?: string }) {
      const { data } = await http.get<CostCenterReport>('/financial-reports/receivables-by-cost-center', { params, timeout: 60_000 })
      return data
    },
  },
}

export const financeKeys = {
  receivables: ['receivables'] as const,
  costCenters: ['cost-centers'] as const,
  cash: ['cash'] as const,
  financialReports: ['financial-reports'] as const,
}
