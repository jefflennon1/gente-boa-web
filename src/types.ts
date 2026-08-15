export type ISODate = string
export type ISODateTime = string

export type ClientKind = 'PESSOA_FISICA' | 'PESSOA_JURIDICA'
export type ClientStatus = 'ATIVO' | 'ATENCAO' | 'INATIVO'
export type DueDay = 'DIA_10' | 'DIA_20' | 'SOB_DEMANDA'
export type Priority = 'NORMAL' | 'URGENTE'
export type ServiceCategory = 'ELETRICA' | 'HIDRAULICA' | 'INSTALACAO' | 'VISITA_TECNICA' | 'SERVICOS_GERAIS'
export type ServiceOrderStatus = 'ABERTA' | 'ENCAMINHADA' | 'AGENDADA' | 'EM_ATENDIMENTO' | 'FINALIZADA' | 'CANCELADA'
export type InvoiceStatus = 'PRONTA' | 'REVISAR' | 'EMITIDA' | 'CANCELADA'
export type PaymentDocumentStatus = 'PENDENTE' | 'PRONTO' | 'REGISTRADO' | 'EMITIDO' | 'ENVIADO' | 'REVISAR'
export type UserRole = 'ADMINISTRADOR' | 'OPERACAO' | 'FINANCEIRO'
export type UserStatus = 'ATIVO' | 'INATIVO'

export interface PagedResponse<T> {
  content: T[]
  total: number
  page: number
  size: number
  totalPages: number
}

export interface Client {
  id: number
  name: string | null
  document: string | null
  kind: ClientKind
  email: string | null
  phone: string | null
  city: string | null
  address: string | null
  contract: boolean
  status: ClientStatus
  contractNumber?: string | null
  plan?: string | null
  dueDay?: DueDay | null
  monthly?: number | null
  hourValue?: number | null
  extraMinuteValue?: number | null
  usedHours?: number | null
  contractedHours?: number | null
  channel?: string | null
  lastServiceAt?: ISODateTime | null
  nmrazao?: string | null
  nmfanta?: string | null
  nrcnpj?: string | null
  nrcpf?: string | null
  nrtele1?: string | null
  nrtele2?: string | null
  dsemail?: string | null
  dsender?: string | null
  dscompl?: string | null
  dsbairr?: string | null
  dscidad?: string | null
  dsestad?: string | null
  nrcep?: string | null
  dsobser?: string | null
  dsindic?: string | null
  idtabel?: number | null
  flclien?: string | null
  flstatu?: string | null
}

export type ClientPayload = Partial<Omit<Client, 'id'>>

export interface ServiceOrder {
  id: number
  code: string | null
  idclien: number | null
  client: Client | null
  clientName: string | null
  service: string | null
  category: ServiceCategory
  technician: string | null
  scheduledDate: ISODate | null
  scheduledTime: string | null
  status: ServiceOrderStatus
  location: string | null
  description: string | null
  priority?: Priority | null
  dtordem?: ISODateTime | null
  nmsolic?: string | null
  idlocal?: number | null
  idopera?: number | null
  dsobser?: string | null
  dsdescr?: string | null
  hrabert?: string | null
  vlcobra?: number | null
  vlmater?: number | null
  vlhorar?: number | null
  flstatu?: string | null
  flcateg?: string | null
  tpservic?: string | null
}

export type ServiceOrderPayload = Partial<Omit<ServiceOrder, 'id' | 'code' | 'client' | 'clientName'>> & {
  idclien: number
  service: string
  scheduledDate: ISODate
  status: ServiceOrderStatus
}

export interface Invoice {
  id: number
  number: string | null
  clientName: string | null
  document: string | null
  competence: string | null
  amount: number | null
  tax: number | null
  issRetained: boolean
  status: InvoiceStatus
  issuedAt: ISODate | null
  client?: Client | null
  nrnotaf?: string | null
  dsmespr?: string | null
  dtemiss?: ISODateTime | null
  dsnatur?: string | null
  nmrazao?: string | null
  nrcnpj?: string | null
  dsender?: string | null
  vltotal?: number | null
  vlbasei?: number | null
  vlaliqu?: number | null
  vlissqn?: number | null
  dsobser?: string | null
  vlmao?: number | null
  vlmater?: number | null
}

export type InvoicePayload = Partial<Omit<Invoice, 'id'>> & {
  clientName: string
  document: string
  competence: string
  amount: number
  issuedAt: ISODate
}

export interface Statement {
  id: number
  code: string | null
  clientName: string | null
  amount: number
  status: PaymentDocumentStatus
  sentAt: ISODateTime | null
  email?: string | null
  serviceOrderCount?: number | null
  hours?: string | null
  invoiceStatus?: PaymentDocumentStatus | null
  slipStatus?: PaymentDocumentStatus | null
  dsmovim?: string | null
  dtinici?: ISODateTime | null
  vlinici?: number | null
  qtcredi?: number | null
  qtdebit?: number | null
  qtbolet?: number | null
  qtdepos?: number | null
  qttrans?: number | null
  qtresga?: number | null
  qtoutro?: number | null
  qtchequ?: number | null
  nrbanco?: string | null
  nragenc?: string | null
  nrconta?: string | null
}

export type StatementPayload = Partial<Omit<Statement, 'id' | 'code' | 'amount'>> & {
  clientName: string
  sentAt: ISODateTime
}

export interface AppUser {
  id: number
  name: string
  initials: string | null
  email: string
  role: UserRole
  status: UserStatus
  lastAccessAt: ISODateTime | null
  permissions: string[]
}

export interface CreateUserPayload {
  name: string
  initials: string
  email: string
  password: string
  role: UserRole
  status: UserStatus
  permissions: string[]
}

export interface UpdateUserPayload extends Omit<CreateUserPayload, 'password'> {
  password?: string
}

export interface AuthResponse {
  accessToken: string
  tokenType: string
  expiresIn: number
  user: AppUser
}

export interface ApiProblem {
  title?: string
  status?: number
  detail?: string
  fields?: Record<string, string>
}
