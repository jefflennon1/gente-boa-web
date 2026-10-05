import type {
  AccountsReceivableListItem,
  AppUser,
  BillDetail,
  BillEmailResponse,
  BillEmailSettings,
  BillEmailSettingsPayload,
  BillGenerationPreview,
  BillListItem,
  BillPrintRow,
  AttendanceLocation,
  AttendanceLocationPayload,
  AuthResponse,
  Client,
  ClientBillingContext,
  ClientContractContext,
  CepAddressResponse,
  ClientListItem,
  ClientSearchOption,
  ClientListSortBy,
  ClientPayload,
  ClientReferral,
  ClientStatisticsResponse,
  ClientStatementDetail,
  ClientStatementSummary,
  CancelContractPayload,
  Contract,
  ContractListItem,
  ContractListSortBy,
  ContractPayload,
  CreateUserPayload,
  ClientEmailDraft,
  ClientEmailPayload,
  Invoice,
  InvoicePayload,
  IssuerCompanyProfile,
  FiscalCatalog,
  FiscalNationalTaxCode,
  FiscalNbsCode,
  MunicipalTaxCode,
  ServiceIncidence,
  PublicClientSignupPayload,
  PublicClientSignupResponse,
  NfseCancelPayload,
  NfseIntegrationStatus,
  Employee,
  EmployeePayload,
  GeneratedBill,
  GeneratedBills,
  Material,
  MaterialPayload,
  PagedResponse,
  ReportRow,
  ReportSummary,
  ReportType,
  ServiceOrder,
  ServiceOrderListItem,
  ServiceOrderTracking,
  ServiceOrderStatus,
  ServiceOrderOperationalFlag,
  ServiceOrderPayload,
  ServiceOrderMaterialOrder,
  ServiceCatalogItem,
  ServiceCatalogPayload,
  Statement,
  StatementPayload,
  SortDirection,
  SystemParameters,
  SystemParametersPayload,
  InvoiceFiscalSettingsPayload,
  ServicePriceAdjustmentPayload,
  BirthdayEmailSettings,
  BirthdayEmailSettingsPayload,
  EmailProcessingResult,
  Supplier,
  SupplierPayload,
  PayableAccount,
  PayableAccountPayload,
  PayableDateField,
  PayablePaymentPayload,
  FinancialLookup,
  PurchaseOrderListItem,
  UpdateUserPayload,
} from '../types'
import type { ServicePriceAdjustmentPreview } from './modules'
import { http } from './client'

export type ListParams = {
  query?: string
  name?: string
  cpf?: string
  cnpj?: string
  clientCode?: number
  date?: string
  sortBy?: ClientListSortBy
  direction?: SortDirection
  page?: number
  size?: number
}

export type ContractListParams = {
  query?: string
  clientId?: number
  status?: 'ATIVO' | 'CANCELADO'
  sortBy?: ContractListSortBy
  direction?: SortDirection
  page?: number
  size?: number
}

export type ServiceCatalogListParams = {
  query?: string
  groupId?: number
  page?: number
  size?: number
}

export type ServiceOrderListParams = {
  query?: string
  clientName?: string
  cpf?: string
  cnpj?: string
  orderNumber?: number
  contractCode?: number
  attendanceLocationId?: number
  date?: string
  startDate?: string
  endDate?: string
  urgentOnly?: boolean
  status?: ServiceOrderStatus
  origin?: 'C' | 'A' | 'O' | 'E'
  category?: string
  technicianId?: number
  clientId?: number
  page?: number
  size?: number
}

export type ServiceOrderSummary = { total: number; open: number; inProgress: number; finished: number; canceled: number; urgent: number }

export type BillListParams = Pick<ListParams, 'query' | 'page' | 'size'> & {
  clientName?: string
  cpf?: string
  cnpj?: string
  billNumber?: number
  serviceOrderNumber?: number
  contractCode?: number
  serviceOrderStart?: string
  serviceOrderEnd?: string
  dueStart?: string
  dueEnd?: string
  dueDay?: 10 | 20
  billingType?: 'ALL' | 'CONTRACT' | 'ONE_OFF'
  paymentStatus?: 'ALL' | 'PENDING' | 'PAID'
}

export type AccountsReceivableListParams = Pick<ListParams, 'query' | 'page' | 'size'> & {
  dueStart?: string
  dueEnd?: string
  serviceOrderStart?: string
  serviceOrderEnd?: string
  dueDay?: 10 | 20
  billingType?: 'ALL' | 'CONTRACT' | 'ONE_OFF'
  generatedStatus?: 'ALL' | 'GENERATED' | 'PENDING'
  paymentStatus?: 'ALL' | 'PAID' | 'PENDING'
}

export type PayableListParams = Pick<ListParams, 'query' | 'page' | 'size'> & {
  supplierId?: number
  startDate?: string
  endDate?: string
  dateField?: PayableDateField
  status?: 'ALL' | 'OPEN' | 'PAID' | 'CLOSED'
}

export type PurchaseOrderListParams = Pick<ListParams, 'query' | 'page' | 'size'> & {
  supplierId?: number
  startDate?: string
  endDate?: string
}

function resource<T, TPayload, TList = T>(path: string) {
  return {
    async list(params: ListParams = {}) {
      const { data } = await http.get<PagedResponse<TList>>(path, { params: { page: 0, size: 100, ...params } })
      return data
    },
    async find(id: number) {
      const { data } = await http.get<T>(`${path}/${id}`)
      return data
    },
    async create(payload: TPayload) {
      const { data } = await http.post<T>(path, payload)
      return data
    },
    async update(id: number, payload: TPayload) {
      const { data } = await http.put<T>(`${path}/${id}`, payload)
      return data
    },
    async remove(id: number) {
      await http.delete(`${path}/${id}`)
    },
  }
}

export const api = {
  auth: {
    async login(login: string, password: string) {
      const { data } = await http.post<AuthResponse>('/auth/login', { login, password })
      return data
    },
    async me() {
      const { data } = await http.get<AppUser>('/auth/me')
      return data
    },
  },
  clients: {
    ...resource<Client, ClientPayload, ClientListItem>('/clients'),
    async statistics() {
      const { data } = await http.get<ClientStatisticsResponse>('/clients/statistics')
      return data
    },
    async referralDescriptions() {
      const { data } = await http.get<string[]>('/clients/referral-descriptions')
      return data
    },
    async createReferralDescription(description: string) {
      const { data } = await http.post<ClientReferral>('/clients/referral-descriptions', { description })
      return data
    },
    async search(query: string, at?: string) {
      const { data } = await http.get<ClientSearchOption[]>('/clients/search', { params: { query, at } })
      return data
    },
    async updateBillEmailPreference(id: number, enabled: boolean) {
      const { data } = await http.patch<Client>(`/clients/${id}/bill-email`, { enabled })
      return data
    },
  },
  addresses: {
    async findByCep(cep: string) {
      const { data } = await http.get<CepAddressResponse>(`/addresses/cep/${cep}`)
      return data
    },
  },
  attendanceLocations: {
    async byClient(clientId: number) {
      const { data } = await http.get<AttendanceLocation[]>('/attendance-locations', { params: { clientId } })
      return data
    },
    async findForClient(id: number, clientId: number) {
      const { data } = await http.get<AttendanceLocation>(`/attendance-locations/${id}`, { params: { clientId } })
      return data
    },
    async create(payload: AttendanceLocationPayload) {
      const { data } = await http.post<AttendanceLocation>('/attendance-locations', payload)
      return data
    },
    async update(id: number, payload: AttendanceLocationPayload) {
      const { data } = await http.put<AttendanceLocation>(`/attendance-locations/${id}`, payload)
      return data
    },
    async remove(id: number) {
      await http.delete(`/attendance-locations/${id}`)
    },
  },
  systemParameters: {
    async get() {
      const { data } = await http.get<SystemParameters | null>('/system-parameters')
      return data || null
    },
    async create(payload: SystemParametersPayload) {
      const { data } = await http.post<SystemParameters>('/system-parameters', payload)
      return data
    },
    async update(payload: SystemParametersPayload) {
      const { data } = await http.put<SystemParameters>('/system-parameters', payload)
      return data
    },
    async updateServiceAdjustment(payload: ServicePriceAdjustmentPayload) {
      const { data } = await http.put<SystemParameters>('/system-parameters/service-adjustment', payload)
      return data
    },
    async previewServiceAdjustment(payload: ServicePriceAdjustmentPayload) {
      const { data } = await http.post<ServicePriceAdjustmentPreview>('/system-parameters/service-adjustment/preview', payload, { timeout: 60_000 })
      return data
    },
    async serviceAdjustmentOverrides() {
      const { data } = await http.get<Array<{ contractId: number; percentage: number }>>('/system-parameters/service-adjustment/contract-overrides')
      return data
    },
    async getBirthdayEmailSettings() {
      const { data } = await http.get<BirthdayEmailSettings>('/system-parameters/birthday-email')
      return data
    },
    async updateBirthdayEmailSettings(payload: BirthdayEmailSettingsPayload) {
      const { data } = await http.put<BirthdayEmailSettings>('/system-parameters/birthday-email', payload)
      return data
    },
    async sendBirthdayEmailsToday() {
      const { data } = await http.post<EmailProcessingResult>('/system-parameters/birthday-email/send-today', undefined, { timeout: 120_000 })
      return data
    },
    async updateInvoiceSettings(payload: InvoiceFiscalSettingsPayload) {
      const { data } = await http.put<SystemParameters>('/system-parameters/invoice', payload)
      return data
    },
    async updateBillEmailSettings(payload: BillEmailSettingsPayload) {
      const { data } = await http.put<BillEmailSettings>('/system-parameters/bill-email', payload)
      return data
    },
    async getBillEmailSettings() {
      const { data } = await http.get<BillEmailSettings>('/system-parameters/bill-email')
      return data
    },
    async remove() {
      await http.delete('/system-parameters')
    },
  },
  emails: {
    async draft(clientId: number) {
      const { data } = await http.get<ClientEmailDraft>(`/emails/clients/${clientId}/draft`)
      return data
    },
    async send(payload: ClientEmailPayload) {
      const { data } = await http.post<{ message: string }>('/emails/send', payload)
      return data
    },
  },
  contracts: {
    async list(params: ContractListParams = {}) {
      const { data } = await http.get<PagedResponse<ContractListItem>>('/contracts', { params: { page: 0, size: 20, ...params } })
      return data
    },
    async find(id: number) {
      const { data } = await http.get<Contract>(`/contracts/${id}`)
      return data
    },
    async document(id: number) {
      const { data } = await http.get<Blob>(`/contracts/${id}/document`, { responseType: 'blob' })
      return data
    },
    async uploadSignedDocument(id: number, file: File) {
      const formData = new FormData()
      formData.append('file', file)
      await http.post(`/contracts/${id}/signed-document`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    async byClient(clientId: number, params: Pick<ContractListParams, 'page' | 'size'> = {}) {
      const { data } = await http.get<PagedResponse<Contract> | Contract[]>(`/clients/${clientId}/contracts`, { params: { page: 0, size: 20, ...params } })
      if (!Array.isArray(data)) return data
      return { content: data, total: data.length, page: 0, size: data.length, totalPages: data.length ? 1 : 0 }
    },
    async activeByClient(clientId: number, at: string) {
      const { data } = await http.get<ClientContractContext>(`/clients/${clientId}/active-contract`, { params: { at } })
      return data
    },
    async create(payload: ContractPayload) {
      const { data } = await http.post<Contract>('/contracts', payload)
      return data
    },
    async update(id: number, payload: ContractPayload) {
      const { data } = await http.put<Contract>(`/contracts/${id}`, payload)
      return data
    },
    async cancel(id: number, payload: CancelContractPayload) {
      const { data } = await http.post<Contract>(`/contracts/${id}/cancel`, payload)
      return data
    },
    async remove(id: number) {
      await http.delete(`/contracts/${id}`)
    },
  },
  serviceCatalog: {
    async list(params: ServiceCatalogListParams = {}) {
      const { data } = await http.get<PagedResponse<ServiceCatalogItem>>('/services', { params: { page: 0, size: 100, ...params } })
      return data
    },
    async find(id: number) {
      const { data } = await http.get<ServiceCatalogItem>(`/services/${id}`)
      return data
    },
    async create(payload: ServiceCatalogPayload) {
      const { data } = await http.post<ServiceCatalogItem>('/services', payload)
      return data
    },
    async update(id: number, payload: ServiceCatalogPayload) {
      const { data } = await http.put<ServiceCatalogItem>(`/services/${id}`, payload)
      return data
    },
    async remove(id: number) {
      await http.delete(`/services/${id}`)
    },
  },
  materials: resource<Material, MaterialPayload>('/materials'),
  employees: {
    ...resource<Employee, EmployeePayload>('/employees'),
    async search(query = '') {
      const { data } = await http.get<Employee[]>('/employees/search', { params: { query: query || undefined } })
      return data
    },
    async updateAvailability(id: number, active: boolean) {
      const { data } = await http.patch<Employee>(`/employees/${id}/availability`, { active })
      return data
    },
  },
  suppliers: {
    async find(id: number) {
      const { data } = await http.get<Supplier>(`/suppliers/${id}`)
      return data
    },
    async list(params: Pick<ListParams, 'query' | 'page' | 'size'> = {}) {
      const { data } = await http.get<PagedResponse<Supplier>>('/suppliers', { params: { page: 0, size: 20, ...params } })
      return data
    },
    async create(payload: SupplierPayload) {
      const { data } = await http.post<Supplier>('/suppliers', payload)
      return data
    },
    async update(id: number, payload: SupplierPayload) {
      const { data } = await http.put<Supplier>(`/suppliers/${id}`, payload)
      return data
    },
    async remove(id: number) {
      await http.delete(`/suppliers/${id}`)
    },
  },
  payables: {
    async list(params: PayableListParams = {}) {
      const { data } = await http.get<PagedResponse<PayableAccount>>('/payables', { params: { page: 0, size: 20, status: 'OPEN', ...params } })
      return data
    },
    async find(id: number) {
      const { data } = await http.get<PayableAccount>(`/payables/${id}`)
      return data
    },
    async create(payload: PayableAccountPayload) {
      const { data } = await http.post<PayableAccount>('/payables', payload)
      return data
    },
    async update(id: number, payload: PayableAccountPayload) {
      const { data } = await http.put<PayableAccount>(`/payables/${id}`, payload)
      return data
    },
    async remove(id: number) {
      await http.delete(`/payables/${id}`)
    },
    async settle(id: number, payload: PayablePaymentPayload) {
      const { data } = await http.post<PayableAccount>(`/payables/${id}/payments`, payload)
      return data
    },
    async reversePayment(id: number, paymentId: number) {
      const { data } = await http.delete<PayableAccount>(`/payables/${id}/payments/${paymentId}`)
      return data
    },
    async costCenters() {
      const { data } = await http.get<FinancialLookup[]>('/payables/lookups/cost-centers')
      return data
    },
    async subCostCenters(costCenterId?: number) {
      const { data } = await http.get<FinancialLookup[]>('/payables/lookups/sub-cost-centers', { params: { costCenterId } })
      return data
    },
    async movementAccounts() {
      const { data } = await http.get<FinancialLookup[]>('/payables/lookups/movement-accounts')
      return data
    },
  },
  purchaseOrders: {
    async list(params: PurchaseOrderListParams = {}) {
      const { data } = await http.get<PagedResponse<PurchaseOrderListItem>>('/purchase-orders', { params: { page: 0, size: 20, ...params } })
      return data
    },
    async find(id: number) {
      const { data } = await http.get<ServiceOrderMaterialOrder>(`/purchase-orders/${id}`)
      return data
    },
  },
  serviceOrders: {
    async list(params: ServiceOrderListParams = {}) {
      const { data } = await http.get<PagedResponse<ServiceOrderListItem>>('/service-orders', { params: { page: 0, size: 100, ...params } })
      return data
    },
    async find(id: number) {
      const { data } = await http.get<ServiceOrder>(`/service-orders/${id}`)
      return data
    },
    async summary(params: Omit<ServiceOrderListParams, 'status' | 'urgentOnly' | 'page' | 'size'> = {}) {
      const { data } = await http.get<ServiceOrderSummary>('/service-orders/summary', { params })
      return data
    },
    async create(payload: ServiceOrderPayload) {
      const { data } = await http.post<ServiceOrder>('/service-orders', payload)
      return data
    },
    async update(id: number, payload: ServiceOrderPayload) {
      const { data } = await http.put<ServiceOrder>(`/service-orders/${id}`, payload)
      return data
    },
    async updateStatus(id: number, status: ServiceOrderStatus) {
      const { data } = await http.put<ServiceOrder>(`/service-orders/${id}/status`, null, { params: { status } })
      return data
    },
    async updateOperationalFlag(id: number, flag: ServiceOrderOperationalFlag, checked: boolean) {
      const { data } = await http.put<ServiceOrder>(`/service-orders/${id}/operational-flag`, { flag, checked })
      return data
    },
    async startTracking(id: number, payload: { scheduleId: number; serviceId?: number | null; employeeId?: number | null; startedAt: string }) {
      const { data } = await http.post<ServiceOrderTracking>(`/service-orders/${id}/tracking/start`, payload)
      return data
    },
    async stopTracking(id: number, trackingId: number, endedAt: string) {
      const { data } = await http.put<ServiceOrderTracking>(`/service-orders/${id}/tracking/${trackingId}/stop`, { endedAt })
      return data
    },
    async remove(id: number) {
      await http.delete(`/service-orders/${id}`)
    },
  },
  invoices: {
    async list(params: Pick<ListParams, 'query' | 'page' | 'size'> & {
      clientName?: string
      cpf?: string
      cnpj?: string
      invoiceNumber?: string
      startDate?: string
      endDate?: string
    } = {}) {
      const { data } = await http.get<PagedResponse<Invoice>>('/invoices', { params: { page: 0, size: 100, ...params } })
      return data
    },
    async find(id: number) {
      const { data } = await http.get<Invoice>(`/invoices/${id}`)
      return data
    },
    async create(payload: InvoicePayload) {
      const { data } = await http.post<Invoice>('/invoices', payload)
      return data
    },
    async createFromServiceOrder(serviceOrderId: number) {
      const { data } = await http.post<Invoice>(`/invoices/from-service-order/${serviceOrderId}`)
      return data
    },
    async update(id: number, payload: InvoicePayload) {
      const { data } = await http.put<Invoice>(`/invoices/${id}`, payload)
      return data
    },
    async remove(id: number) {
      await http.delete(`/invoices/${id}`)
    },
    async integrationStatus() {
      const { data } = await http.get<NfseIntegrationStatus>('/invoices/integration-status')
      return data
    },
    async issue(id: number) {
      const { data } = await http.post<Invoice>(`/invoices/${id}/issue`)
      return data
    },
    async issueBatch(invoiceIds: number[]) {
      const { data } = await http.post<Invoice[]>('/invoices/issue-batch', { invoiceIds })
      return data
    },
    async reconcile(id: number) {
      const { data } = await http.post<Invoice>(`/invoices/${id}/reconcile`)
      return data
    },
    async cancel(id: number, payload: NfseCancelPayload) {
      const { data } = await http.post<Invoice>(`/invoices/${id}/cancel`, payload)
      return data
    },
    async xml(id: number) {
      const { data } = await http.get<Blob>(`/invoices/${id}/xml`, { responseType: 'blob' })
      return data
    },
    async danfse(id: number) {
      const { data } = await http.get<Blob>(`/invoices/${id}/danfse`, { responseType: 'blob' })
      return data
    },
    async pdf(id: number) {
      const { data } = await http.get<Blob>(`/invoices/${id}/pdf`, { responseType: 'blob' })
      return data
    },
  },
  companyProfile: {
    async find() {
      const { data } = await http.get<IssuerCompanyProfile>('/company-profile')
      return data
    },
  },
  fiscalCatalog: {
    async find() {
      const { data } = await http.get<FiscalCatalog>('/fiscal-catalog')
      return data
    },
    async municipalTaxCodes(cityCode: string, nationalTaxCode: string, competence: string) {
      const { data } = await http.get<MunicipalTaxCode[]>(`/fiscal-catalog/municipal-tax-codes/${cityCode}`, {
        params: { nationalTaxCode, competence },
      })
      return data
    },
    async searchNationalTaxCodes(term = '%') {
      const { data } = await http.get<FiscalNationalTaxCode[]>('/fiscal-catalog/national-tax-codes/search', {
        params: { term },
      })
      return data
    },
    async searchNbsCodes(term = '%') {
      const { data } = await http.get<FiscalNbsCode[]>('/fiscal-catalog/nbs/search', {
        params: { term },
      })
      return data
    },
    async serviceIncidence(params: {
      serviceCityCode: string
      customerCityCode: string
      nationalTaxCode: string
      municipalTaxCode?: string
      competence: string
    }) {
      const { data } = await http.get<ServiceIncidence>('/fiscal-catalog/service-incidence', { params })
      return data
    },
  },
  statements: resource<Statement, StatementPayload>('/statements'),
  accountsReceivable: {
    async list(params: AccountsReceivableListParams = {}) {
      const { data } = await http.get<PagedResponse<AccountsReceivableListItem>>('/accounts-receivable', {
        params: { page: 0, size: 20, ...params },
      })
      return data
    },
    async selection(params: AccountsReceivableListParams = {}) {
      const { data } = await http.get<AccountsReceivableListItem[]>('/accounts-receivable/selection', { params })
      return data
    },
    async previewBills(receivableIds: number[]) {
      const { data } = await http.post<BillGenerationPreview>('/accounts-receivable/generate-bills/preview', { receivableIds })
      return data
    },
    async createIssWithholding(payload: { clientId: number; dueDate: string; amount: number; description?: string }) {
      const { data } = await http.post<AccountsReceivableListItem>('/accounts-receivable/iss-withholding', payload)
      return data
    },
    async generateBill(receivableIds: number[]) {
      const { data } = await http.post<GeneratedBill>('/accounts-receivable/generate-bill', { receivableIds })
      return data
    },
    async generateBills(receivableIds: number[]) {
      const { data } = await http.post<GeneratedBills>('/accounts-receivable/generate-bills', { receivableIds })
      return data
    },
  },
  clientStatements: {
    async list(params: {
      startDate: string
      endDate: string
      query?: string
      clientName?: string
      cpf?: string
      cnpj?: string
      clientId?: number
      attendanceLocationId?: number
      attendanceLocation?: string
      page?: number
      size?: number
    }) {
      const { data } = await http.get<PagedResponse<ClientStatementSummary>>('/client-statements', { params: { page: 0, size: 10, ...params } })
      return data
    },
    async find(clientId: number, startDate: string, endDate: string) {
      const { data } = await http.get<ClientStatementDetail>(`/client-statements/${clientId}`, { params: { startDate, endDate } })
      return data
    },
    async pdf(clientId: number, startDate: string, endDate: string) {
      const { data } = await http.get<Blob>(`/client-statements/${clientId}/pdf`, { params: { startDate, endDate }, responseType: 'blob' })
      return data
    },
  },
  bills: {
    async list(params: BillListParams = {}) {
      const { data } = await http.get<PagedResponse<BillListItem>>('/bills', { params: { page: 0, size: 20, ...params } })
      return data
    },
    async find(id: number) {
      const { data } = await http.get<BillDetail>(`/bills/${id}`)
      return data
    },
    async previewByServiceOrder(serviceOrderId: number) {
      const { data } = await http.get<BillDetail>(`/bills/preview/service-order/${serviceOrderId}`)
      return data
    },
    async clientContext(clientId: number) {
      const { data } = await http.get<ClientBillingContext>(`/bills/client/${clientId}/context`)
      return data
    },
    async clientHourTrackingPdf(clientId: number, competence?: string) {
      const { data } = await http.get<Blob>(`/bills/client/${clientId}/hour-tracking/pdf`, { params: { competence: competence || undefined }, responseType: 'blob' })
      return data
    },
    async pdf(id: number) {
      const { data } = await http.get<Blob>(`/bills/${id}/pdf`, { responseType: 'blob' })
      return data
    },
    async uploadBankDocument(id: number, file: File) {
      const form = new FormData()
      form.append('file', file)
      const { data } = await http.post<BillDetail>(`/bills/${id}/bank-document`, form, { timeout: 60_000 })
      return data
    },
    async bankDocument(id: number) {
      const { data } = await http.get<Blob>(`/bills/${id}/bank-document`, { responseType: 'blob' })
      return data
    },
    async printing(dueStart: string, dueEnd: string) {
      const { data } = await http.get<BillPrintRow[]>('/bills/printing', { params: { dueStart, dueEnd }, timeout: 60_000 })
      return data
    },
    async statementsPdf(dueStart: string, dueEnd: string, onlyStatementClients: boolean) {
      const { data } = await http.get<Blob>('/bills/statements', { params: { dueStart, dueEnd, onlyStatementClients }, responseType: 'blob', timeout: 120_000 })
      return data
    },
    async sendEmail(id: number) {
      // O envio inclui geração do PDF e comunicação com o servidor SMTP.
      // Ele pode ultrapassar o timeout padrão de 15 segundos das demais chamadas.
      const { data } = await http.post<BillEmailResponse>(`/bills/${id}/email`, undefined, { timeout: 60_000 })
      return data
    },
  },
  reports: {
    async list(type: ReportType, params: { startDate?: string; endDate?: string; query?: string; page?: number; size?: number } = {}) {
      const { data } = await http.get<PagedResponse<ReportRow>>(`/reports/${type}`, { params: { page: 0, size: 20, ...params } })
      return data
    },
    async summary(type: ReportType, params: { startDate?: string; endDate?: string; query?: string } = {}) {
      const { data } = await http.get<ReportSummary>(`/reports/${type}/summary`, { params })
      return data
    },
  },
  users: resource<AppUser, CreateUserPayload | UpdateUserPayload>('/users'),
  publicClients: {
    async referralDescriptions() {
      const { data } = await http.get<string[]>('/public/clients/referral-descriptions')
      return data
    },
    async create(payload: PublicClientSignupPayload) {
      const { data } = await http.post<PublicClientSignupResponse>('/public/clients', payload)
      return data
    },
  },
}

export const queryKeys = {
  addresses: ['addresses'] as const,
  attendanceLocations: ['attendance-locations'] as const,
  systemParameters: ['system-parameters'] as const,
  emails: ['emails'] as const,
  clients: ['clients'] as const,
  contracts: ['contracts'] as const,
  serviceCatalog: ['service-catalog'] as const,
  materials: ['materials'] as const,
  employees: ['employees'] as const,
  suppliers: ['suppliers'] as const,
  payables: ['payables'] as const,
  purchaseOrders: ['purchase-orders'] as const,
  serviceOrders: ['service-orders'] as const,
  invoices: ['invoices'] as const,
  companyProfile: ['company-profile'] as const,
  fiscalCatalog: ['fiscal-catalog'] as const,
  statements: ['statements'] as const,
  accountsReceivable: ['accounts-receivable'] as const,
  clientStatements: ['client-statements'] as const,
  bills: ['bills'] as const,
  reports: ['reports'] as const,
  users: ['users'] as const,
}
