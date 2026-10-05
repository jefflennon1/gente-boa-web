import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit3, FolderTree, Layers3, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { financeApi, financeKeys } from '../api/finance'
import { Button, ConfirmDialog, EmptyState, ErrorState, FormError, FormField, LoadingState, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'
import type { CostCenter, SubCostCenter } from '../types-finance'

type Category = 'Receitas' | 'Despesas'
type Editing = { kind: 'center'; item: CostCenter | null } | { kind: 'sub'; item: SubCostCenter | null; centerId: number } | null
type Deleting = { kind: 'center'; item: CostCenter } | { kind: 'sub'; item: SubCostCenter } | null

/** Cadastro de centro de custo e subcentro (POP p.12): criar, editar e excluir, com filtro Receitas/Despesas. */
export function CostCenters() {
  const queryClient = useQueryClient()
  const [category, setCategory] = useState<Category>('Despesas')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<Deleting>(null)
  const [formError, setFormError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)
  const listQuery = useQuery({ queryKey: [...financeKeys.costCenters, category], queryFn: () => financeApi.costCenters.list(category) })
  const centers = listQuery.data ?? []
  const selected = centers.find((center) => center.id === selectedId) ?? centers[0] ?? null

  function showToast(message: string, variant: 'success' | 'error' = 'success') {
    setToast({ message, variant })
    window.setTimeout(() => setToast(null), 3200)
  }
  const invalidate = () => queryClient.invalidateQueries({ queryKey: financeKeys.costCenters })

  const saveMutation = useMutation({
    mutationFn: async (description: string) => {
      if (!editing) return
      if (editing.kind === 'center') {
        return editing.item ? financeApi.costCenters.update(editing.item.id, { category, description }) : financeApi.costCenters.create({ category, description })
      }
      return editing.item ? financeApi.costCenters.updateSubCenter(editing.item.id, { costCenterId: editing.centerId, description }) : financeApi.costCenters.createSubCenter({ costCenterId: editing.centerId, description })
    },
    onSuccess: async (result) => {
      await invalidate()
      if (editing?.kind === 'center' && result && 'subCenters' in result) setSelectedId(result.id)
      setEditing(null)
      showToast('Registro gravado.')
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleting) return
      if (deleting.kind === 'center') await financeApi.costCenters.remove(deleting.item.id)
      else await financeApi.costCenters.removeSubCenter(deleting.item.id)
    },
    onSuccess: async () => { await invalidate(); setDeleting(null); showToast('Registro excluído.') },
    onError: (error) => setDeleteError(apiErrorMessage(error)),
  })

  const subCount = centers.reduce((sum, center) => sum + center.subCenters.length, 0)

  return <>
    <PageHeader eyebrow="Financeiro" title="Centros de custo" subtitle="Centros e subcentros usados para classificar contas a pagar e a receber." actions={<Button icon={<Plus size={18} />} onClick={() => { setFormError(''); setEditing({ kind: 'center', item: null }) }}>Novo centro</Button>} />
    <section className="stats-grid stats-grid--three">
      <StatCard label={`Centros de ${category.toLowerCase()}`} value={String(centers.length)} helper="Cadastrados nesta categoria" icon={<FolderTree />} tone="blue" />
      <StatCard label="Subcentros" value={String(subCount)} helper="Somando todos os centros" icon={<Layers3 />} tone="purple" />
      <StatCard label="Centro selecionado" value={selected ? String(selected.subCenters.length) : '0'} helper={selected ? `Subcentros de ${selected.description}` : 'Nenhum centro selecionado'} icon={<Layers3 />} tone="orange" />
    </section>
    <section className="panel data-panel">
      <div className="data-toolbar"><div className="segmented-control">{(['Despesas', 'Receitas'] as Category[]).map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => { setCategory(item); setSelectedId(null) }}>{item}</button>)}</div></div>
      {listQuery.isLoading ? <LoadingState label="Carregando centros de custo..." /> : listQuery.isError ? <ErrorState message={apiErrorMessage(listQuery.error)} onRetry={() => listQuery.refetch()} /> : centers.length === 0 ? <EmptyState title="Nenhum centro cadastrado" description="Cadastre o primeiro centro de custo desta categoria." /> : <div className="cost-center-layout">
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Código</th><th>Centro de custo</th><th>Subcentros</th><th /></tr></thead><tbody>{centers.map((center) => <tr key={center.id} className={selected?.id === center.id ? 'is-selected' : ''} onClick={() => setSelectedId(center.id)}>
          <td><strong>{center.id}</strong></td><td>{center.description}</td><td>{center.subCenters.length}</td>
          <td><div className="row-actions"><button className="row-action" title="Editar" onClick={(event) => { event.stopPropagation(); setFormError(''); setEditing({ kind: 'center', item: center }) }}><Edit3 size={16} /></button><button className="row-action row-action--danger" title="Excluir" onClick={(event) => { event.stopPropagation(); setDeleteError(''); setDeleting({ kind: 'center', item: center }) }}><Trash2 size={16} /></button></div></td>
        </tr>)}</tbody></table></div>
        <div className="cost-center-subs">
          <header><div><strong>{selected ? `${selected.id} · ${selected.description}` : 'Selecione um centro'}</strong><small>Subcentros de custo</small></div>{selected && <Button variant="secondary" icon={<Plus size={16} />} onClick={() => { setFormError(''); setEditing({ kind: 'sub', item: null, centerId: selected.id }) }}>Novo subcentro</Button>}</header>
          {selected && selected.subCenters.length === 0 ? <EmptyState title="Sem subcentros" description="Cadastre os subcentros deste centro de custo." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Código</th><th>Subcentro</th><th /></tr></thead><tbody>{selected?.subCenters.map((sub) => <tr key={sub.id}>
            <td><strong>{sub.id}</strong></td><td>{sub.description}</td>
            <td><div className="row-actions"><button className="row-action" title="Editar" onClick={() => { setFormError(''); setEditing({ kind: 'sub', item: sub, centerId: sub.costCenterId }) }}><Edit3 size={16} /></button><button className="row-action row-action--danger" title="Excluir" onClick={() => { setDeleteError(''); setDeleting({ kind: 'sub', item: sub }) }}><Trash2 size={16} /></button></div></td>
          </tr>)}</tbody></table></div>}
        </div>
      </div>}
    </section>

    <Modal open={editing !== null} onClose={() => !saveMutation.isPending && setEditing(null)} title={editing?.kind === 'sub' ? (editing.item ? `Alterar subcentro ${editing.item.id}` : 'Novo subcentro de custo') : (editing?.item ? `Alterar centro ${editing.item.id}` : `Novo centro de ${category.toLowerCase()}`)}>
      <ModalForm key={editing ? `${editing.kind}-${editing.item?.id ?? 'new'}` : 'none'} submitting={saveMutation.isPending} onCancel={() => setEditing(null)} onSubmit={(event) => { event.preventDefault(); saveMutation.mutate(String(new FormData(event.currentTarget).get('description') ?? '').trim()) }}>
        <FormError message={formError} />
        {editing?.kind === 'sub' && <FormField label="Centro de custo"><input value={centers.find((center) => center.id === editing.centerId)?.description ?? ''} disabled /></FormField>}
        <FormField label="Descrição"><input name="description" required maxLength={editing?.kind === 'sub' ? 50 : 100} defaultValue={editing?.item?.description ?? ''} autoFocus /></FormField>
        <p className="finance-dialog__hint">Para desativar um item já usado em lançamentos, renomeie incluindo “(DESATIVADO)”, como no sistema anterior.</p>
      </ModalForm>
    </Modal>
    <ConfirmDialog open={deleting !== null} title={`Excluir ${deleting?.kind === 'sub' ? 'subcentro' : 'centro'} ${deleting?.item.id ?? ''}?`} description="Somente registros sem lançamentos de contas a pagar/receber podem ser excluídos." busy={deleteMutation.isPending} error={deleteError} onCancel={() => setDeleting(null)} onConfirm={() => deleteMutation.mutate()} />
    {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
  </>
}
