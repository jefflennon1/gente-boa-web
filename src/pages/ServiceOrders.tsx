import { useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, ChevronRight, CircleAlert, Clock3, Columns3, Filter, List, MapPin, Plus, Search, UserRound, Wrench } from 'lucide-react'
import { clients, osStatusLabel, serviceOrders as initialOrders } from '../data/mock'
import type { OsStatus, ServiceOrder } from '../types'
import { Badge, Button, FormField, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'

const stages: OsStatus[] = ['aberta', 'encaminhada', 'agendada', 'em_atendimento', 'finalizada']

const nextStatus = (status: OsStatus): OsStatus => stages[Math.min(stages.indexOf(status) + 1, stages.length - 1)]

const statusTone: Record<OsStatus, 'orange' | 'blue' | 'purple' | 'green' | 'neutral'> = {
  aberta: 'orange', encaminhada: 'blue', agendada: 'purple', em_atendimento: 'green', finalizada: 'neutral',
}

export function ServiceOrders() {
  const [orders, setOrders] = useState(initialOrders)
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [query, setQuery] = useState('')
  const [priority, setPriority] = useState<'Todas' | 'Urgentes'>('Todas')
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<ServiceOrder | null>(null)
  const [toast, setToast] = useState('')

  const filtered = useMemo(() => orders.filter((order) => {
    const matchesQuery = [order.id, order.client, order.service, order.technician].some((value) => value.toLowerCase().includes(query.toLowerCase()))
    return matchesQuery && (priority === 'Todas' || order.priority === 'Urgente')
  }), [orders, priority, query])

  const advance = (order: ServiceOrder) => {
    if (order.status === 'finalizada') return
    const status = nextStatus(order.status)
    setOrders((items) => items.map((item) => item.id === order.id ? { ...item, status } : item))
    setToast(`${order.id} avançou para “${osStatusLabel[status]}”.`)
    setTimeout(() => setToast(''), 3000)
  }

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const payload: ServiceOrder = {
      id: selected?.id || `OS-${Math.max(...orders.map((order) => Number(order.id.replace('OS-', '')))) + 1}`,
      client: String(data.get('client')),
      service: String(data.get('service')),
      category: String(data.get('category')) as ServiceOrder['category'],
      technician: String(data.get('technician')),
      date: String(data.get('date')),
      time: String(data.get('time')),
      priority: String(data.get('priority')) as ServiceOrder['priority'],
      status: String(data.get('status')) as OsStatus,
      location: String(data.get('location')),
      description: String(data.get('description')),
    }
    if (selected) setOrders((items) => items.map((item) => item.id === selected.id ? payload : item))
    else setOrders((items) => [payload, ...items])
    setModalOpen(false)
    setSelected(null)
    setToast(selected ? 'Ordem de serviço atualizada.' : `${payload.id} cadastrada com sucesso.`)
    setTimeout(() => setToast(''), 3000)
  }

  const openEdit = (order: ServiceOrder) => { setSelected(order); setModalOpen(true) }
  const openNew = () => { setSelected(null); setModalOpen(true) }

  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Ordens de serviço"
        subtitle="Acompanhe urgências, horários, técnicos e o avanço de cada atendimento."
        actions={<Button icon={<Plus size={18} />} onClick={openNew}>Nova OS</Button>}
      />

      <section className="stats-grid stats-grid--four">
        <StatCard label="Abertas" value="7" helper="2 marcadas como urgentes" icon={<CircleAlert />} tone="orange" />
        <StatCard label="Em atendimento" value="4" helper="3 técnicos em campo" icon={<Wrench />} tone="green" />
        <StatCard label="Hora marcada" value="5" helper="Para hoje" icon={<Clock3 />} tone="purple" />
        <StatCard label="Finalizadas" value="18" helper="No período selecionado" icon={<CheckCircle2 />} tone="blue" />
      </section>

      <section className="panel data-panel os-panel">
        <div className="data-toolbar">
          <div className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar OS, cliente ou técnico..." /></div>
          <div className="segmented-control"><button className={priority === 'Todas' ? 'active' : ''} onClick={() => setPriority('Todas')}>Todas</button><button className={priority === 'Urgentes' ? 'active' : ''} onClick={() => setPriority('Urgentes')}>Urgentes</button></div>
          <Button variant="secondary" icon={<CalendarDays size={16} />}>1 ago 2026</Button>
          <Button variant="secondary" icon={<Filter size={16} />}>Filtros</Button>
          <div className="view-toggle"><button className={view === 'kanban' ? 'active' : ''} onClick={() => setView('kanban')} aria-label="Visualização em colunas"><Columns3 size={17} /></button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="Visualização em lista"><List size={17} /></button></div>
        </div>

        {view === 'kanban' ? (
          <div className="kanban-board">
            {stages.map((stage) => {
              const stageOrders = filtered.filter((order) => order.status === stage)
              return (
                <section className={`kanban-column kanban-column--${stage}`} key={stage}>
                  <header><span><i />{osStatusLabel[stage]}</span><b>{stageOrders.length}</b></header>
                  <div className="kanban-column__body">
                    {stageOrders.map((order) => (
                      <article className="os-card" key={order.id} onClick={() => openEdit(order)}>
                        <div className="os-card__top"><span>{order.id}</span>{order.priority === 'Urgente' && <Badge tone="red">Urgente</Badge>}</div>
                        <h3>{order.client}</h3>
                        <p>{order.service}</p>
                        <div className="os-meta"><span><Clock3 size={14} />{order.time}</span><span><UserRound size={14} />{order.technician}</span><span><MapPin size={14} />{order.location.split(' · ')[0]}</span></div>
                        {stage !== 'finalizada' ? <button onClick={(event) => { event.stopPropagation(); advance(order) }}>Avançar etapa <ChevronRight size={15} /></button> : <span className="os-complete"><CheckCircle2 size={15} /> Atendimento concluído</span>}
                      </article>
                    ))}
                    {stageOrders.length === 0 && <div className="kanban-empty">Nenhuma OS nesta etapa.</div>}
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table os-table">
              <thead><tr><th>OS / Cliente</th><th>Serviço</th><th>Agenda</th><th>Profissional</th><th>Status</th><th /></tr></thead>
              <tbody>{filtered.map((order) => <tr key={order.id} onClick={() => openEdit(order)}><td><strong>{order.id}</strong><small className="table-secondary">{order.client}</small></td><td><strong className="table-primary">{order.service}</strong><small className="table-secondary">{order.category}</small></td><td>{order.time}<small className="table-secondary">{order.date.split('-').reverse().join('/')}</small></td><td>{order.technician}</td><td><Badge tone={statusTone[order.status]}>{osStatusLabel[order.status]}</Badge></td><td><button className="row-action"><ChevronRight size={18} /></button></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={selected ? `Editar ${selected.id}` : 'Nova ordem de serviço'} description="Cadastre o atendimento e organize o responsável e os horários." size="large">
        <ModalForm onSubmit={submit} onCancel={() => setModalOpen(false)} submitLabel={selected ? 'Salvar alterações' : 'Criar ordem de serviço'}>
          <div className="form-section-title"><span>1</span><div><strong>Atendimento</strong><small>Cliente, serviço e local</small></div></div>
          <div className="form-grid form-grid--two">
            <FormField label="Cliente"><select name="client" defaultValue={selected?.client} required><option value="">Selecione o cliente</option>{clients.map((client) => <option key={client.id}>{client.name}</option>)}</select></FormField>
            <FormField label="Serviço"><input name="service" required defaultValue={selected?.service} placeholder="Ex.: Reparo em vazamento" /></FormField>
            <FormField label="Categoria"><select name="category" defaultValue={selected?.category || 'Elétrica'}><option>Elétrica</option><option>Hidráulica</option><option>Instalação</option><option>Visita técnica</option><option>Serviços gerais</option></select></FormField>
            <FormField label="Local de atendimento"><input name="location" required defaultValue={selected?.location} placeholder="Bairro · Fortaleza" /></FormField>
            <FormField label="Descrição"><textarea name="description" required defaultValue={selected?.description} placeholder="Descreva o que precisa ser executado." rows={3} /></FormField>
          </div>
          <div className="form-section-title"><span>2</span><div><strong>Agenda e execução</strong><small>Data, horário e profissional</small></div></div>
          <div className="form-grid form-grid--four">
            <FormField label="Data"><input name="date" type="date" required defaultValue={selected?.date || '2026-08-01'} /></FormField>
            <FormField label="Hora"><input name="time" type="time" required defaultValue={selected?.time || '08:00'} /></FormField>
            <FormField label="Profissional"><select name="technician" defaultValue={selected?.technician || 'Aguardando'}><option>Aguardando</option><option>Edmilson</option><option>Miguel</option><option>Vandecílio</option></select></FormField>
            <FormField label="Prioridade"><select name="priority" defaultValue={selected?.priority || 'Normal'}><option>Normal</option><option>Urgente</option></select></FormField>
            <FormField label="Status"><select name="status" defaultValue={selected?.status || 'aberta'}>{stages.map((stage) => <option key={stage} value={stage}>{osStatusLabel[stage]}</option>)}</select></FormField>
          </div>
        </ModalForm>
      </Modal>

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </>
  )
}
