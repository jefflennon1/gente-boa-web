import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit3, Megaphone, Plus, Search, Trash2, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { modulesApi, modulesKeys, type SalesChannel } from '../api/modules'
import { queryKeys } from '../api/services'
import { Button, ConfirmDialog, EmptyState, ErrorState, FormError, FormField, LoadingState, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'

/** Canais de venda (POP p.37-38): como o cliente conheceu a empresa. */
export function SalesChannels() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<SalesChannel | 'new' | null>(null)
  const [formError, setFormError] = useState('')
  const [toDelete, setToDelete] = useState<SalesChannel | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [toast, setToast] = useState('')
  const listQuery = useQuery({ queryKey: modulesKeys.salesChannels, queryFn: modulesApi.salesChannels.list })
  const channels = (listQuery.data ?? []).filter((channel) => channel.description.toLowerCase().includes(search.trim().toLowerCase()) || String(channel.id) === search.trim())
  const invalidate = () => Promise.all([queryClient.invalidateQueries({ queryKey: modulesKeys.salesChannels }), queryClient.invalidateQueries({ queryKey: queryKeys.clients })])
  const saveMutation = useMutation({
    mutationFn: (description: string) => editing && editing !== 'new' ? modulesApi.salesChannels.update(editing.id, description) : modulesApi.salesChannels.create(description),
    onSuccess: async (saved) => { await invalidate(); setEditing(null); setToast(editing !== 'new' && saved.clients ? `Canal atualizado em ${saved.clients} cliente(s).` : 'Canal gravado.') },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => modulesApi.salesChannels.remove(id),
    onSuccess: async () => { await invalidate(); setToDelete(null); setToast('Canal excluído.') },
    onError: (error) => setDeleteError(apiErrorMessage(error)),
  })
  const totalClients = (listQuery.data ?? []).reduce((sum, channel) => sum + channel.clients, 0)
  return <>
    <PageHeader eyebrow="Cadastros" title="Canais de venda" subtitle="Opções do campo “Indicado por” no cadastro do cliente." actions={<Button icon={<Plus size={18} />} onClick={() => { setFormError(''); setEditing('new') }}>Novo canal</Button>} />
    <section className="stats-grid stats-grid--three">
      <StatCard label="Canais cadastrados" value={String(listQuery.data?.length ?? 0)} helper="Total geral" icon={<Megaphone />} tone="blue" />
      <StatCard label="Clientes com canal" value={totalClients.toLocaleString('pt-BR')} helper="Somando todos os canais" icon={<UsersRound />} tone="green" />
      <StatCard label="Canais sem clientes" value={String((listQuery.data ?? []).filter((channel) => channel.clients === 0).length)} helper="Podem ser excluídos" icon={<Trash2 />} tone="orange" />
    </section>
    <section className="panel data-panel">
      <div className="inline-filters"><label className="inline-filters__wide"><span>Busca</span><div className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Descrição ou código" /></div></label></div>
      {listQuery.isLoading ? <LoadingState /> : listQuery.isError ? <ErrorState message={apiErrorMessage(listQuery.error)} onRetry={() => listQuery.refetch()} /> : channels.length === 0 ? <EmptyState title="Nenhum canal" description="Cadastre um novo canal de venda." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Código</th><th>Descrição do canal de venda</th><th className="num">Clientes</th><th /></tr></thead>
        <tbody>{channels.map((channel) => <tr key={channel.id}><td><strong>{channel.id}</strong></td><td>{channel.description}</td><td className="num">{channel.clients.toLocaleString('pt-BR')}</td><td><div className="row-actions"><button className="row-action" title="Editar" onClick={() => { setFormError(''); setEditing(channel) }}><Edit3 size={16} /></button><button className="row-action row-action--danger" title="Excluir" onClick={() => { setDeleteError(''); setToDelete(channel) }}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div>}
    </section>
    <Modal open={editing !== null} onClose={() => !saveMutation.isPending && setEditing(null)} title={editing && editing !== 'new' ? `Alterar canal ${editing.id}` : 'Inclusão de novo canal de venda'}>
      <ModalForm key={editing && editing !== 'new' ? editing.id : 'new'} submitting={saveMutation.isPending} onCancel={() => setEditing(null)} onSubmit={(event) => { event.preventDefault(); saveMutation.mutate(String(new FormData(event.currentTarget).get('description') ?? '').trim()) }}>
        <FormError message={formError} />
        <FormField label="Descrição do canal de venda" hint={editing && editing !== 'new' && editing.clients ? `Ao renomear, ${editing.clients} cliente(s) com este canal serão atualizados.` : undefined}><input name="description" required maxLength={50} autoFocus defaultValue={editing && editing !== 'new' ? editing.description : ''} /></FormField>
      </ModalForm>
    </Modal>
    <ConfirmDialog open={toDelete !== null} title={`Excluir “${toDelete?.description ?? ''}”?`} description="Canais informados em clientes não podem ser excluídos." busy={deleteMutation.isPending} error={deleteError} onCancel={() => setToDelete(null)} onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)} />
    {toast && <Toast message={toast} onClose={() => setToast('')} />}
  </>
}
