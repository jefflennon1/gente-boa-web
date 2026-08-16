import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownCircle, ArrowUpCircle, ChevronRight, Edit3, Landmark, Plus, Search, Trash2, WalletCards } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { formatDate, money, toDateTimeInput } from '../lib/format'
import type { Statement, StatementPayload } from '../types'
import { Badge, Button, ConfirmDialog, DetailModal, EmptyState, ErrorState, FormError, FormField, LoadingState, Modal, ModalForm, PageHeader, StatCard, Toast } from '../components/ui'

type FlowFilter = 'Todos' | 'Créditos' | 'Débitos'

function statementPayload(statement: Statement): StatementPayload {
  const { id: _id, code: _code, amount: _amount, status: _status, ...persisted } = statement
  return {
    ...persisted,
    clientName: statement.clientName || '',
    dsmovim: statement.clientName || '',
    sentAt: statement.sentAt || new Date().toISOString(),
    dtinici: statement.sentAt || new Date().toISOString(),
  }
}

export function Statements() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FlowFilter>('Todos')
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<Statement | null>(null)
  const [detail, setDetail] = useState<Statement | null>(null)
  const [statementToDelete, setStatementToDelete] = useState<Statement | null>(null)
  const [toast, setToast] = useState('')
  const [formError, setFormError] = useState('')
  const debouncedSearch = useDebouncedValue(search)

  const statementsQuery = useQuery({ queryKey: [...queryKeys.statements, debouncedSearch], queryFn: () => api.statements.list({ query: debouncedSearch || undefined }) })

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: StatementPayload }) => id ? api.statements.update(id, payload) : api.statements.create(payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.statements })
      setModalOpen(false)
      setSelected(null)
      showToast(variables.id ? 'Movimento atualizado.' : 'Movimento cadastrado no extrato.')
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.statements.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.statements })
      setStatementToDelete(null)
      setModalOpen(false)
      setDetail(null)
      showToast('Movimento removido.')
    },
    onError: (error) => { setStatementToDelete(null); showToast(apiErrorMessage(error)) },
  })

  const statements = statementsQuery.data?.content ?? []
  const filtered = useMemo(() => statements.filter((statement) => filter === 'Todos' || (filter === 'Créditos' ? statement.amount >= 0 : statement.amount < 0)), [filter, statements])
  const credits = statements.reduce((sum, statement) => sum + Number(statement.qtcredi ?? 0), 0)
  const debits = statements.reduce((sum, statement) => sum + Number(statement.qtdebit ?? 0), 0)
  const balance = statements.reduce((sum, statement) => sum + Number(statement.amount ?? 0), 0)

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }

  function openNew() {
    setSelected(null)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(statement: Statement) {
    setDetail(null)
    setSelected(statement)
    setFormError('')
    setModalOpen(true)
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const data = new FormData(event.currentTarget)
    const description = String(data.get('description')).trim()
    const sentAt = String(data.get('date'))
    const payload: StatementPayload = {
      ...(selected ? statementPayload(selected) : {} as StatementPayload),
      clientName: description,
      dsmovim: description,
      sentAt,
      dtinici: sentAt,
      vlinici: Number(data.get('initialBalance') || 0),
      qtcredi: Number(data.get('credits') || 0),
      qtdebit: Number(data.get('debits') || 0),
      qtbolet: Number(data.get('slips') || 0),
      qtdepos: Number(data.get('deposits') || 0),
      qttrans: Number(data.get('transfers') || 0),
      qtresga: Number(data.get('withdrawals') || 0),
      qtoutro: Number(data.get('others') || 0),
      qtchequ: Number(data.get('checks') || 0),
      nrbanco: String(data.get('bank')).trim(),
      nragenc: String(data.get('agency')).trim(),
      nrconta: String(data.get('account')).trim(),
    }
    saveMutation.mutate({ id: selected?.id, payload })
  }

  return (
    <>
      <PageHeader eyebrow="Financeiro" title="Extratos e movimentos" subtitle="Movimentações financeiras conforme o modelo Statement da API." actions={<Button icon={<Plus size={18} />} onClick={openNew}>Novo movimento</Button>} />
      <section className="stats-grid stats-grid--four statement-stats">
        <StatCard label="Movimentos" value={String(statementsQuery.data?.total ?? 0)} helper="Registros encontrados" icon={<WalletCards />} tone="blue" />
        <StatCard label="Créditos" value={money(credits)} helper="Total no retorno atual" icon={<ArrowUpCircle />} tone="green" />
        <StatCard label="Débitos" value={money(debits)} helper="Total no retorno atual" icon={<ArrowDownCircle />} tone="orange" />
        <StatCard label="Saldo movimentado" value={money(balance)} helper="Créditos menos débitos" icon={<Landmark />} tone="purple" />
      </section>

      <section className="panel data-panel">
        <div className="data-toolbar"><div className="segmented-control">{(['Todos', 'Créditos', 'Débitos'] as const).map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="search-box search-box--push"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar descrição ou código..." /></div></div>

        {statementsQuery.isLoading ? <LoadingState label="Carregando extratos..." /> : statementsQuery.isError ? <ErrorState message={apiErrorMessage(statementsQuery.error)} onRetry={() => statementsQuery.refetch()} /> : filtered.length === 0 ? <EmptyState title="Nenhum movimento encontrado" description="Altere os filtros ou registre um movimento." /> : (
          <div className="table-wrap"><table className="data-table statement-table"><thead><tr><th>Código / Descrição</th><th>Data</th><th>Banco</th><th>Agência / Conta</th><th>Créditos</th><th>Débitos</th><th>Saldo</th><th /></tr></thead><tbody>{filtered.map((statement) => (
            <tr key={statement.id} onClick={() => setDetail(statement)}>
              <td><strong>EXT-{statement.id}</strong><small className="table-secondary">{statement.clientName || 'Sem descrição'}</small></td>
              <td>{formatDate(statement.sentAt, true)}</td>
              <td>{statement.nrbanco || 'Não informado'}</td>
              <td>{[statement.nragenc, statement.nrconta].filter(Boolean).join(' / ') || 'Não informado'}</td>
              <td><strong className="positive-value">{money(statement.qtcredi)}</strong></td>
              <td><strong className="negative-value">{money(statement.qtdebit)}</strong></td>
              <td><Badge tone={statement.amount >= 0 ? 'green' : 'red'}>{money(statement.amount)}</Badge></td>
              <td><button className="row-action" aria-label={`Visualizar EXT-${statement.id}`}><ChevronRight size={18} /></button></td>
            </tr>
          ))}</tbody></table></div>
        )}
        <footer className="table-footer"><span><strong>{filtered.length}</strong> de {statementsQuery.data?.total ?? 0} movimentos</span><span>Saldo calculado pela API</span></footer>
      </section>

      <DetailModal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `Movimento EXT-${detail.id}` : 'Detalhes do movimento'}
        description="Identificação bancária, composição financeira e saldo do registro."
        size="large"
        actions={detail ? <><Button variant="danger" icon={<Trash2 size={16} />} disabled={deleteMutation.isPending} onClick={() => setStatementToDelete(detail)}>Excluir</Button><Button icon={<Edit3 size={16} />} onClick={() => openEdit(detail)}>Editar movimento</Button></> : undefined}
      >
        {detail && <StatementDetail statement={detail} />}
      </DetailModal>

      <Modal open={modalOpen} onClose={() => !saveMutation.isPending && setModalOpen(false)} title={selected ? `Editar EXT-${selected.id}` : 'Novo movimento'} description="Campos financeiros do modelo Statement." size="large">
        <ModalForm onSubmit={submit} onCancel={() => setModalOpen(false)} submitting={saveMutation.isPending} submitLabel={saveMutation.isPending ? 'Salvando...' : selected ? 'Salvar alterações' : 'Registrar movimento'}>
          <FormError message={formError} />
          <div className="form-grid form-grid--two">
            <FormField label="Descrição / cliente"><input name="description" maxLength={100} required defaultValue={selected?.clientName ?? ''} /></FormField>
            <FormField label="Data e hora"><input name="date" type="datetime-local" required defaultValue={toDateTimeInput(selected?.sentAt)} /></FormField>
            <FormField label="Banco"><input name="bank" maxLength={50} defaultValue={selected?.nrbanco ?? ''} /></FormField>
            <FormField label="Agência"><input name="agency" maxLength={50} defaultValue={selected?.nragenc ?? ''} /></FormField>
            <FormField label="Conta"><input name="account" maxLength={50} defaultValue={selected?.nrconta ?? ''} /></FormField>
            <FormField label="Saldo inicial"><input name="initialBalance" type="number" step="0.01" defaultValue={selected?.vlinici ?? 0} /></FormField>
          </div>
          <div className="form-section-title"><span>2</span><div><strong>Movimentação</strong><small>Totais por meio de pagamento</small></div></div>
          <div className="form-grid form-grid--four">
            <FormField label="Créditos"><input name="credits" type="number" min="0" step="0.01" defaultValue={selected?.qtcredi ?? 0} /></FormField>
            <FormField label="Débitos"><input name="debits" type="number" min="0" step="0.01" defaultValue={selected?.qtdebit ?? 0} /></FormField>
            <FormField label="Boletos"><input name="slips" type="number" min="0" step="0.01" defaultValue={selected?.qtbolet ?? 0} /></FormField>
            <FormField label="Depósitos"><input name="deposits" type="number" min="0" step="0.01" defaultValue={selected?.qtdepos ?? 0} /></FormField>
            <FormField label="Transferências"><input name="transfers" type="number" min="0" step="0.01" defaultValue={selected?.qttrans ?? 0} /></FormField>
            <FormField label="Resgates"><input name="withdrawals" type="number" min="0" step="0.01" defaultValue={selected?.qtresga ?? 0} /></FormField>
            <FormField label="Cheques"><input name="checks" type="number" min="0" step="0.01" defaultValue={selected?.qtchequ ?? 0} /></FormField>
            <FormField label="Outros"><input name="others" type="number" min="0" step="0.01" defaultValue={selected?.qtoutro ?? 0} /></FormField>
          </div>
          {selected && <div className="destructive-row"><span><strong>Excluir movimento</strong><small>Remove definitivamente o registro da API.</small></span><Button type="button" variant="danger" icon={<Trash2 size={16} />} disabled={deleteMutation.isPending} onClick={() => setStatementToDelete(selected)}>Excluir</Button></div>}
        </ModalForm>
      </Modal>
      <ConfirmDialog open={Boolean(statementToDelete)} title={`Excluir EXT-${statementToDelete?.id}?`} description="O movimento financeiro será removido permanentemente. Esta ação não poderá ser desfeita." confirmLabel="Excluir movimento" busy={deleteMutation.isPending} onCancel={() => setStatementToDelete(null)} onConfirm={() => statementToDelete && !deleteMutation.isPending && deleteMutation.mutate(statementToDelete.id)} />
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </>
  )
}

function StatementDetail({ statement }: { statement: Statement }) {
  return <div className="detail-modal-content">
    <div className="detail-modal__hero-row"><div className="detail-drawer__hero"><span className="detail-avatar"><Landmark /></span><div><span>EXT-{statement.id}</span><h2>{statement.clientName || 'Movimento sem descrição'}</h2><p>{formatDate(statement.sentAt, true)}</p></div></div><Badge tone={statement.amount >= 0 ? 'green' : 'red'}>{money(statement.amount)}</Badge></div>
    <div className="detail-metrics"><span><small>Saldo inicial</small><strong>{money(statement.vlinici)}</strong></span><span><small>Créditos</small><strong className="positive-value">{money(statement.qtcredi)}</strong></span><span><small>Débitos</small><strong className="negative-value">{money(statement.qtdebit)}</strong></span><span><small>Saldo movimentado</small><strong>{money(statement.amount)}</strong></span></div>
    <div className="detail-sections-grid">
      <section className="drawer-section"><h3>Dados bancários</h3><dl><div><dt>Banco</dt><dd>{statement.nrbanco || 'Não informado'}</dd></div><div><dt>Agência</dt><dd>{statement.nragenc || 'Não informada'}</dd></div><div><dt>Conta</dt><dd>{statement.nrconta || 'Não informada'}</dd></div><div><dt>Data do movimento</dt><dd>{formatDate(statement.sentAt, true)}</dd></div></dl></section>
      <section className="drawer-section"><h3>Meios de movimentação</h3><dl><div><dt>Boletos</dt><dd>{money(statement.qtbolet)}</dd></div><div><dt>Depósitos</dt><dd>{money(statement.qtdepos)}</dd></div><div><dt>Transferências</dt><dd>{money(statement.qttrans)}</dd></div><div><dt>Resgates</dt><dd>{money(statement.qtresga)}</dd></div><div><dt>Cheques</dt><dd>{money(statement.qtchequ)}</dd></div><div><dt>Outros</dt><dd>{money(statement.qtoutro)}</dd></div></dl></section>
    </div>
  </div>
}
