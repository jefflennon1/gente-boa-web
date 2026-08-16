import { lazy, Suspense, useEffect } from 'react'
import { useAuth } from './auth'
import { AppLayout } from './components/AppLayout'
import { Login } from './pages/Login'
import { useRouter } from './router'

const pages = {
  '/': lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard }))),
  '/clientes': lazy(() => import('./pages/Clients').then((module) => ({ default: module.Clients }))),
  '/contratos': lazy(() => import('./pages/Contracts').then((module) => ({ default: module.Contracts }))),
  '/ordens-de-servico': lazy(() => import('./pages/ServiceOrders').then((module) => ({ default: module.ServiceOrders }))),
  '/notas-fiscais': lazy(() => import('./pages/Invoices').then((module) => ({ default: module.Invoices }))),
  '/extratos': lazy(() => import('./pages/Statements').then((module) => ({ default: module.Statements }))),
  '/relatorios': lazy(() => import('./pages/Reports').then((module) => ({ default: module.Reports }))),
  '/usuarios': lazy(() => import('./pages/Users').then((module) => ({ default: module.Users }))),
}

export default function App() {
  const { pathname, navigate } = useRouter()
  const { isAuthenticated, initializing, user } = useAuth()
  const Page = pages[pathname as keyof typeof pages]

  useEffect(() => {
    if (!isAuthenticated && pathname !== '/login') navigate('/login', { replace: true })
    else if (isAuthenticated && pathname === '/login') navigate('/', { replace: true })
    else if (isAuthenticated && pathname === '/usuarios' && user?.role !== 'ADMINISTRADOR') navigate('/', { replace: true })
    else if (isAuthenticated && !Page) navigate('/', { replace: true })
  }, [Page, isAuthenticated, navigate, pathname, user?.role])

  if (initializing) return <div className="page-loader page-loader--screen"><span /><strong>Validando sessão...</strong></div>
  if (!isAuthenticated) return <Login />

  return (
    <AppLayout>
      <Suspense fallback={<div className="page-loader"><span /><strong>Carregando módulo...</strong></div>}>
        {Page ? <Page /> : null}
      </Suspense>
    </AppLayout>
  )
}
