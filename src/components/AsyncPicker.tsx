import { useQuery } from '@tanstack/react-query'
import { LoaderCircle, Search, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { api, queryKeys } from '../api/services'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

export type PickerValue = { id: number; label: string } | null

type Option = { id: number; label: string; detail?: string }

type AsyncPickerProps = {
  value: PickerValue
  onChange: (value: PickerValue) => void
  search: (term: string) => Promise<Option[]>
  queryKey: readonly unknown[]
  placeholder?: string
  name?: string
  required?: boolean
  disabled?: boolean
  minLength?: number
}

/** Campo de seleção com busca no servidor; evita carregar listas enormes (2 mil fornecedores, 9 mil clientes). */
export function AsyncPicker({ value, onChange, search, queryKey, placeholder = 'Digite para pesquisar...', name, required, disabled, minLength = 2 }: AsyncPickerProps) {
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const debounced = useDebouncedValue(term.trim(), 300)
  const ready = debounced.length >= minLength || /^\d+$/.test(debounced)
  const listId = useId()
  const wrapper = useRef<HTMLDivElement>(null)
  const optionsQuery = useQuery({ queryKey: [...queryKey, 'picker', debounced], queryFn: () => search(debounced), enabled: open && ready })

  useEffect(() => {
    function close(event: MouseEvent) {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  if (value) {
    return <div className="async-picker async-picker--selected">
      {name && <input type="hidden" name={name} value={value.id} />}
      <span title={value.label}><strong>{value.label}</strong></span>
      {!disabled && <button type="button" onClick={() => { onChange(null); setTerm(''); setOpen(true) }} aria-label="Limpar seleção"><X size={15} /></button>}
    </div>
  }

  return <div className="async-picker" ref={wrapper}>
    {name && required && <input className="async-picker__required" tabIndex={-1} aria-hidden="true" name={name} value="" required onChange={() => undefined} />}
    <div className="async-picker__control"><Search size={15} /><input value={term} disabled={disabled} placeholder={placeholder} onFocus={() => setOpen(true)} onChange={(event) => { setTerm(event.target.value); setOpen(true) }} aria-controls={listId} aria-expanded={open} role="combobox" /></div>
    {open && <div className="async-picker__results" id={listId} role="listbox">
      {!ready ? <span className="async-picker__hint">Digite ao menos {minLength} letras ou o código.</span>
        : optionsQuery.isLoading ? <span className="async-picker__hint"><LoaderCircle size={14} className="api-state__spinner" /> Buscando...</span>
          : optionsQuery.isError ? <span className="async-picker__hint">Não foi possível pesquisar.</span>
            : (optionsQuery.data?.length ?? 0) === 0 ? <span className="async-picker__hint">Nenhum resultado.</span>
              : optionsQuery.data!.map((option) => <button type="button" role="option" aria-selected={false} key={option.id} onClick={() => { onChange({ id: option.id, label: option.label }); setOpen(false); setTerm('') }}><strong>{option.label}</strong>{option.detail && <small>{option.detail}</small>}</button>)}
    </div>}
  </div>
}

export function ClientPicker(props: Omit<AsyncPickerProps, 'search' | 'queryKey'>) {
  return <AsyncPicker {...props} queryKey={queryKeys.clients} placeholder={props.placeholder ?? 'Nome, documento ou código do cliente'} search={async (term) => {
    const options = await api.clients.search(term)
    return options.map((client) => ({ id: client.id, label: `${client.tradeName || client.legalName || 'Cliente'} · #${client.id}`, detail: [client.legalName !== client.tradeName ? client.legalName : null, client.document, client.city].filter(Boolean).join(' · ') }))
  }} />
}

export function SupplierPicker(props: Omit<AsyncPickerProps, 'search' | 'queryKey'>) {
  return <AsyncPicker {...props} queryKey={queryKeys.suppliers} placeholder={props.placeholder ?? 'Nome, documento ou código do fornecedor'} search={async (term) => {
    const page = await api.suppliers.list({ query: term, page: 0, size: 25 })
    return page.content.map((supplier) => ({ id: supplier.id, label: `${supplier.tradeName || supplier.legalName || 'Fornecedor'} · #${supplier.id}`, detail: [supplier.tradeName && supplier.legalName !== supplier.tradeName ? supplier.legalName : null, supplier.document, supplier.city].filter(Boolean).join(' · ') }))
  }} />
}

export function EmployeePicker(props: Omit<AsyncPickerProps, 'search' | 'queryKey'>) {
  return <AsyncPicker {...props} minLength={1} queryKey={queryKeys.employees} placeholder={props.placeholder ?? 'Nome, apelido ou código do técnico'} search={async (term) => {
    const employees = await api.employees.search(term)
    return employees.map((employee) => ({ id: employee.id, label: `${employee.nickname || employee.name || 'Funcionário'} · #${employee.id}`, detail: [employee.name, employee.position].filter(Boolean).join(' · ') }))
  }} />
}
