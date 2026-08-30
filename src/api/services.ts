import type {
  AppUser,
  AuthResponse,
  Client,
  CepAddressResponse,
  ClientListItem,
  ClientSearchOption,
  ClientListSortBy,
  ClientPayload,
  ClientReferral,
  ClientStatisticsResponse,
  CancelContractPayload,
  Contract,
  ContractListItem,
  ContractListSortBy,
  ContractPayload,
  CreateUserPayload,
  Invoice,
  InvoicePayload,
  Material,
  MaterialPayload,
  PagedResponse,
  ServiceOrder,
  ServiceOrderListItem,
  ServiceOrderStatus,
  ServiceOrderPayload,
  ServiceCatalogItem,
  Statement,
  StatementPayload,
  SortDirection,
  SystemParameters,
  SystemParametersPayload,
  Supplier,
  UpdateUserPayload,
} from '../types'
import { http } from './client'

export type ListParams = {
  query?: string
  date?: string
  status?: 'ATIVO' | 'INATIVO'
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
  date?: string
  startDate?: string
  endDate?: string
  urgentOnly?: boolean
  page?: number
  size?: number
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
    async search(query: string) {
      const { data } = await http.get<ClientSearchOption[]>('/clients/search', { params: { query } })
      return data
    },
  },
  addresses: {
    async findByCep(cep: string) {
      const { data } = await http.get<CepAddressResponse>(`/addresses/cep/${cep}`)
      return data
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
    async remove() {
      await http.delete('/system-parameters')
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
  },
  materials: resource<Material, MaterialPayload>('/materials'),
  suppliers: {
    async list(params: Pick<ListParams, 'query' | 'page' | 'size'> = {}) {
      const { data } = await http.get<PagedResponse<Supplier>>('/suppliers', { params: { page: 0, size: 20, ...params } })
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
    async remove(id: number) {
      await http.delete(`/service-orders/${id}`)
    },
  },
  invoices: resource<Invoice, InvoicePayload>('/invoices'),
  statements: resource<Statement, StatementPayload>('/statements'),
  users: resource<AppUser, CreateUserPayload | UpdateUserPayload>('/users'),
}

export const queryKeys = {
  addresses: ['addresses'] as const,
  systemParameters: ['system-parameters'] as const,
  clients: ['clients'] as const,
  contracts: ['contracts'] as const,
  serviceCatalog: ['service-catalog'] as const,
  materials: ['materials'] as const,
  suppliers: ['suppliers'] as const,
  serviceOrders: ['service-orders'] as const,
  invoices: ['invoices'] as const,
  statements: ['statements'] as const,
  users: ['users'] as const,
}
