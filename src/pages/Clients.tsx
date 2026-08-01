import { useMemo, useState } from 'react'
import { Building2, CalendarClock, ChevronRight, Clock3, Edit3, FilePenLine, Filter, Plus, Search, UserRoundCheck, UsersRound } from 'lucide-react'
import { clients as initialClients, money } from '../data/mock'
import type { Client } from '../types'
import { Badge, Button, FormField, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'

const emptyClient: Omit<Client, 'id' | 'usedHours' | 'lastService'> = {
  name: '', document: '', kind: 'Pessoa jurídica', email: '', phone: '', city: 'Fortaleza', contract: true, plan: 'Contrato · 10h', dueDay: '10', monthly: 0, contractedHours: 10, status: 'Ativo', channel: 'Indicação',
}

export function Clients() {
  const [clients, setClients] = useState(initialClients)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'Todos' | 'Contratos' | 'Avulsos' | 'Atenção'>('Todos')
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<Client | null>(null)
  const [detail, setDetail] = useState<Client | null>(null)
  const [toast, setToast] = useState('')

  const filtered = useMemo(() => clients.filter((client) => {
    const matchesQuery = [client.name, client.document, client.email, String(client.id)].some((value) => value.toLowerCase().includes(query.toLowerCase()))
    const matchesFilter = filter === 'Todos' || (filter === 'Contratos' && client.contract) || (filter === 'Avulsos' && !client.contract) || (filter === 'Atenção' && client.status === 'Atenção')
    return matchesQuery && matchesFilter
  }), [clients, filter, query])

  const openNew = () => { setSelected(null); setModalOpen(true) }
  const openEdit = (client: Client) => { setSelected(client); setDetail(null); setModalOpen(true) }

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const contract = data.get('contract') === 'true'
    const base = {
      name: String(data.get('name')),
      document: String(data.get('document')),
      kind: String(data.get('kind')) as Client['kind'],
      email: String(data.get('email')),
      phone: String(data.get('phone')),
      city: String(data.get('city')),
      contract,
      plan: contract ? String(data.get('plan')) : 'Cliente avulso',
      dueDay: contract ? String(data.get('dueDay')) as Client['dueDay'] : 'Sob demanda' as const,
      monthly: Number(data.get('monthly')),
      contractedHours: contract ? Number(data.get('contractedHours')) : 0,
      status: String(data.get('status')) as Client['status'],
      channel: String(data.get('channel')),
    }
    if (selected) {
      setClients((items) => items.map((item) => item.id === selected.id ? { ...item, ...base } : item))
      setToast('Cadastro do cliente atualizado com sucesso.')
    } else {
      setClients((items) => [{ ...emptyClient, ...base, id: Math.max(...items.map((item) => item.id)) + 1, usedHours: 0, lastService: 'Nenhum atendimento' }, ...items])
      setToast('Novo cliente adicionado à carteira.')
    }
    setModalOpen(false)
    setTimeout(() => setToast(''), 3000)
  }

  return (
    <>
      <PageHeader
        eyebrow="Relacionamento"
        title="Clientes"
        subtitle="Cadastro, contratos, horas utilizadas e situação financeira em uma só visão."
        actions={<Button icon={<Plus size={18} />} onClick={openNew}>Novo cliente</Button>}
      />

      <section className="stats-grid stats-grid--four">
        <StatCard label="Clientes ativos" value="128" helper="42 possuem contrato" icon={<UsersRound />} tone="blue" />
        <StatCard label="Contratos a renovar" value="6" helper="Nos próximos 30 dias" icon={<CalendarClock />} tone="orange" />
        <StatCard label="Horas contratadas" value="630h" helper="Disponíveis neste mês" icon={<Clock3 />} tone="green" />
        <StatCard label="Ticket médio" value={money(2015)} helper="↑ 8,4% no ano" icon={<UserRoundCheck />} tone="purple" />
      </section>

      <section className="panel data-panel">
        <div className="data-toolbar">
          <div className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, código, CPF ou CNPJ..." /></div>
          <div className="segmented-control" aria-label="Filtrar clientes">
            {(['Todos', 'Contratos', 'Avulsos', 'Atenção'] as const).map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}
          </div>
          <Button variant="secondary" icon={<Filter size={16} />}>Mais filtros</Button>
        </div>

        <div className="table-wrap">
          <table className="data-table clients-table">
            <thead><tr><th>Cliente</th><th>Plano</th><th>Vencimento</th><th>Mensalidade</th><th>Horas utilizadas</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {filtered.map((client) => {
                const percentage = client.contract ? Math.min(100, Math.round(client.usedHours / client.contractedHours * 100)) : 0
                return (
                  <tr key={client.id} onClick={() => setDetail(client)}>
                    <td><div className="entity-cell"><span className="entity-avatar"><Building2 size={18} /></span><span><strong>{client.name}</strong><small>#{client.id} · {client.document}</small></span></div></td>
                    <td><strong className="table-primary">{client.plan}</strong><small className="table-secondary">{client.contract ? 'Renovação em mai/2027' : 'Sem contrato recorrente'}</small></td>
                    <td>{client.contract ? `Dia ${client.dueDay}` : client.dueDay}</td>
                    <td><strong>{money(client.monthly)}</strong></td>
                    <td>{client.contract ? <div className="hours-cell"><span><b>{client.usedHours.toFixed(1).replace('.', 'h')}</b> de {client.contractedHours}h</span><div className="mini-progress"><i style={{ width: `${percentage}%` }} /></div></div> : <span className="muted">—</span>}</td>
                    <td><Badge tone={client.status === 'Ativo' ? 'green' : 'orange'}>{client.status}</Badge></td>
                    <td><button className="row-action" onClick={(event) => { event.stopPropagation(); setDetail(client) }} aria-label={`Abrir ${client.name}`}><ChevronRight size={18} /></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <footer className="table-footer"><span>Mostrando <strong>{filtered.length}</strong> de 128 clientes</span><span>Atualizado agora</span></footer>
      </section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={selected ? 'Editar cliente' : 'Novo cliente'} description="Os campos marcados serão usados nos contratos, notas e extratos." size="large">
        <ModalForm onSubmit={submit} onCancel={() => setModalOpen(false)} submitLabel={selected ? 'Salvar alterações' : 'Cadastrar cliente'}>
          <div className="form-section-title"><span>1</span><div><strong>Dados cadastrais</strong><small>Informações principais do cliente</small></div></div>
          <div className="form-grid form-grid--two">
            <FormField label="Nome / Razão social"><input name="name" required defaultValue={selected?.name} placeholder="Ex.: Almeida Consultoria" /></FormField>
            <FormField label="Tipo de pessoa"><select name="kind" defaultValue={selected?.kind || emptyClient.kind}><option>Pessoa jurídica</option><option>Pessoa física</option></select></FormField>
            <FormField label="CPF / CNPJ"><input name="document" required defaultValue={selected?.document} placeholder="00.000.000/0000-00" /></FormField>
            <FormField label="Telefone"><input name="phone" required defaultValue={selected?.phone} placeholder="(85) 99999-9999" /></FormField>
            <FormField label="E-mail financeiro"><input name="email" type="email" required defaultValue={selected?.email} placeholder="financeiro@cliente.com.br" /></FormField>
            <FormField label="Cidade"><input name="city" defaultValue={selected?.city || emptyClient.city} /></FormField>
            <FormField label="Canal de venda"><select name="channel" defaultValue={selected?.channel || emptyClient.channel}><option>Indicação</option><option>Google</option><option>Instagram</option><option>Site</option><option>Cliente recorrente</option></select></FormField>
            <FormField label="Situação"><select name="status" defaultValue={selected?.status || emptyClient.status}><option>Ativo</option><option>Atenção</option></select></FormField>
          </div>
          <div className="form-section-title"><span>2</span><div><strong>Contrato e cobrança</strong><small>Regras comerciais do atendimento</small></div></div>
          <div className="form-grid form-grid--four">
            <FormField label="Tipo"><select name="contract" defaultValue={String(selected?.contract ?? true)}><option value="true">Contratado</option><option value="false">Avulso</option></select></FormField>
            <FormField label="Plano"><select name="plan" defaultValue={selected?.plan || emptyClient.plan}><option>Contrato · 8h</option><option>Contrato · 10h</option><option>Contrato · 12h</option><option>Contrato · 20h</option><option>Plano personalizado</option></select></FormField>
            <FormField label="Vencimento"><select name="dueDay" defaultValue={selected?.dueDay || '10'}><option value="10">Dia 10</option><option value="20">Dia 20</option></select></FormField>
            <FormField label="Horas contratadas"><input name="contractedHours" type="number" min="0" defaultValue={selected?.contractedHours || 10} /></FormField>
            <FormField label="Mensalidade"><input name="monthly" type="number" min="0" step="0.01" defaultValue={selected?.monthly || 0} /></FormField>
          </div>
        </ModalForm>
      </Modal>

      {detail && (
        <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDetail(null)}>
          <aside className="detail-drawer">
            <header><button className="drawer-close" onClick={() => setDetail(null)}>Fechar</button><Badge tone={detail.status === 'Ativo' ? 'green' : 'orange'}>{detail.status}</Badge></header>
            <div className="detail-drawer__hero"><span className="detail-avatar"><Building2 /></span><div><span>Cliente #{detail.id}</span><h2>{detail.name}</h2><p>{detail.document}</p></div></div>
            <div className="detail-metrics"><span><small>Plano atual</small><strong>{detail.plan}</strong></span><span><small>Mensalidade</small><strong>{money(detail.monthly)}</strong></span><span><small>Vencimento</small><strong>{detail.contract ? `Dia ${detail.dueDay}` : 'Sob demanda'}</strong></span><span><small>Último serviço</small><strong>{detail.lastService}</strong></span></div>
            <section className="drawer-section"><h3>Contato e atendimento</h3><dl><div><dt>E-mail financeiro</dt><dd>{detail.email}</dd></div><div><dt>Telefone</dt><dd>{detail.phone}</dd></div><div><dt>Canal de venda</dt><dd>{detail.channel}</dd></div><div><dt>Cidade</dt><dd>{detail.city}</dd></div></dl></section>
            {detail.contract && <section className="drawer-section contract-usage"><div><h3>Uso do contrato</h3><span>{Math.round(detail.usedHours / detail.contractedHours * 100)}%</span></div><div className="usage-ring-copy"><strong>{detail.usedHours.toFixed(1).replace('.', 'h')}</strong><span>utilizadas de {detail.contractedHours}h</span></div><div className="progress"><span style={{ width: `${Math.min(100, detail.usedHours / detail.contractedHours * 100)}%` }} /></div></section>}
            <footer><Button variant="secondary" icon={<FilePenLine size={17} />}>Ver contrato</Button><Button icon={<Edit3 size={17} />} onClick={() => openEdit(detail)}>Editar cadastro</Button></footer>
          </aside>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </>
  )
}
