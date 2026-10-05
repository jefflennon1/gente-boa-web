import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Clock3, Edit3, FileSpreadsheet, ListOrdered, Plus, Printer, Save, Search, Trash2, UsersRound } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { detailKindLabels, employeeTrackingApi, employeeTrackingKeys, hours, percent, type DailyReportEntry, type DetailPayload, type DetailRow, type OvertimeReport, type PeriodReport, type Workday } from '../api/employeeTracking'
import { api, queryKeys } from '../api/services'
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, FormError, FormField, LoadingState, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'
import { dateText, downloadCsv, monthBounds, moneyText, printElement, todayIso } from '../lib/export'

type Tab = 'workload' | 'detail' | 'reports'
type ReportKind = 'daily' | 'period' | 'overtime'

const weekdays = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const weekday = (date: string) => weekdays[new Date(`${date}T12:00:00`).getDay()]

/** Acompanhamento dos colaboradores (POP p.34-36). */
export function EmployeeTracking() {
  const [tab, setTab] = useState<Tab>('workload')
  const [date, setDate] = useState(todayIso())
  const [employeeId, setEmployeeId] = useState<number | null>(null)
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)
  function showToast(message: string, variant: 'success' | 'error' = 'success') {
    setToast({ message, variant })
    window.setTimeout(() => setToast(null), variant === 'error' ? 6000 : 3000)
  }
  return <>
    <PageHeader eyebrow="Operação" title="Acompanhamento dos colaboradores" subtitle="Carga horária por dia, detalhamento dos atendimentos e relatórios de utilização e horas extras." />
    <nav className="system-parameters-menu" aria-label="Seções do acompanhamento">
      <button className={tab === 'workload' ? 'active' : ''} onClick={() => setTab('workload')}>Carga horária por dia</button>
      <button className={tab === 'detail' ? 'active' : ''} onClick={() => setTab('detail')}>Detalhamento do dia</button>
      <button className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}>Relatórios</button>
    </nav>
    {tab === 'workload' && <WorkloadTab date={date} setDate={setDate} onOpenDetail={(id) => { setEmployeeId(id); setTab('detail') }} showToast={showToast} />}
    {tab === 'detail' && <DetailTab date={date} setDate={setDate} employeeId={employeeId} setEmployeeId={setEmployeeId} showToast={showToast} />}
    {tab === 'reports' && <ReportsTab showToast={showToast} />}
    {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
  </>
}

function WorkloadTab({ date, setDate, onOpenDetail, showToast }: { date: string; setDate: (value: string) => void; onOpenDetail: (employeeId: number) => void; showToast: (message: string, variant?: 'success' | 'error') => void }) {
  const [includeTerminated, setIncludeTerminated] = useState(false)
  const dayQuery = useQuery({ queryKey: [...employeeTrackingKeys.all, 'day', date, includeTerminated], queryFn: () => employeeTrackingApi.day(date, includeTerminated) })
  const rows = dayQuery.data ?? []
  const totals = rows.reduce((sum, row) => ({ worked: sum.worked + row.workedMinutes, registered: sum.registered + row.registered.total, filled: sum.filled + (row.entryTime ? 1 : 0) }), { worked: 0, registered: 0, filled: 0 })
  return <>
    <section className="stats-grid stats-grid--three">
      <StatCard label="Colaboradores" value={String(rows.length)} helper={`${totals.filled} com jornada lançada`} icon={<UsersRound />} tone="blue" />
      <StatCard label="Horas trabalhadas" value={hours(totals.worked)} helper="Entrada até saída, sem o almoço" icon={<Clock3 />} tone="green" />
      <StatCard label="Horas registradas em OS" value={hours(totals.registered)} helper="Trabalho, translado, materiais e garantia" icon={<CalendarClock />} tone="orange" />
    </section>
    <section className="panel data-panel">
      <div className="inline-filters">
        <label><span>Data</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <span className="muted employee-weekday">{weekday(date)}</span>
        <label className="checkbox-inline"><input type="checkbox" checked={includeTerminated} onChange={(event) => setIncludeTerminated(event.target.checked)} /> Verificar com funcionários demitidos</label>
      </div>
      {dayQuery.isLoading ? <LoadingState label="Carregando carga horária..." /> : dayQuery.isError ? <ErrorState message={apiErrorMessage(dayQuery.error)} onRetry={() => dayQuery.refetch()} /> : rows.length === 0 ? <EmptyState title="Nenhum colaborador" description="Não há colaboradores ativos para a data." /> : <div className="table-wrap"><table className="data-table workload-table">
        <thead><tr><th rowSpan={2}>Colaborador</th><th rowSpan={2}>Carga</th><th rowSpan={2}>Entrada</th><th colSpan={3}>Intervalo almoço</th><th rowSpan={2}>Saída</th><th colSpan={2}>Totais</th><th colSpan={5}>Horários registrados em OS</th><th rowSpan={2}>Observações</th><th rowSpan={2} /></tr>
          <tr><th>Início</th><th>Final</th><th>Total</th><th>Tempo</th><th>%</th><th>Trab.</th><th>Trans.</th><th>Mater.</th><th>Garant.</th><th>Total</th></tr></thead>
        <tbody>{rows.map((row) => <WorkloadRow key={`${row.employeeId}-${date}-${row.workdayId ?? 'new'}`} row={row} date={date} onOpenDetail={onOpenDetail} showToast={showToast} />)}</tbody>
      </table></div>}
    </section>
  </>
}

function WorkloadRow({ row, date, onOpenDetail, showToast }: { row: Workday; date: string; onOpenDetail: (employeeId: number) => void; showToast: (message: string, variant?: 'success' | 'error') => void }) {
  const queryClient = useQueryClient()
  const initial = { workload: row.workload ?? '', entryTime: row.entryTime ?? '', lunchStart: row.lunchStart ?? '', lunchEnd: row.lunchEnd ?? '', exitTime: row.exitTime ?? '', notes: row.notes ?? '' }
  const [values, setValues] = useState(initial)
  const dirty = JSON.stringify(values) !== JSON.stringify(initial)
  const mutation = useMutation({
    mutationFn: () => employeeTrackingApi.saveWorkday({ date, employeeId: row.employeeId, ...values }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: employeeTrackingKeys.all }); showToast(`Jornada de ${row.employeeName} gravada.`) },
    onError: (error) => showToast(apiErrorMessage(error), 'error'),
  })
  const preview = useMemo(() => {
    const toMinutes = (value: string) => { const [h, m] = value.split(':').map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null }
    const entry = toMinutes(values.entryTime), exit = toMinutes(values.exitTime), ls = toMinutes(values.lunchStart), le = toMinutes(values.lunchEnd), workload = toMinutes(values.workload) ?? row.workloadMinutes
    const lunch = ls !== null && le !== null && le >= ls ? le - ls : 0
    const worked = entry !== null && exit !== null && exit > entry ? exit - entry - lunch : row.workedMinutes
    return { lunch, worked, workload }
  }, [row.workedMinutes, row.workloadMinutes, values])
  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) => setValues((current) => ({ ...current, [key]: event.target.value }))
  return <tr className={dirty ? 'is-selected' : ''}>
    <td><strong className="table-primary">{row.employeeName}</strong><small className="table-secondary">{row.position || (row.active ? 'Ativo' : 'Desligado')}</small></td>
    <td><input className="time-input" type="time" value={values.workload} onChange={set('workload')} /></td>
    <td><input className="time-input" type="time" value={values.entryTime} onChange={set('entryTime')} /></td>
    <td><input className="time-input" type="time" value={values.lunchStart} onChange={set('lunchStart')} /></td>
    <td><input className="time-input" type="time" value={values.lunchEnd} onChange={set('lunchEnd')} /></td>
    <td>{hours(preview.lunch)}</td>
    <td><input className="time-input" type="time" value={values.exitTime} onChange={set('exitTime')} /></td>
    <td><strong>{hours(preview.worked)}</strong></td>
    <td>{percent(preview.worked, preview.workload)}</td>
    <td>{hours(row.registered.service)}</td><td>{hours(row.registered.transfer)}</td><td>{hours(row.registered.material)}</td><td>{hours(row.registered.warranty)}</td><td><strong>{hours(row.registered.total)}</strong></td>
    <td><input className="notes-input" value={values.notes} maxLength={300} onChange={set('notes')} placeholder="Observações" /></td>
    <td><div className="row-actions"><button className="row-action row-action--success" disabled={!dirty || mutation.isPending} title="Gravar jornada" onClick={() => mutation.mutate()}><Save size={16} /></button><button className="row-action" title="Detalhamento do dia" onClick={() => onOpenDetail(row.employeeId)}><ListOrdered size={16} /></button></div></td>
  </tr>
}

function DetailTab({ date, setDate, employeeId, setEmployeeId, showToast }: { date: string; setDate: (value: string) => void; employeeId: number | null; setEmployeeId: (value: number | null) => void; showToast: (message: string, variant?: 'success' | 'error') => void }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<DetailRow | 'new' | null>(null)
  const [kind, setKind] = useState<DetailPayload['kind']>('SERVICE')
  const [formError, setFormError] = useState('')
  const [toDelete, setToDelete] = useState<DetailRow | null>(null)
  const employeesQuery = useQuery({ queryKey: [...queryKeys.employees, 'tracking-options'], queryFn: () => api.employees.search('') })
  const detailQuery = useQuery({ queryKey: [...employeeTrackingKeys.all, 'detail', date, employeeId], queryFn: () => employeeTrackingApi.detail(date, employeeId!), enabled: employeeId !== null })
  const detail = detailQuery.data
  const invalidate = () => queryClient.invalidateQueries({ queryKey: employeeTrackingKeys.all })
  const saveMutation = useMutation({
    mutationFn: (payload: DetailPayload) => editing && editing !== 'new' ? employeeTrackingApi.updateDetail(editing.id, payload) : employeeTrackingApi.createDetail(payload),
    onSuccess: async () => { await invalidate(); setEditing(null); showToast('Registro gravado.') },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => employeeTrackingApi.deleteDetail(id),
    onSuccess: async () => { await invalidate(); setToDelete(null); showToast('Registro excluído.') },
    onError: (error) => showToast(apiErrorMessage(error), 'error'),
  })
  const employees = (employeesQuery.data ?? []).filter((employee) => employee.id !== 1)
  function openForm(row: DetailRow | 'new') {
    setFormError('')
    setKind(row === 'new' ? 'SERVICE' : row.kind === 'WARRANTY' ? 'SERVICE' : row.kind)
    setEditing(row)
  }
  const editingRow = editing && editing !== 'new' ? editing : null
  const lastEnd = detail?.rows.at(-1)?.endTime ?? ''
  return <section className="panel data-panel">
    <div className="inline-filters">
      <label><span>Data</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <label className="inline-filters__wide"><span>Colaborador</span><select value={employeeId ?? ''} onChange={(event) => setEmployeeId(event.target.value ? Number(event.target.value) : null)}><option value="">Selecione</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.nickname || employee.name} · #{employee.id}{employee.active ? '' : ' (inativo)'}</option>)}</select></label>
      {detail && <div className="employee-day-meta"><span>Almoço: <strong>{detail.workday.lunchStart ?? '--:--'} às {detail.workday.lunchEnd ?? '--:--'}</strong></span><span>Jornada: <strong>{detail.workday.entryTime ?? '--:--'} às {detail.workday.exitTime ?? '--:--'}</strong></span><span>Registrado: <strong>{hours(detail.registered.total)}</strong></span></div>}
      {employeeId && <Button icon={<Plus size={16} />} onClick={() => openForm('new')}>Adicionar registro</Button>}
    </div>
    {!employeeId ? <EmptyState title="Selecione o colaborador" description="Escolha a data e o colaborador para ver e alimentar os atendimentos do dia." /> : detailQuery.isLoading ? <LoadingState label="Carregando atendimentos..." /> : detailQuery.isError ? <ErrorState message={apiErrorMessage(detailQuery.error)} onRetry={() => detailQuery.refetch()} /> : !detail || detail.rows.length === 0 ? <EmptyState title="Nenhum atendimento registrado" description="Adicione os atendimentos, translados e compras de material enviados pelo técnico." /> : <div className="table-wrap"><table className="data-table">
      <thead><tr><th>O.S.</th><th>Tipo</th><th>Cat.</th><th>Cliente</th><th>Descrição</th><th>Hr. ini</th><th>Hr. fin</th><th>Total</th><th /></tr></thead>
      <tbody>{detail.rows.map((row) => <tr key={row.id}>
        <td><strong>{row.serviceOrderId ?? '0'}</strong></td><td><Badge tone={row.kind === 'TRANSFER' ? 'neutral' : row.kind === 'MATERIAL' ? 'purple' : row.kind === 'WARRANTY' ? 'orange' : 'blue'}>{detailKindLabels[row.kind]}</Badge></td><td>{row.categoryFlag ?? ''}</td>
        <td>{row.clientId ? `${row.clientId} · ${row.clientName ?? ''}` : '—'}</td><td>{row.description}</td><td>{row.startTime}</td><td>{row.endTime}</td><td><strong>{hours(row.minutes)}</strong></td>
        <td><div className="row-actions">{row.fromServiceOrderTimer ? <small className="table-secondary">Cronômetro da OS</small> : <><button className="row-action" title="Alterar" onClick={() => openForm(row)}><Edit3 size={16} /></button><button className="row-action row-action--danger" title="Excluir" onClick={() => setToDelete(row)}><Trash2 size={16} /></button></>}</div></td>
      </tr>)}</tbody>
      <tfoot><tr><td colSpan={7}>Trabalho {hours(detail.registered.service)} · Translado {hours(detail.registered.transfer)} · Materiais {hours(detail.registered.material)} · Garantia {hours(detail.registered.warranty)}</td><td>{hours(detail.registered.total)}</td><td /></tr></tfoot>
    </table></div>}

    <Modal open={editing !== null} onClose={() => !saveMutation.isPending && setEditing(null)} title={editingRow ? 'Alterar registro do dia' : 'Novo registro do dia'} description={`${dateText(date)} · ${employees.find((employee) => employee.id === employeeId)?.nickname ?? ''}`}>
      <ModalForm key={editingRow?.id ?? 'new'} submitting={saveMutation.isPending} onCancel={() => setEditing(null)} onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        saveMutation.mutate({ date, employeeId: employeeId!, kind, serviceOrderId: kind === 'TRANSFER' ? null : Number(data.get('serviceOrderId')) || null, description: String(data.get('description') ?? ''), startTime: String(data.get('startTime')), endTime: String(data.get('endTime')) })
      }}>
        <FormError message={formError} />
        <FormField label="Tipo"><select value={kind} onChange={(event) => setKind(event.target.value as DetailPayload['kind'])}><option value="SERVICE">Atendimento na OS</option><option value="TRANSFER">Translado entre OS</option><option value="MATERIAL">Compra de material</option></select></FormField>
        {kind !== 'TRANSFER' && <FormField label="Ordem de serviço"><input name="serviceOrderId" type="number" min="1" required defaultValue={editingRow?.serviceOrderId ?? ''} /></FormField>}
        {kind !== 'MATERIAL' && <FormField label="Descrição" hint={kind === 'SERVICE' ? 'Em branco usa a descrição da OS' : undefined}><input name="description" maxLength={300} defaultValue={editingRow?.description ?? (kind === 'TRANSFER' ? 'Translado entre OS' : '')} /></FormField>}
        <div className="form-grid form-grid--two"><FormField label="Hora inicial"><input name="startTime" type="time" required defaultValue={editingRow?.startTime ?? lastEnd} /></FormField><FormField label="Hora final"><input name="endTime" type="time" required defaultValue={editingRow?.endTime ?? ''} /></FormField></div>
      </ModalForm>
    </Modal>
    <ConfirmDialog open={toDelete !== null} title="Excluir registro?" description={`${toDelete ? detailKindLabels[toDelete.kind] : ''} das ${toDelete?.startTime ?? ''} às ${toDelete?.endTime ?? ''}.`} busy={deleteMutation.isPending} onCancel={() => setToDelete(null)} onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)} />
  </section>
}

function ReportsTab({ showToast }: { showToast: (message: string, variant?: 'success' | 'error') => void }) {
  const bounds = useMemo(() => monthBounds(), [])
  const [kind, setKind] = useState<ReportKind>('daily')
  const [startDate, setStartDate] = useState(bounds.start)
  const [endDate, setEndDate] = useState(bounds.end)
  const [employeeId, setEmployeeId] = useState('')
  const [includeTerminated, setIncludeTerminated] = useState(false)
  const [hourValue, setHourValue] = useState('')
  const printRef = useRef<HTMLDivElement>(null)
  const employeesQuery = useQuery({ queryKey: [...queryKeys.employees, 'tracking-options'], queryFn: () => api.employees.search('') })
  const mutation = useMutation({
    mutationFn: async (): Promise<{ kind: ReportKind; data: DailyReportEntry[] | PeriodReport | OvertimeReport }> => {
      if (kind === 'daily') return { kind, data: await employeeTrackingApi.dailyReport({ startDate, endDate, employeeId: employeeId ? Number(employeeId) : undefined }) }
      if (kind === 'period') return { kind, data: await employeeTrackingApi.periodReport({ startDate, endDate, includeTerminated }) }
      return { kind, data: await employeeTrackingApi.overtimeReport({ startDate, endDate, employeeId: employeeId ? Number(employeeId) : undefined, hourValue: hourValue ? Number(hourValue) : undefined }) }
    },
    onError: (error) => showToast(apiErrorMessage(error), 'error'),
  })
  const result = mutation.data
  const titles: Record<ReportKind, string> = { daily: 'Utilização diária', period: 'Utilização por período', overtime: 'Horas extras' }

  function exportExcel() {
    if (!result) return
    if (result.kind === 'period') {
      const report = result.data as PeriodReport
      downloadCsv('utilizacao-periodo', ['Funcionário', 'Carga horária', 'Trabalhado', '%', 'Translado', '%', 'Materiais', '%', 'Garantia', '%', 'Totais', '%', 'Mão de obra', 'Garantia (OS)', 'Outros', 'Total OS'], [...report.rows, report.totals].map((row) => [row.employeeName, hours(row.workloadMinutes), hours(row.registered.service), percent(row.registered.service, row.workloadMinutes), hours(row.registered.transfer), percent(row.registered.transfer, row.workloadMinutes), hours(row.registered.material), percent(row.registered.material, row.workloadMinutes), hours(row.registered.warranty), percent(row.registered.warranty, row.workloadMinutes), hours(row.registered.total), percent(row.registered.total, row.workloadMinutes), row.laborOrders, row.warrantyOrders, row.otherOrders, row.totalOrders]))
    } else if (result.kind === 'daily') {
      const entries = result.data as DailyReportEntry[]
      downloadCsv('utilizacao-diaria', ['Data', 'Funcionário', 'Carga', 'Entrada', 'Início almoço', 'Fim almoço', 'Saída', 'Total', 'OS', 'Tipo', 'Cliente', 'Descrição', 'Hr. ini', 'Hr. fim', 'Saldo'], entries.flatMap((entry) => (entry.rows.length ? entry.rows : [null]).map((row) => [dateText(entry.workday.date), entry.workday.employeeName, entry.workday.workload, entry.workday.entryTime, entry.workday.lunchStart, entry.workday.lunchEnd, entry.workday.exitTime, hours(entry.workday.workedMinutes), row?.serviceOrderId ?? '', row ? detailKindLabels[row.kind] : '', row?.clientName ?? '', row?.description ?? '', row?.startTime ?? '', row?.endTime ?? '', row ? hours(row.minutes) : ''])))
    } else {
      const report = result.data as OvertimeReport
      downloadCsv('horas-extras', ['Funcionário', 'Data', 'Dia', 'Entrada', 'Início almoço', 'Fim almoço', 'Almoço', 'Saída', 'Carga', 'Trabalhado'], report.employees.flatMap((employee) => employee.weeks.flatMap((week) => week.days.map((day) => [employee.employeeName, dateText(day.date), weekday(day.date), day.entryTime, day.lunchStart, day.lunchEnd, day.lunchTotal, day.exitTime, hours(day.workloadMinutes), hours(day.workedMinutes)]))))
    }
  }

  return <section className="panel data-panel">
    <div className="report-picker report-picker--inline">{(Object.keys(titles) as ReportKind[]).map((key) => <button key={key} className={kind === key ? 'active' : ''} onClick={() => { setKind(key); mutation.reset() }}><strong>{titles[key]}</strong><small>{key === 'daily' ? 'Clientes atendidos no dia com horários e tempo total.' : key === 'period' ? 'Tempo total ao mês e quantidade de OS por tipo.' : 'Carga horária × horas trabalhadas por semana.'}</small></button>)}</div>
    <form className="report-filters" data-allow-enter-submit="true" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
      <label><span>Período de</span><input type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
      <label><span>até</span><input type="date" required value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></label>
      {kind !== 'period' && <label><span>Funcionário</span><select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="">Todos</option>{(employeesQuery.data ?? []).filter((employee) => employee.id !== 1).map((employee) => <option key={employee.id} value={employee.id}>{employee.nickname || employee.name}</option>)}</select></label>}
      {kind === 'period' && <label className="checkbox-inline"><input type="checkbox" checked={includeTerminated} onChange={(event) => setIncludeTerminated(event.target.checked)} /> Incluir funcionários demitidos</label>}
      {kind === 'overtime' && <label><span>Valor da hora extra (R$)</span><input type="number" min="0" step="0.01" value={hourValue} onChange={(event) => setHourValue(event.target.value)} placeholder="Opcional" /></label>}
      <div className="report-filters__actions"><Button type="submit" icon={<Search size={16} />} disabled={mutation.isPending}>{mutation.isPending ? 'Gerando...' : 'Visualizar'}</Button><Button type="button" variant="secondary" icon={<Printer size={16} />} disabled={!result} onClick={() => printElement(printRef.current, titles[kind])}>Imprimir / PDF</Button><Button type="button" variant="secondary" icon={<FileSpreadsheet size={16} />} disabled={!result} onClick={exportExcel}>Excel</Button></div>
    </form>
    {mutation.isPending ? <LoadingState label="Gerando relatório..." /> : !result ? <EmptyState title="Defina os filtros" description="Escolha o relatório e o período e clique em Visualizar." /> : <div className="report-document" ref={printRef}>
      {result.kind === 'daily' && <DailyReportView entries={result.data as DailyReportEntry[]} startDate={startDate} endDate={endDate} />}
      {result.kind === 'period' && <PeriodReportView report={result.data as PeriodReport} />}
      {result.kind === 'overtime' && <OvertimeReportView report={result.data as OvertimeReport} />}
    </div>}
  </section>
}

function DailyReportView({ entries, startDate, endDate }: { entries: DailyReportEntry[]; startDate: string; endDate: string }) {
  if (entries.length === 0) return <p className="muted">Nenhum lançamento no período.</p>
  return <>
    <div className="print-header"><div><h1>GENTE BOA SERVIÇOS</h1><p>Rel. de Utilização por Funcionário</p><small>{dateText(startDate)} a {dateText(endDate)}</small></div></div>
    {entries.map((entry) => { const day = entry.workday; const base = day.workloadMinutes; return <div key={`${day.employeeId}-${day.date}`} className="print-group">
      <h3>Funcionário: {day.employeeId} &nbsp; {day.employeeName} · {dateText(day.date)} ({weekday(day.date)})</h3>
      <table><thead><tr><th>Carga</th><th>Entr.</th><th>I.Alm.</th><th>F.Alm.</th><th>Saída</th><th>Total</th><th>Trabalhado</th><th>Translado</th><th>Materiais</th><th>Garantia</th><th>Total reg.</th></tr></thead>
        <tbody><tr><td>{day.workload}</td><td>{day.entryTime ?? ''}</td><td>{day.lunchStart ?? ''}</td><td>{day.lunchEnd ?? ''}</td><td>{day.exitTime ?? ''}</td><td>{hours(day.workedMinutes)} · {percent(day.workedMinutes, base)}</td><td>{hours(day.registered.service)} · {percent(day.registered.service, base)}</td><td>{hours(day.registered.transfer)} · {percent(day.registered.transfer, base)}</td><td>{hours(day.registered.material)} · {percent(day.registered.material, base)}</td><td>{hours(day.registered.warranty)} · {percent(day.registered.warranty, base)}</td><td>{hours(day.registered.total)} · {percent(day.registered.total, base)}</td></tr></tbody></table>
      {day.notes && <p>OBS: {day.notes}</p>}
      <table><thead><tr><th>O.S.</th><th>Cat.</th><th>Cliente</th><th>Descrição</th><th>Hr. ini.</th><th>Hr. fim</th><th className="num">Saldo</th></tr></thead>
        <tbody>{entry.rows.length === 0 ? <tr><td colSpan={7} className="muted">Sem atendimentos registrados.</td></tr> : entry.rows.map((row) => <tr key={row.id}><td>{row.serviceOrderId ?? 0}</td><td>{row.categoryFlag ?? ''}</td><td>{row.clientId ? `${row.clientId} ${row.clientName ?? ''}` : ''}</td><td>{row.description}</td><td>{row.startTime}</td><td>{row.endTime}</td><td className="num">{hours(row.minutes)}</td></tr>)}</tbody></table>
    </div> })}
  </>
}

function PeriodReportView({ report }: { report: PeriodReport }) {
  const line = (row: PeriodReport['totals'], bold = false) => <tr key={row.employeeId ?? 'total'} className={bold ? 'total-row' : ''}><td>{row.employeeName}</td><td className="num">{hours(row.workloadMinutes)}</td><td className="num">{hours(row.registered.service)}</td><td className="num">{percent(row.registered.service, row.workloadMinutes)}</td><td className="num">{hours(row.registered.transfer)}</td><td className="num">{percent(row.registered.transfer, row.workloadMinutes)}</td><td className="num">{hours(row.registered.material)}</td><td className="num">{percent(row.registered.material, row.workloadMinutes)}</td><td className="num">{hours(row.registered.warranty)}</td><td className="num">{percent(row.registered.warranty, row.workloadMinutes)}</td><td className="num">{hours(row.registered.total)}</td><td className="num">{percent(row.registered.total, row.workloadMinutes)}</td><td className="num">{row.laborOrders}</td><td className="num">{row.warrantyOrders}</td><td className="num">{row.otherOrders}</td><td className="num">{row.totalOrders}</td></tr>
  return <>
    <div className="print-header"><div><h1>GENTE BOA SERVIÇOS</h1><p>Relatório de Acompanhamento dos Horários por Funcionário</p><small>Período: {dateText(report.startDate)} a {dateText(report.endDate)}</small></div></div>
    <table><thead><tr><th>Funcionário</th><th className="num">Carga horária</th><th className="num" colSpan={2}>Trabalhado</th><th className="num" colSpan={2}>Translado</th><th className="num" colSpan={2}>Materiais</th><th className="num" colSpan={2}>Garantia</th><th className="num" colSpan={2}>Totais</th><th className="num">Mão de obra</th><th className="num">Garantia</th><th className="num">Outros</th><th className="num">Total OS</th></tr></thead>
      <tbody>{report.rows.map((row) => line(row))}{line(report.totals, true)}</tbody></table>
  </>
}

function OvertimeReportView({ report }: { report: OvertimeReport }) {
  if (report.employees.length === 0) return <p className="muted">Nenhuma jornada lançada no período.</p>
  return <>
    <div className="print-header"><div><h1>GENTE BOA SERVIÇOS</h1><p>Relatório de Horas Extras</p><small>Período: {dateText(report.startDate)} a {dateText(report.endDate)}{report.hourValue ? ` · Valor da hora extra R$ ${moneyText(report.hourValue)}` : ''}</small></div></div>
    {report.employees.map((employee) => <div key={employee.employeeId} className="print-group">
      <h2>{employee.employeeId} · {employee.employeeName}</h2>
      <table><thead><tr><th>Data</th><th>Dia</th><th>Entrada</th><th>I.Alm.</th><th>F.Alm.</th><th>Almoço</th><th>Saída</th><th className="num">Trabalhado</th></tr></thead>
        <tbody>{employee.weeks.map((week) => [...week.days.map((day) => <tr key={day.date}><td>{dateText(day.date)}</td><td>{weekday(day.date)}</td><td>{day.entryTime ?? ''}</td><td>{day.lunchStart ?? ''}</td><td>{day.lunchEnd ?? ''}</td><td>{day.lunchTotal}</td><td>{day.exitTime ?? ''}</td><td className="num">{hours(day.workedMinutes)}</td></tr>),
          <tr key={`${week.startDate}-total`} className="total-row"><td colSpan={8}>Carga horária {hours(week.workloadMinutes)} (−) Horas trabalhadas {hours(week.workedMinutes)} (=) Qtd. extra {hours(week.extraMinutes)} (×) Valor extra {moneyText(report.hourValue)} (=) Valor total {moneyText(week.extraValue)}</td></tr>])}</tbody></table>
      <div className="print-boxes"><div className="print-box"><small>Carga horária</small><strong>{hours(employee.workloadMinutes)}</strong></div><div className="print-box"><small>Horas trabalhadas</small><strong>{hours(employee.workedMinutes)}</strong></div><div className="print-box"><small>Qtd. extra</small><strong>{hours(employee.extraMinutes)}</strong></div><div className="print-box"><small>Valor total</small><strong>R$ {moneyText(employee.extraValue)}</strong></div></div>
    </div>)}
  </>
}
