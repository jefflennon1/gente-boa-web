import type { ISODate, ISODateTime } from './types'

export type FinancialStatusFilter = 'ALL' | 'OPEN' | 'PAID' | 'OVERDUE'
export type SettlementMethod = 'CASH' | 'TRANSFER' | 'BILL'

export interface FinancialSummary {
  count: number
  amountDue: number
  amountPaid: number
  balance: number
  overdueCount: number
  overdueBalance: number
  openCount: number
  paidCount: number
}

export interface BatchOperationResult {
  count: number
  totalAmount: number
  ids: number[]
}

export interface MultipleSettlementPayload {
  ids: number[]
  paidAt: ISODateTime
  movementAccountId: number
  paymentMethod: SettlementMethod
  notes?: string | null
}

export interface InstallmentPayload {
  entryAmount: number
  entryDueDate: ISODate
  installments: number
  firstInstallmentDueDate?: ISODate | null
}

export interface ReceivablePayment {
  id: number
  paidAt: ISODateTime
  cashValue: number
  transferValue: number
  billValue: number
  otherValue: number
  totalValue: number
  movementAccountId: number | null
  movementAccountName: string | null
  notes: string | null
}

export type ReceivableOrigin = 'MANUAL' | 'OS' | 'CONTRATO' | 'ISS'

export interface Receivable {
  id: number
  clientId: number | null
  clientName: string | null
  clientTradeName: string | null
  clientDocument: string | null
  contractId: number | null
  serviceOrderId: number | null
  purchaseOrderId: number | null
  invoiceNumber: string | null
  description: string | null
  notes: string | null
  billNumber: number | null
  amount: number
  receivedAmount: number
  balance: number
  createdAt: ISODateTime | null
  dueAt: ISODateTime | null
  receivedAt: ISODateTime | null
  status: 'OPEN' | 'PAID'
  overdue: boolean
  costCenterId: number | null
  costCenterName: string | null
  subCostCenterId: number | null
  subCostCenterName: string | null
  movementAccountId: number | null
  movementAccountName: string | null
  paymentMethodDescription: string | null
  origin: ReceivableOrigin
  managedBySystem: boolean
  legacySettlement: boolean
  username: string | null
  payments: ReceivablePayment[]
}

export interface ReceivablePayload {
  clientId: number
  contractId?: number | null
  serviceOrderId?: number | null
  purchaseOrderId?: number | null
  invoiceNumber?: string | null
  description: string
  notes?: string | null
  amount: number
  registeredAt?: ISODateTime | null
  dueAt: ISODateTime
  costCenterId?: number | null
  subCostCenterId?: number | null
}

export interface ReceivablePaymentPayload {
  paidAt: ISODateTime
  cashValue: number
  transferValue: number
  billValue: number
  movementAccountId: number
  costCenterId?: number | null
  subCostCenterId?: number | null
  notes?: string | null
}

export interface ReceivableListParams {
  query?: string
  clientId?: number
  receivableId?: number
  billNumber?: number
  serviceOrderId?: number
  dateField?: 'DUE_DATE' | 'RECEIPT_DATE' | 'REGISTRATION_DATE'
  startDate?: string
  endDate?: string
  status?: FinancialStatusFilter
  minAmount?: number
  maxAmount?: number
  costCenterId?: number
  subCostCenterId?: number
  movementAccountId?: number
  billingType?: 'ALL' | 'CONTRACT' | 'ONE_OFF'
  sortBy?: 'DUE_DATE' | 'RECEIPT_DATE' | 'REGISTRATION_DATE' | 'AMOUNT' | 'ID'
  direction?: 'ASC' | 'DESC'
  page?: number
  size?: number
}

export interface SubCostCenter {
  id: number
  costCenterId: number
  description: string
}

export interface CostCenter {
  id: number
  category: 'Receitas' | 'Despesas' | string
  description: string
  subCenters: SubCostCenter[]
}

export interface CashBreakdown {
  cash: number
  transfer: number
  bill: number
  other: number
  total: number
}

export interface CashAccountSummary {
  id: number
  name: string
  detail: string
  fixedFund: boolean
  previousBalance: number
  credits: CashBreakdown
  debits: CashBreakdown
  finalBalance: number
}

export interface CashEntry {
  kind: 'CR' | 'CP'
  documentId: number
  date: ISODate
  movementAccountId: number | null
  movementAccountName: string | null
  partyId: number | null
  partyName: string | null
  description: string | null
  billNumber: number | null
  serviceOrderId: number | null
  cash: number
  transfer: number
  bill: number
  other: number
  total: number
}

export interface CashDayStatus {
  date: ISODate
  closed: boolean
  history: string | null
}

export interface CashDaily {
  startDate: ISODate
  endDate: ISODate
  movementAccountId: number | null
  accounts: CashAccountSummary[]
  totalCredits: CashBreakdown
  totalDebits: CashBreakdown
  previousBalance: number
  finalBalance: number
  credits: CashEntry[]
  debits: CashEntry[]
  days: CashDayStatus[]
  fullyClosed: boolean
  partiallyClosed: boolean
}

export interface FinancialReportRow {
  kind: 'CP' | 'CR'
  id: number
  registeredAt: ISODateTime | null
  dueAt: ISODateTime | null
  paidAt: ISODateTime | null
  partyId: number | null
  partyName: string | null
  description: string | null
  serviceOrderId: number | null
  billNumber: number | null
  invoiceNumber: string | null
  costCenterId: number | null
  costCenterName: string | null
  subCostCenterId: number | null
  subCostCenterName: string | null
  amountDue: number
  amountPaid: number
  balance: number
  cash: number
  transfer: number
  bill: number
  other: number
  status: 'OPEN' | 'PAID'
}

export interface FinancialReportTotals {
  count: number
  amountDue: number
  amountPaid: number
  balance: number
  cash: number
  transfer: number
  bill: number
  other: number
}

export interface FinancialPeriodReport {
  startDate: ISODate
  endDate: ISODate
  orderBy: string
  scope: string
  rows: FinancialReportRow[]
  totals: FinancialReportTotals
  truncated: boolean
}

export interface CostCenterReportSubGroup {
  id: number | null
  name: string
  amountDue: number
  amountPaid: number
  balance: number
  percentage: number
  rows: FinancialReportRow[]
}

export interface CostCenterReportGroup {
  id: number | null
  name: string
  category: string
  amountDue: number
  amountPaid: number
  balance: number
  percentage: number
  subCenters: CostCenterReportSubGroup[]
}

export interface CostCenterReport {
  startDate: ISODate
  endDate: ISODate
  status: string
  type: 'DETAILED' | 'SUMMARY'
  centers: CostCenterReportGroup[]
  totals: FinancialReportTotals
}
