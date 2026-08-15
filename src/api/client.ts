import axios, { AxiosError } from 'axios'
import type { ApiProblem } from '../types'
import { clearStoredToken, getStoredToken } from './storage'

const configuredUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api'

export const API_BASE_URL = configuredUrl.replace(/\/+$/, '')
export const AUTH_EXPIRED_EVENT = 'gente-boa:auth-expired'

export const http = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
})

http.interceptors.request.use((config) => {
  const token = getStoredToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiProblem>) => {
    const isLoginRequest = error.config?.url?.includes('/auth/login')
    if (error.response?.status === 401 && !isLoginRequest) {
      clearStoredToken()
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
    }
    return Promise.reject(error)
  },
)

export function apiErrorMessage(error: unknown, fallback = 'Não foi possível concluir a operação.') {
  if (axios.isAxiosError<ApiProblem>(error)) {
    if (!error.response) {
      return `Não foi possível conectar à API em ${API_BASE_URL}. Verifique se o backend está ativo.`
    }
    const fields = error.response.data?.fields
    if (fields && Object.keys(fields).length) return Object.values(fields).join(' ')
    if (error.response.status === 401) return 'Usuário ou senha inválidos.'
    if (error.response.status === 403) return 'Seu usuário não possui permissão para esta ação.'
    return error.response.data?.detail || fallback
  }
  return error instanceof Error ? error.message : fallback
}
