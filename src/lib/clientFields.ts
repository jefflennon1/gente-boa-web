/** Máscaras e validações dos campos de cadastro de cliente (cadastro interno e cadastro público). */

export function onlyDigits(value?: string | null) {
  return String(value ?? '').replace(/\D/g, '')
}

export function formatCpf(value?: string | null) {
  const digits = onlyDigits(value).slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

export function formatCnpj(value?: string | null) {
  const digits = onlyDigits(value).slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

/** (85) 3333-4444 para fixo e (85) 99999-8888 para celular. */
export function formatPhone(value?: string | null) {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  const area = digits.slice(0, 2)
  const number = digits.slice(2)
  if (number.length <= 4) return `(${area}) ${number}`
  const split = number.length === 9 ? 5 : 4
  return `(${area}) ${number.slice(0, split)}-${number.slice(split)}`
}

export function isValidPhone(value?: string | null) {
  const length = onlyDigits(value).length
  return length === 10 || length === 11
}

export function isValidCpf(value?: string | null) {
  const digits = onlyDigits(value)
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false
  const check = (size: number) => {
    const sum = digits.slice(0, size).split('').reduce((total, digit, index) => total + Number(digit) * (size + 1 - index), 0)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10])
}

export function isValidCnpj(value?: string | null) {
  const digits = onlyDigits(value)
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false
  const check = (size: number) => {
    const weights = size === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0)
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }
  return check(12) === Number(digits[12]) && check(13) === Number(digits[13])
}

/** Aniversário no formato do legado (DD/MM, sem ano). */
export function splitBirthday(value?: string | null) {
  const match = /^(\d{2})\/(\d{2})$/.exec(String(value ?? '').trim())
  return match ? { day: match[1], month: match[2] } : { day: '', month: '' }
}

export const BIRTHDAY_MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export function daysInBirthdayMonth(month: string) {
  // Ano bissexto para permitir 29/02.
  return month ? new Date(2000, Number(month), 0).getDate() : 31
}
