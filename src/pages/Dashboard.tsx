import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, CalendarDays, Check, CircleDollarSign, ClipboardCheck, Clock3, FileCheck2, Plus, ReceiptText, TrendingUp, TriangleAlert, UsersRound, Wrench } from 'lucide-react'
import { cashFlow, money, serviceOrders } from '../data/mock'
import { Badge, Button, PageHeader, StatCard, Toast } from '../components/ui'
import { useRouter } from '../router'

const activity = serviceOrders.slice(0, 4)

export function Dashboard() {
  const { navigate } = useRouter()
  const [toast, setToast] = useState('')

  return (
    <>
      <PageHeader
        eyebrow="Painel de controle"
        title="Bom dia, Nathália!"
        subtitle="Aqui está o resumo da operação de hoje, 1 de agosto."
        actions={<Button icon={<Plus size={18} />} onClick={() => navigate('/ordens-de-servico')}>Nova ordem de serviço</Button>}
      />

      <section className="stats-grid stats-grid--four">
        <StatCard label="Receita do mês" value={money(84620)} helper="↑ 12,8% em relação a junho" icon={<TrendingUp />} tone="green" />
        <StatCard label="Contas a receber" value={money(21480)} helper="14 títulos em aberto" icon={<CircleDollarSign />} tone="blue" />
        <StatCard label="Ordens hoje" value="12" helper="4 em atendimento agora" icon={<ClipboardCheck />} tone="orange" />
        <StatCard label="Inadimplência" value="3,2%" helper="↓ 0,6% desde junho" icon={<TriangleAlert />} tone="gold" />
      </section>

      <button className="attention-banner" onClick={() => navigate('/notas-fiscais')}>
        <span className="attention-banner__icon"><FileCheck2 size={21} /></span>
        <span><strong>3 cobranças estão prontas para emissão</strong><small>Notas fiscais, boletos e extratos já conferidos pelo sistema.</small></span>
        <b>Revisar fechamento <ArrowRight size={17} /></b>
      </button>

      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <div className="panel__header">
            <div><span className="eyebrow">Últimos 6 meses</span><h2>Fluxo financeiro</h2></div>
            <div className="chart-legend"><span><i className="legend-dot legend-dot--blue" />Recebido</span><span><i className="legend-dot legend-dot--orange" />A receber</span></div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlow} margin={{ top: 8, right: 0, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="received" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#33399a" stopOpacity={0.28} /><stop offset="100%" stopColor="#33399a" stopOpacity={0.02} /></linearGradient>
                  <linearGradient id="pending" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f48120" stopOpacity={0.2} /><stop offset="100%" stopColor="#f48120" stopOpacity={0.01} /></linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e8e9f1" strokeDasharray="3 5" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#7a7e98', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9a9db0', fontSize: 11 }} tickFormatter={(value) => `${value}k`} />
                <Tooltip formatter={(value) => [`R$ ${value} mil`, '']} contentStyle={{ borderRadius: 12, border: '1px solid #e1e2eb', boxShadow: '0 10px 28px rgba(25,27,61,.12)' }} />
                <Area type="monotone" dataKey="received" stroke="#33399a" strokeWidth={3} fill="url(#received)" isAnimationActive={false} />
                <Area type="monotone" dataKey="pending" stroke="#f48120" strokeWidth={2} fill="url(#pending)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-summary">
            <span>Recebido em julho<strong>{money(84620)}</strong></span>
            <span>Em aberto<strong>{money(21480)}</strong></span>
            <span>Resultado projetado<strong>{money(106100)}</strong></span>
          </div>
        </article>

        <article className="panel schedule-panel">
          <div className="panel__header">
            <div><span className="eyebrow">Agenda operacional</span><h2>Próximos atendimentos</h2></div>
            <button className="panel-link" onClick={() => navigate('/ordens-de-servico')}>Ver agenda <ArrowRight size={15} /></button>
          </div>
          <div className="schedule-list">
            {activity.map((item, index) => (
              <button key={item.id} className="schedule-row" onClick={() => navigate('/ordens-de-servico')}>
                <span className={`schedule-time ${index === 0 ? 'schedule-time--urgent' : ''}`}>{item.time}</span>
                <span className="schedule-main"><strong>{item.client}</strong><small>{item.service}</small></span>
                <span className="schedule-tech">{item.technician}</span>
              </button>
            ))}
          </div>
          <div className="schedule-footer"><Clock3 size={16} /><span>Próxima janela livre: <strong>16:30</strong></span></div>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid--bottom">
        <article className="panel quick-panel">
          <div className="panel__header"><div><span className="eyebrow">Acesso rápido</span><h2>Rotinas frequentes</h2></div></div>
          <div className="quick-actions">
            <button onClick={() => navigate('/clientes')}><span className="quick-icon quick-icon--blue"><UsersRound /></span><span><strong>Novo cliente</strong><small>Cadastro e contrato</small></span><ArrowRight /></button>
            <button onClick={() => navigate('/notas-fiscais')}><span className="quick-icon quick-icon--orange"><ReceiptText /></span><span><strong>Emitir notas</strong><small>3 prontas para lote</small></span><ArrowRight /></button>
            <button onClick={() => navigate('/extratos')}><span className="quick-icon quick-icon--green"><FileCheck2 /></span><span><strong>Enviar extratos</strong><small>2 aguardando envio</small></span><ArrowRight /></button>
          </div>
        </article>

        <article className="panel closing-panel">
          <div className="closing-panel__top">
            <span className="eyebrow">Fechamento mensal</span>
            <Badge tone="green">78% concluído</Badge>
          </div>
          <h2>Julho está quase fechado</h2>
          <p>Faltam apenas as revisões fiscais para concluir o ciclo.</p>
          <div className="progress"><span style={{ width: '78%' }} /></div>
          <div className="closing-steps">
            <span><Check size={15} /> OS conferidas</span>
            <span><Check size={15} /> Boletos gerados</span>
            <span className="closing-steps__pending"><CalendarDays size={15} /> 3 notas para revisar</span>
          </div>
          <Button variant="secondary" onClick={() => { setToast('Resumo do fechamento atualizado.'); setTimeout(() => setToast(''), 3000) }}>Ver detalhes do fechamento</Button>
        </article>
      </section>

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </>
  )
}
