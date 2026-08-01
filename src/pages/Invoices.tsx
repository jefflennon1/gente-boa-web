import { useMemo, useState } from 'react'
import { Check, CheckCircle2, ChevronRight, CircleDollarSign, FileCheck2, FilePlus2, Filter, Landmark, Plus, ReceiptText, Search, Send, ShieldCheck, TriangleAlert } from 'lucide-react'
import { invoices as initialInvoices, money } from '../data/mock'
import type { Invoice } from '../types'
import { Badge, Button, FormField, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'

const steps = [
  { label: 'Fechamento', detail: 'OS conferidas', icon: CheckCircle2 },
  { label: 'Notas fiscais', detail: 'Etapa atual', icon: ReceiptText },
  { label: 'Boletos', detail: 'Após emissão', icon: Landmark },
  { label: 'Envio', detail: 'Extrato por e-mail', icon: Send },
]

export function Invoices() {
  const [invoices, setInvoices] = useState(initialInvoices)
  const [tab, setTab] = useState<'Pendentes' | 'Emitidas' | 'Todas'>('Pendentes')
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [newModal, setNewModal] = useState(false)
  const [emitModal, setEmitModal] = useState(false)
  const [detail, setDetail] = useState<Invoice | null>(null)
  const [toast, setToast] = useState('')

  const filtered = useMemo(() => invoices.filter((invoice) => {
    const matchesTab = tab === 'Todas' || (tab === 'Emitidas' ? invoice.status === 'Emitida' : invoice.status !== 'Emitida')
    return matchesTab && [invoice.id, invoice.client, invoice.document].some((value) => value.toLowerCase().includes(query.toLowerCase()))
  }), [invoices, query, tab])

  const readySelected = invoices.filter((invoice) => selectedIds.includes(invoice.id) && invoice.status === 'Pronta')
  const toggleAll = () => {
    const selectable = filtered.filter((invoice) => invoice.status === 'Pronta').map((invoice) => invoice.id)
    setSelectedIds(selectable.every((id) => selectedIds.includes(id)) ? [] : selectable)
  }

  const emit = () => {
    const now = '01/08/2026'
    setInvoices((items) => items.map((invoice) => readySelected.some((selected) => selected.id === invoice.id) ? { ...invoice, status: 'Emitida', issuedAt: now } : invoice))
    const count = readySelected.length
    setEmitModal(false)
    setSelectedIds([])
    setToast(`${count} ${count === 1 ? 'nota foi emitida' : 'notas foram emitidas'} com sucesso.`)
    setTimeout(() => setToast(''), 3500)
  }

  const submitNew = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const next = Math.max(...invoices.map((invoice) => Number(invoice.id.replace('NF-', '')))) + 1
    const invoice: Invoice = {
      id: `NF-${next}`,
      client: String(data.get('client')),
      document: String(data.get('document')),
      competence: String(data.get('competence')),
      amount: Number(data.get('amount')),
      tax: Number(data.get('tax')),
      issRetained: data.get('issRetained') === 'true',
      status: 'Pronta',
    }
    setInvoices((items) => [invoice, ...items])
    setNewModal(false)
    setToast(`${invoice.id} preparada para emissão.`)
    setTimeout(() => setToast(''), 3000)
  }

  return (
    <>
      <PageHeader
        eyebrow="Faturamento"
        title="Notas fiscais"
        subtitle="Conferência fiscal e emissão em lote com rastreabilidade por cliente."
        actions={<><Button variant="secondary" icon={<FilePlus2 size={17} />} onClick={() => setNewModal(true)}>Nota avulsa</Button><Button icon={<ReceiptText size={18} />} disabled={!readySelected.length} onClick={() => setEmitModal(true)}>Emitir selecionadas {readySelected.length ? `(${readySelected.length})` : ''}</Button></>}
      />

      <section className="billing-steps">
        {steps.map(({ label, detail, icon: Icon }, index) => <div key={label} className={`billing-step ${index === 1 ? 'billing-step--active' : index === 0 ? 'billing-step--done' : ''}`}><span><Icon size={19} /></span><div><strong>{label}</strong><small>{detail}</small></div>{index < steps.length - 1 && <ChevronRight size={17} />}</div>)}
      </section>

      <section className="stats-grid stats-grid--four">
        <StatCard label="Base de cálculo" value={money(11150)} helper="Competência jul/2026" icon={<CircleDollarSign />} tone="blue" />
        <StatCard label="Prontas para emitir" value="3" helper="2 selecionáveis agora" icon={<FileCheck2 />} tone="green" />
        <StatCard label="Aguardam revisão" value="1" helper="Dados fiscais incompletos" icon={<TriangleAlert />} tone="orange" />
        <StatCard label="Emitidas no mês" value="48" helper={money(73840)} icon={<ShieldCheck />} tone="purple" />
      </section>

      <section className="panel data-panel invoice-panel">
        <div className="data-toolbar">
          <div className="segmented-control">{(['Pendentes', 'Emitidas', 'Todas'] as const).map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => { setTab(item); setSelectedIds([]) }}>{item}</button>)}</div>
          <div className="search-box search-box--push"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente ou nota..." /></div>
          <Button variant="secondary" icon={<Filter size={16} />}>Filtros</Button>
        </div>

        {selectedIds.length > 0 && <div className="selection-bar"><span><Check size={16} />{selectedIds.length} {selectedIds.length === 1 ? 'nota selecionada' : 'notas selecionadas'}</span><button onClick={() => setSelectedIds([])}>Limpar seleção</button></div>}

        <div className="table-wrap">
          <table className="data-table invoice-table">
            <thead><tr><th className="check-column"><input type="checkbox" checked={filtered.filter((invoice) => invoice.status === 'Pronta').length > 0 && filtered.filter((invoice) => invoice.status === 'Pronta').every((invoice) => selectedIds.includes(invoice.id))} onChange={toggleAll} aria-label="Selecionar notas prontas" /></th><th>Nota / Cliente</th><th>Competência</th><th>Base de cálculo</th><th>Tributação</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {filtered.map((invoice) => (
                <tr key={invoice.id} className={selectedIds.includes(invoice.id) ? 'row-selected' : ''} onClick={() => setDetail(invoice)}>
                  <td className="check-column" onClick={(event) => event.stopPropagation()}><input type="checkbox" disabled={invoice.status !== 'Pronta'} checked={selectedIds.includes(invoice.id)} onChange={() => setSelectedIds((ids) => ids.includes(invoice.id) ? ids.filter((id) => id !== invoice.id) : [...ids, invoice.id])} aria-label={`Selecionar ${invoice.id}`} /></td>
                  <td><strong>{invoice.id}</strong><small className="table-secondary">{invoice.client}</small></td>
                  <td>{invoice.competence}</td>
                  <td><strong>{money(invoice.amount)}</strong></td>
                  <td>{invoice.issRetained ? <Badge tone="purple">ISS retido</Badge> : <span>ISS {invoice.tax.toFixed(1).replace('.', ',')}%</span>}</td>
                  <td><Badge tone={invoice.status === 'Pronta' ? 'green' : invoice.status === 'Revisar' ? 'orange' : 'blue'}>{invoice.status}</Badge>{invoice.issuedAt && <small className="table-secondary">em {invoice.issuedAt}</small>}</td>
                  <td><button className="row-action"><ChevronRight size={18} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="table-footer"><span><strong>{filtered.length}</strong> notas encontradas</span><span>ISS padrão do mês: <strong>3,4%</strong></span></footer>
      </section>

      <Modal open={newModal} onClose={() => setNewModal(false)} title="Preparar nota avulsa" description="Inclua uma nota fora do fechamento recorrente.">
        <ModalForm onSubmit={submitNew} onCancel={() => setNewModal(false)} submitLabel="Preparar nota">
          <div className="form-grid form-grid--two">
            <FormField label="Cliente"><input name="client" required placeholder="Nome ou razão social" /></FormField>
            <FormField label="CPF / CNPJ"><input name="document" required placeholder="00.000.000/0000-00" /></FormField>
            <FormField label="Competência"><input name="competence" required defaultValue="Ago/2026" /></FormField>
            <FormField label="Valor da nota"><input name="amount" type="number" min="0" step="0.01" required /></FormField>
            <FormField label="Alíquota ISS (%)"><input name="tax" type="number" min="0" step="0.1" defaultValue="3.4" required /></FormField>
            <FormField label="Retenção de ISS"><select name="issRetained" defaultValue="false"><option value="false">Não retém</option><option value="true">ISS retido pelo cliente</option></select></FormField>
          </div>
        </ModalForm>
      </Modal>

      <Modal open={emitModal} onClose={() => setEmitModal(false)} title="Confirmar emissão" description="Revise o resumo antes de enviar as notas ao provedor fiscal.">
        <div className="modal__body emission-summary">
          <span className="emission-summary__icon"><ShieldCheck size={25} /></span>
          <div><strong>{readySelected.length} {readySelected.length === 1 ? 'nota pronta' : 'notas prontas'}</strong><small>Valor total de {money(readySelected.reduce((sum, invoice) => sum + invoice.amount, 0))}</small></div>
          <ul>{readySelected.map((invoice) => <li key={invoice.id}><span>{invoice.client}</span><strong>{money(invoice.amount)}</strong></li>)}</ul>
          <p>Este protótipo simula a emissão. Na versão produtiva, a ação será integrada à prefeitura ou ao provedor fiscal escolhido.</p>
        </div>
        <footer className="modal__footer"><Button variant="secondary" onClick={() => setEmitModal(false)}>Voltar</Button><Button icon={<ReceiptText size={17} />} onClick={emit}>Confirmar emissão</Button></footer>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.id || 'Detalhe da nota'} description={detail ? `${detail.client} · ${detail.competence}` : ''}>
        {detail && <div className="modal__body invoice-detail"><div className="invoice-detail__status"><Badge tone={detail.status === 'Pronta' ? 'green' : detail.status === 'Revisar' ? 'orange' : 'blue'}>{detail.status}</Badge><span>{detail.document}</span></div><dl><div><dt>Base de cálculo</dt><dd>{money(detail.amount)}</dd></div><div><dt>Alíquota</dt><dd>{detail.issRetained ? 'ISS retido' : `${detail.tax.toFixed(1).replace('.', ',')}%`}</dd></div><div><dt>Tributos estimados</dt><dd>{money(detail.amount * detail.tax / 100)}</dd></div><div><dt>Valor líquido estimado</dt><dd>{money(detail.amount - detail.amount * detail.tax / 100)}</dd></div></dl>{detail.status === 'Revisar' && <div className="warning-box"><TriangleAlert size={18} /><span><strong>Revisão necessária</strong><small>Confirme a alíquota e o endereço de prestação antes da emissão.</small></span></div>}</div>}
        <footer className="modal__footer"><Button variant="secondary" onClick={() => setDetail(null)}>Fechar</Button>{detail?.status === 'Revisar' && <Button onClick={() => { if (detail) setInvoices((items) => items.map((item) => item.id === detail.id ? { ...item, status: 'Pronta' } : item)); setDetail(null); setToast('Nota revisada e liberada para emissão.') }}>Concluir revisão</Button>}</footer>
      </Modal>

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </>
  )
}
