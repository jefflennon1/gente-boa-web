import { useState } from 'react'
import { BarChart3, BriefcaseBusiness, CalendarRange, ChevronRight, CircleDollarSign, ClipboardList, Clock3, Download, FileBarChart, FileDown, FileText, Filter, PieChart, ReceiptText, Search, UsersRound, UserRoundX } from 'lucide-react'
import { Button, FormField, Modal, PageHeader, Toast } from '../components/ui'

const reportGroups = [
  {
    title: 'Operação e serviços',
    description: 'Acompanhamento dos atendimentos e da equipe técnica.',
    icon: ClipboardList,
    reports: [
      { title: 'Ordens de serviço', detail: 'Período, cliente, técnico, status, tipo e categoria', icon: ClipboardList, popular: true },
      { title: 'Utilização dos colaboradores', detail: 'Carga horária, atendimentos e horas extras', icon: Clock3 },
      { title: 'Resumo mensal', detail: 'Contratos, OS, horas e indicadores da reunião', icon: BarChart3 },
    ],
  },
  {
    title: 'Clientes e contratos',
    description: 'Carteira, recorrência e acompanhamento comercial.',
    icon: UsersRound,
    reports: [
      { title: 'Contratos ativos', detail: 'Horas, vencimento, mensalidade e próxima renovação', icon: BriefcaseBusiness, popular: true },
      { title: 'Clientes por canal de venda', detail: 'Origem dos clientes e conversão por canal', icon: PieChart },
      { title: 'Extratos dos clientes', detail: 'Atendimentos, horas e documentos do período', icon: FileText },
    ],
  },
  {
    title: 'Financeiro',
    description: 'Contas, resultados e situações que exigem atenção.',
    icon: CircleDollarSign,
    reports: [
      { title: 'Contas a pagar por período', detail: 'Abertas, quitadas e atrasadas com detalhamento', icon: ReceiptText, popular: true },
      { title: 'Contas por centro de custo', detail: 'Visão detalhada ou resumida por centro e subcentro', icon: FileBarChart },
      { title: 'Contas a receber por período', detail: 'Recebimentos previstos, realizados e vencidos', icon: CircleDollarSign },
      { title: 'Lista de inadimplentes', detail: 'Clientes com boletos e títulos ainda em aberto', icon: UserRoundX },
    ],
  },
]

const recent = [
  { name: 'OS finalizadas · Julho 2026', type: 'Ordens de serviço', date: 'Hoje, 09:18', author: 'Nathália Lira' },
  { name: 'Contas a pagar · 01 a 31/07', type: 'Financeiro', date: 'Ontem, 16:42', author: 'Dielly Gomes' },
  { name: 'Contratos ativos · Reajuste 2026', type: 'Clientes', date: '30 jul, 11:05', author: 'Nathália Lira' },
]

export function Reports() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [toast, setToast] = useState('')

  const generate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPreview(true)
  }

  return (
    <>
      <PageHeader
        eyebrow="Análises"
        title="Relatórios"
        subtitle="Informações operacionais, comerciais e financeiras para decisões mais rápidas."
        actions={<Button variant="secondary" icon={<CalendarRange size={17} />}>Agendar relatório</Button>}
      />

      <section className="reports-hero">
        <div><span className="reports-hero__icon"><FileBarChart size={24} /></span><span><strong>O que você precisa analisar?</strong><small>Encontre um relatório por nome, assunto ou informação.</small></span></div>
        <div className="reports-search"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: contas a pagar, OS, contratos ativos..." /></div>
      </section>

      <div className="report-groups">
        {reportGroups.map((group) => {
          const reports = group.reports.filter((report) => `${report.title} ${report.detail}`.toLowerCase().includes(query.toLowerCase()))
          if (!reports.length) return null
          const GroupIcon = group.icon
          return (
            <section className="report-group" key={group.title}>
              <header><span><GroupIcon size={20} /></span><div><h2>{group.title}</h2><p>{group.description}</p></div></header>
              <div className="report-card-grid">
                {reports.map((report) => { const Icon = report.icon; return <button className="report-card" key={report.title} onClick={() => { setSelected(report.title); setPreview(false) }}><span className="report-card__icon"><Icon size={20} /></span><span><strong>{report.title}{report.popular && <i>Mais usado</i>}</strong><small>{report.detail}</small></span><ChevronRight size={18} /></button> })}
              </div>
            </section>
          )
        })}
      </div>

      <section className="panel recent-reports">
        <div className="panel__header"><div><span className="eyebrow">Histórico</span><h2>Gerados recentemente</h2></div><Button variant="ghost">Ver todos</Button></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Relatório</th><th>Categoria</th><th>Gerado em</th><th>Responsável</th><th /></tr></thead><tbody>{recent.map((item) => <tr key={item.name}><td><div className="report-file"><span><FileText size={17} /></span><strong>{item.name}</strong></div></td><td>{item.type}</td><td>{item.date}</td><td>{item.author}</td><td><button className="row-action" onClick={() => { setToast('Download do relatório simulado.'); setTimeout(() => setToast(''), 3000) }} aria-label="Baixar relatório"><Download size={17} /></button></td></tr>)}</tbody></table></div>
      </section>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected || 'Gerar relatório'} description="Defina os filtros para visualizar e exportar as informações." size="large">
        {!preview ? <form onSubmit={generate}><div className="modal__body"><div className="report-config-intro"><span><Filter size={21} /></span><div><strong>Filtros do relatório</strong><small>Você poderá revisar os dados antes de exportar.</small></div></div><div className="form-grid form-grid--two"><FormField label="Período inicial"><input type="date" defaultValue="2026-07-01" required /></FormField><FormField label="Período final"><input type="date" defaultValue="2026-07-31" required /></FormField><FormField label="Status"><select><option>Todos</option><option>Abertas</option><option>Quitadas / Finalizadas</option><option>Atrasadas</option></select></FormField><FormField label="Formato da visão"><select><option>Detalhado</option><option>Resumido</option></select></FormField><FormField label="Cliente / Fornecedor"><input placeholder="Todos" /></FormField><FormField label="Centro de custo / Técnico"><input placeholder="Todos" /></FormField></div></div><footer className="modal__footer"><Button type="button" variant="secondary" onClick={() => setSelected(null)}>Cancelar</Button><Button type="submit" icon={<BarChart3 size={17} />}>Gerar visualização</Button></footer></form> : <><div className="modal__body report-preview"><div className="report-preview__header"><div><span>Gente Boa Manutenção e Serviços</span><h3>{selected}</h3><small>Período: 01/07/2026 a 31/07/2026</small></div><strong>Prévia</strong></div><div className="report-preview__kpis"><span><small>Total de registros</small><strong>48</strong></span><span><small>Valor consolidado</small><strong>R$ 84.620</strong></span><span><small>Itens pendentes</small><strong>7</strong></span></div><table><thead><tr><th>Código</th><th>Descrição</th><th>Data</th><th>Status</th><th>Valor</th></tr></thead><tbody><tr><td>GB-2581</td><td>Almeida Consultoria</td><td>01/07/2026</td><td>Concluído</td><td>R$ 3.850</td></tr><tr><td>GB-2582</td><td>Condomínio Riviera</td><td>10/07/2026</td><td>Concluído</td><td>R$ 2.980</td></tr><tr><td>GB-2583</td><td>Studio Aurora</td><td>20/07/2026</td><td>Em revisão</td><td>R$ 2.400</td></tr></tbody></table><p>Prévia com 3 de 48 registros. O arquivo exportado conterá todos os dados e os totais consolidados.</p></div><footer className="modal__footer"><Button variant="secondary" onClick={() => setPreview(false)}>Alterar filtros</Button><Button icon={<FileDown size={17} />} onClick={() => { setSelected(null); setToast('Relatório exportado em PDF.'); setTimeout(() => setToast(''), 3000) }}>Exportar PDF</Button></footer></>}
      </Modal>

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </>
  )
}
