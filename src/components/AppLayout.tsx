import { type ReactNode, useEffect, useRef, useState } from 'react'
import {
  Bell,
  ChevronDown,
  ClipboardList,
  FileBarChart,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Search,
  Settings,
  UsersRound,
  X,
} from 'lucide-react'
import { useAuth } from '../auth'
import { NavLink, useRouter } from '../router'

const nav = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/clientes', label: 'Clientes', icon: UsersRound },
  { to: '/ordens-de-servico', label: 'Ordens de serviço', icon: ClipboardList, badge: '7' },
  { to: '/notas-fiscais', label: 'Notas fiscais', icon: ReceiptText, badge: '3' },
  { to: '/extratos', label: 'Extratos', icon: FileText },
  { to: '/relatorios', label: 'Relatórios', icon: FileBarChart },
]

const routeNames: Record<string, string> = {
  '/': 'Visão geral',
  '/clientes': 'Clientes',
  '/ordens-de-servico': 'Ordens de serviço',
  '/notas-fiscais': 'Notas fiscais',
  '/extratos': 'Extratos',
  '/relatorios': 'Relatórios',
  '/usuarios': 'Usuários',
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const { pathname, navigate } = useRouter()
  const { logout } = useAuth()

  useEffect(() => {
    setMenuOpen(false)
    setProfileOpen(false)
  }, [pathname])

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    const value = search.trim().toLowerCase()
    if (!value) return
    if (value.includes('cliente')) navigate('/clientes')
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
        <div className="sidebar__brand">
          <div className="brand-mark">GB</div>
          <div><strong>Gente Boa</strong><span>Gestão</span></div>
          <button className="sidebar__close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X size={20} /></button>
        </div>

        <div className="sidebar__section-label">Menu principal</div>
        <nav className="sidebar__nav">
          {nav.map(({ to, label, icon: Icon, badge, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}>
              <Icon size={19} />
              <span>{label}</span>
              {badge && <small>{badge}</small>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__bottom">
          <NavLink to="/usuarios" className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}>
            <Settings size={19} /><span>Usuários e acessos</span>
          </NavLink>
          <div className="sidebar__support">
            <span>Precisa de ajuda?</span>
            <strong>Central de suporte</strong>
            <small>Resposta em até 5 minutos</small>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar__left">
            <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu size={22} /></button>
            <div className="breadcrumb"><span>Gente Boa</span><b>/</b><strong>{routeNames[pathname] || 'Gestão'}</strong></div>
            <span className="demo-mode-badge">Protótipo · dados fictícios</span>
          </div>
          <form className="global-search" onSubmit={submitSearch}>
            <Search size={18} />
            <input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente, OS ou nota..." aria-label="Busca global" />
            <kbd>Ctrl K</kbd>
          </form>
          <div className="topbar__actions">
            <div className="popover-anchor">
              <button className="topbar-icon" onClick={() => setNotificationsOpen((value) => !value)} aria-label="Notificações">
                <Bell size={19} /><i />
              </button>
              {notificationsOpen && (
                <div className="popover notifications-popover">
                  <div className="popover__title"><strong>Notificações</strong><span>3 novas</span></div>
                  <button><i className="notification-dot notification-dot--orange" /><span><strong>3 notas aguardam revisão</strong><small>Competência jul/2026 · agora</small></span></button>
                  <button><i className="notification-dot notification-dot--red" /><span><strong>OS-2586 marcada como urgente</strong><small>Clínica Horizonte · há 12 min</small></span></button>
                  <button><i className="notification-dot notification-dot--blue" /><span><strong>Caixa diário ainda está aberto</strong><small>1 de agosto de 2026</small></span></button>
                </div>
              )}
            </div>
            <div className="popover-anchor profile-anchor">
              <button className="profile-button" onClick={() => setProfileOpen((value) => !value)}>
                <span className="avatar">NL</span>
                <span className="profile-copy"><strong>Nathália Lira</strong><small>Administradora</small></span>
                <ChevronDown size={16} />
              </button>
              {profileOpen && (
                <div className="popover profile-popover">
                  <button onClick={() => navigate('/usuarios')}>Meu perfil</button>
                  <button onClick={() => navigate('/usuarios')}>Usuários e acessos</button>
                  <button>Configurações da empresa</button>
                  <button className="profile-popover__logout" onClick={() => { logout(); navigate('/login', { replace: true }) }}><LogOut size={15} /> Sair do sistema</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  )
}
