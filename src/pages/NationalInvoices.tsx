import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CloudCog,
  Download,
  Edit3,
  FileCheck2,
  FileCode2,
  FilePlus2,
  MapPin,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { enumLabel, formatDate, money, toDateInput } from '../lib/format'
import type {
  Client,
  ClientSearchOption,
  Invoice,
  InvoicePayload,
  InvoiceStatus,
  IssuerCompanyProfile,
  NfseCancelPayload,
} from '../types'
import {
  Badge,
  Button,
  ConfirmDialog,
  DetailModal,
  EmptyState,
  ErrorState,
  FormError,
  FormField,
  LoadingState,
  Modal,
  ModalForm,
  PageHeader,
  StatCard,
  Toast,
} from '../components/ui'

type InvoiceTab = 'Pendentes' | 'Emitidas' | 'Canceladas' | 'Todas'
type ToastState = { message: string; variant: 'success' | 'error' } | null

const editableStatuses: InvoiceStatus[] = ['RASCUNHO', 'PRONTA', 'REVISAR', 'REJEITADA']
const issuableStatuses: InvoiceStatus[] = ['PRONTA', 'REJEITADA']
const pendingStatuses: InvoiceStatus[] = [
  'RASCUNHO',
  'PRONTA',
  'REVISAR',
  'ENVIANDO',
  'REJEITADA',
  'CONSULTA_PENDENTE',
  'CANCELAMENTO_SOLICITADO',
]

function invoiceCode(invoice: Invoice) {
  if (invoice.number) return `NFS-e ${invoice.number}`
  if (invoice.dpsNumber) return `DPS ${invoice.dpsSeries || ''}/${invoice.dpsNumber}`
  return `Rascunho #${invoice.id}`
}

function statusTone(status: InvoiceStatus): 'green' | 'orange' | 'red' | 'blue' | 'neutral' | 'purple' {
  if (status === 'EMITIDA') return 'green'
  if (status === 'CANCELADA' || status === 'REJEITADA') return 'red'
  if (status === 'PRONTA') return 'blue'
  if (status === 'SUBSTITUIDA') return 'purple'
  if (status === 'RASCUNHO') return 'neutral'
  return 'orange'
}

function matchesTab(invoice: Invoice, tab: InvoiceTab) {
  if (tab === 'Todas') return true
  if (tab === 'Emitidas') return invoice.status === 'EMITIDA' || invoice.status === 'SUBSTITUIDA'
  if (tab === 'Canceladas') return invoice.status === 'CANCELADA'
  return pendingStatuses.includes(invoice.status)
}

function clientDisplay(client: ClientSearchOption) {
  return client.tradeName || client.legalName || `Cliente #${client.id}`
}

function clientAddress(client: ClientSearchOption) {
  return [client.street, client.complement, client.district, client.city, client.state, client.zipCode]
    .filter(Boolean)
    .join(' · ')
}

function currencyInputValue(value: FormDataEntryValue | null) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits ? Number(digits) / 100 : 0
}

function invoiceClient(invoice: Invoice): ClientSearchOption | null {
  if (!invoice.clientId) return null
  return {
    id: invoice.clientId,
    legalName: invoice.clientName,
    tradeName: invoice.clientTradeName,
    document: invoice.document,
    street: invoice.address,
    complement: null,
    district: null,
    city: null,
    state: null,
    zipCode: null,
    hasContract: false,
    contractId: null,
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function NationalInvoices() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<InvoiceTab>('Pendentes')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [formInvoice, setFormInvoice] = useState<Invoice | null | undefined>(undefined)
  const [selectedClient, setSelectedClient] = useState<ClientSearchOption | null>(null)
  const [customerCityCode, setCustomerCityCode] = useState('')
  const [clientPickerOpen, setClientPickerOpen] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [detail, setDetail] = useState<Invoice | null>(null)
  const [toDelete, setToDelete] = useState<Invoice | null>(null)
  const [toCancel, setToCancel] = useState<Invoice | null>(null)
  const [emitModal, setEmitModal] = useState(false)
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState<ToastState>(null)
  const debouncedSearch = useDebouncedValue(search.trim())
  const debouncedClientSearch = useDebouncedValue(clientSearch.trim())
  const clientSearchReady = debouncedClientSearch.length >= 2 || /^\d+$/.test(debouncedClientSearch)

  const invoicesQuery = useQuery({
    queryKey: [...queryKeys.invoices, debouncedSearch, page, pageSize],
    queryFn: () => api.invoices.list({ query: debouncedSearch || undefined, page, size: pageSize }),
  })
  const integrationQuery = useQuery({
    queryKey: [...queryKeys.invoices, 'integration-status'],
    queryFn: api.invoices.integrationStatus,
  })
  const companyProfileQuery = useQuery({
    queryKey: queryKeys.companyProfile,
    queryFn: api.companyProfile.find,
  })
  const clientOptionsQuery = useQuery({
    queryKey: [...queryKeys.clients, 'search', debouncedClientSearch],
    queryFn: () => api.clients.search(debouncedClientSearch),
    enabled: clientPickerOpen && clientSearchReady,
  })
  const selectedClientDetailsQuery = useQuery({
    queryKey: [...queryKeys.clients, 'invoice-details', selectedClient?.id],
    queryFn: () => api.clients.find(selectedClient!.id),
    enabled: Boolean(selectedClient?.id),
  })

  useEffect(() => {
    if (customerCityCode || !selectedClient) return
    const zipCode = (selectedClientDetailsQuery.data?.nrcep || selectedClient.zipCode || '').replace(/\D/g, '')
    if (zipCode.length !== 8) return
    let active = true
    api.addresses.findByCep(zipCode)
      .then((address) => {
        if (active && address.ibge) setCustomerCityCode(address.ibge)
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [customerCityCode, selectedClient, selectedClientDetailsQuery.data])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.invoices })
  const showToast = (message: string, variant: 'success' | 'error' = 'success') => {
    setToast({ message, variant })
    window.setTimeout(() => setToast(null), 4500)
  }

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: InvoicePayload }) => id
      ? api.invoices.update(id, payload)
      : api.invoices.create(payload),
    onSuccess: async (_, variables) => {
      await invalidate()
      setFormInvoice(undefined)
      setSelectedClient(null)
      setCustomerCityCode('')
      setDetail(null)
      showToast(variables.id ? 'Documento fiscal atualizado.' : 'Documento fiscal cadastrado.')
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })

  const issueMutation = useMutation({
    mutationFn: (ids: number[]) => api.invoices.issueBatch(ids),
    onSuccess: async (documents) => {
      await invalidate()
      setEmitModal(false)
      setSelectedIds([])
      const emitted = documents.filter((item) => item.status === 'EMITIDA')
      const notEmitted = documents.filter((item) => item.status !== 'EMITIDA')
      if (notEmitted.length) {
        const firstError = notEmitted.find((item) => item.errorMessage)?.errorMessage
        showToast(firstError || `${notEmitted.length} documento(s) não foram autorizados. Consulte os detalhes.`, 'error')
      } else {
        showToast(`${emitted.length} ${emitted.length === 1 ? 'NFS-e emitida' : 'NFS-e emitidas'} com sucesso.`)
      }
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.invoices.remove(id),
    onSuccess: async () => {
      await invalidate()
      setToDelete(null)
      setFormInvoice(undefined)
      setDetail(null)
      showToast('Documento fiscal removido.')
    },
    onError: (error) => {
      setToDelete(null)
      showToast(apiErrorMessage(error), 'error')
    },
  })

  const reconcileMutation = useMutation({
    mutationFn: (id: number) => api.invoices.reconcile(id),
    onSuccess: async (invoice) => {
      await invalidate()
      setDetail(invoice)
      showToast(invoice.status === 'EMITIDA' ? 'NFS-e localizada e atualizada.' : 'Consulta concluída; situação fiscal atualizada.')
    },
    onError: (error) => showToast(apiErrorMessage(error), 'error'),
  })

  const cancelMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: NfseCancelPayload }) => api.invoices.cancel(id, payload),
    onSuccess: async (invoice) => {
      await invalidate()
      setToCancel(null)
      setDetail(invoice)
      showToast(invoice.status === 'CANCELADA' ? 'NFS-e cancelada com sucesso.' : 'Pedido de cancelamento enviado.')
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })

  const downloadMutation = useMutation({
    mutationFn: async ({ invoice, kind }: { invoice: Invoice; kind: 'xml' | 'pdf' | 'danfse' }) => ({
      invoice,
      kind,
      blob: kind === 'xml' ? await api.invoices.xml(invoice.id) : kind === 'danfse' ? await api.invoices.danfse(invoice.id) : await api.invoices.pdf(invoice.id),
    }),
    onSuccess: ({ invoice, kind, blob }) => downloadBlob(blob, `${kind === 'xml' ? 'nfse' : kind === 'danfse' ? 'danfse' : 'nota-fiscal'}-${invoice.number || invoice.id}.${kind === 'xml' ? 'xml' : 'pdf'}`),
    onError: (error) => showToast(apiErrorMessage(error), 'error'),
  })

  const invoices = invoicesQuery.data?.content ?? []
  const filtered = useMemo(() => invoices.filter((invoice) => matchesTab(invoice, tab)), [invoices, tab])
  const issuable = filtered.filter((invoice) => issuableStatuses.includes(invoice.status))
  const selectedForIssue = invoices.filter((invoice) => selectedIds.includes(invoice.id) && issuableStatuses.includes(invoice.status))
  const totalAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)

  function openNew() {
    setFormError('')
    setSelectedClient(null)
    setCustomerCityCode('')
    setFormInvoice(null)
  }

  function openEdit(invoice: Invoice) {
    setFormError('')
    setSelectedClient(invoiceClient(invoice))
    setCustomerCityCode(invoice.customerCityCode || '')
    setDetail(null)
    setFormInvoice(invoice)
  }

  function openClientPicker() {
    setClientSearch('')
    setClientPickerOpen(true)
  }

  function selectClient(client: ClientSearchOption) {
    setSelectedClient(client)
    setCustomerCityCode('')
    setClientPickerOpen(false)
    setClientSearch('')
  }

  function toggleAll() {
    const allSelected = issuable.length > 0 && issuable.every((invoice) => selectedIds.includes(invoice.id))
    setSelectedIds(allSelected ? [] : issuable.map((invoice) => invoice.id))
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    if (!selectedClient) {
      setFormError('Pesquise e selecione o cliente da nota fiscal.')
      return
    }
    const data = new FormData(event.currentTarget)
    const payload: InvoicePayload = {
      clientId: selectedClient.id,
      competence: String(data.get('competence')),
      amount: currencyInputValue(data.get('amount')),
      unconditionalDiscount: Number(data.get('unconditionalDiscount') || 0),
      deductionValue: Number(data.get('deductionValue') || 0),
      issRate: Number(data.get('issRate') || 0),
      issRetained: data.get('issRetained') === 'true',
      serviceCityCode: String(data.get('serviceCityCode')).trim(),
      customerCityCode: String(data.get('customerCityCode')).trim(),
      customerDocument: String(data.get('customerDocument') || '').trim(),
      customerName: String(data.get('customerName') || '').trim(),
      customerMunicipalRegistration: String(data.get('customerMunicipalRegistration') || '').trim(),
      customerZipCode: String(data.get('customerZipCode') || '').trim(),
      customerStreet: String(data.get('customerStreet') || '').trim(),
      customerNumber: String(data.get('customerNumber') || '').trim(),
      customerComplement: String(data.get('customerComplement') || '').trim(),
      customerDistrict: String(data.get('customerDistrict') || '').trim(),
      customerCity: String(data.get('customerCity') || '').trim(),
      customerState: String(data.get('customerState') || '').trim(),
      customerPhone: String(data.get('customerPhone') || '').trim(),
      customerEmail: String(data.get('customerEmail') || '').trim(),
      issuerCnae: String(data.get('issuerCnae')).trim(),
      nationalServiceCode: String(data.get('nationalServiceCode')).trim(),
      municipalServiceCode: String(data.get('municipalServiceCode')).trim(),
      nbsCode: String(data.get('nbsCode')).trim(),
      serviceDescription: String(data.get('serviceDescription')).trim(),
      nature: String(data.get('nature')).trim(),
      notes: String(data.get('notes')).trim(),
      laborAmount: Number(data.get('laborAmount') || 0),
      materialAmount: Number(data.get('materialAmount') || 0),
      conditionalDiscount: Number(data.get('conditionalDiscount') || 0),
      pisCofinsCst: String(data.get('pisCofinsCst')).trim(),
      pisCofinsWithholdingType: String(data.get('pisCofinsWithholdingType')).trim(),
      pisCofinsBase: Number(data.get('pisCofinsBase') || 0),
      pisValue: Number(data.get('pisValue') || 0),
      cofinsValue: Number(data.get('cofinsValue') || 0),
      retainedInss: Number(data.get('retainedInss') || 0),
      retainedIrrf: Number(data.get('retainedIrrf') || 0),
      retainedCsll: Number(data.get('retainedCsll') || 0),
      status: String(data.get('status')) as InvoiceStatus,
      replacedAccessKey: String(data.get('replacedAccessKey')).trim(),
      replacementReasonCode: String(data.get('replacementReasonCode')).trim(),
      replacementReason: String(data.get('replacementReason')).trim(),
      ibsCbsApplicable: data.get('ibsCbsApplicable') === 'true',
      ibsCbsFinalConsumer: String(data.get('ibsCbsFinalConsumer')).trim(),
      ibsCbsOperationIndicator: String(data.get('ibsCbsOperationIndicator')).trim(),
      ibsCbsDestinationIndicator: String(data.get('ibsCbsDestinationIndicator')).trim(),
      ibsCbsCst: String(data.get('ibsCbsCst')).trim(),
      ibsCbsTaxClassification: String(data.get('ibsCbsTaxClassification')).trim(),
    }
    saveMutation.mutate({ id: formInvoice?.id, payload })
  }

  function submitCancellation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!toCancel) return
    setFormError('')
    const data = new FormData(event.currentTarget)
    cancelMutation.mutate({
      id: toCancel.id,
      payload: {
        reasonCode: String(data.get('reasonCode')) as NfseCancelPayload['reasonCode'],
        reason: String(data.get('reason')).trim(),
      },
    })
  }

  const integration = integrationQuery.data
  const companyProfile = companyProfileQuery.data
  const integrationLabel = integration?.environment === 'PRODUCAO' ? 'Produção' : 'Produção restrita'

  return (
    <>
      <PageHeader
        eyebrow="Faturamento"
        title="Notas fiscais"
        subtitle="Emissão, consulta e cancelamento integrados ao Emissor Nacional de NFS-e."
        actions={<>
          <Button variant="secondary" icon={<FilePlus2 size={17} />} onClick={openNew}>Nova nota</Button>
          <Button icon={<Send size={17} />} disabled={!selectedForIssue.length || !integration?.ready} onClick={() => { setFormError(''); setEmitModal(true) }}>
            Emitir selecionadas {selectedForIssue.length ? `(${selectedForIssue.length})` : ''}
          </Button>
        </>}
      />

      {!integrationQuery.isLoading && integration && (
        <section className={`nfse-integration-banner ${integration.ready ? 'is-ready' : 'is-warning'}`}>
          <span>{integration.ready ? <ShieldCheck size={22} /> : <CloudCog size={22} />}</span>
          <div>
            <strong>{integration.ready ? `Integração pronta em ${integrationLabel}` : 'Integração nacional aguardando configuração'}</strong>
            <small>
              {integration.ready
                ? `Layout ${integration.layoutVersion}. Certificado digital e comunicação mTLS disponíveis.`
                : integration.enabled
                  ? `Configurações pendentes: ${integration.missingConfiguration.join(', ') || 'verifique o certificado e o emitente'}.`
                  : 'A emissão permanece segura e desativada até NFSE_ENABLED ser habilitado no backend.'}
            </small>
          </div>
          <Badge tone={integration.ready ? 'green' : 'orange'}>{integration.enabled ? integrationLabel : 'Desativada'}</Badge>
        </section>
      )}

      <section className="stats-grid stats-grid--four">
        <StatCard label="Valor na página" value={money(totalAmount)} helper={`${invoices.length} registros carregados`} icon={<CircleDollarSign />} tone="blue" />
        <StatCard label="Prontas para emitir" value={String(invoices.filter((item) => item.status === 'PRONTA').length)} helper="Aguardando autorização" icon={<FileCheck2 />} tone="green" />
        <StatCard label="Com pendência" value={String(invoices.filter((item) => ['REVISAR', 'REJEITADA', 'CONSULTA_PENDENTE'].includes(item.status)).length)} helper="Revisão ou consulta" icon={<AlertTriangle />} tone="orange" />
        <StatCard label="Emitidas" value={String(invoices.filter((item) => item.status === 'EMITIDA').length)} helper="Na página atual" icon={<ReceiptText />} tone="purple" />
      </section>

      <section className="panel data-panel invoice-panel">
        <div className="data-toolbar">
          <div className="segmented-control">
            {(['Pendentes', 'Emitidas', 'Canceladas', 'Todas'] as const).map((item) => (
              <button key={item} className={tab === item ? 'active' : ''} onClick={() => { setTab(item); setSelectedIds([]) }}>{item}</button>
            ))}
          </div>
          <div className="search-box search-box--push"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Buscar cliente, CPF/CNPJ, DPS ou NFS-e..." /></div>
        </div>

        {selectedIds.length > 0 && <div className="selection-bar"><span><Check size={16} />{selectedIds.length} selecionada(s)</span><button onClick={() => setSelectedIds([])}>Limpar seleção</button></div>}

        {invoicesQuery.isLoading ? <LoadingState label="Carregando documentos fiscais..." /> : invoicesQuery.isError ? <ErrorState message={apiErrorMessage(invoicesQuery.error)} onRetry={() => invoicesQuery.refetch()} /> : filtered.length === 0 ? <EmptyState title="Nenhuma nota encontrada" description="Altere os filtros ou cadastre um novo documento fiscal." /> : (
          <div className="table-wrap"><table className="data-table invoice-table"><thead><tr>
            <th className="check-column"><input type="checkbox" checked={issuable.length > 0 && issuable.every((item) => selectedIds.includes(item.id))} onChange={toggleAll} aria-label="Selecionar notas emitíveis" /></th>
            <th>Documento / Cliente</th><th>Competência</th><th>Valor</th><th>ISS</th><th>Situação</th><th />
          </tr></thead><tbody>{filtered.map((invoice) => (
            <tr key={invoice.id} className={selectedIds.includes(invoice.id) ? 'row-selected' : ''} onClick={() => setDetail(invoice)}>
              <td className="check-column" onClick={(event) => event.stopPropagation()}><input type="checkbox" disabled={!issuableStatuses.includes(invoice.status)} checked={selectedIds.includes(invoice.id)} onChange={() => setSelectedIds((ids) => ids.includes(invoice.id) ? ids.filter((id) => id !== invoice.id) : [...ids, invoice.id])} /></td>
              <td><strong>{invoiceCode(invoice)}</strong><small className="table-secondary">{invoice.clientTradeName || invoice.clientName || 'Cliente não informado'} · {invoice.document || 'Sem documento'}</small></td>
              <td>{formatDate(invoice.competence)}<small className="table-secondary">{invoice.environment ? enumLabel(invoice.environment) : 'Registro legado'}</small></td>
              <td><strong>{money(invoice.amount)}</strong></td>
              <td>{invoice.issRetained ? <Badge tone="purple">Retido</Badge> : money(invoice.tax)}</td>
              <td><Badge tone={statusTone(invoice.status)}>{enumLabel(invoice.status)}</Badge>{invoice.errorMessage && <small className="invoice-row-error" title={invoice.errorMessage}>{invoice.errorMessage}</small>}</td>
              <td><button className="row-action" aria-label={`Visualizar ${invoiceCode(invoice)}`}><ChevronRight size={18} /></button></td>
            </tr>
          ))}</tbody></table></div>
        )}
        <footer className="table-footer nfse-pagination">
          <span><strong>{invoicesQuery.data?.total ?? 0}</strong> documentos encontrados</span>
          <div><label>Por página <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}>{[10, 20, 50, 100].map((size) => <option key={size}>{size}</option>)}</select></label><button disabled={page === 0} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16} /></button><span>Página {page + 1} de {Math.max(invoicesQuery.data?.totalPages || 1, 1)}</span><button disabled={page + 1 >= (invoicesQuery.data?.totalPages || 1)} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></button></div>
        </footer>
      </section>

      <DetailModal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? invoiceCode(detail) : 'Documento fiscal'}
        description="Dados da DPS, autorização nacional e histórico operacional do documento."
        size="large"
        actions={detail ? <>
          {editableStatuses.includes(detail.status) && <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setToDelete(detail)}>Excluir</Button>}
          {editableStatuses.includes(detail.status) && <Button variant="secondary" icon={<Edit3 size={16} />} onClick={() => openEdit(detail)}>Editar</Button>}
          {detail.status === 'CONSULTA_PENDENTE' || detail.status === 'CANCELAMENTO_SOLICITADO' ? <Button variant="secondary" icon={<RefreshCw size={16} />} disabled={reconcileMutation.isPending} onClick={() => reconcileMutation.mutate(detail.id)}>Reconciliar</Button> : null}
          {detail.xmlAvailable && <Button variant="secondary" icon={<FileCode2 size={16} />} disabled={downloadMutation.isPending} onClick={() => downloadMutation.mutate({ invoice: detail, kind: 'xml' })}>Baixar XML</Button>}
          <Button variant="secondary" icon={<Download size={16} />} disabled={downloadMutation.isPending} onClick={() => downloadMutation.mutate({ invoice: detail, kind: 'pdf' })}>Baixar PDF</Button>
          {detail.danfseAvailable && <Button variant="secondary" icon={<Download size={16} />} disabled={downloadMutation.isPending} onClick={() => downloadMutation.mutate({ invoice: detail, kind: 'danfse' })}>DANFSe oficial</Button>}
          {detail.status === 'EMITIDA' && <Button variant="danger" icon={<XCircle size={16} />} onClick={() => { setFormError(''); setToCancel(detail) }}>Cancelar NFS-e</Button>}
          {issuableStatuses.includes(detail.status) && <Button icon={<Send size={16} />} disabled={!integration?.ready} onClick={() => { setSelectedIds([detail.id]); setDetail(null); setEmitModal(true) }}>Emitir NFS-e</Button>}
        </> : undefined}
      >
        {detail && <InvoiceDetail invoice={detail} />}
      </DetailModal>

      <Modal open={formInvoice !== undefined} onClose={() => !saveMutation.isPending && setFormInvoice(undefined)} title={formInvoice ? `Editar ${invoiceCode(formInvoice)}` : 'Nova nota fiscal'} description="Prepare e valide a DPS antes do envio ao Emissor Nacional." size="xlarge">
        <ModalForm onSubmit={submit} onCancel={() => setFormInvoice(undefined)} submitting={saveMutation.isPending} submitLabel={saveMutation.isPending ? 'Salvando...' : formInvoice ? 'Salvar alterações' : 'Cadastrar documento'}>
          <FormError message={formError} />
          <section className="nfse-form-section">
            <div className="form-section-title"><span>1</span><div><strong>Dados do prestador</strong><small>Empresa responsável pela emissão da nota fiscal</small></div></div>
            <IssuerCompanySummary profile={companyProfile} loading={companyProfileQuery.isLoading} error={companyProfileQuery.isError} />
          </section>

          <section className="nfse-form-section">
            <div className="form-section-title"><span>2</span><div><strong>Dados do cliente</strong><small>Cliente para quem a nota fiscal será emitida</small></div></div>
            <div className="form-grid form-grid--two">
              <FormField label="Cliente *">
                <button type="button" className="os-client-modal-trigger" onClick={openClientPicker}><Search size={16} /><span><strong>{selectedClient ? clientDisplay(selectedClient) : 'Pesquisar cliente'}</strong><small>{selectedClient ? `Código #${selectedClient.id} · ${selectedClient.document || 'sem CPF/CNPJ'}` : 'Nome fantasia, razão social ou código'}</small></span></button>
              </FormField>
              <FormField label="Município do cliente (IBGE) *" hint="Preenchido pelo CEP; confirme antes de emitir"><input name="customerCityCode" inputMode="numeric" maxLength={7} required value={customerCityCode} onChange={(event) => setCustomerCityCode(event.target.value.replace(/\D/g, '').slice(0, 7))} /></FormField>
            </div>
            {selectedClient && <ClientInvoiceFields key={`${selectedClient.id}-${formInvoice?.id || 'new'}`} client={selectedClientDetailsQuery.data} fallback={selectedClient} invoice={formInvoice} loading={selectedClientDetailsQuery.isLoading} />}
          </section>

          <section className="nfse-form-section">
            <div className="form-section-title"><span>3</span><div><strong>Dados do serviço</strong><small>Tributação, descrição, valores e demais informações do serviço prestado</small></div></div>
            <div className="form-grid form-grid--two">
              <FormField label="Competência *"><input name="competence" type="date" required defaultValue={toDateInput(formInvoice?.competence) || new Date().toISOString().slice(0, 10)} /></FormField>
              <FormField label="Município da prestação (IBGE) *" hint="Fortaleza: 2304400"><input name="serviceCityCode" inputMode="numeric" maxLength={7} required defaultValue={formInvoice?.serviceCityCode || companyProfile?.cityCode || '2304400'} /></FormField>
            </div>
            <div className="nfse-form-subtitle"><strong>Classificação tributária</strong><small>Códigos transmitidos na DPS</small></div>
            <div className="form-grid form-grid--two">
            <FormField label="Atividade do prestador (CNAE) *" hint="Escolha a atividade da Gente Boa relacionada ao serviço">
              <select name="issuerCnae" required defaultValue={formInvoice?.issuerCnae || companyProfile?.primaryCnae || ''} disabled={!companyProfile}>
                <option value="">Selecione o CNAE</option>
                {companyProfile && <option value={companyProfile.primaryCnae}>{companyProfile.primaryCnae} · {companyProfile.primaryActivityDescription} (principal)</option>}
                {(companyProfile?.secondaryCnaes || []).map((item) => <option key={item.id} value={item.cnaeCode}>{item.cnaeCode} · {item.description}</option>)}
              </select>
            </FormField>
            <FormField label="Código nacional de tributação *" hint="Selecione conforme o serviço efetivamente prestado">
              <select name="nationalServiceCode" required defaultValue={formInvoice?.nationalServiceCode || ''} disabled={!companyProfile?.nationalTaxCodes.length}>
                <option value="">Selecione o código nacional</option>
                {(companyProfile?.nationalTaxCodes || []).map((item) => <option key={item.id} value={item.code}>{item.code} · {item.description}</option>)}
              </select>
            </FormField>
            <FormField label="Código municipal" hint="3 dígitos"><input name="municipalServiceCode" inputMode="numeric" maxLength={3} defaultValue={formInvoice?.municipalServiceCode || ''} /></FormField>
            <FormField label="Código NBS"><input name="nbsCode" inputMode="numeric" maxLength={9} defaultValue={formInvoice?.nbsCode || ''} /></FormField>
            </div>
            <FormField label="Discriminação do serviço *"><textarea name="serviceDescription" rows={4} maxLength={2000} required defaultValue={formInvoice?.serviceDescription || ''} /></FormField>
            <div className="form-grid form-grid--two">
            <FormField label="Natureza da operação"><input name="nature" maxLength={100} defaultValue={formInvoice?.nature || ''} /></FormField>
            <FormField label="Observações internas"><textarea name="notes" rows={2} maxLength={2000} defaultValue={formInvoice?.notes || ''} /></FormField>
            </div>

            <details className="nfse-replacement-fields"><summary>Substituição de NFS-e anterior</summary><div className="form-grid form-grid--three"><FormField label="Chave substituída"><input name="replacedAccessKey" maxLength={50} defaultValue={formInvoice?.replacedAccessKey || ''} /></FormField><FormField label="Código do motivo"><input name="replacementReasonCode" maxLength={2} defaultValue={formInvoice?.replacementReasonCode || ''} /></FormField><FormField label="Motivo"><input name="replacementReason" maxLength={255} defaultValue={formInvoice?.replacementReason || ''} /></FormField></div></details>
            <details className="nfse-replacement-fields"><summary>Informações IBS/CBS (leiaute 2026)</summary><div className="form-grid form-grid--three"><FormField label="Informar IBS/CBS"><select name="ibsCbsApplicable" defaultValue={String(formInvoice?.ibsCbsApplicable || false)}><option value="false">Não</option><option value="true">Sim</option></select></FormField><FormField label="Consumidor final"><select name="ibsCbsFinalConsumer" defaultValue={formInvoice?.ibsCbsFinalConsumer || '0'}><option value="0">Não</option><option value="1">Sim</option></select></FormField><FormField label="Destinatário é o tomador"><select name="ibsCbsDestinationIndicator" defaultValue={formInvoice?.ibsCbsDestinationIndicator || '0'}><option value="0">Sim</option><option value="1">Não</option></select></FormField><FormField label="Indicador da operação" hint="6 dígitos do Anexo C"><input name="ibsCbsOperationIndicator" inputMode="numeric" maxLength={6} defaultValue={formInvoice?.ibsCbsOperationIndicator || ''} /></FormField><FormField label="CST IBS/CBS"><input name="ibsCbsCst" inputMode="numeric" maxLength={3} defaultValue={formInvoice?.ibsCbsCst || ''} /></FormField><FormField label="Classificação tributária"><input name="ibsCbsTaxClassification" inputMode="numeric" maxLength={6} defaultValue={formInvoice?.ibsCbsTaxClassification || ''} /></FormField></div></details>
          </section>

          <section className="nfse-form-section">
            <div className="form-section-title"><span>4</span><div><strong>Valores e tributos</strong><small>Valores do serviço, ISS e retenções federais transmitidos na DPS</small></div></div>
            <div className="nfse-form-subtitle"><strong>Valores do serviço</strong><small>Campos com * são obrigatórios</small></div>
            <div className="form-grid form-grid--four">
              <FormField label="Valor do serviço *"><CurrencyInput name="amount" initialValue={formInvoice?.amount || 0} required /></FormField>
              <FormField label="Dedução"><input name="deductionValue" type="number" min="0" step="0.01" defaultValue={formInvoice?.deductionValue || 0} /></FormField>
              <FormField label="Desconto incondicionado"><input name="unconditionalDiscount" type="number" min="0" step="0.01" defaultValue={formInvoice?.unconditionalDiscount || 0} /></FormField>
              <FormField label="Desconto condicionado"><input name="conditionalDiscount" type="number" min="0" step="0.01" defaultValue={formInvoice?.conditionalDiscount || 0} /></FormField>
              <FormField label="Alíquota ISS (%)"><input name="issRate" type="number" min="0" step="0.01" defaultValue={formInvoice?.tax ? (formInvoice.tax / Math.max(formInvoice.amount, 1)) * 100 : 0} /></FormField>
              <FormField label="ISS retido"><select name="issRetained" defaultValue={String(formInvoice?.issRetained || false)}><option value="false">Não</option><option value="true">Sim</option></select></FormField>
              <FormField label="Mão de obra"><input name="laborAmount" type="number" min="0" step="0.01" defaultValue={formInvoice?.laborAmount || 0} /></FormField>
              <FormField label="Materiais"><input name="materialAmount" type="number" min="0" step="0.01" defaultValue={formInvoice?.materialAmount || 0} /></FormField>
            </div>
            <div className="nfse-form-subtitle"><strong>Tributos federais</strong><small>Preencha somente quando aplicável à operação</small></div>
            <div className="form-grid form-grid--four">
              <FormField label="CST PIS/COFINS"><input name="pisCofinsCst" inputMode="numeric" maxLength={2} defaultValue={formInvoice?.pisCofinsCst || ''} /></FormField>
              <FormField label="Tipo de retenção PIS/COFINS"><select name="pisCofinsWithholdingType" defaultValue={formInvoice?.pisCofinsWithholdingType || ''}><option value="">Não informar</option><option value="0">PIS/COFINS/CSLL não retidos</option><option value="1">PIS/COFINS retidos</option><option value="2">PIS/COFINS não retidos</option><option value="3">PIS/COFINS/CSLL retidos</option><option value="4">PIS/COFINS retidos; CSLL não</option><option value="5">Somente PIS retido</option><option value="6">Somente COFINS retido</option><option value="7">COFINS/CSLL retidos</option><option value="8">Somente CSLL retido</option><option value="9">PIS/CSLL retidos</option></select></FormField>
              <FormField label="Base PIS/COFINS"><input name="pisCofinsBase" type="number" min="0" step="0.01" defaultValue={formInvoice?.pisCofinsBase || 0} /></FormField>
              <FormField label="PIS"><input name="pisValue" type="number" min="0" step="0.01" defaultValue={formInvoice?.pisValue || 0} /></FormField>
              <FormField label="COFINS"><input name="cofinsValue" type="number" min="0" step="0.01" defaultValue={formInvoice?.cofinsValue || 0} /></FormField>
              <FormField label="INSS/CP retido"><input name="retainedInss" type="number" min="0" step="0.01" defaultValue={formInvoice?.retainedInss || 0} /></FormField>
              <FormField label="IRRF retido"><input name="retainedIrrf" type="number" min="0" step="0.01" defaultValue={formInvoice?.retainedIrrf || 0} /></FormField>
              <FormField label="CSLL retido"><input name="retainedCsll" type="number" min="0" step="0.01" defaultValue={formInvoice?.retainedCsll || 0} /></FormField>
              <FormField label="Preparação"><select name="status" defaultValue={formInvoice?.status === 'REJEITADA' ? 'REVISAR' : formInvoice?.status || 'RASCUNHO'}><option value="RASCUNHO">Rascunho</option><option value="REVISAR">Revisar</option><option value="PRONTA">Pronta para emitir</option></select></FormField>
            </div>
          </section>
        </ModalForm>
      </Modal>

      <Modal open={clientPickerOpen} onClose={() => setClientPickerOpen(false)} title="Selecionar cliente" description="Busque pelo nome fantasia, razão social ou código." size="large">
        <div className="modal__body employee-picker-modal client-picker-modal">
          <div className="search-box employee-picker-modal__search"><Search size={18} /><input autoFocus value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Digite ao menos 2 letras ou o código..." /></div>
          <div className="employee-picker-modal__results">
            {!clientSearchReady ? <EmptyState title="Pesquise um cliente" description="Informe nome fantasia, razão social ou código." /> : clientOptionsQuery.isLoading ? <LoadingState label="Buscando clientes..." /> : clientOptionsQuery.isError ? <ErrorState message={apiErrorMessage(clientOptionsQuery.error)} onRetry={() => clientOptionsQuery.refetch()} /> : (clientOptionsQuery.data || []).length === 0 ? <EmptyState title="Nenhum cliente encontrado" description="Tente outro nome ou código." /> : (clientOptionsQuery.data || []).map((client) => <button type="button" key={client.id} onClick={() => selectClient(client)}><span className="employee-picker-modal__avatar client-picker-modal__avatar"><Building2 size={19} /></span><span className="employee-picker-modal__identity"><strong>{clientDisplay(client)}</strong><small>{client.legalName || 'Razão social não informada'}</small></span><span className="client-picker-modal__address"><MapPin size={16} /><span><strong>Endereço principal</strong><small>{clientAddress(client) || 'Endereço não informado'}</small></span></span><span className="employee-picker-modal__meta"><strong>Código #{client.id}</strong><small>{client.document || 'CPF/CNPJ não informado'}</small></span></button>)}
          </div>
        </div>
      </Modal>

      <Modal open={emitModal} onClose={() => !issueMutation.isPending && setEmitModal(false)} title="Confirmar emissão nacional" description="Cada DPS será assinada e enviada ao ambiente configurado.">
        <div className="modal__body emission-summary"><FormError message={formError} /><span className="emission-summary__icon"><ShieldCheck size={25} /></span><div><strong>{selectedForIssue.length} documento(s) pronto(s)</strong><small>Valor total de {money(selectedForIssue.reduce((sum, item) => sum + item.amount, 0))}</small></div><ul>{selectedForIssue.map((invoice) => <li key={invoice.id}><span>{invoice.clientTradeName || invoice.clientName}</span><strong>{money(invoice.amount)}</strong></li>)}</ul></div>
        <footer className="modal__footer"><Button variant="secondary" onClick={() => setEmitModal(false)} disabled={issueMutation.isPending}>Voltar</Button><Button icon={<Send size={17} />} disabled={issueMutation.isPending || !integration?.ready} onClick={() => issueMutation.mutate(selectedForIssue.map((item) => item.id))}>{issueMutation.isPending ? 'Transmitindo...' : 'Assinar e emitir'}</Button></footer>
      </Modal>

      <Modal open={Boolean(toCancel)} onClose={() => !cancelMutation.isPending && setToCancel(null)} title="Cancelar NFS-e" description="O pedido será assinado e registrado no Emissor Nacional.">
        <ModalForm onSubmit={submitCancellation} onCancel={() => setToCancel(null)} submitting={cancelMutation.isPending} submitLabel={cancelMutation.isPending ? 'Enviando...' : 'Confirmar cancelamento'}>
          <FormError message={formError} />
          <FormField label="Motivo"><select name="reasonCode" required><option value="1">Erro na emissão</option><option value="2">Serviço não prestado</option><option value="9">Outros</option></select></FormField>
          <FormField label="Justificativa" hint="Mínimo de 15 caracteres"><textarea name="reason" minLength={15} maxLength={255} rows={4} required /></FormField>
        </ModalForm>
      </Modal>

      <ConfirmDialog open={Boolean(toDelete)} title={`Excluir ${toDelete ? invoiceCode(toDelete) : 'este documento'}?`} description="Somente rascunhos e documentos ainda não autorizados podem ser excluídos." confirmLabel="Excluir documento" busy={deleteMutation.isPending} onCancel={() => setToDelete(null)} onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)} />
      {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
    </>
  )
}

function InvoiceDetail({ invoice }: { invoice: Invoice }) {
  return <div className="detail-modal-content">
    <div className="detail-modal__hero-row"><div className="detail-drawer__hero"><span className="detail-avatar"><ReceiptText /></span><div><span>{invoiceCode(invoice)}</span><h2>{invoice.clientTradeName || invoice.clientName || 'Cliente não informado'}</h2><p>{invoice.clientTradeName && invoice.clientName !== invoice.clientTradeName ? invoice.clientName : invoice.document || 'Documento não informado'}</p></div></div><Badge tone={statusTone(invoice.status)}>{enumLabel(invoice.status)}</Badge></div>
    {invoice.errorMessage && <div className="form-error"><AlertTriangle size={16} /><span>{invoice.errorCode ? `${invoice.errorCode}: ` : ''}{invoice.errorMessage}</span></div>}
    <div className="detail-metrics"><span><small>Competência</small><strong>{formatDate(invoice.competence)}</strong></span><span><small>Valor do serviço</small><strong>{money(invoice.amount)}</strong></span><span><small>ISS</small><strong>{money(invoice.tax)}</strong></span><span><small>Tentativas</small><strong>{invoice.attempts || 0}</strong></span></div>
    <div className="detail-sections-grid">
      <section className="drawer-section"><h3>Identificação nacional</h3><dl><div><dt>Número da NFS-e</dt><dd>{invoice.number || 'Ainda não autorizado'}</dd></div><div><dt>Chave de acesso</dt><dd className="nfse-long-value">{invoice.accessKey || 'Não disponível'}</dd></div><div><dt>DPS</dt><dd>{invoice.dpsId || 'Ainda não numerada'}</dd></div><div><dt>Ambiente / layout</dt><dd>{invoice.environment ? `${enumLabel(invoice.environment)} · ${invoice.layoutVersion}` : 'Registro legado'}</dd></div></dl></section>
      <section className="drawer-section"><h3>Tributação do serviço</h3><dl><div><dt>CNAE do prestador</dt><dd>{invoice.issuerCnae || 'Não informado'}</dd></div><div><dt>Código nacional</dt><dd>{invoice.nationalServiceCode || 'Não informado'}</dd></div><div><dt>Código municipal</dt><dd>{invoice.municipalServiceCode || 'Não informado'}</dd></div><div><dt>Município da prestação</dt><dd>{invoice.serviceCityCode || 'Não informado'}</dd></div><div><dt>ISS retido</dt><dd>{invoice.issRetained ? 'Sim' : 'Não'}</dd></div></dl></section>
      {invoice.ibsCbsApplicable && <section className="drawer-section"><h3>IBS/CBS</h3><dl><div><dt>Indicador da operação</dt><dd>{invoice.ibsCbsOperationIndicator}</dd></div><div><dt>CST</dt><dd>{invoice.ibsCbsCst}</dd></div><div><dt>Classificação tributária</dt><dd>{invoice.ibsCbsTaxClassification}</dd></div><div><dt>Consumidor final</dt><dd>{invoice.ibsCbsFinalConsumer === '1' ? 'Sim' : 'Não'}</dd></div></dl></section>}
      <section className="drawer-section drawer-section--wide"><h3>Serviço</h3><p className="drawer-section__text">{invoice.serviceDescription || invoice.notes || 'Descrição não informada.'}</p>{invoice.address && <p className="drawer-section__text detail-text-spaced"><strong>Tomador:</strong> {invoice.address}</p>}</section>
    </div>
  </div>
}

function CurrencyInput({ name, initialValue, required = false }: { name: string; initialValue: number; required?: boolean }) {
  const [value, setValue] = useState(Math.max(0, Number(initialValue) || 0))
  return <input
    name={name}
    type="text"
    inputMode="numeric"
    autoComplete="off"
    required={required}
    value={money(value)}
    onFocus={(event) => event.currentTarget.select()}
    onChange={(event) => {
      const digits = event.target.value.replace(/\D/g, '').slice(0, 17)
      setValue(digits ? Number(digits) / 100 : 0)
    }}
  />
}

function ClientInvoiceFields({ client, fallback, invoice, loading }: { client?: Client; fallback: ClientSearchOption; invoice: Invoice | null | undefined; loading: boolean }) {
  if (loading && !client) return <div className="nfse-customer-card nfse-customer-card--state">Carregando dados fiscais do cliente...</div>
  const legalName = invoice?.customerNameSnapshot || client?.nmrazao || client?.name || fallback.legalName || ''
  const document = invoice?.customerDocument || client?.document || client?.nrcnpj || client?.nrcpf || fallback.document || ''
  return <section className="nfse-customer-card">
    <div className="nfse-customer-card__heading"><strong>Dados que serão enviados para identificar o tomador</strong><small>As alterações abaixo valem somente para esta nota fiscal.</small></div>
    <div className="form-grid form-grid--three">
      <FormField label="CPF/CNPJ *"><input name="customerDocument" inputMode="numeric" maxLength={18} required defaultValue={document} /></FormField>
      <FormField label="Nome / razão social *"><input name="customerName" maxLength={150} required defaultValue={legalName} /></FormField>
      <FormField label="Inscrição municipal"><input name="customerMunicipalRegistration" maxLength={15} defaultValue={invoice?.customerMunicipalRegistration || ''} /></FormField>
      <FormField label="CEP"><input name="customerZipCode" inputMode="numeric" maxLength={9} defaultValue={invoice?.customerZipCode || client?.nrcep || fallback.zipCode || ''} /></FormField>
      <FormField label="Logradouro"><input name="customerStreet" maxLength={255} defaultValue={invoice?.customerStreet || client?.dsender || fallback.street || ''} /></FormField>
      <FormField label="Número"><input name="customerNumber" maxLength={60} defaultValue={invoice?.customerNumber || client?.dscompl || ''} /></FormField>
      <FormField label="Complemento"><input name="customerComplement" maxLength={156} defaultValue={invoice?.customerComplement || fallback.complement || ''} /></FormField>
      <FormField label="Bairro"><input name="customerDistrict" maxLength={60} defaultValue={invoice?.customerDistrict || client?.dsbairr || fallback.district || ''} /></FormField>
      <FormField label="Cidade"><input name="customerCity" maxLength={100} defaultValue={invoice?.customerCity || client?.dscidad || fallback.city || ''} /></FormField>
      <FormField label="UF"><input name="customerState" maxLength={2} defaultValue={invoice?.customerState || client?.dsestad || fallback.state || ''} /></FormField>
      <FormField label="Telefone"><input name="customerPhone" maxLength={20} defaultValue={invoice?.customerPhone || client?.phone || client?.nrtele1 || ''} /></FormField>
      <FormField label="E-mail"><input name="customerEmail" type="email" maxLength={80} defaultValue={invoice?.customerEmail || client?.email || client?.dsemail || ''} /></FormField>
    </div>
  </section>
}

function IssuerCompanySummary({ profile, loading, error }: { profile?: IssuerCompanyProfile; loading: boolean; error: boolean }) {
  if (loading) return <div className="nfse-issuer-card nfse-issuer-card--state">Carregando dados da empresa...</div>
  if (error || !profile) return <div className="nfse-issuer-card nfse-issuer-card--state is-error">Não foi possível carregar os dados da empresa emitente.</div>
  const address = [profile.street, profile.number, profile.complement, profile.district, profile.city, profile.state, profile.zipCode]
    .filter(Boolean)
    .join(' · ')
  return <section className="nfse-issuer-card">
    <div className="nfse-issuer-card__identity"><span><Building2 size={19} /></span><div><strong>{profile.legalName}</strong><small>{profile.tradeName}</small></div></div>
    <dl>
      <div><dt>CNPJ</dt><dd>{profile.cnpj}</dd></div>
      <div><dt>Inscrição municipal</dt><dd>{profile.municipalRegistration}</dd></div>
      <div><dt>Regime</dt><dd>{profile.taxationRegime || 'Não informado'}</dd></div>
      <div><dt>Situação</dt><dd>{profile.registrationStatus || 'Não informada'}</dd></div>
      <div className="nfse-issuer-card__wide"><dt>Endereço</dt><dd>{address}</dd></div>
    </dl>
  </section>
}
