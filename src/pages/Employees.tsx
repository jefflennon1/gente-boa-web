import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BriefcaseBusiness, ChevronLeft, ChevronRight, Edit3, Mail, Phone, Plus, Search, Trash2, UserRoundCog } from 'lucide-react'
import { useState } from 'react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { formatDate } from '../lib/format'
import type { Employee, EmployeePayload } from '../types'
import { Button, ConfirmDialog, EmptyState, ErrorState, FormError, FormField, LoadingState, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'

function dateTimeInput(value?: string | null) {
  return value ? value.slice(0, 16) : ''
}

function emptyToNull(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

export function Employees() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<Employee | null>(null)
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null)
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const debouncedSearch = useDebouncedValue(search)

  const employeesQuery = useQuery({
    queryKey: [...queryKeys.employees, 'list', debouncedSearch, page, pageSize],
    queryFn: () => api.employees.list({ query: debouncedSearch || undefined, page, size: pageSize }),
    placeholderData: keepPreviousData,
  })

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: EmployeePayload }) => id ? api.employees.update(id, payload) : api.employees.create(payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.employees })
      setModalOpen(false)
      setSelected(null)
      showToast(variables.id ? 'Funcionário atualizado.' : 'Funcionário cadastrado.')
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.employees.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.employees })
      setEmployeeToDelete(null)
      setDeleteError('')
      setModalOpen(false)
      setSelected(null)
      showToast('Funcionário excluído.')
    },
    onError: (error) => {
      const message = apiErrorMessage(error, 'Não foi possível excluir o funcionário.')
      setDeleteError(message)
      showToast(message, 'error')
    },
  })

  const employees = employeesQuery.data?.content ?? []
  const total = employeesQuery.data?.total ?? 0
  const totalPages = employeesQuery.data?.totalPages ?? 0
  const firstResult = total === 0 ? 0 : page * pageSize + 1
  const lastResult = Math.min((page + 1) * pageSize, total)

  function showToast(message: string, variant: 'success' | 'error' = 'success') {
    setToast({ message, variant })
    window.setTimeout(() => setToast(null), variant === 'error' ? 6000 : 3200)
  }

  function openNew() {
    setSelected(null)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(employee: Employee) {
    setSelected(employee)
    setFormError('')
    setModalOpen(true)
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const commission = String(data.get('commissionPercentage') ?? '').trim()
    const payload: EmployeePayload = {
      name: String(data.get('name') ?? '').trim(),
      nickname: emptyToNull(data.get('nickname')),
      hiredAt: emptyToNull(data.get('hiredAt')),
      position: emptyToNull(data.get('position')),
      address: emptyToNull(data.get('address')),
      complement: emptyToNull(data.get('complement')),
      district: emptyToNull(data.get('district')),
      city: emptyToNull(data.get('city')),
      state: emptyToNull(data.get('state'))?.toUpperCase() ?? null,
      phone: emptyToNull(data.get('phone')),
      secondaryPhone: emptyToNull(data.get('secondaryPhone')),
      cpf: emptyToNull(data.get('cpf')),
      rg: emptyToNull(data.get('rg')),
      commissionPercentage: commission === '' ? null : Number(commission),
      birthDate: emptyToNull(data.get('birthDate')),
      notes: emptyToNull(data.get('notes')),
      terminatedAt: emptyToNull(data.get('terminatedAt')),
      driverLicense: emptyToNull(data.get('driverLicense')),
      tertiaryPhone: emptyToNull(data.get('tertiaryPhone')),
      zipCode: emptyToNull(data.get('zipCode')),
      email: emptyToNull(data.get('email')),
    }
    saveMutation.mutate({ id: selected?.id, payload })
  }

  return <>
    <PageHeader eyebrow="Equipe" title="Cadastro de funcionários" subtitle="Profissionais disponíveis para atendimento e agendamento das ordens de serviço." actions={<Button icon={<Plus size={18} />} onClick={openNew}>Novo funcionário</Button>} />

    <section className="stats-grid stats-grid--four">
      <StatCard label="Funcionários cadastrados" value={total.toLocaleString('pt-BR')} helper={`${employees.length} nesta página`} icon={<UserRoundCog />} tone="blue" />
      <StatCard label="Com telefone" value={String(employees.filter((employee) => employee.phone || employee.secondaryPhone || employee.tertiaryPhone).length)} helper="Contatos nesta página" icon={<Phone />} tone="green" />
      <StatCard label="Cargos nesta página" value={String(new Set(employees.map((employee) => employee.position).filter(Boolean)).size)} helper="Funções distintas" icon={<BriefcaseBusiness />} tone="orange" />
      <StatCard label="Com e-mail" value={String(employees.filter((employee) => employee.email).length)} helper="Contatos nesta página" icon={<Mail />} tone="purple" />
    </section>

    <section className="panel data-panel">
      <div className="data-toolbar data-toolbar--clients">
        <div className="search-box"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Buscar por código, nome, apelido, cargo ou CPF..." /></div>
      </div>

      {employeesQuery.isLoading ? <LoadingState label="Carregando funcionários..." /> : employeesQuery.isError ? <ErrorState message={apiErrorMessage(employeesQuery.error)} onRetry={() => employeesQuery.refetch()} /> : employees.length === 0 ? <EmptyState title="Nenhum funcionário encontrado" description="Altere a busca ou cadastre um novo funcionário." /> : <div className={`table-wrap ${employeesQuery.isFetching ? 'table-wrap--refreshing' : ''}`}>
        <table className="data-table employees-table"><thead><tr><th>Código</th><th>Funcionário</th><th>Cargo</th><th>Telefone</th><th>E-mail</th><th>Contratação</th><th /></tr></thead><tbody>{employees.map((employee) => <tr key={employee.id} onClick={() => openEdit(employee)}>
          <td><strong>#{employee.id}</strong></td>
          <td><strong className="table-primary">{employee.name || 'Sem nome'}</strong>{employee.nickname && <small className="table-secondary">{employee.nickname}</small>}</td>
          <td>{employee.position || 'Não informado'}</td>
          <td>{employee.phone || employee.secondaryPhone || employee.tertiaryPhone || 'Não informado'}</td>
          <td>{employee.email || 'Não informado'}</td>
          <td>{formatDate(employee.hiredAt)}</td>
          <td><div className="row-actions"><button className="row-action" onClick={(event) => { event.stopPropagation(); openEdit(employee) }} aria-label={`Editar ${employee.name}`} title="Editar funcionário"><Edit3 size={16} /></button><button className="row-action row-action--danger" onClick={(event) => { event.stopPropagation(); setDeleteError(''); setEmployeeToDelete(employee) }} aria-label={`Excluir ${employee.name}`} title="Excluir funcionário"><Trash2 size={16} /></button></div></td>
        </tr>)}</tbody></table>
      </div>}

      <footer className="table-footer table-footer--pagination">
        <span>Mostrando <strong>{firstResult}–{lastResult}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong> funcionários</span>
        <div className="pagination-controls">
          <label>Por página <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label>
          <button disabled={page === 0 || employeesQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button>
          <span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span>
          <button disabled={page + 1 >= totalPages || employeesQuery.isFetching} onClick={() => setPage((value) => value + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button>
        </div>
      </footer>
    </section>

    <Modal open={modalOpen} onClose={() => !saveMutation.isPending && setModalOpen(false)} title={selected ? `Editar funcionário #${selected.id}` : 'Novo funcionário'} description="Cadastro utilizado na seleção dos responsáveis pelos agendamentos." size="large">
      <ModalForm onSubmit={submit} onCancel={() => setModalOpen(false)} submitting={saveMutation.isPending} submitLabel={saveMutation.isPending ? 'Salvando...' : selected ? 'Salvar alterações' : 'Cadastrar funcionário'}>
        <FormError message={formError} />
        <div className="form-section-title"><span>1</span><div><strong>Dados profissionais</strong><small>Identificação, cargo e informações do vínculo.</small></div></div>
        <div className="form-grid form-grid--two">
          <FormField label="Código"><input value={selected?.id ?? 'Gerado ao salvar'} disabled /></FormField>
          <FormField label="Nome"><input name="name" required maxLength={100} defaultValue={selected?.name ?? ''} /></FormField>
          <FormField label="Apelido"><input name="nickname" maxLength={100} defaultValue={selected?.nickname ?? ''} /></FormField>
          <FormField label="Cargo"><input name="position" maxLength={50} defaultValue={selected?.position ?? ''} /></FormField>
          <FormField label="Comissão %"><input name="commissionPercentage" type="number" min="0" step="0.01" defaultValue={selected?.commissionPercentage ?? ''} /></FormField>
          <FormField label="Data de contratação"><input name="hiredAt" type="datetime-local" defaultValue={dateTimeInput(selected?.hiredAt)} /></FormField>
          <FormField label="Data de desligamento"><input name="terminatedAt" type="datetime-local" defaultValue={dateTimeInput(selected?.terminatedAt)} /></FormField>
        </div>

        <div className="form-section-title"><span>2</span><div><strong>Contato e documentos</strong><small>Informações para comunicação e identificação.</small></div></div>
        <div className="form-grid form-grid--two">
          <FormField label="Telefone principal"><input name="phone" maxLength={18} defaultValue={selected?.phone ?? ''} /></FormField>
          <FormField label="Telefone secundário"><input name="secondaryPhone" maxLength={18} defaultValue={selected?.secondaryPhone ?? ''} /></FormField>
          <FormField label="Terceiro telefone"><input name="tertiaryPhone" maxLength={18} defaultValue={selected?.tertiaryPhone ?? ''} /></FormField>
          <FormField label="E-mail"><input name="email" type="email" maxLength={100} defaultValue={selected?.email ?? ''} /></FormField>
          <FormField label="CPF"><input name="cpf" maxLength={18} defaultValue={selected?.cpf ?? ''} /></FormField>
          <FormField label="RG"><input name="rg" maxLength={50} defaultValue={selected?.rg ?? ''} /></FormField>
          <FormField label="CNH"><input name="driverLicense" maxLength={50} defaultValue={selected?.driverLicense ?? ''} /></FormField>
          <FormField label="Data de nascimento"><input name="birthDate" type="datetime-local" defaultValue={dateTimeInput(selected?.birthDate)} /></FormField>
        </div>

        <div className="form-section-title"><span>3</span><div><strong>Endereço</strong><small>Localização cadastrada para o funcionário.</small></div></div>
        <div className="form-grid form-grid--two">
          <FormField label="Endereço"><input name="address" maxLength={200} defaultValue={selected?.address ?? ''} /></FormField>
          <FormField label="Complemento"><input name="complement" maxLength={100} defaultValue={selected?.complement ?? ''} /></FormField>
          <FormField label="Bairro"><input name="district" maxLength={100} defaultValue={selected?.district ?? ''} /></FormField>
          <FormField label="Cidade"><input name="city" maxLength={100} defaultValue={selected?.city ?? ''} /></FormField>
          <FormField label="Estado"><input name="state" maxLength={2} defaultValue={selected?.state ?? ''} /></FormField>
          <FormField label="CEP"><input name="zipCode" maxLength={25} defaultValue={selected?.zipCode ?? ''} /></FormField>
          <FormField label="Observações"><textarea name="notes" rows={3} defaultValue={selected?.notes ?? ''} /></FormField>
        </div>
        {selected && <div className="destructive-row"><span><strong>Excluir funcionário</strong><small>Vínculos existentes com clientes, contratos ou ordens de serviço impedem a exclusão.</small></span><Button type="button" variant="danger" icon={<Trash2 size={16} />} onClick={() => { setDeleteError(''); setEmployeeToDelete(selected) }}>Excluir</Button></div>}
      </ModalForm>
    </Modal>

    <ConfirmDialog open={employeeToDelete !== null} title={`Excluir funcionário #${employeeToDelete?.id ?? ''}?`} description="O cadastro será removido apenas se não houver vínculos com clientes, contratos ou agendamentos de ordens de serviço." confirmLabel="Excluir funcionário" busy={deleteMutation.isPending} error={deleteError} onCancel={() => { setEmployeeToDelete(null); setDeleteError('') }} onConfirm={() => employeeToDelete && deleteMutation.mutate(employeeToDelete.id)} />
    {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
  </>
}
