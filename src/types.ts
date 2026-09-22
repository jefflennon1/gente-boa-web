export type ISODate = string
export type ISODateTime = string

export type ClientKind = 'PESSOA_FISICA' | 'PESSOA_JURIDICA'
export type Priority = 'NORMAL' | 'URGENTE'
export type ServiceCategory = 'MAO_DE_OBRA' | 'GARANTIA' | 'VISITA_TECNICA' | 'CANCELAMENTO' | 'DESLOCAMENTO'
export type ServiceSearchType = 'ELETRICOS' | 'AMBOS' | 'ALVENARIA' | 'HIDRAULICO' | 'HIDRO' | 'OUTROS'
export type ServiceOrderStatus = 'ABERTA' | 'ENCAMINHADA' | 'AGENDADA' | 'EM_ATENDIMENTO' | 'FINALIZADA' | 'CANCELADA'
export type ServiceOrderOrigin = 'A' | 'C'
export type InvoiceStatus =
  | 'RASCUNHO'
  | 'PRONTA'
  | 'REVISAR'
  | 'ENVIANDO'
  | 'EMITIDA'
  | 'REJEITADA'
  | 'CONSULTA_PENDENTE'
  | 'CANCELAMENTO_SOLICITADO'
  | 'CANCELADA'
  | 'SUBSTITUIDA'
export type NfseEnvironment = 'RESTRITO' | 'PRODUCAO'
export type PaymentDocumentStatus = 'PENDENTE' | 'PRONTO' | 'REGISTRADO' | 'EMITIDO' | 'ENVIADO' | 'REVISAR'
export type UserRole = 'ADMINISTRADOR' | 'OPERACAO' | 'FINANCEIRO'
export type UserStatus = 'ATIVO' | 'INATIVO'
export type ClientListSortBy = 'NAME' | 'SERVICE_ORDER_COUNT' | 'TOTAL_VALUE'
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
  contractMinimumMinutes: number | null
  oneOffMinimumMinutes: number | null
  minimumContractMonths: number | null
  serviceWarrantyDays: number | null
  annualAdjustmentMonth: number | null
  primaryDueDay: number | null
  secondaryDueDay: number | null
  contractRules: string | null
  oneOffRules: string | null
  minimumTermEmailSubject: string | null
  minimumTermEmailBody: string | null
  serviceAdjustmentEnabled?: boolean
  serviceAdjustmentPercentage?: number | null
  serviceAdjustmentDate?: ISODate | null
  serviceAdjustmentAppliedAt?: ISODateTime | null
  serviceAdjustmentAppliedDate?: ISODate | null
  serviceAdjustmentAffectedServices?: number | null
}

export type SystemParametersPayload = SystemParameters

export interface ServicePriceAdjustmentPayload {
  enabled: boolean
  percentage: number | null
  scheduledDate: ISODate | null
}

export interface ClientEmailDraft {
  clientId: number
  clientName: string
  legalName: string | null
  tradeName: string | null
  recipient: string
  subject: string
  body: string
  contractId: number | null
  contractDate: ISODate | null
  minimumTermDate: ISODate | null
  minimumTermCompleted: boolean
}

export interface ClientEmailPayload {
  clientId: number
  subject: string
  body: string
}

export interface AttendanceLocation {
  id: number
  contractId: number
  clientId: number
  description: string
  address: string
  complement: string | null
  district: string | null
  city: string | null
  zipCode: string | null
  contactName: string | null
  referencePoint: string | null
  bank1: string | null
  agency1: string | null
  account1: string | null
  bank2: string | null
  agency2: string | null
  account2: string | null
  paymentMethod: string | null
  paymentCondition: string | null
  spreadDescription: string | null
  spreadValue: number | null
  spreadGroup: string | null
  contactPhone: string | null
  cnpj: string | null
  username: string | null
  requester: string | null
  registeredAt: ISODateTime | null
}

export type AttendanceLocationPayload = Omit<AttendanceLocation, 'id' | 'registeredAt'>

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
  serviceOrderCount: number
  totalValue: number
}

export interface ClientSearchOption {
  id: number
  legalName: string | null
  tradeName: string | null
  document: string | null
  street: string | null
  complement: string | null
  district: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  hasContract: boolean
  contractId: number | null
}

export interface ClientStatisticsResponse {
  total: number
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

export type ClientPayload = Partial<Omit<Client, 'id' | 'name' | 'document' | 'kind' | 'email' | 'phone' | 'city' | 'address' | 'contract' | 'addresses'>> & {
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
  extraValue?: number | null
  oneOffValue?: number | null
}

export type ServiceCatalogPayload = Omit<ServiceCatalogItem, 'id' | 'defaultValue'>

export interface Material {
  id: number
  description: string | null
  unit: string | null
  minimumStock: number | null
  currentStock: number | null
  unitValue: number | null
  brand: string | null
  supplierId: number | null
  supplierTradeName: string | null
  supplierLegalName: string | null
}

export type MaterialPayload = Omit<Material, 'id' | 'supplierTradeName' | 'supplierLegalName'>

export interface Employee {
  id: number
  name: string
  nickname: string | null
  hiredAt: ISODateTime | null
  position: string | null
  address: string | null
  complement: string | null
  district: string | null
  city: string | null
  state: string | null
  phone: string | null
  secondaryPhone: string | null
  cpf: string | null
  rg: string | null
  commissionPercentage: number | null
  birthDate: ISODateTime | null
  notes: string | null
  terminatedAt: ISODateTime | null
  driverLicense: string | null
  tertiaryPhone: string | null
  zipCode: string | null
  email: string | null
  active: boolean
}

export type EmployeePayload = Omit<Employee, 'id'>

export interface Supplier {
  id: number
  type?: string | null
  registeredAt?: ISODateTime | null
  tradeName: string | null
  legalName: string | null
  document: string | null
  cnpj?: string | null
  cpf?: string | null
  address: string | null
  complement?: string | null
  district?: string | null
  city: string | null
  state: string | null
  zipCode?: string | null
  phone: string | null
  contactName: string | null
  contactPhone: string | null
  contactEmail: string | null
}

export type SupplierPayload = Omit<Supplier, 'id' | 'registeredAt' | 'document'>

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

export interface ClientContractContext {
  hasContract: boolean
  contract: Contract | null
  balance: ContractTimeBalance | null
}

export interface ContractTimeBalance {
  contractId: number
  clientId: number
  year: number
  month: number
  unit: string
  contracted: string
  used: string
  balance: string
  contractedMinutes: number
  usedMinutes: number
  balanceMinutes: number
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
  employeeName?: string | null
  employeeNickname?: string | null
  employeePosition?: string | null
  employeePhone?: string | null
  roleId?: number | null
  serviceId?: number | null
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
  extraValue?: number | null
  oneOffValue?: number | null
}

export interface ServiceOrderTracking {
  id: number
  serviceOrderId: number
  scheduleId: number | null
  serviceId: number | null
  employeeId: number | null
  employeeName: string
  serviceDescription: string
  startedAt: ISODateTime | null
  endedAt: ISODateTime | null
  startTime: string | null
  endTime: string | null
  duration: string | null
  running: boolean
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
  origin: ServiceOrderOrigin
  attendanceLocationId: number | null
  completedAttendances: number
  serviceAddress: string | null
  referencePoint: string | null
  orderNotes: string | null
  clientNotes: string | null
  searchTarget: string | null
  scheduledTime: boolean
  scheduledAt: ISODateTime | null
  scheduledStart: string | null
  scheduledEnd: string | null
  forecastAt: ISODateTime | null
  forecastStart: string | null
  forecastEnd: string | null
  professionalNames: string[]
  routed: boolean
  started: boolean
  finished: boolean
  tracking?: ServiceOrderTracking | null
  serviceDescriptions: string[]
}

export interface ServiceOrder {
  id: number
  code: string | null
  idclien: number | null
  idcontr?: number | null
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
  procurarpor?: string | null
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
  trackingDetails?: ServiceOrderTracking[] | null
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
  clientId: number | null
  clientName: string | null
  clientTradeName: string | null
  document: string | null
  competence: string | null
  amount: number
  tax: number
  issRate: number | null
  issRetained: boolean
  issTaxation: '1' | '2' | '3' | '4'
  issImmunityType: '1' | '2' | '3' | '4' | '5' | null
  status: InvoiceStatus
  issuedAt: ISODate | null
  nature: string | null
  address: string | null
  notes: string | null
  laborAmount: number
  materialAmount: number
  environment: NfseEnvironment | null
  layoutVersion: string | null
  dpsSeries: string | null
  dpsNumber: number | null
  dpsId: string | null
  accessKey: string | null
  serviceCityCode: string | null
  customerCityCode: string | null
  customerDocument: string | null
  customerNameSnapshot: string | null
  customerMunicipalRegistration: string | null
  customerZipCode: string | null
  customerStreet: string | null
  customerNumber: string | null
  customerComplement: string | null
  customerDistrict: string | null
  customerCity: string | null
  customerState: string | null
  customerPhone: string | null
  customerEmail: string | null
  issuerCnae: string | null
  nationalServiceCode: string | null
  municipalServiceCode: string | null
  nbsCode: string | null
  serviceDescription: string | null
  workIdentificationType: 'CNO_CEI' | 'CIB' | 'ADDRESS' | 'FOREIGN_ADDRESS' | null
  workPropertyRegistration: string | null
  workCode: string | null
  workCib: string | null
  workZipCode: string | null
  workStreet: string | null
  workNumber: string | null
  workComplement: string | null
  workDistrict: string | null
  workForeignPostalCode: string | null
  workForeignCity: string | null
  workForeignRegion: string | null
  technicalResponsibilityDocument: string | null
  referenceDocument: string | null
  unconditionalDiscount: number
  conditionalDiscount: number
  deductionValue: number
  pisCofinsCst: string | null
  pisCofinsWithholdingType: string | null
  pisCofinsBase: number
  pisValue: number
  cofinsValue: number
  retainedInss: number
  retainedIrrf: number
  retainedCsll: number
  approximateSimpleNationalTaxRate: number | null
  approximateFederalTaxRate: number | null
  approximateStateTaxRate: number | null
  approximateMunicipalTaxRate: number | null
  errorCode: string | null
  errorMessage: string | null
  attempts: number
  integrationManaged: boolean
  xmlAvailable: boolean
  danfseAvailable: boolean
  sentAt: ISODateTime | null
  nationalIssuedAt: ISODateTime | null
  cancelledAt: ISODateTime | null
  replacedAccessKey: string | null
  replacementReasonCode: string | null
  replacementReason: string | null
  ibsCbsApplicable: boolean
  ibsCbsFinalConsumer: string | null
  ibsCbsOperationIndicator: string | null
  ibsCbsDestinationIndicator: string | null
  ibsCbsCst: string | null
  ibsCbsTaxClassification: string | null
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

export interface InvoicePayload {
  clientId?: number | null
  serviceOrderId?: number | null
  contractId?: number | null
  competence?: string
  amount?: number
  tax?: number | null
  unconditionalDiscount?: number
  deductionValue?: number
  issRate?: number
  issRetained?: boolean
  issTaxation?: '1' | '2' | '3' | '4'
  issImmunityType?: '1' | '2' | '3' | '4' | '5' | ''
  serviceCityCode?: string
  customerCityCode?: string
  customerDocument?: string
  customerName?: string
  customerMunicipalRegistration?: string
  customerZipCode?: string
  customerStreet?: string
  customerNumber?: string
  customerComplement?: string
  customerDistrict?: string
  customerCity?: string
  customerState?: string
  customerPhone?: string
  customerEmail?: string
  issuerCnae?: string
  nationalServiceCode?: string
  municipalServiceCode?: string
  nbsCode?: string
  serviceDescription?: string
  workIdentificationType?: 'CNO_CEI' | 'CIB' | 'ADDRESS' | 'FOREIGN_ADDRESS' | ''
  workPropertyRegistration?: string
  workCode?: string
  workCib?: string
  workZipCode?: string
  workStreet?: string
  workNumber?: string
  workComplement?: string
  workDistrict?: string
  workForeignPostalCode?: string
  workForeignCity?: string
  workForeignRegion?: string
  technicalResponsibilityDocument?: string
  referenceDocument?: string
  nature?: string
  notes?: string
  laborAmount?: number
  materialAmount?: number
  conditionalDiscount?: number
  pisCofinsCst?: string
  pisCofinsWithholdingType?: string
  pisCofinsBase?: number
  pisValue?: number
  cofinsValue?: number
  retainedInss?: number
  retainedIrrf?: number
  retainedCsll?: number
  approximateSimpleNationalTaxRate?: number
  approximateFederalTaxRate?: number
  approximateStateTaxRate?: number
  approximateMunicipalTaxRate?: number
  status?: InvoiceStatus
  replacedAccessKey?: string
  replacementReasonCode?: string
  replacementReason?: string
  ibsCbsApplicable?: boolean
  ibsCbsFinalConsumer?: string
  ibsCbsOperationIndicator?: string
  ibsCbsDestinationIndicator?: string
  ibsCbsCst?: string
  ibsCbsTaxClassification?: string
  clientName?: string
  document?: string
  issuedAt?: ISODate
  number?: string | null
  nrnotaf?: string | null
  nmrazao?: string | null
  nrcnpj?: string | null
  dsmespr?: string | null
  dtemiss?: ISODateTime | null
  vltotal?: number | null
  vlissqn?: number | null
  vlaliqu?: number | null
  vlmao?: number | null
  vlmater?: number | null
  dsnatur?: string | null
  dsender?: string | null
  dsobser?: string | null
}

export interface NfseIntegrationStatus {
  enabled: boolean
  configured: boolean
  ready: boolean
  environment: NfseEnvironment
  layoutVersion: string
  danfseConfigured: boolean
  issuerMunicipalRegistrationSent: boolean
  simpleNationalOption: number | null
  simpleNationalCalculationRegime: number | null
  specialTaxRegime: number | null
  municipalAgreementActive: boolean
  missingConfiguration: string[]
}

export interface CompanyCnae {
  id: number
  municipalActivityCode: string
  cnaeCode: string
  description: string
}

export interface CompanyNationalTaxCode {
  id: number
  code: string
  description: string
}

export interface FiscalNationalTaxCode {
  code: string
  description: string
}

export interface FiscalNbsCode {
  code: string
  formattedCode: string
  description: string
}

export interface FiscalCatalog {
  source: string
  sourceVersion: string
  nationalTaxCodes: FiscalNationalTaxCode[]
  nbsCodes: FiscalNbsCode[]
}

export interface MunicipalTaxCode {
  cityCode: string
  nationalTaxCode: string
  municipalTaxCode: string
  fullCode: string
  description: string
  validFrom: ISODate | null
  validUntil: ISODate | null
  source: string
}

export interface ServiceIncidence {
  hasIssIncidence: boolean
  workActivity: boolean
  eventActivity: boolean
  export: boolean
  customerRequired: boolean
  municipalityCode: string
  municipalityName: string
  agreementActive: boolean
  municipalTaxCodes: MunicipalTaxCode[]
  message: string | null
}

export interface PublicClientSignupPayload {
  kind: ClientKind
  nmrazao: string
  nmfanta: string
  nrcnpj: string
  nrcpf: string
  dsinscr: string
  dtanive: string
  nrtele1: string
  nrtele2: string
  nrfax: string
  dsemail: string
  dsindic: string
  nmcont1: string
  nrtelc1: string
  nmcont2: string
  nrtelc2: string
  nmcont3: string
  nrtelc3: string
  nmcont4: string
  nrtelc4: string
  dsender: string
  dscompl: string
  dsbairr: string
  dscidad: string
  dsestad: string
  nrcep: string
  dsponto: string
  flaudit: string
  fliss: string
  flenvioboleto: string
  flenvioextrato: string
  dsobser: string
}

export interface PublicClientSignupResponse {
  message: string
}

export interface IssuerCompanyProfile {
  id: number
  legalName: string
  tradeName: string
  cnpj: string
  municipalRegistration: string
  activityStartDate: ISODate | null
  primaryActivityCode: string
  primaryCnae: string
  primaryActivityDescription: string
  legalNatureCode: string | null
  legalNatureDescription: string | null
  establishmentType: string | null
  street: string | null
  number: string | null
  complement: string | null
  district: string | null
  zipCode: string | null
  city: string | null
  state: string | null
  cityCode: string | null
  registrationStatus: string | null
  taxationRegime: string | null
  taxSubstitute: boolean
  simei: boolean
  simpleNational: boolean
  simpleNationalOptionDate: ISODate | null
  sefinRegistrationDate: ISODate | null
  secondaryCnaes: CompanyCnae[]
  nationalTaxCodes: CompanyNationalTaxCode[]
}

export interface NfseCancelPayload {
  reasonCode: '1' | '2' | '9'
  reason: string
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
  message?: string
  fields?: Record<string, string>
}
