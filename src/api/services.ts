import type {
  AppUser,
  AuthResponse,
  Client,
  ClientPayload,
  CreateUserPayload,
  Invoice,
  InvoicePayload,
  PagedResponse,
  ServiceOrder,
  ServiceOrderPayload,
  Statement,
  StatementPayload,
  UpdateUserPayload,
} from '../types'
import { http } from './client'

type ListParams = { query?: string; date?: string; page?: number; size?: number }

function resource<T, TPayload>(path: string) {
  return {
    async list(params: ListParams = {}) {
      const { data } = await http.get<PagedResponse<T>>(path, { params: { page: 0, size: 100, ...params } })
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
  clients: resource<Client, ClientPayload>('/clients'),
  serviceOrders: resource<ServiceOrder, ServiceOrderPayload>('/service-orders'),
  invoices: resource<Invoice, InvoicePayload>('/invoices'),
  statements: resource<Statement, StatementPayload>('/statements'),
  users: resource<AppUser, CreateUserPayload | UpdateUserPayload>('/users'),
}

export const queryKeys = {
  clients: ['clients'] as const,
  serviceOrders: ['service-orders'] as const,
  invoices: ['invoices'] as const,
  statements: ['statements'] as const,
  users: ['users'] as const,
}
