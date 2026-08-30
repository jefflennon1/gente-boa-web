export type ISODate = string
export type ISODateTime = string

export type ClientKind = 'PESSOA_FISICA' | 'PESSOA_JURIDICA'
export type ClientStatus = 'ATIVO' | 'ATENCAO' | 'INATIVO'
export type Priority = 'NORMAL' | 'URGENTE'
export type ServiceCategory = 'MAO_DE_OBRA' | 'GARANTIA' | 'VISITA_TECNICA' | 'CANCELAMENTO' | 'DESLOCAMENTO'
export type ServiceSearchType = 'ELETRICOS' | 'AMBOS' | 'ALVENARIA' | 'HIDRAULICO' | 'HIDRO' | 'OUTROS'
export type ServiceOrderStatus = 'ABERTA' | 'ENCAMINHADA' | 'AGENDADA' | 'EM_ATENDIMENTO' | 'FINALIZADA' | 'CANCELADA'
export type ServiceOrderOrigin = 'A' | 'C'
export type InvoiceStatus = 'PRONTA' | 'REVISAR' | 'EMITIDA' | 'CANCELADA'
export type PaymentDocumentStatus = 'PENDENTE' | 'PRONTO' | 'REGISTRADO' | 'EMITIDO' | 'ENVIADO' | 'REVISAR'
export type UserRole = 'ADMINISTRADOR' | 'OPERACAO' | 'FINANCEIRO'
export type UserStatus = 'ATIVO' | 'INATIVO'
export type ClientListSortBy = 'STATUS' | 'NAME' | 'SERVICE_ORDER_COUNT' | 'TOTAL_VALUE'
export type ContractStatus = 'ATIVO' | 'CANCELADO'
export type ContractListSortBy = 'CLIENT' | 'CONTRACT_DATE' | 'RENEWAL_DATE' | 'DUE_DAY' | 'ADHESION_FEE'
export type SortDirection = 'ASC' | 'DESC'

export interface PagedResponse<T> {
  content: T[]
  total: number
  page: number
  size: number
  totalPages: number
}

export interface CepAddressResponse {
  cep: string | null
  logradouro: string | null
  complemento: string | null
  unidade: string | null
  bairro: string | null
  localidade: string | null
  uf: string | null
  estado: string | null
  regiao: string | null
  ibge: string | null
  gia: string | null
  ddd: string | null
  siafi: string | null
}

export interface SystemParameters {
  nmempre: string
  dsender: string | null
  dsbairr: string | null
  dscidad: string | null
  nrbolet: string | null
  qtinadi: number | null
  dtrenov: ISODateTime | null
  dspath: string | null
  dspdf: string | null
  vlorcam: number | null
  vliss: number | null
  vlaliq: number | null
}

export type SystemParametersPayload = SystemParameters

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
  dsindic?: string | null
  idindic?: number | null
  dtcadas?: ISODateTime | null
  idusuar?: number | null
  nmrazao?: string | null
  nmfanta?: string | null
  nrtele1?: string | null
  nrtele2?: string | null
  nrfax?: string | null
  dsemail?: string | null
  flclien?: string | null
  nrcnpj?: string | null
  nrcpf?: string | null
  nmcont1?: string | null
  nrtelc1?: string | null
  nmcont2?: string | null
  nrtelc2?: string | null
  dsender?: string | null
  dscompl?: string | null
  dsbairr?: string | null
  dscidad?: string | null
  dsestad?: string | null
  nrcep?: string | null
  dsobser?: string | null
  flaudit?: string | null
  fliss?: string | null
  vliss?: number | null
  flinss?: string | null
  vlinss?: number | null
  idfunci?: number | null
  idtabel?: number | null
  flstatu?: string | null
  dtanive?: string | null
  dtliber?: ISODateTime | null
  idliber?: number | null
  dsinscr?: string | null
  nmcont3?: string | null
  nrtelc3?: string | null
  nmcont4?: string | null
  nrtelc4?: string | null
  dsponto?: string | null
  dsusuario?: string | null
  flenvio?: string | null
  flaniv?: string | null
  flenvioboleto?: string | null
  flenvioextrato?: string | null
  addresses?: ClientAddress[]
}

export interface ClientListItem {
  id: number
  name: string | null
  tradeName: string | null
  document: string | null
  kind: ClientKind
  email: string | null
  phone: string | null
  city: string | null
  contract: boolean
  status: Exclude<ClientStatus, 'ATENCAO'>
  serviceOrderCount: number
  totalValue: number
}

export interface ClientSearchOption {
  id: number
  legalName: string | null
  tradeName: string | null
  document: string | null
  status: Exclude<ClientStatus, 'ATENCAO'>
}

export interface ClientStatisticsResponse {
  total: number
  active: number
  inactive: number
}

export interface ClientReferral {
  id: number
  description: string
}

export interface ClientAddress {
  id: number
  clientId: number | null
  description: string | null
  street: string | null
  complement: string | null
  district: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  map: string | null
  accountName: string | null
  phone: string | null
  reference: string | null
}

export interface ClientAddressPayload {
  id?: number
  description?: string | null
  street?: string | null
  complement?: string | null
  district?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  map?: string | null
  accountName?: string | null
  phone?: string | null
  reference?: string | null
}

export type ClientPayload = Partial<Omit<Client, 'id' | 'name' | 'document' | 'kind' | 'email' | 'phone' | 'city' | 'address' | 'contract' | 'status' | 'addresses'>> & {
  addresses?: ClientAddressPayload[] | null
}

export interface ServiceCatalogItem {
  id: number
  groupId?: number | null
  description: string | null
  defaultValue?: number | null
  defaultPrice?: number | null
  unit: string | null
  minimumValue?: number | null
  legacyMinuteValue?: number | null
}

export interface Material {
  id: number
  description: string | null
  unit: string | null
  minimumStock: number | null
  currentStock: number | null
  unitValue: number | null
  brand: string | null
}

export type MaterialPayload = Omit<Material, 'id'>

export interface Supplier {
  id: number
  tradeName: string | null
  legalName: string | null
  document: string | null
  address: string | null
  city: string | null
  state: string | null
  phone: string | null
  contactName: string | null
  contactPhone: string | null
  contactEmail: string | null
}

export interface ServiceOrderMaterialItem {
  itemId?: number | null
  purchaseOrderId?: number | null
  materialId: number
  quantity?: number | null
  unitValue?: number | null
  totalValue?: number | null
  materialDescription?: string | null
  materialUnit?: string | null
  materialBrand?: string | null
}

export interface ServiceOrderMaterialOrder {
  id?: number | null
  entryDate?: ISODateTime | null
  invoiceNumber?: string | null
  serviceOrderId?: number | null
  supplierId?: number | null
  supplierName?: string | null
  supplierTradeName?: string | null
  discountPercentage?: number | null
  freightValue?: number | null
  insuranceValue?: number | null
  fobValue?: number | null
  cifValue?: number | null
  standardValue?: number | null
  gbMarginValue?: number | null
  rentalValue?: number | null
  notes?: string | null
  netValue?: number | null
  grossValue?: number | null
  items: ServiceOrderMaterialItem[]
}

export interface ContractServiceItem {
  sequence: number
  serviceId: number
  serviceName: string | null
  serviceDescription?: string | null
  unit: string | null
  quantity: number
  unitValue: number
  totalValue: number
  extraMinuteValue: number | null
  bonusQuantity: number | null
}

export interface ContractServicePayload {
  sequence?: number
  serviceId: number
  quantity: number
  unitValue: number
  extraMinuteValue?: number | null
  bonusQuantity?: number | null
}

export interface Contract {
  id: number
  clientId: number
  clientName: string | null
  clientTradeName: string | null
  contractDate: ISODateTime | null
  renewalDate: ISODateTime | null
  adhesionFee: number | null
  dueDay: number | null
  gracePeriod: boolean
  adjustmentIndexId: number | null
  salePercentage: number | null
  renewalPercentage: number | null
  canceled: boolean
  cancellationDate: ISODateTime | null
  cancellationReason: string | null
  employeeId: number | null
  employeePercentage: number | null
  supplierId: number | null
  statusFlag: string | null
  lastAdjustmentDate: ISODateTime | null
  status: ContractStatus
  services: ContractServiceItem[]
}

export interface ContractListItem {
  id: number
  clientId: number
  clientName: string | null
  clientTradeName: string | null
  contractDate: ISODateTime | null
  renewalDate: ISODateTime | null
  adhesionFee: number | null
  dueDay: number | null
  canceled: boolean
  status: ContractStatus
  serviceCount?: number | null
}

export interface ContractPayload {
  clientId: number
  contractDate: ISODateTime
  renewalDate?: ISODateTime | null
  adhesionFee?: number | null
  dueDay?: number | null
  gracePeriod: boolean
  adjustmentIndexId?: number | null
  salePercentage?: number | null
  renewalPercentage?: number | null
  canceled: boolean
  cancellationDate?: ISODateTime | null
  cancellationReason?: string | null
  employeeId?: number | null
  employeePercentage?: number | null
  supplierId?: number | null
  statusFlag?: string | null
  lastAdjustmentDate?: ISODateTime | null
  services: ContractServicePayload[]
}

export interface CancelContractPayload {
  cancellationDate: ISODateTime
  reason: string
}

export interface ServiceOrderSchedule {
  serviceOrderId?: number | null
  scheduleId?: number | null
  expectedDate: ISODateTime
  expectedStart?: string | null
  expectedEnd?: string | null
  expectedDuration?: string | null
  employeeId?: number | null
  roleId?: number | null
  actualDate?: ISODateTime | null
  actualStart?: string | null
  actualEnd?: string | null
  actualQuantity?: number | null
  actualDuration?: string | null
  urgentFlag?: string | null
  scheduledTimeFlag?: string | null
  startedFlag?: string | null
  finishedFlag?: string | null
  routedFlag?: string | null
  finishedAt?: ISODateTime | null
  startedAt?: ISODateTime | null
  serviceType?: string | null
}

export interface ServiceOrderServiceItem {
  serviceOrderId?: number | null
  serviceId: number
  quantity?: number | null
  hours?: string | null
  unitValue?: number | null
  totalValue?: number | null
  minimumValue?: number | null
  minuteValue?: number | null
}

export interface ServiceOrderListItem {
  id: number
  orderedAt: ISODateTime
  clientName: string | null
  clientTradeName: string | null
  clientId: number | null
  requester: string | null
  category: ServiceCategory
  status: ServiceOrderStatus
  description: string | null
  totalValue: number | null
  priority: Priority
}

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
  flordem?: ServiceOrderOrigin | null
  nrbloco?: string | null
  dtvenci?: ISODateTime | null
  txbolet?: number | null
  qthorac?: string | null
  qthorat?: string | null
  sdanter?: string | null
  sdutili?: string | null
  sdfinal?: string | null
  sdexced?: string | null
  hireali?: string | null
  dtfecha?: ISODateTime | null
  vldesco?: number | null
  vldesc?: number | null
  dtfinal?: ISODateTime | null
  dtinicial?: ISODateTime | null
  idpedi?: number | null
  vltrans?: number | null
  vlalug?: number | null
  fltrans?: string | null
  flalug?: string | null
  qthrest?: string | null
  flexc?: string | null
  sdcontr?: string | null
  nrcnpj?: string | null
  nrorca?: string | null
  dtorca?: ISODateTime | null
  dsorca?: string | null
  vlorca?: number | null
  dscancel?: string | null
  flfideli?: string | null
  idfidel?: number | null
  nmconta?: string | null
  schedules?: ServiceOrderSchedule[] | null
  serviceItems?: ServiceOrderServiceItem[] | null
  materialOrder?: ServiceOrderMaterialOrder | null
}

export type ServiceOrderPayload = Partial<Omit<ServiceOrder, 'id' | 'code' | 'client' | 'clientName'>> & {
  idclien: number
  dtordem: ISODateTime
  status: ServiceOrderStatus
  schedules: ServiceOrderSchedule[]
  serviceItems: ServiceOrderServiceItem[]
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
