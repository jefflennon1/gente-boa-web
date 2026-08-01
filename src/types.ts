export type OsStatus = 'aberta' | 'encaminhada' | 'agendada' | 'em_atendimento' | 'finalizada'

export interface Client {
  id: number
  name: string
  document: string
  kind: 'Pessoa jurídica' | 'Pessoa física'
  email: string
  phone: string
  city: string
  contract: boolean
  plan: string
  dueDay: '10' | '20' | 'Sob demanda'
  monthly: number
  usedHours: number
  contractedHours: number
  status: 'Ativo' | 'Atenção'
  channel: string
  lastService: string
}

export interface ServiceOrder {
  id: string
  client: string
  service: string
  category: 'Elétrica' | 'Hidráulica' | 'Instalação' | 'Visita técnica' | 'Serviços gerais'
  technician: string
  date: string
  time: string
  priority: 'Urgente' | 'Normal'
  status: OsStatus
  location: string
  description: string
}

export interface Invoice {
  id: string
  client: string
  document: string
  competence: string
  amount: number
  tax: number
  issRetained: boolean
  status: 'Pronta' | 'Revisar' | 'Emitida'
  issuedAt?: string
}

export interface Statement {
  id: string
  client: string
  email: string
  osCount: number
  hours: string
  amount: number
  invoice: 'Pronta' | 'Pendente' | 'Emitida'
  slip: 'Registrado' | 'Pendente'
  status: 'Pronto' | 'Revisar' | 'Enviado'
  sentAt?: string
}

export interface AppUser {
  id: number
  name: string
  initials: string
  email: string
  role: 'Administrador' | 'Operação' | 'Financeiro'
  status: 'Ativo' | 'Inativo'
  lastAccess: string
  permissions: string[]
}
