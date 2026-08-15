import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronRight, Clock3, KeyRound, Mail, Plus, Search, ShieldCheck, Trash2, UserCheck, UserCog } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { useAuth } from '../auth'
import { enumLabel, formatDate, initials } from '../lib/format'
import type { AppUser, CreateUserPayload, UpdateUserPayload, UserRole, UserStatus } from '../types'
import { Badge, Button, EmptyState, ErrorState, FormError, FormField, LoadingState, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'

const permissionOptions = ['Dashboard', 'Clientes', 'Ordens de servico', 'Financeiro', 'Notas fiscais', 'Relatorios', 'Usuarios']

function updatePayload(user: AppUser, overrides: Partial<UpdateUserPayload> = {}): UpdateUserPayload {
  return {
    name: user.name,
    initials: user.initials || initials(user.name),
    email: user.email,
    role: user.role,
    status: user.status,
    permissions: user.permissions || [],
    ...overrides,
  }
}

export function Users() {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<AppUser | null>(null)
  const [toast, setToast] = useState('')
  const [formError, setFormError] = useState('')

  const usersQuery = useQuery({ queryKey: queryKeys.users, queryFn: () => api.users.list() })

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: CreateUserPayload | UpdateUserPayload }) => id ? api.users.update(id, payload) : api.users.create(payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.users })
      setModalOpen(false)
      setSelected(null)
      showToast(variables.id ? 'Usuário atualizado.' : 'Usuário criado com sucesso.')
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })

  const statusMutation = useMutation({
    mutationFn: ({ user, status }: { user: AppUser; status: UserStatus }) => api.users.update(user.id, updatePayload(user, { status })),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.users })
      setModalOpen(false)
      showToast(`${updated.name} agora está ${enumLabel(updated.status).toLowerCase()}.`)
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.users.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.users })
      setModalOpen(false)
      showToast('Usuário removido.')
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })

  const users = usersQuery.data?.content ?? []
  const filtered = useMemo(() => users.filter((user) => [user.name, user.email, enumLabel(user.role)].some((value) => value.toLowerCase().includes(search.toLowerCase()))), [search, users])

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }

  function openNew() {
    setSelected(null)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(user: AppUser) {
    setSelected(user)
    setFormError('')
    setModalOpen(true)
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name')).trim()
    const password = String(data.get('password'))
    const base = {
      name,
      initials: initials(name),
      email: String(data.get('email')).trim(),
      role: String(data.get('role')) as UserRole,
      status: String(data.get('status')) as UserStatus,
      permissions: data.getAll('permissions').map(String),
    }
    const payload: CreateUserPayload | UpdateUserPayload = selected
      ? { ...base, ...(password ? { password } : {}) }
      : { ...base, password }
    saveMutation.mutate({ id: selected?.id, payload })
  }

  return (
    <>
      <PageHeader eyebrow="Configurações" title="Usuários e acessos" subtitle="Contas e permissões gerenciadas pela API. Acesso restrito a administradores." actions={<Button icon={<Plus size={18} />} onClick={openNew}>Adicionar usuário</Button>} />
      <section className="stats-grid stats-grid--four">
        <StatCard label="Usuários ativos" value={String(users.filter((user) => user.status === 'ATIVO').length)} helper={`${users.filter((user) => user.status === 'INATIVO').length} inativos`} icon={<UserCheck />} tone="green" />
        <StatCard label="Administradores" value={String(users.filter((user) => user.role === 'ADMINISTRADOR').length)} helper="Acesso completo" icon={<ShieldCheck />} tone="blue" />
        <StatCard label="Total de usuários" value={String(usersQuery.data?.total ?? 0)} helper="Cadastrados na API" icon={<Clock3 />} tone="purple" />
        <StatCard label="Perfis em uso" value={String(new Set(users.map((user) => user.role)).size)} helper="Admin, operação e financeiro" icon={<UserCog />} tone="orange" />
      </section>

      <section className="panel data-panel">
        <div className="data-toolbar"><div className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar usuário, e-mail ou perfil..." /></div><div className="users-security"><KeyRound size={17} /><span>Senhas protegidas pelo backend</span></div></div>

        {usersQuery.isLoading ? <LoadingState label="Carregando usuários..." /> : usersQuery.isError ? <ErrorState message={apiErrorMessage(usersQuery.error)} onRetry={() => usersQuery.refetch()} /> : filtered.length === 0 ? <EmptyState title="Nenhum usuário encontrado" description="Altere a busca ou cadastre um usuário." /> : (
          <div className="user-list">{filtered.map((user) => (
            <article key={user.id}>
              <span className={`user-avatar user-avatar--${user.id % 4}`}>{user.initials || initials(user.name)}</span>
              <div className="user-identity"><strong>{user.name}{user.id === currentUser?.id && <small>Você</small>}</strong><span><Mail size={13} />{user.email}</span></div>
              <div className="user-role"><small>Perfil</small><strong>{enumLabel(user.role)}</strong></div>
              <div className="user-permissions"><small>Acessos</small><span>{(user.permissions || []).slice(0, 3).map((permission) => <i key={permission}>{permission}</i>)}{(user.permissions || []).length > 3 && <b>+{user.permissions.length - 3}</b>}</span></div>
              <div className="user-access"><Badge tone={user.status === 'ATIVO' ? 'green' : 'neutral'}>{enumLabel(user.status)}</Badge><small>{user.lastAccessAt ? formatDate(user.lastAccessAt, true) : 'Sem registro de acesso'}</small></div>
              <button className="row-action" onClick={() => openEdit(user)} aria-label={`Editar ${user.name}`}><ChevronRight size={18} /></button>
            </article>
          ))}</div>
        )}
        <footer className="table-footer"><span><strong>{filtered.length}</strong> de {usersQuery.data?.total ?? 0} usuários</span><span>Endpoint protegido por perfil administrador</span></footer>
      </section>

      <Modal open={modalOpen} onClose={() => !saveMutation.isPending && setModalOpen(false)} title={selected ? 'Editar usuário' : 'Adicionar usuário'} description="Conta criada diretamente no backend." size="large">
        <ModalForm onSubmit={submit} onCancel={() => setModalOpen(false)} submitting={saveMutation.isPending} submitLabel={saveMutation.isPending ? 'Salvando...' : selected ? 'Salvar alterações' : 'Criar usuário'}>
          <FormError message={formError} />
          <div className="form-section-title"><span>1</span><div><strong>Identificação e perfil</strong><small>Dados usados na autenticação</small></div></div>
          <div className="form-grid form-grid--two">
            <FormField label="Nome completo"><input name="name" required defaultValue={selected?.name ?? ''} /></FormField>
            <FormField label="E-mail"><input name="email" type="email" required defaultValue={selected?.email ?? ''} /></FormField>
            <FormField label={selected ? 'Nova senha' : 'Senha'} hint={selected ? 'Deixe em branco para manter a senha atual.' : 'Obrigatória para o primeiro acesso.'}><input name="password" type="password" minLength={6} required={!selected} autoComplete="new-password" /></FormField>
            <FormField label="Perfil"><select name="role" defaultValue={selected?.role || 'OPERACAO'}><option value="ADMINISTRADOR">Administrador</option><option value="OPERACAO">Operação</option><option value="FINANCEIRO">Financeiro</option></select></FormField>
            <FormField label="Situação"><select name="status" defaultValue={selected?.status || 'ATIVO'}><option value="ATIVO">Ativo</option><option value="INATIVO">Inativo</option></select></FormField>
          </div>
          <div className="form-section-title"><span>2</span><div><strong>Permissões de acesso</strong><small>Valores enviados no campo permissions</small></div></div>
          <div className="permission-grid">{permissionOptions.map((permission) => <label key={permission} className="permission-option"><input type="checkbox" name="permissions" value={permission} defaultChecked={selected ? (selected.permissions || []).includes(permission) : ['Dashboard', 'Clientes', 'Ordens de servico'].includes(permission)} /><span><i><Check size={15} /></i><strong>{permission}</strong><small>Acessar e gerenciar este módulo</small></span></label>)}</div>
          {selected && <div className="user-modal-actions"><span><strong>Ações de segurança</strong><small>Altere o status ou remova a conta.</small></span><Button type="button" variant={selected.status === 'ATIVO' ? 'danger' : 'secondary'} disabled={statusMutation.isPending || selected.id === currentUser?.id} onClick={() => statusMutation.mutate({ user: selected, status: selected.status === 'ATIVO' ? 'INATIVO' : 'ATIVO' })}>{selected.status === 'ATIVO' ? 'Desativar acesso' : 'Reativar acesso'}</Button><Button type="button" variant="danger" icon={<Trash2 size={16} />} disabled={deleteMutation.isPending || selected.id === currentUser?.id} onClick={() => window.confirm(`Excluir o usuário ${selected.name}?`) && deleteMutation.mutate(selected.id)}>Excluir</Button></div>}
        </ModalForm>
      </Modal>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </>
  )
}
