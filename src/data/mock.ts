import type { AppUser, Client, Invoice, ServiceOrder, Statement } from '../types'

export const clients: Client[] = [
  { id: 1048, name: 'Almeida Consultoria', document: '26.182.261/0001-56', kind: 'Pessoa jurídica', email: 'financeiro@almeida.com.br', phone: '(85) 98741-0032', city: 'Fortaleza', contract: true, plan: 'Contrato · 20h', dueDay: '10', monthly: 3850, usedHours: 14.3, contractedHours: 20, status: 'Ativo', channel: 'Indicação', lastService: 'Hoje, 09:30' },
  { id: 1022, name: 'Condomínio Riviera', document: '14.020.339/0001-87', kind: 'Pessoa jurídica', email: 'sindico@riviera.com.br', phone: '(85) 3241-9090', city: 'Fortaleza', contract: true, plan: 'Contrato · 12h', dueDay: '20', monthly: 2980, usedHours: 7.75, contractedHours: 12, status: 'Ativo', channel: 'Google', lastService: 'Ontem, 16:10' },
  { id: 1017, name: 'Studio Aurora', document: '43.991.204/0001-10', kind: 'Pessoa jurídica', email: 'contato@aurora.com.br', phone: '(85) 99622-1140', city: 'Fortaleza', contract: true, plan: 'Contrato · 10h', dueDay: '10', monthly: 2400, usedHours: 9.2, contractedHours: 10, status: 'Atenção', channel: 'Instagram', lastService: '30 jul, 14:30' },
  { id: 996, name: 'Medeiros & Lima', document: '08.744.155/0001-72', kind: 'Pessoa jurídica', email: 'adm@medeiros.com.br', phone: '(85) 98802-7654', city: 'Fortaleza', contract: true, plan: 'Contrato · 8h', dueDay: '20', monthly: 1920, usedHours: 3.5, contractedHours: 8, status: 'Ativo', channel: 'Indicação', lastService: '28 jul, 08:10' },
  { id: 973, name: 'Clínica Horizonte', document: '19.406.582/0001-19', kind: 'Pessoa jurídica', email: 'recepcao@horizonte.com.br', phone: '(85) 3254-7731', city: 'Fortaleza', contract: false, plan: 'Cliente avulso', dueDay: 'Sob demanda', monthly: 780, usedHours: 0, contractedHours: 0, status: 'Ativo', channel: 'Site', lastService: '24 jul, 15:30' },
  { id: 951, name: 'Rodrigo Jereissati', document: '005.861.973-97', kind: 'Pessoa física', email: 'rodrigo@email.com', phone: '(85) 99911-2677', city: 'Fortaleza', contract: false, plan: 'Cliente avulso', dueDay: 'Sob demanda', monthly: 460, usedHours: 0, contractedHours: 0, status: 'Ativo', channel: 'Indicação', lastService: '18 jul, 11:00' },
]

export const serviceOrders: ServiceOrder[] = [
  { id: 'OS-2586', client: 'Clínica Horizonte', service: 'Troca de luminárias', category: 'Elétrica', technician: 'Aguardando', date: '2026-08-01', time: '15:30', priority: 'Urgente', status: 'aberta', location: 'Aldeota · Fortaleza', description: 'Trocar quatro luminárias da recepção e revisar um ponto com mau contato.' },
  { id: 'OS-2585', client: 'Medeiros & Lima', service: 'Reparo em vazamento', category: 'Hidráulica', technician: 'Vandecílio', date: '2026-08-01', time: '13:00', priority: 'Normal', status: 'encaminhada', location: 'Meireles · Fortaleza', description: 'Vazamento identificado sob a pia da copa.' },
  { id: 'OS-2584', client: 'Condomínio Riviera', service: 'Visita técnica', category: 'Visita técnica', technician: 'Miguel', date: '2026-08-01', time: '11:00', priority: 'Normal', status: 'agendada', location: 'Cocó · Fortaleza', description: 'Vistoria preventiva no quadro elétrico das áreas comuns.' },
  { id: 'OS-2583', client: 'Almeida Consultoria', service: 'Manutenção elétrica', category: 'Elétrica', technician: 'Edmilson', date: '2026-08-01', time: '09:30', priority: 'Urgente', status: 'em_atendimento', location: 'Dionísio Torres · Fortaleza', description: 'Revisão de tomadas e estabilização do circuito da sala de reunião.' },
  { id: 'OS-2582', client: 'Studio Aurora', service: 'Reparo hidráulico', category: 'Hidráulica', technician: 'Miguel', date: '2026-08-01', time: '08:40', priority: 'Normal', status: 'em_atendimento', location: 'Varjota · Fortaleza', description: 'Substituição de sifão e vedação da bancada.' },
  { id: 'OS-2581', client: 'Medeiros & Lima', service: 'Instalação de persianas', category: 'Instalação', technician: 'Vandecílio', date: '2026-08-01', time: '08:10', priority: 'Normal', status: 'finalizada', location: 'Meireles · Fortaleza', description: 'Instalação de duas persianas na sala administrativa.' },
  { id: 'OS-2580', client: 'Rodrigo Jereissati', service: 'Instalação de suporte de TV', category: 'Instalação', technician: 'Edmilson', date: '2026-07-31', time: '16:00', priority: 'Normal', status: 'finalizada', location: 'Papicu · Fortaleza', description: 'Instalação e passagem de cabos para suporte articulado.' },
]

export const invoices: Invoice[] = [
  { id: 'NF-8064', client: 'Almeida Consultoria', document: '26.182.261/0001-56', competence: 'Jul/2026', amount: 3850, tax: 3.4, issRetained: false, status: 'Pronta' },
  { id: 'NF-8063', client: 'Condomínio Riviera', document: '14.020.339/0001-87', competence: 'Jul/2026', amount: 2980, tax: 0, issRetained: true, status: 'Pronta' },
  { id: 'NF-8062', client: 'Studio Aurora', document: '43.991.204/0001-10', competence: 'Jul/2026', amount: 2400, tax: 3.4, issRetained: false, status: 'Revisar' },
  { id: 'NF-8061', client: 'Medeiros & Lima', document: '08.744.155/0001-72', competence: 'Jul/2026', amount: 1920, tax: 3.4, issRetained: false, status: 'Emitida', issuedAt: '30/07/2026' },
  { id: 'NF-8060', client: 'Clínica Horizonte', document: '19.406.582/0001-19', competence: 'Jul/2026', amount: 780, tax: 3.4, issRetained: false, status: 'Emitida', issuedAt: '29/07/2026' },
]

export const statements: Statement[] = [
  { id: 'EXT-071', client: 'Almeida Consultoria', email: 'financeiro@almeida.com.br', osCount: 7, hours: '18h35', amount: 3850, invoice: 'Pronta', slip: 'Registrado', status: 'Pronto' },
  { id: 'EXT-072', client: 'Condomínio Riviera', email: 'sindico@riviera.com.br', osCount: 4, hours: '11h20', amount: 2980, invoice: 'Pronta', slip: 'Registrado', status: 'Pronto' },
  { id: 'EXT-073', client: 'Studio Aurora', email: 'contato@aurora.com.br', osCount: 6, hours: '13h40', amount: 2400, invoice: 'Pendente', slip: 'Pendente', status: 'Revisar' },
  { id: 'EXT-074', client: 'Medeiros & Lima', email: 'adm@medeiros.com.br', osCount: 3, hours: '7h10', amount: 1920, invoice: 'Emitida', slip: 'Registrado', status: 'Enviado', sentAt: '30/07/2026 · 16:42' },
]

export const users: AppUser[] = [
  { id: 1, name: 'Nathália Lira', initials: 'NL', email: 'nathalia@genteboa.com.br', role: 'Administrador', status: 'Ativo', lastAccess: 'Agora', permissions: ['Dashboard', 'Clientes', 'Ordens de serviço', 'Financeiro', 'Notas fiscais', 'Relatórios', 'Usuários'] },
  { id: 2, name: 'Ediane Souza', initials: 'ES', email: 'ediane@genteboa.com.br', role: 'Operação', status: 'Ativo', lastAccess: 'Hoje, 12:34', permissions: ['Dashboard', 'Clientes', 'Ordens de serviço', 'Relatórios'] },
  { id: 3, name: 'Dielly Gomes', initials: 'DG', email: 'dielly@genteboa.com.br', role: 'Financeiro', status: 'Ativo', lastAccess: 'Hoje, 08:12', permissions: ['Dashboard', 'Clientes', 'Financeiro', 'Notas fiscais', 'Relatórios'] },
  { id: 4, name: 'Miguel Santos', initials: 'MS', email: 'miguel@genteboa.com.br', role: 'Operação', status: 'Inativo', lastAccess: '25 jul, 17:50', permissions: ['Ordens de serviço'] },
]

export const cashFlow = [
  { month: 'Fev', received: 41, pending: 13 },
  { month: 'Mar', received: 47, pending: 16 },
  { month: 'Abr', received: 56, pending: 18 },
  { month: 'Mai', received: 64, pending: 21 },
  { month: 'Jun', received: 72, pending: 25 },
  { month: 'Jul', received: 84, pending: 29 },
]

export const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)

export const osStatusLabel = {
  aberta: 'Aberta',
  encaminhada: 'Encaminhada',
  agendada: 'Hora marcada',
  em_atendimento: 'Em atendimento',
  finalizada: 'Finalizada',
} as const
