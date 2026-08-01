import { useMemo, useState } from 'react'
import { Check, CheckCircle2, ChevronRight, Clock3, Eye, FileCheck2, FileText, Mail, Paperclip, Search, Send, WalletCards } from 'lucide-react'
import { money, statements as initialStatements } from '../data/mock'
import type { Statement } from '../types'
import { Badge, Button, Modal, PageHeader, StatCard, Toast } from '../components/ui'

const flow = [
  { label: 'OS finalizadas', detail: '31 de julho', icon: CheckCircle2, tone: 'green' },
  { label: 'NF emitida', detail: 'Anexo automático', icon: FileCheck2, tone: 'blue' },
  { label: 'Boleto registrado', detail: 'Vencimento 10 ou 20', icon: WalletCards, tone: 'purple' },
  { label: 'Extrato enviado', detail: 'PDF por e-mail', icon: Send, tone: 'orange' },
]

export function Statements() {
  const [statements, setStatements] = useState(initialStatements)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'Pendentes' | 'Enviados' | 'Todos'>('Pendentes')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [preview, setPreview] = useState<Statement | null>(null)
  const [sendModal, setSendModal] = useState(false)
  const [toast, setToast] = useState('')

  const filtered = useMemo(() => statements.filter((statement) => {
    const matchesTab = tab === 'Todos' || (tab === 'Enviados' ? statement.status === 'Enviado' : statement.status !== 'Enviado')
    return matchesTab && [statement.client, statement.email, statement.id].some((value) => value.toLowerCase().includes(query.toLowerCase()))
  }), [query, statements, tab])

  const sendable = statements.filter((statement) => selectedIds.includes(statement.id) && statement.status === 'Pronto')

  const send = () => {
    const count = sendable.length
    setStatements((items) => items.map((statement) => sendable.some((selected) => selected.id === statement.id) ? { ...statement, status: 'Enviado', sentAt: '01/08/2026 · agora' } : statement))
    setSelectedIds([])
    setSendModal(false)
    setToast(`${count} ${count === 1 ? 'extrato enviado' : 'extratos enviados'} por e-mail.`)
    setTimeout(() => setToast(''), 3500)
  }

  return (
    <>
      <PageHeader
        eyebrow="Fechamento mensal"
        title="Extratos dos clientes"
        subtitle="Serviços, horas, nota fiscal e boleto reunidos em um único envio."
        actions={<Button icon={<Send size={18} />} disabled={!sendable.length} onClick={() => setSendModal(true)}>Enviar selecionados {sendable.length ? `(${sendable.length})` : ''}</Button>}
      />

      <section className="statement-flow">
        {flow.map(({ label, detail, icon: Icon, tone }, index) => <div className={`statement-flow__step statement-flow__step--${tone}`} key={label}><span><Icon size={20} /></span><div><strong>{label}</strong><small>{detail}</small></div>{index < flow.length - 1 && <ChevronRight size={17} />}</div>)}
      </section>

      <section className="stats-grid stats-grid--four statement-stats">
        <StatCard label="Extratos gerados" value="42" helper="Competência jul/2026" icon={<FileText />} tone="blue" />
        <StatCard label="Prontos para envio" value="2" helper="NF e boleto conferidos" icon={<Mail />} tone="green" />
        <StatCard label="Em revisão" value="1" helper="Documento pendente" icon={<Clock3 />} tone="orange" />
        <StatCard label="Valor do lote" value={money(11150)} helper="4 clientes no fechamento" icon={<WalletCards />} tone="purple" />
      </section>

      <section className="panel data-panel">
        <div className="data-toolbar">
          <div className="segmented-control">{(['Pendentes', 'Enviados', 'Todos'] as const).map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => { setTab(item); setSelectedIds([]) }}>{item}</button>)}</div>
          <div className="search-box search-box--push"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente ou e-mail..." /></div>
          <Button variant="secondary">Julho / 2026</Button>
        </div>

        {selectedIds.length > 0 && <div className="selection-bar"><span><Check size={16} />{selectedIds.length} {selectedIds.length === 1 ? 'extrato selecionado' : 'extratos selecionados'}</span><button onClick={() => setSelectedIds([])}>Limpar seleção</button></div>}

        <div className="statement-list">
          <div className="statement-list__head"><span /><span>Cliente e destino</span><span>Atendimentos</span><span>Documentos</span><span>Valor total</span><span>Situação</span><span /></div>
          {filtered.map((statement) => (
            <article key={statement.id} className={selectedIds.includes(statement.id) ? 'selected' : ''}>
              <span className="statement-check"><input type="checkbox" disabled={statement.status !== 'Pronto'} checked={selectedIds.includes(statement.id)} onChange={() => setSelectedIds((ids) => ids.includes(statement.id) ? ids.filter((id) => id !== statement.id) : [...ids, statement.id])} /></span>
              <div className="statement-client"><strong>{statement.client}</strong><small><Mail size={13} />{statement.email}</small></div>
              <div className="statement-service"><strong>{statement.osCount} OS</strong><small>{statement.hours} utilizadas</small></div>
              <div className="document-badges"><Badge tone={statement.invoice === 'Pendente' ? 'orange' : 'blue'}>NF {statement.invoice}</Badge><Badge tone={statement.slip === 'Pendente' ? 'orange' : 'purple'}>Boleto {statement.slip}</Badge></div>
              <strong className="statement-value">{money(statement.amount)}</strong>
              <div><Badge tone={statement.status === 'Pronto' ? 'green' : statement.status === 'Revisar' ? 'orange' : 'blue'}>{statement.status}</Badge>{statement.sentAt && <small className="table-secondary">{statement.sentAt}</small>}</div>
              <button className="row-action" onClick={() => setPreview(statement)} aria-label={`Visualizar extrato de ${statement.client}`}><Eye size={18} /></button>
            </article>
          ))}
        </div>
        <footer className="table-footer"><span><strong>{filtered.length}</strong> clientes no fechamento</span><span>Última atualização: hoje, 13:42</span></footer>
      </section>

      <Modal open={!!preview} onClose={() => setPreview(null)} title="Prévia do extrato" description={preview ? `${preview.client} · Julho de 2026` : ''} size="large">
        {preview && <div className="modal__body statement-preview"><div className="preview-document"><header><div className="preview-logo">GB</div><div><strong>Gente Boa Manutenção e Serviços</strong><small>Extrato mensal de atendimentos</small></div><span>Jul/2026</span></header><section><div><span>Cliente</span><strong>{preview.client}</strong></div><div><span>Período</span><strong>01/07 a 31/07/2026</strong></div><div><span>Horas utilizadas</span><strong>{preview.hours}</strong></div></section><table><thead><tr><th>Serviço</th><th>Data</th><th>Técnico</th><th>Tempo</th></tr></thead><tbody><tr><td>Manutenção elétrica</td><td>08/07</td><td>Edmilson</td><td>2h10</td></tr><tr><td>Visita técnica preventiva</td><td>15/07</td><td>Miguel</td><td>1h35</td></tr><tr><td>Serviços e atendimentos adicionais</td><td>Julho</td><td>Equipe Gente Boa</td><td>{preview.hours}</td></tr></tbody></table><footer><span>Valor total do período</span><strong>{money(preview.amount)}</strong></footer></div><aside><h3>Documentos do envio</h3><span><FileCheck2 size={18} /><div><strong>Nota fiscal</strong><small>{preview.invoice}</small></div></span><span><WalletCards size={18} /><div><strong>Boleto bancário</strong><small>{preview.slip}</small></div></span><span><Paperclip size={18} /><div><strong>Extrato detalhado</strong><small>PDF · 186 KB</small></div></span><div className="preview-recipient"><small>Destinatário</small><strong>{preview.email}</strong></div></aside></div>}
        <footer className="modal__footer"><Button variant="secondary" onClick={() => setPreview(null)}>Fechar prévia</Button>{preview?.status === 'Pronto' && <Button icon={<Send size={17} />} onClick={() => { if (preview) setSelectedIds([preview.id]); setPreview(null); setSendModal(true) }}>Enviar este extrato</Button>}</footer>
      </Modal>

      <Modal open={sendModal} onClose={() => setSendModal(false)} title="Confirmar envio dos extratos" description="Cada cliente receberá o extrato, a nota fiscal e o boleto disponíveis.">
        <div className="modal__body send-summary"><span className="send-summary__icon"><Mail size={25} /></span><div><strong>{sendable.length} {sendable.length === 1 ? 'destinatário confirmado' : 'destinatários confirmados'}</strong><small>Os documentos serão anexados automaticamente.</small></div><ul>{sendable.map((statement) => <li key={statement.id}><span><strong>{statement.client}</strong><small>{statement.email}</small></span><Badge tone="green">Pronto</Badge></li>)}</ul><p>Este protótipo simula o envio. Na versão produtiva, a ação usará o serviço de e-mail selecionado.</p></div>
        <footer className="modal__footer"><Button variant="secondary" onClick={() => setSendModal(false)}>Voltar</Button><Button icon={<Send size={17} />} onClick={send}>Confirmar e enviar</Button></footer>
      </Modal>

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </>
  )
}
