import type { ContractServiceItem } from '../types'

type ContractMinutePrice = Pick<ContractServiceItem, 'serviceId' | 'extraValue' | 'legacyMinuteValue'>

/** "Valor min. extra" de um serviço do contrato: valor legado do Delphi (vlminu) e, sem ele, o valor extra (vlextra). */
export function contractMinuteValue(service: Pick<ContractServiceItem, 'extraValue' | 'legacyMinuteValue'>) {
  const legacy = Number(service.legacyMinuteValue ?? 0)
  return legacy > 0 ? legacy : Math.max(0, Number(service.extraValue ?? 0))
}

/**
 * Valor do minuto excedente de uma OS de contrato (mesma regra do backend): serviço do contrato igual ao da OS,
 * depois o primeiro serviço do contrato com valor e, por fim, o valor do item da OS.
 */
export function contractExtraMinuteRate(serviceId: number, services: ContractMinutePrice[] | null | undefined, fallback?: number | null) {
  const list = services ?? []
  const sameService = list.find((service) => service.serviceId === serviceId && contractMinuteValue(service) > 0)
  const anyService = list.find((service) => contractMinuteValue(service) > 0)
  const chosen = sameService ?? anyService
  return chosen ? contractMinuteValue(chosen) : Math.max(0, Number(fallback ?? 0))
}
