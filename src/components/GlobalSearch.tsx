import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, CornerDownLeft, LayoutGrid, Loader2, ReceiptText, Search, Truck, UsersRound } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { useAuth } from '../auth'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { enumLabel, formatDate } from '../lib/format'
import { canAccess, navGroups } from '../navigation'
import { useRouter } from '../router'

type ResultGroup = 'Telas' | 'Clientes' | 'Fornecedores' | 'Ordens de serviço' | 'Notas fiscais'

interface SearchResult {
  key: string
  group: ResultGroup
  title: string
  subtitle?: string
  to: string
  icon: ReactNode
}

const RESULT_LIMIT = 5

/** Termos usados no dia a dia que não aparecem no nome da tela. */
const pageAliases: Record<string, string[]> = {
  '/envio-de-emails': ['email', 'e-mail', 'notificacao'],
  '/contas-a-pagar': ['despesa', 'cp'],
  '/contas-a-receber': ['receita', 'cr'],
  '/acompanhamento-colaboradores': ['carga horaria', 'hora extra'],
  '/contratos-ativos': ['reajuste'],
  '/resumo-mensal': ['ata'],
  '/materiais': ['produto', 'estoque'],
  '/funcionarios': ['colaborador'],
  '/notas-fiscais': ['nf', 'nfse'],
  '/boletos': ['cobranca'],
}

const normalize = (value: string | null | undefined) => (value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Busca geral do topo (Ctrl+K): telas do menu e registros de clientes, fornecedores, OS e notas fiscais. */
export function GlobalSearch() {
  const { navigate } = useRouter()
  const { user } = useAuth()
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLFormElement>(null)
  const term = useDebouncedValue(value.trim(), 250)
  const searching = term.length >= 2
  const numeric = /^\d+$/.test(term) ? Number(term) : null

  const allowed = useMemo(() => {
    const routes = new Set(navGroups.flatMap((group) => group.items.filter((item) => canAccess(item, user)).map((item) => item.to)))
    return (route: string) => routes.has(route)
  }, [user])

  const clientsQuery = useQuery({
    queryKey: [...queryKeys.clients, 'global-search', term],
    queryFn: () => api.clients.list({ query: term, size: RESULT_LIMIT }),
    enabled: open && searching && allowed('/clientes'),
    staleTime: 30_000,
  })
  const suppliersQuery = useQuery({
    queryKey: [...queryKeys.suppliers, 'global-search', term],
    queryFn: () => api.suppliers.list({ query: term, size: RESULT_LIMIT }),
    enabled: open && searching && allowed('/fornecedores'),
    staleTime: 30_000,
  })
  const ordersQuery = useQuery({
    queryKey: [...queryKeys.serviceOrders, 'global-search', term],
    queryFn: () => api.serviceOrders.list(numeric !== null ? { orderNumber: numeric, size: RESULT_LIMIT } : { clientName: term, size: RESULT_LIMIT }),
    enabled: open && searching && allowed('/ordens-de-servico'),
    staleTime: 30_000,
  })
  const invoicesQuery = useQuery({
    queryKey: [...queryKeys.invoices, 'global-search', term],
    queryFn: () => api.invoices.list(numeric !== null ? { invoiceNumber: term, size: RESULT_LIMIT } : { clientName: term, size: RESULT_LIMIT }),
    enabled: open && searching && allowed('/notas-fiscais'),
    staleTime: 30_000,
  })
  const loading = [clientsQuery, suppliersQuery, ordersQuery, invoicesQuery].some((query) => query.isFetching)

  const results = useMemo<SearchResult[]>(() => {
    const needle = normalize(term)
    if (!needle) return []
    const pages = navGroups.flatMap((group) => group.items
      .filter((item) => canAccess(item, user))
      .filter((item) => normalize(item.label).includes(needle) || (pageAliases[item.to] ?? []).some((alias) => alias.includes(needle) || needle.includes(alias)))
      .map<SearchResult>((item) => ({ key: `page-${item.to}`, group: 'Telas', title: item.label, subtitle: group.label, to: item.to, icon: <item.icon size={16} /> })))
      .slice(0, RESULT_LIMIT)
    if (!searching) return pages
    const clients = (clientsQuery.data?.content ?? []).map<SearchResult>((client) => ({
      key: `client-${client.id}`, group: 'Clientes', title: client.tradeName || client.name || `Cliente #${client.id}`,
      subtitle: [`Código ${client.id}`, client.tradeName && client.name !== client.tradeName ? client.name : null, client.document].filter(Boolean).join(' · '),
      to: `/clientes?id=${client.id}`, icon: <UsersRound size={16} />,
    }))
    const suppliers = (suppliersQuery.data?.content ?? []).map<SearchResult>((supplier) => ({
      key: `supplier-${supplier.id}`, group: 'Fornecedores', title: supplier.tradeName || supplier.legalName || `Fornecedor #${supplier.id}`,
      subtitle: [`Código ${supplier.id}`, supplier.document || supplier.cnpj || supplier.cpf, supplier.city].filter(Boolean).join(' · '),
      to: `/fornecedores?id=${supplier.id}`, icon: <Truck size={16} />,
    }))
    const orders = (ordersQuery.data?.content ?? []).map<SearchResult>((order) => ({
      key: `order-${order.id}`, group: 'Ordens de serviço', title: `OS ${order.id} · ${order.clientTradeName || order.clientName || 'Sem cliente'}`,
      subtitle: [formatDate(order.orderedAt), order.description].filter(Boolean).join(' · '),
      to: `/ordens-de-servico?id=${order.id}`, icon: <ClipboardList size={16} />,
    }))
    const invoices = (invoicesQuery.data?.content ?? []).map<SearchResult>((invoice) => ({
      key: `invoice-${invoice.id}`, group: 'Notas fiscais', title: `${invoice.number ? `NF ${invoice.number}` : `Nota #${invoice.id}`} · ${invoice.clientTradeName || invoice.clientName || 'Sem cliente'}`,
      subtitle: [invoice.issuedAt ? formatDate(invoice.issuedAt) : null, enumLabel(invoice.status)].filter(Boolean).join(' · '),
      to: `/notas-fiscais?invoiceId=${invoice.id}`, icon: <ReceiptText size={16} />,
    }))
    // Número digitado: OS e notas primeiro, porque é o que normalmente se procura por número.
    return numeric !== null ? [...orders, ...invoices, ...clients, ...suppliers, ...pages] : [...pages, ...clients, ...suppliers, ...orders, ...invoices]
  }, [term, searching, numeric, user, clientsQuery.data, suppliersQuery.data, ordersQuery.data, invoicesQuery.data])

  useEffect(() => { setActiveIndex(0) }, [results.length, term])

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
        setOpen(true)
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onShortcut)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onShortcut)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])

  function go(result: SearchResult | undefined) {
    if (!result) return
    navigate(result.to)
    setValue('')
    setOpen(false)
    inputRef.current?.blur()
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(index + 1, results.length - 1)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)) }
    else if (event.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
  }

  const pending = value.trim() !== term || loading
  const showPanel = open && value.trim().length > 0
  let lastGroup: ResultGroup | null = null

  return <form ref={containerRef} className="global-search" data-allow-enter-submit="true" role="search" onSubmit={(event) => { event.preventDefault(); go(results[activeIndex]) }}>
    <Search size={18} />
    <input
      ref={inputRef}
      value={value}
      onChange={(event) => { setValue(event.target.value); setOpen(true) }}
      onFocus={() => setOpen(true)}
      onKeyDown={onKeyDown}
      placeholder="Ir para cliente, fornecedor, OS ou nota..."
      aria-label="Busca geral"
      aria-expanded={showPanel}
      aria-controls="global-search-results"
      autoComplete="off"
    />
    {pending && showPanel ? <Loader2 size={15} className="global-search__spinner" /> : <kbd>Ctrl K</kbd>}
    {showPanel && <div className="global-search__panel" id="global-search-results" role="listbox">
      {results.length === 0
        ? <div className="global-search__empty">{pending ? 'Buscando...' : value.trim().length < 2 ? 'Digite ao menos 2 caracteres.' : 'Nenhum resultado encontrado.'}</div>
        : results.map((result, index) => {
          const header = result.group !== lastGroup ? result.group : null
          lastGroup = result.group
          return <div key={result.key}>
            {header && <div className="global-search__group">{header === 'Telas' ? <LayoutGrid size={12} /> : null}{header}</div>}
            <button
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={`global-search__item ${index === activeIndex ? 'global-search__item--active' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => go(result)}
            >
              <span className="global-search__icon">{result.icon}</span>
              <span className="global-search__text"><strong>{result.title}</strong>{result.subtitle && <small>{result.subtitle}</small>}</span>
              {index === activeIndex && <CornerDownLeft size={14} className="global-search__enter" />}
            </button>
          </div>
        })}
    </div>}
  </form>
}
