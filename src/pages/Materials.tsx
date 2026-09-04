import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, ChevronLeft, ChevronRight, CircleDollarSign, Edit3, PackageCheck, PackageMinus, Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { money } from '../lib/format'
import type { Material, MaterialPayload, Supplier, SupplierPayload } from '../types'
import { Button, ConfirmDialog, EmptyState, ErrorState, FormError, FormField, LoadingState, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'

export function Materials() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [modalOpen, setModalOpen] = useState(false)
  const [supplierModalOpen, setSupplierModalOpen] = useState(false)
  const [selected, setSelected] = useState<Material | null>(null)
  const [supplierId, setSupplierId] = useState('')
  const [createdSupplier, setCreatedSupplier] = useState<Supplier | null>(null)
  const [materialToDelete, setMaterialToDelete] = useState<Material | null>(null)
  const [formError, setFormError] = useState('')
  const [supplierFormError, setSupplierFormError] = useState('')
  const [toast, setToast] = useState('')
  const debouncedSearch = useDebouncedValue(search)

  const materialsQuery = useQuery({
    queryKey: [...queryKeys.materials, 'list', debouncedSearch, page, pageSize],
    queryFn: () => api.materials.list({ query: debouncedSearch || undefined, page, size: pageSize }),
    placeholderData: keepPreviousData,
  })

  const suppliersQuery = useQuery({
    queryKey: [...queryKeys.suppliers, 'material-form'],
    queryFn: () => api.suppliers.list({ page: 0, size: 100 }),
    enabled: modalOpen || supplierModalOpen,
  })

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: MaterialPayload }) => id ? api.materials.update(id, payload) : api.materials.create(payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.materials })
      setModalOpen(false)
      setSelected(null)
      showToast(variables.id ? 'Material atualizado.' : 'Material cadastrado.')
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.materials.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.materials })
      setMaterialToDelete(null)
      setModalOpen(false)
      setSelected(null)
      showToast('Material excluído.')
    },
    onError: (error) => {
      setMaterialToDelete(null)
      showToast(apiErrorMessage(error))
    },
  })

  const saveSupplierMutation = useMutation({
    mutationFn: (payload: SupplierPayload) => api.suppliers.create(payload),
    onSuccess: async (supplier) => {
      setCreatedSupplier(supplier)
      setSupplierId(String(supplier.id))
      setSupplierModalOpen(false)
      setSupplierFormError('')
      await queryClient.invalidateQueries({ queryKey: queryKeys.suppliers })
      showToast('Fornecedor cadastrado e selecionado.')
    },
    onError: (error) => setSupplierFormError(apiErrorMessage(error)),
  })

  const materials = materialsQuery.data?.content ?? []
  const total = materialsQuery.data?.total ?? 0
  const totalPages = materialsQuery.data?.totalPages ?? 0
  const firstResult = total === 0 ? 0 : page * pageSize + 1
  const lastResult = Math.min((page + 1) * pageSize, total)
  const currentStock = materials.reduce((sum, material) => sum + Number(material.currentStock ?? 0), 0)
  const belowMinimum = materials.filter((material) => Number(material.currentStock ?? 0) < Number(material.minimumStock ?? 0)).length
  const inventoryValue = materials.reduce((sum, material) => sum + Number(material.currentStock ?? 0) * Number(material.unitValue ?? 0), 0)
  const supplierOptions = suppliersQuery.data?.content ?? []
  const visibleSupplierOptions = createdSupplier && !supplierOptions.some((supplier) => supplier.id === createdSupplier.id)
    ? [createdSupplier, ...supplierOptions]
    : supplierOptions
  const selectedSupplierMissing = Boolean(supplierId) && !visibleSupplierOptions.some((supplier) => supplier.id === Number(supplierId))

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }

  function openNew() {
    setSelected(null)
    setSupplierId('')
    setCreatedSupplier(null)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(material: Material) {
    setSelected(material)
    setSupplierId(material.supplierId ? String(material.supplierId) : '')
    setCreatedSupplier(null)
    setFormError('')
    setModalOpen(true)
  }

  function openNewSupplier() {
    setSupplierFormError('')
    setSupplierModalOpen(true)
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const numberOrNull = (name: string) => {
      const value = String(data.get(name) ?? '').trim()
      return value === '' ? null : Number(value)
    }
    const payload: MaterialPayload = {
      description: String(data.get('description') ?? '').trim(),
      unit: String(data.get('unit') ?? '').trim() || null,
      minimumStock: numberOrNull('minimumStock'),
      currentStock: numberOrNull('currentStock'),
      unitValue: numberOrNull('unitValue'),
      brand: String(data.get('brand') ?? '').trim() || null,
      supplierId: supplierId ? Number(supplierId) : null,
    }
    saveMutation.mutate({ id: selected?.id, payload })
  }

  function submitSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const textOrNull = (name: string) => String(data.get(name) ?? '').trim() || null
    saveSupplierMutation.mutate({
      tradeName: String(data.get('tradeName') ?? '').trim(),
      legalName: textOrNull('legalName'),
      type: textOrNull('type'),
      cnpj: textOrNull('cnpj'),
      cpf: textOrNull('cpf'),
      address: textOrNull('address'),
      complement: textOrNull('complement'),
      district: textOrNull('district'),
      city: textOrNull('city'),
      state: textOrNull('state')?.toUpperCase() ?? null,
      zipCode: textOrNull('zipCode'),
      phone: textOrNull('phone'),
      contactName: textOrNull('contactName'),
      contactPhone: textOrNull('contactPhone'),
      contactEmail: textOrNull('contactEmail'),
    })
  }

  return <>
    <PageHeader eyebrow="Estoque" title="Cadastro de materiais" subtitle="Produtos disponíveis para inclusão nos pedidos de compra das ordens de serviço." actions={<Button icon={<Plus size={18} />} onClick={openNew}>Novo material</Button>} />

    <section className="stats-grid stats-grid--four">
      <StatCard label="Materiais cadastrados" value={total.toLocaleString('pt-BR')} helper={`${materials.length} nesta página`} icon={<Boxes />} tone="blue" />
      <StatCard label="Estoque nesta página" value={currentStock.toLocaleString('pt-BR')} helper="Soma das quantidades atuais" icon={<PackageCheck />} tone="green" />
      <StatCard label="Abaixo do mínimo" value={String(belowMinimum)} helper="Itens desta página" icon={<PackageMinus />} tone="orange" />
      <StatCard label="Valor em estoque" value={money(inventoryValue)} helper="Estimativa da página atual" icon={<CircleDollarSign />} tone="purple" />
    </section>

    <section className="panel data-panel">
      <div className="data-toolbar data-toolbar--clients">
        <div className="search-box"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Buscar por código, material, marca ou unidade..." /></div>
      </div>

      {materialsQuery.isLoading ? <LoadingState label="Carregando materiais..." /> : materialsQuery.isError ? <ErrorState message={apiErrorMessage(materialsQuery.error)} onRetry={() => materialsQuery.refetch()} /> : materials.length === 0 ? <EmptyState title="Nenhum material encontrado" description="Altere a busca ou cadastre um novo material." /> : <div className={`table-wrap ${materialsQuery.isFetching ? 'table-wrap--refreshing' : ''}`}>
        <table className="data-table materials-table"><thead><tr><th>Código</th><th>Material</th><th>Marca</th><th>Fornecedor</th><th>Unidade</th><th>Estoque mínimo</th><th>Estoque atual</th><th>Valor unitário</th><th /></tr></thead><tbody>{materials.map((material) => <tr key={material.id} onClick={() => openEdit(material)}>
          <td><strong>#{material.id}</strong></td>
          <td><strong className="table-primary">{material.description || 'Sem descrição'}</strong></td>
          <td>{material.brand || 'Não informada'}</td>
          <td>{material.supplierTradeName || material.supplierLegalName || 'Não informado'}</td>
          <td>{material.unit || '—'}</td>
          <td>{Number(material.minimumStock ?? 0).toLocaleString('pt-BR')}</td>
          <td><strong className={Number(material.currentStock ?? 0) < Number(material.minimumStock ?? 0) ? 'negative-value' : 'positive-value'}>{Number(material.currentStock ?? 0).toLocaleString('pt-BR')}</strong></td>
          <td><strong>{money(material.unitValue)}</strong></td>
          <td><button className="row-action" onClick={(event) => { event.stopPropagation(); openEdit(material) }} aria-label={`Editar ${material.description || `material #${material.id}`}`}><Edit3 size={16} /></button></td>
        </tr>)}</tbody></table>
      </div>}

      <footer className="table-footer table-footer--pagination">
        <span>Mostrando <strong>{firstResult}–{lastResult}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong> materiais</span>
        <div className="pagination-controls">
          <label>Por página <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label>
          <button disabled={page === 0 || materialsQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button>
          <span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span>
          <button disabled={page + 1 >= totalPages || materialsQuery.isFetching} onClick={() => setPage((value) => value + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button>
        </div>
      </footer>
    </section>

    <Modal open={modalOpen} onClose={() => !saveMutation.isPending && setModalOpen(false)} title={selected ? `Editar material #${selected.id}` : 'Novo material'} description="Dados utilizados na montagem dos pedidos de compra.">
      <ModalForm onSubmit={submit} onCancel={() => setModalOpen(false)} submitting={saveMutation.isPending} submitLabel={saveMutation.isPending ? 'Salvando...' : selected ? 'Salvar alterações' : 'Cadastrar material'}>
        <FormError message={formError} />
        <div className="form-grid form-grid--two">
          <FormField label="Código"><input value={selected?.id ?? 'Gerado ao salvar'} disabled /></FormField>
          <FormField label="Unidade"><input name="unit" maxLength={20} placeholder="UN, M, KG..." defaultValue={selected?.unit ?? ''} /></FormField>
          <FormField label="Material"><input name="description" required maxLength={100} defaultValue={selected?.description ?? ''} /></FormField>
          <FormField label="Marca"><input name="brand" maxLength={100} defaultValue={selected?.brand ?? ''} /></FormField>
          <FormField label="Estoque mínimo"><input name="minimumStock" type="number" min="0" step="1" defaultValue={selected?.minimumStock ?? 0} /></FormField>
          <FormField label="Estoque atual"><input name="currentStock" type="number" min="0" step="1" defaultValue={selected?.currentStock ?? 0} /></FormField>
          <FormField label="Valor unitário"><input name="unitValue" type="number" min="0" step="0.01" defaultValue={selected?.unitValue ?? 0} /></FormField>
          <div className="form-field">
            <span>Fornecedor</span>
            <div className="material-supplier-control">
              <select name="supplierId" value={supplierId} onChange={(event) => setSupplierId(event.target.value)} disabled={suppliersQuery.isLoading}>
                <option value="">Selecione o fornecedor</option>
                {selectedSupplierMissing && <option value={supplierId}>{selected?.supplierTradeName || selected?.supplierLegalName || `Fornecedor #${supplierId}`}</option>}
                {visibleSupplierOptions.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplierDisplay(supplier)}</option>)}
              </select>
              <button type="button" className="material-supplier-add" onClick={openNewSupplier} title="Cadastrar novo fornecedor" aria-label="Cadastrar novo fornecedor"><Plus size={18} /></button>
            </div>
            {suppliersQuery.isError && <small className="form-field__error">{apiErrorMessage(suppliersQuery.error)}</small>}
          </div>
        </div>
        {selected && <div className="destructive-row"><span><strong>Excluir material</strong><small>Materiais usados em pedidos de compra não poderão ser excluídos.</small></span><Button type="button" variant="danger" icon={<Trash2 size={16} />} onClick={() => setMaterialToDelete(selected)}>Excluir</Button></div>}
      </ModalForm>
    </Modal>

    <Modal open={supplierModalOpen} onClose={() => !saveSupplierMutation.isPending && setSupplierModalOpen(false)} title="Novo fornecedor" description="Cadastre o fornecedor e selecione-o automaticamente no material." size="large">
      <ModalForm onSubmit={submitSupplier} onCancel={() => setSupplierModalOpen(false)} submitting={saveSupplierMutation.isPending} submitLabel={saveSupplierMutation.isPending ? 'Salvando...' : 'Cadastrar fornecedor'}>
        <FormError message={supplierFormError} />
        <div className="form-grid form-grid--two">
          <FormField label="Nome fantasia"><input name="tradeName" required maxLength={100} autoFocus /></FormField>
          <FormField label="Razão social"><input name="legalName" maxLength={100} /></FormField>
          <FormField label="Tipo de fornecedor"><input name="type" maxLength={50} placeholder="Empresa, autônomo..." /></FormField>
          <FormField label="Telefone"><input name="phone" maxLength={18} /></FormField>
          <FormField label="CNPJ"><input name="cnpj" maxLength={18} inputMode="numeric" /></FormField>
          <FormField label="CPF"><input name="cpf" maxLength={18} inputMode="numeric" /></FormField>
          <FormField label="Endereço"><input name="address" maxLength={200} /></FormField>
          <FormField label="Complemento"><input name="complement" maxLength={100} /></FormField>
          <FormField label="Bairro"><input name="district" maxLength={100} /></FormField>
          <FormField label="Cidade"><input name="city" maxLength={100} /></FormField>
          <FormField label="Estado"><input name="state" maxLength={2} placeholder="CE" /></FormField>
          <FormField label="CEP"><input name="zipCode" maxLength={25} inputMode="numeric" /></FormField>
          <FormField label="Contato"><input name="contactName" maxLength={50} /></FormField>
          <FormField label="Telefone do contato"><input name="contactPhone" maxLength={18} /></FormField>
          <FormField label="E-mail do contato"><input name="contactEmail" type="email" maxLength={50} /></FormField>
        </div>
      </ModalForm>
    </Modal>

    <ConfirmDialog open={materialToDelete !== null} title={`Excluir material #${materialToDelete?.id ?? ''}?`} description="Esta ação remove o material do cadastro. Pedidos de compra existentes serão preservados e impedem a exclusão." confirmLabel="Excluir material" busy={deleteMutation.isPending} onCancel={() => setMaterialToDelete(null)} onConfirm={() => materialToDelete && deleteMutation.mutate(materialToDelete.id)} />
    {toast && <Toast message={toast} onClose={() => setToast('')} />}
  </>
}

function supplierDisplay(supplier: Supplier) {
  const name = supplier.tradeName || supplier.legalName || `Fornecedor #${supplier.id}`
  return `${name}${supplier.tradeName && supplier.legalName ? ` — ${supplier.legalName}` : ''} · #${supplier.id}`
}
