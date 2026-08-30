import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bell, Boxes, ChevronDown, ClipboardList, FileBarChart, FileSignature, FileText, LayoutDashboard, LogOut, Menu, ReceiptText, Search, Settings, UsersRound, X } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { useAuth } from '../auth'
import { enumLabel, initials } from '../lib/format'
import { NavLink, useRouter } from '../router'

const nav = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/clientes', label: 'Clientes', icon: UsersRound },
  { to: '/contratos', label: 'Contratos', icon: FileSignature },
  { to: '/ordens-de-servico', label: 'Ordens de serviço', icon: ClipboardList },
  { to: '/materiais', label: 'Materiais', icon: Boxes },
  { to: '/notas-fiscais', label: 'Notas fiscais', icon: ReceiptText },
  { to: '/extratos', label: 'Extratos', icon: FileText },
  { to: '/relatorios', label: 'Relatórios', icon: FileBarChart },
]

const routeNames: Record<string, string> = {
  '/': 'Visão geral', '/clientes': 'Clientes', '/contratos': 'Contratos', '/ordens-de-servico': 'Ordens de serviço', '/materiais': 'Materiais', '/notas-fiscais': 'Notas fiscais', '/extratos': 'Extratos', '/relatorios': 'Relatórios', '/usuarios': 'Usuários', '/parametros-do-sistema': 'Parâmetros do sistema',
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const { pathname, navigate } = useRouter()
  const { logout, user } = useAuth()
  const ordersQuery = useQuery({ queryKey: queryKeys.serviceOrders, queryFn: () => api.serviceOrders.list() })
  const invoicesQuery = useQuery({ queryKey: queryKeys.invoices, queryFn: () => api.invoices.list() })
  const urgentOrders = ordersQuery.data?.content.filter((order) => order.priority === 'URGENTE' && !['FINALIZADA', 'CANCELADA'].includes(order.status)) ?? []
  const pendingInvoices = invoicesQuery.data?.content.filter((invoice) => ['PRONTA', 'REVISAR'].includes(invoice.status)) ?? []
  const notificationCount = urgentOrders.length + pendingInvoices.length

  useEffect(() => { setMenuOpen(false); setProfileOpen(false) }, [pathname])
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])

  function submitSearch(event: React.FormEvent) {
    event.preventDefault()
    const value = search.trim().toLowerCase()
    if (!value) return
    if (value.includes('param')) navigate('/parametros-do-sistema')
    else if (value.includes('contrato')) navigate('/contratos')
    else if (value.includes('cliente')) navigate('/clientes')
    else if (value.includes('material') || value.includes('produto')) navigate('/materiais')
    else if (value.includes('nota') || value.includes('nf')) navigate('/notas-fiscais')
    else if (value.includes('extrato')) navigate('/extratos')
    else if (value.includes('relat')) navigate('/relatorios')
    else navigate('/ordens-de-servico')
    setSearch('')
  }

  return (
    <div className="app-shell">
      {menuOpen && <button className="sidebar-scrim" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__brand"><div className="brand-mark"><img src="/images/logo.jpg" alt="Gente Boa" /></div><div><strong>Gente Boa</strong><span>Gestão</span></div><button className="sidebar__close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X size={20} /></button></div>
        <div className="sidebar__section-label">Menu principal</div>
        <nav className="sidebar__nav">{nav.map(({ to, label, icon: Icon, end }) => {
          const badge = to === '/ordens-de-servico' ? urgentOrders.length : to === '/notas-fiscais' ? pendingInvoices.length : 0
          return <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}><Icon size={19} /><span>{label}</span>{badge > 0 && <small>{badge}</small>}</NavLink>
        })}</nav>
        {/* <div className="sidebar__bottom">
          {user?.role === 'ADMINISTRADOR' && <><NavLink to="/parametros-do-sistema" className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}><Settings size={19} /><span>Parâmetros do sistema</span></NavLink><NavLink to="/usuarios" className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}><UsersRound size={19} /><span>Usuários e acessos</span></NavLink></>}
          <div className="sidebar__support"><span>Integração</span><strong>API Gente Boa</strong><small>Dados sincronizados pelo backend</small></div>
        </div> */}
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar__left"><button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu size={22} /></button><div className="breadcrumb"><span>Gente Boa</span><b>/</b><strong>{routeNames[pathname] || 'Gestão'}</strong></div></div>
          <form className="global-search" onSubmit={submitSearch}><Search size={18} /><input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ir para cliente, contrato, OS ou nota..." aria-label="Navegação rápida" /><kbd>Ctrl K</kbd></form>
          <div className="topbar__actions">
            <div className="popover-anchor"><button className="topbar-icon" onClick={() => setNotificationsOpen((value) => !value)} aria-label="Notificações"><Bell size={19} />{notificationCount > 0 && <i />}</button>{notificationsOpen && <div className="popover notifications-popover"><div className="popover__title"><strong>Notificações</strong><span>{notificationCount} pendentes</span></div>{pendingInvoices.length > 0 && <button onClick={() => navigate('/notas-fiscais')}><i className="notification-dot notification-dot--orange" /><span><strong>{pendingInvoices.length} notas aguardam ação</strong><small>Prontas ou em revisão</small></span></button>}{urgentOrders.length > 0 && <button onClick={() => navigate('/ordens-de-servico')}><i className="notification-dot notification-dot--red" /><span><strong>{urgentOrders.length} ordens urgentes</strong><small>Atendimentos não finalizados</small></span></button>}{notificationCount === 0 && <div className="popover-empty">Nenhuma pendência encontrada.</div>}</div>}</div>
            <div className="popover-anchor profile-anchor"><button className="profile-button" onClick={() => setProfileOpen((value) => !value)}><span className="avatar">{user?.initials || initials(user?.name)}</span><span className="profile-copy"><strong>{user?.name}</strong><small>{enumLabel(user?.role)}</small></span><ChevronDown size={16} /></button>{profileOpen && <div className="popover profile-popover">{user?.role === 'ADMINISTRADOR' && <><button onClick={() => navigate('/parametros-do-sistema')}>Parâmetros do sistema</button><button onClick={() => navigate('/usuarios')}>Usuários e acessos</button></>}<button className="profile-popover__logout" onClick={() => { logout(); navigate('/login', { replace: true }) }}><LogOut size={15} /> Sair do sistema</button></div>}</div>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  )
}
