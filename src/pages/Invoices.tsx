import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, CheckCircle2, ChevronRight, CircleDollarSign, Edit3, FileCheck2, FilePlus2, Landmark, Plus, ReceiptText, Search, Send, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { enumLabel, formatDate, money, toDateInput } from '../lib/format'
import type { Invoice, InvoicePayload, InvoiceStatus } from '../types'
import { Badge, Button, ConfirmDialog, DetailModal, EmptyState, ErrorState, FormError, FormField, LoadingState, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'

const steps = [
  { label: 'Fechamento', detail: 'Dados conferidos', icon: CheckCircle2 },
  { label: 'Notas fiscais', detail: 'Etapa atual', icon: ReceiptText },
  { label: 'Boletos', detail: 'Após emissão', icon: Landmark },
  { label: 'Envio', detail: 'Documentos ao cliente', icon: Send },
]

const invoiceCode = (invoice: Invoice) => invoice.number || `NF-${invoice.id}`

function invoicePayload(invoice: Invoice, overrides: Partial<InvoicePayload> = {}): InvoicePayload {
  const issuedAt = overrides.issuedAt ?? invoice.issuedAt ?? toDateInput(invoice.dtemiss)
  const number = overrides.number ?? invoice.number
  const clientName = overrides.clientName ?? invoice.clientName ?? ''
  const document = overrides.document ?? invoice.document ?? ''
  const competence = overrides.competence ?? invoice.competence ?? ''
  const amount = overrides.amount ?? Number(invoice.amount ?? 0)
  const tax = overrides.tax ?? invoice.tax
  return {
    ...invoice,
    ...overrides,
    number,
    nrnotaf: number,
    clientName,
    nmrazao: clientName,
    document,
    nrcnpj: document,
    competence,
    dsmespr: competence,
    amount,
    vltotal: amount,
    tax,
    vlissqn: tax,
    issuedAt,
    dtemiss: `${issuedAt}T00:00:00`,
  }
}

export function Invoices() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'Pendentes' | 'Emitidas' | 'Todas'>('Pendentes')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [emitModal, setEmitModal] = useState(false)
  const [selected, setSelected] = useState<Invoice | null>(null)
  const [detail, setDetail] = useState<Invoice | null>(null)
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null)
  const [toast, setToast] = useState('')
  const [formError, setFormError] = useState('')
  const debouncedSearch = useDebouncedValue(search)

  const invoicesQuery = useQuery({ queryKey: [...queryKeys.invoices, debouncedSearch], queryFn: () => api.invoices.list({ query: debouncedSearch || undefined }) })
  const clientsQuery = useQuery({ queryKey: queryKeys.clients, queryFn: () => api.clients.list() })

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: InvoicePayload }) => id ? api.invoices.update(id, payload) : api.invoices.create(payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices })
      setModalOpen(false)
      setSelected(null)
      setDetail(null)
      showToast(variables.id ? 'Nota fiscal atualizada.' : 'Nota fiscal cadastrada.')
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })

  const emitMutation = useMutation({
    mutationFn: (invoices: Invoice[]) => Promise.all(invoices.map((invoice) => api.invoices.update(invoice.id, invoicePayload(invoice, { status: 'EMITIDA', issuedAt: new Date().toISOString().slice(0, 10) })))),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices })
      setEmitModal(false)
      setSelectedIds([])
      showToast(`${updated.length} ${updated.length === 1 ? 'nota emitida' : 'notas emitidas'} com sucesso.`)
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.invoices.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices })
      setInvoiceToDelete(null)
      setModalOpen(false)
      setSelected(null)
      showToast('Nota fiscal removida.')
    },
    onError: (error) => { setInvoiceToDelete(null); showToast(apiErrorMessage(error)) },
  })

  const invoices = invoicesQuery.data?.content ?? []
  const filtered = useMemo(() => invoices.filter((invoice) => tab === 'Todas' || (tab === 'Emitidas' ? invoice.status === 'EMITIDA' : invoice.status !== 'EMITIDA')), [invoices, tab])
  const readySelected = invoices.filter((invoice) => selectedIds.includes(invoice.id) && invoice.status === 'PRONTA')
  const readyInvoices = filtered.filter((invoice) => invoice.status === 'PRONTA')
  const totalAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0)

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3300)
  }

  function openNew() {
    setSelected(null)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(invoice: Invoice) {
    setDetail(null)
    setSelected(invoice)
    setFormError('')
    setModalOpen(true)
  }

  function toggleAll() {
    setSelectedIds(readyInvoices.length > 0 && readyInvoices.every((invoice) => selectedIds.includes(invoice.id)) ? [] : readyInvoices.map((invoice) => invoice.id))
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const data = new FormData(event.currentTarget)
    const number = String(data.get('number')).trim() || null
    const clientName = String(data.get('clientName')).trim()
    const document = String(data.get('document')).trim()
    const competence = String(data.get('competence')).trim()
    const issuedAt = String(data.get('issuedAt'))
    const amount = Number(data.get('amount') || 0)
    const tax = Number(data.get('tax') || 0)
    const payload: InvoicePayload = {
      ...(selected ? invoicePayload(selected) : {} as InvoicePayload),
      number,
      nrnotaf: number,
      clientName,
      nmrazao: clientName,
      document,
      nrcnpj: document,
      competence,
      dsmespr: competence,
      issuedAt,
      dtemiss: `${issuedAt}T00:00:00`,
      amount,
      vltotal: amount,
      tax,
      vlissqn: tax,
      vlaliqu: Number(data.get('taxRate') || 0),
      vlmao: Number(data.get('laborAmount') || 0),
      vlmater: Number(data.get('materialAmount') || 0),
      dsnatur: String(data.get('nature')).trim(),
      dsender: String(data.get('address')).trim(),
      dsobser: String(data.get('notes')).trim(),
      issRetained: data.get('issRetained') === 'true',
      status: String(data.get('status')) as InvoiceStatus,
    }
    saveMutation.mutate({ id: selected?.id, payload })
  }

  return (
    <>
      <PageHeader eyebrow="Faturamento" title="Notas fiscais" subtitle="Cadastro e acompanhamento fiscal com dados da API." actions={<><Button variant="secondary" icon={<FilePlus2 size={17} />} onClick={openNew}>Nova nota</Button><Button icon={<ReceiptText size={18} />} disabled={!readySelected.length} onClick={() => { setFormError(''); setEmitModal(true) }}>Emitir selecionadas {readySelected.length ? `(${readySelected.length})` : ''}</Button></>} />

      <section className="billing-steps">{steps.map(({ label, detail, icon: Icon }, index) => <div key={label} className={`billing-step ${index === 1 ? 'billing-step--active' : index === 0 ? 'billing-step--done' : ''}`}><span><Icon size={19} /></span><div><strong>{label}</strong><small>{detail}</small></div>{index < steps.length - 1 && <ChevronRight size={17} />}</div>)}</section>
      <section className="stats-grid stats-grid--four">
        <StatCard label="Valor total" value={money(totalAmount)} helper={`${invoicesQuery.data?.total ?? 0} registros`} icon={<CircleDollarSign />} tone="blue" />
        <StatCard label="Prontas para emitir" value={String(invoices.filter((invoice) => invoice.status === 'PRONTA').length)} helper="Disponíveis para seleção" icon={<FileCheck2 />} tone="green" />
        <StatCard label="Aguardam revisão" value={String(invoices.filter((invoice) => invoice.status === 'REVISAR').length)} helper="Dados fiscais pendentes" icon={<TriangleAlert />} tone="orange" />
        <StatCard label="Emitidas" value={String(invoices.filter((invoice) => invoice.status === 'EMITIDA').length)} helper="No retorno atual" icon={<ShieldCheck />} tone="purple" />
      </section>

      <section className="panel data-panel invoice-panel">
        <div className="data-toolbar"><div className="segmented-control">{(['Pendentes', 'Emitidas', 'Todas'] as const).map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => { setTab(item); setSelectedIds([]) }}>{item}</button>)}</div><div className="search-box search-box--push"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente, documento ou nota..." /></div></div>
        {selectedIds.length > 0 && <div className="selection-bar"><span><Check size={16} />{selectedIds.length} {selectedIds.length === 1 ? 'nota selecionada' : 'notas selecionadas'}</span><button onClick={() => setSelectedIds([])}>Limpar seleção</button></div>}

        {invoicesQuery.isLoading ? <LoadingState label="Carregando notas fiscais..." /> : invoicesQuery.isError ? <ErrorState message={apiErrorMessage(invoicesQuery.error)} onRetry={() => invoicesQuery.refetch()} /> : filtered.length === 0 ? <EmptyState title="Nenhuma nota encontrada" description="Altere os filtros ou cadastre uma nota fiscal." /> : (
          <div className="table-wrap"><table className="data-table invoice-table"><thead><tr><th className="check-column"><input type="checkbox" checked={readyInvoices.length > 0 && readyInvoices.every((invoice) => selectedIds.includes(invoice.id))} onChange={toggleAll} aria-label="Selecionar notas prontas" /></th><th>Nota / Cliente</th><th>Competência</th><th>Valor</th><th>ISSQN</th><th>Situação</th><th /></tr></thead><tbody>{filtered.map((invoice) => (
            <tr key={invoice.id} className={selectedIds.includes(invoice.id) ? 'row-selected' : ''} onClick={() => setDetail(invoice)}>
              <td className="check-column" onClick={(event) => event.stopPropagation()}><input type="checkbox" disabled={invoice.status !== 'PRONTA'} checked={selectedIds.includes(invoice.id)} onChange={() => setSelectedIds((ids) => ids.includes(invoice.id) ? ids.filter((id) => id !== invoice.id) : [...ids, invoice.id])} /></td>
              <td><strong>{invoiceCode(invoice)}</strong><small className="table-secondary">{invoice.clientName || 'Cliente não informado'} · {invoice.document || 'Sem documento'}</small></td>
              <td>{invoice.competence || 'Não informada'}<small className="table-secondary">{formatDate(invoice.issuedAt)}</small></td>
              <td><strong>{money(invoice.amount)}</strong></td>
              <td>{invoice.issRetained ? <Badge tone="purple">ISS retido</Badge> : <span>{money(invoice.tax)}</span>}</td>
              <td><Badge tone={invoice.status === 'PRONTA' ? 'green' : invoice.status === 'REVISAR' ? 'orange' : invoice.status === 'CANCELADA' ? 'red' : 'blue'}>{enumLabel(invoice.status)}</Badge></td>
              <td><button className="row-action" aria-label={`Visualizar ${invoiceCode(invoice)}`}><ChevronRight size={18} /></button></td>
            </tr>
          ))}</tbody></table></div>
        )}
        <footer className="table-footer"><span><strong>{filtered.length}</strong> de {invoicesQuery.data?.total ?? 0} notas</span><span>Dados fiscais retornados pela API</span></footer>
      </section>

      <DetailModal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `${invoiceCode(detail)} · ${detail.clientName || 'Cliente não informado'}` : 'Detalhes da nota fiscal'}
        description="Informações fiscais, valores, retenções e situação da nota."
        size="large"
        actions={detail ? <><Button variant="danger" icon={<Trash2 size={16} />} disabled={deleteMutation.isPending} onClick={() => setInvoiceToDelete(detail)}>Excluir</Button><Button icon={<Edit3 size={16} />} onClick={() => openEdit(detail)}>Editar nota</Button></> : undefined}
      >
        {detail && <InvoiceDetail invoice={detail} />}
      </DetailModal>

      <Modal open={modalOpen} onClose={() => !saveMutation.isPending && setModalOpen(false)} title={selected ? `Editar ${invoiceCode(selected)}` : 'Cadastrar nota fiscal'} description="Campos alinhados ao modelo Invoice do backend." size="large">
        <ModalForm onSubmit={submit} onCancel={() => setModalOpen(false)} submitting={saveMutation.isPending} submitLabel={saveMutation.isPending ? 'Salvando...' : selected ? 'Salvar alterações' : 'Cadastrar nota'}>
          <FormError message={formError} />
          <div className="form-grid form-grid--two">
            <FormField label="Número da nota"><input name="number" maxLength={50} defaultValue={selected?.number ?? ''} /></FormField>
            <FormField label="Cliente"><input name="clientName" list="invoice-clients" required defaultValue={selected?.clientName ?? ''} /><datalist id="invoice-clients">{clientsQuery.data?.content.map((client) => <option key={client.id} value={client.name ?? ''} />)}</datalist></FormField>
            <FormField label="CPF / CNPJ"><input name="document" required defaultValue={selected?.document ?? ''} /></FormField>
            <FormField label="Competência"><input name="competence" required maxLength={100} defaultValue={selected?.competence ?? ''} placeholder="Ex.: Ago/2026" /></FormField>
            <FormField label="Data de emissão"><input name="issuedAt" type="date" required defaultValue={toDateInput(selected?.issuedAt)} /></FormField>
            <FormField label="Natureza da operação"><input name="nature" maxLength={100} defaultValue={selected?.dsnatur ?? ''} /></FormField>
            <FormField label="Endereço"><input name="address" maxLength={300} defaultValue={selected?.dsender ?? ''} /></FormField>
            <FormField label="Situação"><select name="status" defaultValue={selected?.status || 'PRONTA'}>{(['PRONTA', 'REVISAR', 'EMITIDA', 'CANCELADA'] as InvoiceStatus[]).map((status) => <option key={status} value={status}>{enumLabel(status)}</option>)}</select></FormField>
          </div>
          <div className="form-section-title"><span>2</span><div><strong>Valores fiscais</strong><small>Valores monetários armazenados no backend</small></div></div>
          <div className="form-grid form-grid--four">
            <FormField label="Valor total"><input name="amount" type="number" min="0" step="0.01" required defaultValue={selected?.amount ?? 0} /></FormField>
            <FormField label="Alíquota (%)"><input name="taxRate" type="number" min="0" step="0.01" defaultValue={selected?.vlaliqu ?? 0} /></FormField>
            <FormField label="Valor do ISSQN"><input name="tax" type="number" min="0" step="0.01" defaultValue={selected?.tax ?? 0} /></FormField>
            <FormField label="ISS retido"><select name="issRetained" defaultValue={String(selected?.issRetained ?? false)}><option value="false">Não</option><option value="true">Sim</option></select></FormField>
            <FormField label="Mão de obra"><input name="laborAmount" type="number" min="0" step="0.01" defaultValue={selected?.vlmao ?? 0} /></FormField>
            <FormField label="Materiais"><input name="materialAmount" type="number" min="0" step="0.01" defaultValue={selected?.vlmater ?? 0} /></FormField>
          </div>
          <FormField label="Observações"><textarea name="notes" rows={3} defaultValue={selected?.dsobser ?? ''} /></FormField>
          {selected && <div className="destructive-row"><span><strong>Excluir nota</strong><small>Remove definitivamente o registro da API.</small></span><Button type="button" variant="danger" icon={<Trash2 size={16} />} disabled={deleteMutation.isPending} onClick={() => setInvoiceToDelete(selected)}>Excluir</Button></div>}
        </ModalForm>
      </Modal>

      <Modal open={emitModal} onClose={() => !emitMutation.isPending && setEmitModal(false)} title="Confirmar emissão" description="As notas selecionadas serão atualizadas na API.">
        <div className="modal__body emission-summary"><FormError message={formError} /><span className="emission-summary__icon"><ShieldCheck size={25} /></span><div><strong>{readySelected.length} {readySelected.length === 1 ? 'nota pronta' : 'notas prontas'}</strong><small>Valor total de {money(readySelected.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0))}</small></div><ul>{readySelected.map((invoice) => <li key={invoice.id}><span>{invoice.clientName}</span><strong>{money(invoice.amount)}</strong></li>)}</ul></div>
        <footer className="modal__footer"><Button variant="secondary" onClick={() => setEmitModal(false)}>Voltar</Button><Button icon={<ReceiptText size={17} />} disabled={emitMutation.isPending} onClick={() => emitMutation.mutate(readySelected)}>{emitMutation.isPending ? 'Emitindo...' : 'Confirmar emissão'}</Button></footer>
      </Modal>
      <ConfirmDialog open={Boolean(invoiceToDelete)} title={`Excluir ${invoiceToDelete ? invoiceCode(invoiceToDelete) : 'esta nota'}?`} description="A nota fiscal será removida permanentemente. Esta ação não poderá ser desfeita." confirmLabel="Excluir nota" busy={deleteMutation.isPending} onCancel={() => setInvoiceToDelete(null)} onConfirm={() => invoiceToDelete && !deleteMutation.isPending && deleteMutation.mutate(invoiceToDelete.id)} />
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </>
  )
}

function InvoiceDetail({ invoice }: { invoice: Invoice }) {
  const tone = invoice.status === 'PRONTA' ? 'green' : invoice.status === 'REVISAR' ? 'orange' : invoice.status === 'CANCELADA' ? 'red' : 'blue'
  return <div className="detail-modal-content">
    <div className="detail-modal__hero-row"><div className="detail-drawer__hero"><span className="detail-avatar"><ReceiptText /></span><div><span>{invoiceCode(invoice)}</span><h2>{invoice.clientName || 'Cliente não informado'}</h2><p>{invoice.document || 'Documento não informado'}</p></div></div><Badge tone={tone}>{enumLabel(invoice.status)}</Badge></div>
    <div className="detail-metrics"><span><small>Competência</small><strong>{invoice.competence || 'Não informada'}</strong></span><span><small>Data de emissão</small><strong>{formatDate(invoice.issuedAt)}</strong></span><span><small>Valor total</small><strong>{money(invoice.amount)}</strong></span><span><small>ISSQN</small><strong>{money(invoice.tax)}</strong></span></div>
    <div className="detail-sections-grid">
      <section className="drawer-section"><h3>Dados fiscais</h3><dl><div><dt>Número da nota</dt><dd>{invoice.number || 'Não informado'}</dd></div><div><dt>Natureza da operação</dt><dd>{invoice.dsnatur || 'Não informada'}</dd></div><div><dt>Alíquota</dt><dd>{invoice.vlaliqu == null ? 'Não informada' : `${invoice.vlaliqu}%`}</dd></div><div><dt>ISS retido</dt><dd>{invoice.issRetained ? 'Sim' : 'Não'}</dd></div></dl></section>
      <section className="drawer-section"><h3>Composição do valor</h3><dl><div><dt>Mão de obra</dt><dd>{money(invoice.vlmao)}</dd></div><div><dt>Materiais</dt><dd>{money(invoice.vlmater)}</dd></div><div><dt>Base de cálculo</dt><dd>{money(invoice.vlbasei)}</dd></div><div><dt>Valor do ISSQN</dt><dd>{money(invoice.tax)}</dd></div></dl></section>
      {(invoice.dsender || invoice.dsobser) && <section className="drawer-section drawer-section--wide"><h3>Endereço e observações</h3>{invoice.dsender && <p className="drawer-section__text"><strong>Endereço:</strong> {invoice.dsender}</p>}{invoice.dsobser && <p className="drawer-section__text detail-text-spaced">{invoice.dsobser}</p>}</section>}
    </div>
  </div>
}
