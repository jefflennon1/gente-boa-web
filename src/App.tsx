import { lazy, Suspense, useEffect } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'
import { useAuth } from './auth'
import { AppLayout } from './components/AppLayout'
import { Login } from './pages/Login'
import { canAccess, navItemForPath } from './navigation'
import { useRouter } from './router'

const pages: Partial<Record<string, LazyExoticComponent<ComponentType>>> = {
  '/': lazy(() => import('./pages/MonthlyDashboard').then((module) => ({ default: module.MonthlyDashboard }))),
  '/clientes': lazy(() => import('./pages/Clients').then((module) => ({ default: module.Clients }))),
  '/contratos': lazy(() => import('./pages/Contracts').then((module) => ({ default: module.Contracts }))),
  '/ordens-de-servico': lazy(() => import('./pages/ServiceOrders').then((module) => ({ default: module.ServiceOrders }))),
  '/servicos': lazy(() => import('./pages/Services').then((module) => ({ default: module.Services }))),
  '/materiais': lazy(() => import('./pages/Materials').then((module) => ({ default: module.Materials }))),
  '/fornecedores': lazy(() => import('./pages/Suppliers').then((module) => ({ default: module.Suppliers }))),
  '/contas-a-pagar': lazy(() => import('./pages/AccountsPayable').then((module) => ({ default: module.AccountsPayable }))),
  '/funcionarios': lazy(() => import('./pages/Employees').then((module) => ({ default: module.Employees }))),
  '/notas-fiscais': lazy(() => import('./pages/NationalInvoices').then((module) => ({ default: module.NationalInvoices }))),
  '/boletos': lazy(() => import('./pages/Statements').then((module) => ({ default: module.Statements }))),
  '/extratos': lazy(() => import('./pages/Statements').then((module) => ({ default: module.Statements }))),
  '/relatorios': lazy(() => import('./pages/Reports').then((module) => ({ default: module.Reports }))),
  '/usuarios': lazy(() => import('./pages/Users').then((module) => ({ default: module.Users }))),
  '/modelos-de-documentos': lazy(() => import('./pages/DocumentTemplates').then((module) => ({ default: module.DocumentTemplates }))),
  '/parametros-do-sistema': lazy(() => import('./pages/SystemParameters').then((module) => ({ default: module.SystemParametersPage }))),
  '/envio-de-emails': lazy(() => import('./pages/ClientEmails').then((module) => ({ default: module.ClientEmailsPage }))),
  '/contas-a-receber': lazy(() => import('./pages/AccountsReceivable').then((module) => ({ default: module.AccountsReceivable }))),
  '/caixa-diario': lazy(() => import('./pages/CashDaily').then((module) => ({ default: module.CashDaily }))),
  '/centros-de-custo': lazy(() => import('./pages/CostCenters').then((module) => ({ default: module.CostCenters }))),
  '/acompanhamento-colaboradores': lazy(() => import('./pages/EmployeeTracking').then((module) => ({ default: module.EmployeeTracking }))),
  '/contratos-ativos': lazy(() => import('./pages/ActiveContracts').then((module) => ({ default: module.ActiveContracts }))),
  '/relatorios-os': lazy(() => import('./pages/ServiceOrderReport').then((module) => ({ default: module.ServiceOrderReport }))),
  '/relatorios-clientes': lazy(() => import('./pages/ClientReports').then((module) => ({ default: module.ClientReports }))),
  '/canais-de-venda': lazy(() => import('./pages/SalesChannels').then((module) => ({ default: module.SalesChannels }))),
  '/resumo-mensal': lazy(() => import('./pages/MonthlySummary').then((module) => ({ default: module.MonthlySummary }))),
  '/relatorios-financeiros': lazy(() => import('./pages/FinancialReports').then((module) => ({ default: module.FinancialReports }))),
  '/relatorios-atendimentos': lazy(() => import('./pages/AttendancePeriodReport').then((module) => ({ default: module.AttendancePeriodReport }))),
}

const publicPages: Partial<Record<string, LazyExoticComponent<ComponentType>>> = {
  '/cadastro': lazy(() => import('./pages/PublicClientSignup').then((module) => ({ default: module.PublicClientSignup }))),
}

export default function App() {
  const { pathname, navigate } = useRouter()
  const { isAuthenticated, initializing, user } = useAuth()
  const Page = pages[pathname]
  const PublicPage = publicPages[pathname]

  useEffect(() => {
    function preventEnterFormSubmission(event: KeyboardEvent) {
      if (event.key !== 'Enter' || event.isComposing || event.defaultPrevented) return

      const target = event.target
      if (!(target instanceof HTMLElement) || target instanceof HTMLTextAreaElement || target.isContentEditable) return

      const form = target.closest('form')
      if (!form || form.dataset.allowEnterSubmit === 'true') return

      event.preventDefault()
    }

    document.addEventListener('keydown', preventEnterFormSubmission, true)
    return () => document.removeEventListener('keydown', preventEnterFormSubmission, true)
  }, [])

  useEffect(() => {
    if (PublicPage) return
    if (!isAuthenticated && pathname !== '/login') navigate('/login', { replace: true })
    else if (isAuthenticated && pathname === '/login') navigate('/', { replace: true })
    else if (isAuthenticated && navItemForPath(pathname) && !canAccess(navItemForPath(pathname), user) && pathname !== '/') navigate('/', { replace: true })
    else if (isAuthenticated && !Page) navigate('/', { replace: true })
  }, [Page, PublicPage, isAuthenticated, navigate, pathname, user?.role])

  if (PublicPage) {
    return (
      <Suspense fallback={<div className="page-loader page-loader--screen"><span /><strong>Carregando...</strong></div>}>
        <PublicPage />
      </Suspense>
    )
  }

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
