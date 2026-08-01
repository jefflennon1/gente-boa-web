import { useMemo, useState } from 'react'
import { Check, ChevronRight, Clock3, Edit3, KeyRound, Mail, Plus, Search, ShieldCheck, UserCheck, UserCog, UsersRound } from 'lucide-react'
import { users as initialUsers } from '../data/mock'
import type { AppUser } from '../types'
import { Badge, Button, FormField, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'

const permissionOptions = ['Dashboard', 'Clientes', 'Ordens de serviço', 'Financeiro', 'Notas fiscais', 'Relatórios', 'Usuários']

export function Users() {
  const [users, setUsers] = useState(initialUsers)
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<AppUser | null>(null)
  const [toast, setToast] = useState('')

  const filtered = useMemo(() => users.filter((user) => [user.name, user.email, user.role].some((value) => value.toLowerCase().includes(query.toLowerCase()))), [query, users])

  const openNew = () => { setSelected(null); setModalOpen(true) }
  const openEdit = (user: AppUser) => { setSelected(user); setModalOpen(true) }

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name'))
    const payload = {
      name,
      initials: name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase(),
      email: String(data.get('email')),
      role: String(data.get('role')) as AppUser['role'],
      status: String(data.get('status')) as AppUser['status'],
      permissions: data.getAll('permissions').map(String),
    }
    if (selected) setUsers((items) => items.map((item) => item.id === selected.id ? { ...item, ...payload } : item))
    else setUsers((items) => [{ ...payload, id: Math.max(...items.map((item) => item.id)) + 1, lastAccess: 'Convite pendente' }, ...items])
    setModalOpen(false)
    setToast(selected ? 'Usuário atualizado com sucesso.' : 'Convite enviado para o novo usuário.')
    setTimeout(() => setToast(''), 3000)
  }

  const toggleStatus = (user: AppUser) => {
    const status = user.status === 'Ativo' ? 'Inativo' : 'Ativo'
    setUsers((items) => items.map((item) => item.id === user.id ? { ...item, status } : item))
    setToast(`${user.name} agora está ${status.toLowerCase()}.`)
    setTimeout(() => setToast(''), 3000)
  }

  return (
    <>
      <PageHeader
        eyebrow="Configurações"
        title="Usuários e acessos"
        subtitle="Gerencie quem pode acessar e quais áreas do sistema ficam disponíveis."
        actions={<Button icon={<Plus size={18} />} onClick={openNew}>Adicionar usuário</Button>}
      />

      <section className="stats-grid stats-grid--four">
        <StatCard label="Usuários ativos" value="3" helper="1 acesso inativo" icon={<UserCheck />} tone="green" />
        <StatCard label="Administradores" value="1" helper="Acesso completo" icon={<ShieldCheck />} tone="blue" />
        <StatCard label="Acessos hoje" value="3" helper="Último há 8 minutos" icon={<Clock3 />} tone="purple" />
        <StatCard label="Perfis configurados" value="3" helper="Admin, operação e financeiro" icon={<UserCog />} tone="orange" />
      </section>

      <section className="panel data-panel">
        <div className="data-toolbar"><div className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar usuário, e-mail ou perfil..." /></div><div className="users-security"><KeyRound size={17} /><span>Autenticação em duas etapas recomendada</span><Button variant="ghost">Configurar</Button></div></div>
        <div className="user-list">
          {filtered.map((user) => (
            <article key={user.id}>
              <span className={`user-avatar user-avatar--${user.id % 4}`}>{user.initials}</span>
              <div className="user-identity"><strong>{user.name}{user.id === 1 && <small>Você</small>}</strong><span><Mail size={13} />{user.email}</span></div>
              <div className="user-role"><small>Perfil</small><strong>{user.role}</strong></div>
              <div className="user-permissions"><small>Acessos</small><span>{user.permissions.slice(0, 3).map((permission) => <i key={permission}>{permission}</i>)}{user.permissions.length > 3 && <b>+{user.permissions.length - 3}</b>}</span></div>
              <div className="user-access"><Badge tone={user.status === 'Ativo' ? 'green' : 'neutral'}>{user.status}</Badge><small>{user.lastAccess}</small></div>
              <button className="row-action" onClick={() => openEdit(user)} aria-label={`Editar ${user.name}`}><ChevronRight size={18} /></button>
            </article>
          ))}
        </div>
        <footer className="table-footer"><span><strong>{filtered.length}</strong> usuários cadastrados</span><span>Permissões atualizadas em tempo real</span></footer>
      </section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={selected ? 'Editar usuário' : 'Adicionar usuário'} description="Defina os dados de acesso e as áreas que ficarão disponíveis." size="large">
        <ModalForm onSubmit={submit} onCancel={() => setModalOpen(false)} submitLabel={selected ? 'Salvar alterações' : 'Enviar convite'}>
          <div className="form-section-title"><span>1</span><div><strong>Identificação e perfil</strong><small>Dados usados no acesso ao sistema</small></div></div>
          <div className="form-grid form-grid--two">
            <FormField label="Nome completo"><input name="name" required defaultValue={selected?.name} placeholder="Nome do usuário" /></FormField>
            <FormField label="E-mail"><input name="email" type="email" required defaultValue={selected?.email} placeholder="usuario@genteboa.com.br" /></FormField>
            <FormField label="Perfil"><select name="role" defaultValue={selected?.role || 'Operação'}><option>Administrador</option><option>Operação</option><option>Financeiro</option></select></FormField>
            <FormField label="Situação"><select name="status" defaultValue={selected?.status || 'Ativo'}><option>Ativo</option><option>Inativo</option></select></FormField>
          </div>
          <div className="form-section-title"><span>2</span><div><strong>Permissões de acesso</strong><small>Selecione o que este usuário pode visualizar e alterar</small></div></div>
          <div className="permission-grid">
            {permissionOptions.map((permission) => <label key={permission} className="permission-option"><input type="checkbox" name="permissions" value={permission} defaultChecked={selected ? selected.permissions.includes(permission) : ['Dashboard', 'Clientes', 'Ordens de serviço'].includes(permission)} /><span><i><Check size={15} /></i><strong>{permission}</strong><small>{permission === 'Dashboard' ? 'Indicadores gerais da empresa' : permission === 'Usuários' ? 'Usuários, perfis e configurações' : `Visualizar e gerenciar ${permission.toLowerCase()}`}</small></span></label>)}
          </div>
          {selected && <div className="user-modal-actions"><span><strong>Ações de segurança</strong><small>Revogue o acesso imediatamente ou solicite uma nova senha.</small></span><Button type="button" variant="secondary" icon={<KeyRound size={16} />} onClick={() => { setModalOpen(false); setToast('Link de redefinição de senha enviado.'); setTimeout(() => setToast(''), 3000) }}>Redefinir senha</Button><Button type="button" variant={selected.status === 'Ativo' ? 'danger' : 'secondary'} onClick={() => { toggleStatus(selected); setModalOpen(false) }}>{selected.status === 'Ativo' ? 'Desativar acesso' : 'Reativar acesso'}</Button></div>}
        </ModalForm>
      </Modal>

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </>
  )
}
