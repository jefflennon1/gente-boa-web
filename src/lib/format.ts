export const money = (value?: number | null) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0)

export function formatDate(value?: string | null, includeTime = false) {
  if (!value) return 'Não informado'
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', includeTime
    ? { dateStyle: 'short', timeStyle: 'short' }
    : { dateStyle: 'short' }).format(date)
}

export function toDateInput(value?: string | null) {
  return value?.slice(0, 10) || new Date().toISOString().slice(0, 10)
}

export function toDateTimeInput(value?: string | null) {
  return value ? value.slice(0, 16) : new Date().toISOString().slice(0, 16)
}

export function initials(name?: string | null) {
  return (name || 'GB').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

export function enumLabel(value?: string | null) {
  if (!value) return 'Não informado'
  const normalized = value.toLowerCase().replaceAll('_', ' ')
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}
