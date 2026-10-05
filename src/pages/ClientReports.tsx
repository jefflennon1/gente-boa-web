import { useMutation, useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, Printer, Search } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { modulesApi, modulesKeys, type ChannelReport, type ClientReportRow } from '../api/modules'
import { Badge, Button, EmptyState, ErrorState, LoadingState, PageHeader, Toast } from '../components/ui'
import { dateText, downloadCsv, printElement } from '../lib/export'

type Report = 'listing' | 'birthdays' | 'channels'

const reportOptions: Array<{ key: Report; title: string; detail: string }> = [
  { key: 'listing', title: 'Listagem de clientes', detail: 'Razão social, fantasia, bairro, cidade, contratados ou avulsos, PF ou PJ.' },
  { key: 'birthdays', title: 'Aniversariantes', detail: 'Clientes que fazem aniversário no período (dia/mês).' },
  { key: 'channels', title: 'Clientes por canal de venda', detail: 'De onde veio cada cliente, por período de cadastro.' },
]

/** Relatórios Diversos > clientes (POP p.39-40). */
export function ClientReports() {
  const [report, setReport] = useState<Report>('listing')
  const [filters, setFilters] = useState({ name: '', tradeName: '', type: 'ALL', personType: 'ALL', district: '', city: '', birthdayFrom: '', birthdayTo: '', from: todayMonthDay(), to: todayMonthDay(), contractedOnly: false, startDate: '', endDate: '', channel: '' })
  const [toast, setToast] = useState('')
  const printRef = useRef<HTMLDivElement>(null)
  const channelsQuery = useQuery({ queryKey: modulesKeys.salesChannels, queryFn: modulesApi.salesChannels.list })
  const mutation = useMutation({
    mutationFn: async (): Promise<{ kind: Report; rows: ClientReportRow[]; channels?: ChannelReport['channels'] }> => {
      if (report === 'listing') return { kind: report, rows: await modulesApi.clientReports.listing({ name: filters.name || undefined, tradeName: filters.tradeName || undefined, type: filters.type, personType: filters.personType, district: filters.district || undefined, city: filters.city || undefined, birthdayFrom: filters.birthdayFrom || undefined, birthdayTo: filters.birthdayTo || undefined }) }
      if (report === 'birthdays') return { kind: report, rows: await modulesApi.clientReports.birthdays({ from: filters.from, to: filters.to, contractedOnly: filters.contractedOnly }) }
      const data = await modulesApi.clientReports.byChannel({ startDate: filters.startDate || undefined, endDate: filters.endDate || undefined, channel: filters.channel || undefined })
      return { kind: report, rows: data.clients, channels: data.channels }
    },
    onError: (error) => setToast(apiErrorMessage(error)),
  })
  const result = mutation.data
  const title = reportOptions.find((option) => option.key === report)!.title
  const set = (key: keyof typeof filters) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFilters((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? (event.target as HTMLInputElement).checked : event.target.value }))
  const grouped = useMemo(() => {
    if (!result || result.kind !== 'channels') return []
    const map = new Map<string, ClientReportRow[]>()
    result.rows.forEach((row) => { const key = row.channel?.trim().toUpperCase() || 'NÃO INFORMADO'; map.set(key, [...(map.get(key) ?? []), row]) })
    return [...map.entries()]
  }, [result])

  function exportExcel() {
    if (!result) return
    downloadCsv(title, ['Código', 'Razão social / nome', 'Fantasia', 'Tipo', 'CPF/CNPJ', 'Telefone', 'E-mail', 'Endereço', 'Bairro', 'Cidade', 'UF', 'CEP', 'Aniversário', 'Canal', 'Cadastro', 'Contratado'], result.rows.map((row) => [row.id, row.name, row.tradeName, row.personType === 'J' ? 'Jurídica' : 'Física', row.document, row.phone, row.email, [row.address, row.complement].filter(Boolean).join(', '), row.district, row.city, row.state, row.zipCode, row.birthday, row.channel, dateText(row.registeredAt), row.contracted ? 'Sim' : 'Não']))
  }

  return <>
    <PageHeader eyebrow="Relatórios" title="Relatórios de clientes" subtitle="Listagem com filtros, aniversariantes e clientes por canal de venda." />
    <section className="report-picker">{reportOptions.map((option) => <button key={option.key} className={report === option.key ? 'active' : ''} onClick={() => { setReport(option.key); mutation.reset() }}><strong>{option.title}</strong><small>{option.detail}</small></button>)}</section>
    <section className="panel data-panel">
      <form className="report-filters" data-allow-enter-submit="true" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
        {report === 'listing' && <>
          <label><span>Razão social</span><input value={filters.name} onChange={set('name')} /></label>
          <label><span>Fantasia</span><input value={filters.tradeName} onChange={set('tradeName')} /></label>
          <label><span>Bairro</span><input value={filters.district} onChange={set('district')} /></label>
          <label><span>Cidade</span><input value={filters.city} onChange={set('city')} /></label>
          <label><span>Abrangência</span><select value={filters.type} onChange={set('type')}><option value="ALL">Todos</option><option value="CONTRACTED">Contratados</option><option value="ONE_OFF">Avulsos</option></select></label>
          <label><span>Tipo de cliente</span><select value={filters.personType} onChange={set('personType')}><option value="ALL">Todos</option><option value="F">Pessoa física</option><option value="J">Pessoa jurídica</option></select></label>
          <label><span>Aniversário de (dd/mm)</span><input value={filters.birthdayFrom} onChange={set('birthdayFrom')} placeholder="01/01" maxLength={5} /></label>
          <label><span>até (dd/mm)</span><input value={filters.birthdayTo} onChange={set('birthdayTo')} placeholder="31/12" maxLength={5} /></label>
        </>}
        {report === 'birthdays' && <>
          <label><span>De (dd/mm)</span><input value={filters.from} onChange={set('from')} maxLength={5} required /></label>
          <label><span>Até (dd/mm)</span><input value={filters.to} onChange={set('to')} maxLength={5} required /></label>
          <label className="checkbox-inline"><input type="checkbox" checked={filters.contractedOnly} onChange={set('contractedOnly')} /> Somente contratados</label>
        </>}
        {report === 'channels' && <>
          <label><span>Cadastro de</span><input type="date" value={filters.startDate} onChange={set('startDate')} /></label>
          <label><span>até</span><input type="date" value={filters.endDate} onChange={set('endDate')} /></label>
          <label className="report-filters__wide"><span>Canal de venda</span><select value={filters.channel} onChange={set('channel')}><option value="">Todos</option>{channelsQuery.data?.map((channel) => <option key={channel.id} value={channel.description}>{channel.description}</option>)}</select></label>
        </>}
        <div className="report-filters__actions"><Button type="submit" icon={<Search size={16} />} disabled={mutation.isPending}>{mutation.isPending ? 'Gerando...' : 'Visualizar'}</Button><Button type="button" variant="secondary" icon={<Printer size={16} />} disabled={!result} onClick={() => printElement(printRef.current, title)}>Imprimir / PDF</Button><Button type="button" variant="secondary" icon={<FileSpreadsheet size={16} />} disabled={!result} onClick={exportExcel}>Excel</Button></div>
      </form>
      {mutation.isPending ? <LoadingState label="Gerando relatório..." /> : mutation.isError ? <ErrorState message={apiErrorMessage(mutation.error)} /> : !result ? <EmptyState title="Defina os filtros" description="Escolha o relatório e clique em Visualizar." /> : <div className="report-document" ref={printRef}>
        <div className="print-header"><div><h1>GENTE BOA SERVIÇOS</h1><p>{title}</p></div><small>{result.rows.length} cliente(s)</small></div>
        {result.kind === 'channels' && result.channels && <table><thead><tr><th>Canal de venda</th><th className="num">Clientes</th><th className="num">Contratados</th><th className="num">%</th></tr></thead><tbody>{result.channels.map((channel) => <tr key={channel.channel}><td>{channel.channel}</td><td className="num">{channel.clients}</td><td className="num">{channel.contracted}</td><td className="num">{result.rows.length ? ((channel.clients * 100) / result.rows.length).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : 0}%</td></tr>)}</tbody></table>}
        {result.kind === 'channels' ? grouped.map(([channel, rows]) => <div key={channel} className="print-group"><h3>{channel} ({rows.length})</h3><ClientTable rows={rows} /></div>) : <ClientTable rows={result.rows} birthday={result.kind === 'birthdays'} />}
      </div>}
    </section>
    {toast && <Toast variant="error" message={toast} onClose={() => setToast('')} />}
  </>
}

function ClientTable({ rows, birthday = false }: { rows: ClientReportRow[]; birthday?: boolean }) {
  return <table><thead><tr>{birthday && <th>Aniversário</th>}<th>Código</th><th>Nome / razão social</th><th>Tipo</th><th>Telefone</th><th>E-mail</th><th>Endereço</th><th>Bairro / cidade</th><th>Contrato</th></tr></thead>
    <tbody>{rows.map((row) => <tr key={row.id}>{birthday && <td><strong>{row.birthday}</strong></td>}<td>{row.id}</td><td>{row.name}{row.tradeName ? <small className="muted"> · {row.tradeName}</small> : null}</td><td>{row.personType === 'J' ? 'PJ' : 'PF'}</td><td>{row.phone}</td><td>{row.email}</td><td>{[row.address, row.complement].filter(Boolean).join(', ')}</td><td>{[row.district, row.city].filter(Boolean).join(' / ')}</td><td>{row.contracted ? <Badge tone="green">Contratado</Badge> : 'Avulso'}</td></tr>)}</tbody></table>
}

function todayMonthDay() {
  const now = new Date()
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`
}
