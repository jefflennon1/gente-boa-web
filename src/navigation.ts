import type { LucideIcon } from 'lucide-react'
import { Bell, Boxes, BriefcaseBusiness, CalendarClock, ClipboardList, FileBarChart, FilePen, FileSignature, FileSpreadsheet, FileText, FolderTree, HandCoins, LayoutDashboard, Megaphone, PiggyBank, ReceiptText, ScrollText, Settings, ShieldCheck, Truck, UserRoundCog, UsersRound, Wallet, Wrench } from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  /** Chave de acesso usada no controle de permissões por usuário (Utilitários > Usuários > Acessos). */
  permission: string
  end?: boolean
  adminOnly?: boolean
}

export type NavGroup = { label: string; items: NavItem[] }

export const navGroups: NavGroup[] = [
  {
    label: 'Operação',
    items: [
      { to: '/', label: 'Visão geral', icon: LayoutDashboard, end: true, permission: 'dashboard' },
      { to: '/ordens-de-servico', label: 'Ordens de serviço', icon: ClipboardList, permission: 'service-orders' },
      { to: '/acompanhamento-colaboradores', label: 'Acomp. de colaboradores', icon: CalendarClock, permission: 'employee-tracking' },
    ],
  },
  {
    label: 'Cadastros',
    items: [
      { to: '/clientes', label: 'Clientes', icon: UsersRound, permission: 'clients' },
      { to: '/contratos', label: 'Contratos', icon: FileSignature, permission: 'contracts' },
      { to: '/servicos', label: 'Serviços', icon: BriefcaseBusiness, permission: 'services' },
      { to: '/materiais', label: 'Materiais', icon: Boxes, permission: 'materials' },
      { to: '/fornecedores', label: 'Fornecedores', icon: Truck, permission: 'suppliers' },
      { to: '/funcionarios', label: 'Funcionários', icon: UserRoundCog, permission: 'employees' },
      { to: '/canais-de-venda', label: 'Canais de venda', icon: Megaphone, permission: 'sales-channels' },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { to: '/contas-a-receber', label: 'Contas a receber', icon: PiggyBank, permission: 'receivables' },
      { to: '/contas-a-pagar', label: 'Contas a pagar', icon: HandCoins, permission: 'payables' },
      { to: '/caixa-diario', label: 'Caixa diário', icon: Wallet, permission: 'cash' },
      { to: '/centros-de-custo', label: 'Centros de custo', icon: FolderTree, permission: 'cost-centers' },
      { to: '/boletos', label: 'Boletos', icon: FileText, permission: 'bills' },
      { to: '/extratos', label: 'Extratos', icon: FileBarChart, permission: 'bills' },
      { to: '/notas-fiscais', label: 'Notas fiscais', icon: ReceiptText, permission: 'invoices' },
    ],
  },
  {
    label: 'Relatórios',
    items: [
      { to: '/relatorios-os', label: 'Impressão de OS', icon: Wrench, permission: 'report-service-orders' },
      { to: '/contratos-ativos', label: 'Contratos ativos e reajuste', icon: ScrollText, permission: 'report-active-contracts' },
      { to: '/relatorios-financeiros', label: 'Relatórios financeiros', icon: FileSpreadsheet, permission: 'report-financial' },
      { to: '/relatorios-atendimentos', label: 'Atendimentos por período', icon: FileText, permission: 'reports' },
      { to: '/relatorios-clientes', label: 'Relatórios de clientes', icon: UsersRound, permission: 'report-clients' },
      { to: '/resumo-mensal', label: 'Resumo mensal (ata)', icon: FileBarChart, permission: 'report-monthly-summary' },
      { to: '/relatorios', label: 'Outros relatórios', icon: FileBarChart, permission: 'reports' },
    ],
  },
  {
    label: 'Utilitários',
    items: [
      { to: '/parametros-do-sistema', label: 'Parâmetros do sistema', icon: Settings, permission: 'system-parameters', adminOnly: true },
      { to: '/modelos-de-documentos', label: 'Modelos de documentos', icon: FilePen, permission: 'system-parameters', adminOnly: true },
      { to: '/envio-de-emails', label: 'Notificações', icon: Bell, permission: 'notifications', adminOnly: true },
      { to: '/usuarios', label: 'Usuários e acessos', icon: ShieldCheck, permission: 'users', adminOnly: true },
    ],
  },
]

export const navItems = navGroups.flatMap((group) => group.items)

export const routeNames: Record<string, string> = Object.fromEntries(navItems.map((item) => [item.to, item.label]))

/** Usuário pode abrir a rota? Administradores sempre podem; os demais seguem a lista de acessos (vazia = acesso livre). */
export function canAccess(item: NavItem | undefined, user: { role?: string; permissions?: string[] } | null | undefined) {
  if (!item || !user) return false
  if (user.role === 'ADMINISTRADOR') return true
  if (item.adminOnly) return false
  const permissions = user.permissions ?? []
  return permissions.length === 0 || permissions.includes(item.permission)
}

export function navItemForPath(pathname: string) {
  return navItems.find((item) => item.to === pathname)
}
