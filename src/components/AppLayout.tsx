import { type ReactNode, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bell, ChevronDown, KeyRound, LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { useAuth } from '../auth'
import { enumLabel, initials } from '../lib/format'
import { canAccess, navGroups, routeNames } from '../navigation'
import { NavLink, useRouter } from '../router'
import { ChangePasswordDialog } from './ChangePasswordDialog'
import { GlobalSearch } from './GlobalSearch'

export function AppLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem('gente-boa-sidebar-collapsed') === 'true')
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const { pathname, navigate } = useRouter()
  const { logout, user } = useAuth()
  const ordersQuery = useQuery({ queryKey: queryKeys.serviceOrders, queryFn: () => api.serviceOrders.list() })
  const invoicesQuery = useQuery({ queryKey: queryKeys.invoices, queryFn: () => api.invoices.list() })
  const urgentOrders = ordersQuery.data?.content.filter((order) => order.priority === 'URGENTE' && !['FINALIZADA', 'CANCELADA'].includes(order.status)) ?? []
  const pendingInvoices = invoicesQuery.data?.content.filter((invoice) => ['PRONTA', 'REVISAR'].includes(invoice.status)) ?? []
  const notificationCount = urgentOrders.length + pendingInvoices.length

  useEffect(() => { setMenuOpen(false); setProfileOpen(false) }, [pathname])
  useEffect(() => { window.localStorage.setItem('gente-boa-sidebar-collapsed', String(sidebarCollapsed)) }, [sidebarCollapsed])

  return (
    <div className="app-shell">
      {menuOpen && <button className="sidebar-scrim" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''} ${sidebarCollapsed ? 'sidebar--collapsed' : ''}`}>
        <button className="sidebar__collapse" type="button" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'} aria-expanded={!sidebarCollapsed} title={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}>{sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</button>
        <div className="sidebar__brand"><div className="brand-mark"><img src="/images/logo.jpg" alt="Gente Boa" /></div><div className="sidebar__brand-copy"><strong>Gente Boa</strong><span>Gestão</span></div><button className="sidebar__close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X size={20} /></button></div>
        {navGroups.map((group) => {
          const items = group.items.filter((item) => canAccess(item, user))
          if (items.length === 0) return null
          return <div key={group.label} className="sidebar__group">
            <div className="sidebar__section-label">{group.label}</div>
            <nav className="sidebar__nav">{items.map(({ to, label, icon: Icon, end }) => {
              const badge = to === '/ordens-de-servico' ? urgentOrders.length : to === '/notas-fiscais' ? pendingInvoices.length : 0
              return <NavLink key={to} to={to} end={end} aria-label={label} title={sidebarCollapsed ? label : undefined} className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}><Icon size={19} /><span>{label}</span>{badge > 0 && <small>{badge}</small>}</NavLink>
            })}</nav>
          </div>
        })}
        {/* <div className="sidebar__bottom">
          {user?.role === 'ADMINISTRADOR' && <><NavLink to="/parametros-do-sistema" className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}><Settings size={19} /><span>Parâmetros do sistema</span></NavLink><NavLink to="/usuarios" className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}><UsersRound size={19} /><span>Usuários e acessos</span></NavLink></>}
          <div className="sidebar__support"><span>Integração</span><strong>API Gente Boa</strong><small>Dados sincronizados pelo backend</small></div>
        </div> */}
      </aside>

      <div className={`app-main ${sidebarCollapsed ? 'app-main--sidebar-collapsed' : ''}`}>
        <header className="topbar">
          <div className="topbar__left"><button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu size={22} /></button><div className="breadcrumb"><span>Gente Boa</span><b>/</b><strong>{routeNames[pathname] || 'Gestão'}</strong></div></div>
          <GlobalSearch />
          <div className="topbar__actions">
            <div className="popover-anchor"><button className="topbar-icon" onClick={() => setNotificationsOpen((value) => !value)} aria-label="Notificações"><Bell size={19} />{notificationCount > 0 && <i />}</button>{notificationsOpen && <div className="popover notifications-popover"><div className="popover__title"><strong>Notificações</strong><span>{notificationCount} pendentes</span></div>{pendingInvoices.length > 0 && <button onClick={() => navigate('/notas-fiscais')}><i className="notification-dot notification-dot--orange" /><span><strong>{pendingInvoices.length} notas aguardam ação</strong><small>Prontas ou em revisão</small></span></button>}{urgentOrders.length > 0 && <button onClick={() => navigate('/ordens-de-servico')}><i className="notification-dot notification-dot--red" /><span><strong>{urgentOrders.length} ordens urgentes</strong><small>Atendimentos não finalizados</small></span></button>}{notificationCount === 0 && <div className="popover-empty">Nenhuma pendência encontrada.</div>}</div>}</div>
            <div className="popover-anchor profile-anchor"><button className="profile-button" onClick={() => setProfileOpen((value) => !value)}><span className="avatar">{user?.initials || initials(user?.name)}</span><span className="profile-copy"><strong>{user?.name}</strong><small>{enumLabel(user?.role)}</small></span><ChevronDown size={16} /></button>{profileOpen && <div className="popover profile-popover"><button onClick={() => { setProfileOpen(false); setPasswordOpen(true) }}><KeyRound size={15} /> Trocar senha</button>{user?.role === 'ADMINISTRADOR' && <button onClick={() => navigate('/usuarios')}>Usuários e acessos</button>}<button className="profile-popover__logout" onClick={() => { logout(); navigate('/login', { replace: true }) }}><LogOut size={15} /> Sair do sistema</button></div>}</div>
          </div>
        </header>
        <main className="page-content">{children}</main>
        <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      </div>
    </div>
  )
}
