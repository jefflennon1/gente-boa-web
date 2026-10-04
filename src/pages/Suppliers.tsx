import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, ChevronLeft, ChevronRight, Edit3, HandCoins, MapPin, Phone, Plus, Search, Trash2, Truck } from 'lucide-react'
import { useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { api, queryKeys } from '../api/services'
import { Button, CollapsibleFilters, ConfirmDialog, EmptyState, ErrorState, FormError, FormField, LoadingState, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import type { Supplier, SupplierPayload } from '../types'
import { useRouter } from '../router'

type ToastState = { message: string; variant: 'success' | 'error' } | null

function emptyToNull(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

function supplierName(supplier: Supplier) {
  return supplier.tradeName || supplier.legalName || `Fornecedor #${supplier.id}`
}

export function Suppliers() {
  const queryClient = useQueryClient()
  const { navigate } = useRouter()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<Supplier | null>(null)
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null)
  const [formError, setFormError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [toast, setToast] = useState<ToastState>(null)
  const debouncedSearch = useDebouncedValue(search.trim())

  const suppliersQuery = useQuery({
    queryKey: [...queryKeys.suppliers, 'management', debouncedSearch, page, pageSize],
    queryFn: () => api.suppliers.list({ query: debouncedSearch || undefined, page, size: pageSize }),
    placeholderData: keepPreviousData,
  })

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: SupplierPayload }) => id
      ? api.suppliers.update(id, payload)
      : api.suppliers.create(payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.suppliers })
      setModalOpen(false)
      setSelected(null)
      showToast(variables.id ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado.')
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.suppliers.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.suppliers })
      setSupplierToDelete(null)
      setDeleteError('')
      setModalOpen(false)
      setSelected(null)
      showToast('Fornecedor excluído.')
    },
    onError: (error) => {
      const message = apiErrorMessage(error, 'Não foi possível excluir o fornecedor.')
      setDeleteError(message)
      showToast(message, 'error')
    },
  })

  const suppliers = suppliersQuery.data?.content ?? []
  const total = suppliersQuery.data?.total ?? 0
  const totalPages = suppliersQuery.data?.totalPages ?? 0
  const firstResult = total === 0 ? 0 : page * pageSize + 1
  const lastResult = Math.min((page + 1) * pageSize, total)
  const withDocument = suppliers.filter((supplier) => supplier.document || supplier.cnpj || supplier.cpf).length
  const cities = new Set(suppliers.map((supplier) => supplier.city?.trim().toLocaleLowerCase('pt-BR')).filter(Boolean)).size
  const withContact = suppliers.filter((supplier) => supplier.contactName || supplier.contactPhone || supplier.contactEmail).length

  function showToast(message: string, variant: 'success' | 'error' = 'success') {
    setToast({ message, variant })
    window.setTimeout(() => setToast(null), variant === 'error' ? 6000 : 3200)
  }

  function openNew() {
    setSelected(null)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(supplier: Supplier) {
    setSelected(supplier)
    setFormError('')
    setModalOpen(true)
  }

  function requestDelete(supplier: Supplier) {
    setDeleteError('')
    setSupplierToDelete(supplier)
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const payload: SupplierPayload = {
      tradeName: emptyToNull(data.get('tradeName')),
      legalName: emptyToNull(data.get('legalName')),
      type: emptyToNull(data.get('type')),
      cnpj: emptyToNull(data.get('cnpj')),
      cpf: emptyToNull(data.get('cpf')),
      address: emptyToNull(data.get('address')),
      complement: emptyToNull(data.get('complement')),
      district: emptyToNull(data.get('district')),
      city: emptyToNull(data.get('city')),
      state: emptyToNull(data.get('state'))?.toUpperCase() ?? null,
      zipCode: emptyToNull(data.get('zipCode')),
      phone: emptyToNull(data.get('phone')),
      contactName: emptyToNull(data.get('contactName')),
      contactPhone: emptyToNull(data.get('contactPhone')),
      contactEmail: emptyToNull(data.get('contactEmail')),
    }
    saveMutation.mutate({ id: selected?.id, payload })
  }

  return <>
    <PageHeader eyebrow="Compras" title="Cadastro de fornecedores" subtitle="Empresas e profissionais disponíveis para materiais e pedidos de compra." actions={<Button icon={<Plus size={18} />} onClick={openNew}>Novo fornecedor</Button>} />

    <section className="stats-grid stats-grid--four">
      <StatCard label="Fornecedores cadastrados" value={total.toLocaleString('pt-BR')} helper={`${suppliers.length} nesta página`} icon={<Truck />} tone="blue" />
      <StatCard label="Com documento" value={String(withDocument)} helper="CNPJ ou CPF nesta página" icon={<Building2 />} tone="green" />
      <StatCard label="Cidades atendidas" value={String(cities)} helper="Cidades distintas nesta página" icon={<MapPin />} tone="orange" />
      <StatCard label="Com contato" value={String(withContact)} helper="Contatos nesta página" icon={<Phone />} tone="purple" />
    </section>

    <section className="panel data-panel">
      <CollapsibleFilters summary="Código, nome, documento, cidade ou contato" activeCount={search.trim() ? 1 : 0} onClear={() => { setSearch(''); setPage(0) }} contentClassName="data-toolbar data-toolbar--clients">
        <div className="search-box"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Buscar por código, nome, documento, cidade ou contato..." /></div>
      </CollapsibleFilters>

      {suppliersQuery.isLoading ? <LoadingState label="Carregando fornecedores..." /> : suppliersQuery.isError ? <ErrorState message={apiErrorMessage(suppliersQuery.error)} onRetry={() => suppliersQuery.refetch()} /> : suppliers.length === 0 ? <EmptyState title="Nenhum fornecedor encontrado" description="Altere a busca ou cadastre um novo fornecedor." /> : <div className={`table-wrap ${suppliersQuery.isFetching ? 'table-wrap--refreshing' : ''}`}>
        <table className="data-table suppliers-table"><thead><tr><th>Código</th><th>Fornecedor</th><th>Documento</th><th>Tipo</th><th>Cidade / UF</th><th>Telefone</th><th>Contato</th><th /></tr></thead><tbody>{suppliers.map((supplier) => <tr key={supplier.id} onClick={() => openEdit(supplier)}>
          <td><strong>#{supplier.id}</strong></td>
          <td><strong className="table-primary">{supplierName(supplier)}</strong>{supplier.tradeName && supplier.legalName && <small className="table-secondary">{supplier.legalName}</small>}</td>
          <td>{supplier.document || supplier.cnpj || supplier.cpf || 'Não informado'}</td>
          <td>{supplier.type || 'Não informado'}</td>
          <td>{[supplier.city, supplier.state].filter(Boolean).join(' / ') || 'Não informado'}</td>
          <td>{supplier.phone || 'Não informado'}</td>
          <td><strong className="table-primary">{supplier.contactName || 'Não informado'}</strong>{(supplier.contactPhone || supplier.contactEmail) && <small className="table-secondary">{supplier.contactPhone || supplier.contactEmail}</small>}</td>
          <td><div className="row-actions"><button className="row-action" onClick={(event) => { event.stopPropagation(); openEdit(supplier) }} aria-label={`Editar ${supplierName(supplier)}`} title="Editar fornecedor"><Edit3 size={16} /></button><button className="row-action row-action--danger" onClick={(event) => { event.stopPropagation(); requestDelete(supplier) }} aria-label={`Excluir ${supplierName(supplier)}`} title="Excluir fornecedor"><Trash2 size={16} /></button></div></td>
        </tr>)}</tbody></table>
      </div>}

      <footer className="table-footer table-footer--pagination">
        <span>Mostrando <strong>{firstResult}–{lastResult}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong> fornecedores</span>
        <div className="pagination-controls">
          <label>Por página <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}>{[5, 10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
          <button disabled={page === 0 || suppliersQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button>
          <span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span>
          <button disabled={page + 1 >= totalPages || suppliersQuery.isFetching} onClick={() => setPage((value) => value + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button>
        </div>
      </footer>
    </section>

    <Modal open={modalOpen} onClose={() => !saveMutation.isPending && setModalOpen(false)} title={selected ? `Editar fornecedor #${selected.id}` : 'Novo fornecedor'} description="Cadastro utilizado em materiais e pedidos de compra." size="large">
      <ModalForm onSubmit={submit} onCancel={() => setModalOpen(false)} submitting={saveMutation.isPending} submitLabel={saveMutation.isPending ? 'Salvando...' : selected ? 'Salvar alterações' : 'Cadastrar fornecedor'}>
        <FormError message={formError} />
        {selected && <div className="supplier-linked-actions"><span><strong>Financeiro do fornecedor</strong><small>Consulte pedidos e dívidas vinculadas a este cadastro.</small></span><Button type="button" variant="secondary" icon={<HandCoins size={16} />} onClick={() => { setModalOpen(false); navigate(`/contas-a-pagar?supplierId=${selected.id}`) }}>Contas a pagar</Button></div>}
        <div className="form-section-title"><span>1</span><div><strong>Identificação</strong><small>Dados cadastrais e documentos do fornecedor.</small></div></div>
        <div className="form-grid form-grid--two">
          <FormField label="Código"><input value={selected?.id ?? 'Gerado ao salvar'} disabled /></FormField>
          <FormField label="Tipo de fornecedor"><input name="type" maxLength={50} placeholder="Empresa, autônomo..." defaultValue={selected?.type ?? ''} /></FormField>
          <FormField label="Nome fantasia"><input name="tradeName" required maxLength={100} defaultValue={selected?.tradeName ?? ''} /></FormField>
          <FormField label="Razão social"><input name="legalName" maxLength={100} defaultValue={selected?.legalName ?? ''} /></FormField>
          <FormField label="CNPJ"><input name="cnpj" maxLength={18} inputMode="numeric" defaultValue={selected?.cnpj ?? ''} /></FormField>
          <FormField label="CPF"><input name="cpf" maxLength={18} inputMode="numeric" defaultValue={selected?.cpf ?? ''} /></FormField>
          <FormField label="Telefone principal"><input name="phone" maxLength={18} defaultValue={selected?.phone ?? ''} /></FormField>
        </div>

        <div className="form-section-title"><span>2</span><div><strong>Endereço</strong><small>Localização principal do fornecedor.</small></div></div>
        <div className="form-grid form-grid--two">
          <FormField label="Endereço"><input name="address" maxLength={200} defaultValue={selected?.address ?? ''} /></FormField>
          <FormField label="Complemento"><input name="complement" maxLength={100} defaultValue={selected?.complement ?? ''} /></FormField>
          <FormField label="Bairro"><input name="district" maxLength={100} defaultValue={selected?.district ?? ''} /></FormField>
          <FormField label="Cidade"><input name="city" maxLength={100} defaultValue={selected?.city ?? ''} /></FormField>
          <FormField label="Estado"><input name="state" maxLength={2} placeholder="CE" defaultValue={selected?.state ?? ''} /></FormField>
          <FormField label="CEP"><input name="zipCode" maxLength={25} inputMode="numeric" defaultValue={selected?.zipCode ?? ''} /></FormField>
        </div>

        <div className="form-section-title"><span>3</span><div><strong>Pessoa de contato</strong><small>Responsável comercial ou administrativo.</small></div></div>
        <div className="form-grid form-grid--two">
          <FormField label="Nome do contato"><input name="contactName" maxLength={50} defaultValue={selected?.contactName ?? ''} /></FormField>
          <FormField label="Telefone do contato"><input name="contactPhone" maxLength={18} defaultValue={selected?.contactPhone ?? ''} /></FormField>
          <FormField label="E-mail do contato"><input name="contactEmail" type="email" maxLength={50} defaultValue={selected?.contactEmail ?? ''} /></FormField>
        </div>
        {selected && <div className="destructive-row"><span><strong>Excluir fornecedor</strong><small>Materiais e pedidos de compra vinculados podem impedir a exclusão.</small></span><Button type="button" variant="danger" icon={<Trash2 size={16} />} onClick={() => requestDelete(selected)}>Excluir</Button></div>}
      </ModalForm>
    </Modal>

    <ConfirmDialog open={supplierToDelete !== null} title={`Excluir ${supplierToDelete ? supplierName(supplierToDelete) : 'fornecedor'}?`} description="O cadastro será removido apenas se não houver materiais ou pedidos de compra vinculados." confirmLabel="Excluir fornecedor" busy={deleteMutation.isPending} error={deleteError} onCancel={() => { setSupplierToDelete(null); setDeleteError('') }} onConfirm={() => supplierToDelete && deleteMutation.mutate(supplierToDelete.id)} />
    {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
  </>
}
