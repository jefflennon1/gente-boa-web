import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Mail, Search, Send } from 'lucide-react'
import { useState } from 'react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { Badge, Button, EmptyState, ErrorState, FormError, FormField, LoadingState, Modal, PageHeader, Toast } from '../components/ui'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { formatDate } from '../lib/format'
import type { ClientEmailPayload } from '../types'

export function ClientEmailsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState('')
  const debouncedSearch = useDebouncedValue(search)

  const clientsQuery = useQuery({
    queryKey: [...queryKeys.emails, 'clients', debouncedSearch, page, pageSize],
    queryFn: () => api.clients.list({
      query: debouncedSearch || undefined,
      sortBy: 'NAME',
      direction: 'ASC',
      page,
      size: pageSize,
    }),
    placeholderData: keepPreviousData,
  })

  const draftQuery = useQuery({
    queryKey: [...queryKeys.emails, 'draft', selectedClientId],
    queryFn: () => api.emails.draft(selectedClientId as number),
    enabled: selectedClientId !== null,
    retry: false,
  })

  const sendMutation = useMutation({
    mutationFn: (payload: ClientEmailPayload) => api.emails.send(payload),
    onSuccess: (response) => {
      setSelectedClientId(null)
      setFormError('')
      setToast(response.message)
      window.setTimeout(() => setToast(''), 3200)
    },
    onError: (error) => setFormError(apiErrorMessage(error, 'Não foi possível enviar o e-mail.')),
  })

  const clients = clientsQuery.data?.content ?? []
  const total = clientsQuery.data?.total ?? 0
  const totalPages = clientsQuery.data?.totalPages ?? 0
  const firstResult = total === 0 ? 0 : page * pageSize + 1
  const lastResult = Math.min((page + 1) * pageSize, total)

  function openComposer(clientId: number) {
    setFormError('')
    setSelectedClientId(clientId)
  }

  function closeComposer() {
    if (sendMutation.isPending) return
    setSelectedClientId(null)
    setFormError('')
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedClientId === null) return
    const data = new FormData(event.currentTarget)
    sendMutation.mutate({
      clientId: selectedClientId,
      subject: String(data.get('subject') ?? '').trim(),
      body: String(data.get('body') ?? '').trim(),
    })
  }

  return <>
    <PageHeader
      eyebrow="Comunicação"
      title="Notificações"
      subtitle="Selecione um cliente e revise a mensagem antes do envio."
    />

    <section className="panel data-panel client-emails-panel">
      <div className="data-toolbar data-toolbar--clients">
        <div className="search-box"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Buscar por código, nome fantasia, razão social, CPF ou CNPJ..." /></div>
        <span className="client-emails-total"><strong>{total.toLocaleString('pt-BR')}</strong> clientes</span>
      </div>

      {clientsQuery.isLoading ? <LoadingState label="Carregando clientes..." /> : clientsQuery.isError ? <ErrorState message={apiErrorMessage(clientsQuery.error)} onRetry={() => clientsQuery.refetch()} /> : clients.length === 0 ? <EmptyState title="Nenhum cliente encontrado" description="Altere os termos da busca." /> : <div className={`table-wrap ${clientsQuery.isFetching ? 'table-wrap--refreshing' : ''}`}>
        <table className="data-table client-emails-table">
          <thead><tr><th>Código</th><th>Nome fantasia</th><th>Razão social</th><th>E-mail</th><th>Contrato</th><th /></tr></thead>
          <tbody>{clients.map((client) => <tr key={client.id}>
            <td><strong>#{client.id}</strong></td>
            <td><strong className="table-primary">{client.tradeName || client.name || 'Não informado'}</strong></td>
            <td>{client.name || 'Não informado'}</td>
            <td>{client.email || <span className="client-email-missing">Não cadastrado</span>}</td>
            <td><Badge tone={client.contract ? 'green' : 'neutral'}>{client.contract ? 'Com contrato' : 'Sem contrato'}</Badge></td>
            <td><Button variant="secondary" icon={<Mail size={15} />} disabled={!client.email} onClick={() => openComposer(client.id)}>Enviar e-mail</Button></td>
          </tr>)}</tbody>
        </table>
      </div>}

      <footer className="table-footer table-footer--pagination">
        <span>Mostrando <strong>{firstResult}–{lastResult}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong> clientes</span>
        <div className="pagination-controls">
          <label>Por página <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label>
          <button disabled={page === 0 || clientsQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button>
          <span>Página <strong>{totalPages ? page + 1 : 0}</strong> de <strong>{totalPages}</strong></span>
          <button disabled={page + 1 >= totalPages || clientsQuery.isFetching} onClick={() => setPage((value) => value + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button>
        </div>
      </footer>
    </section>

    <Modal open={selectedClientId !== null} onClose={closeComposer} title="Enviar e-mail" size="large">
      {draftQuery.isLoading ? <div className="modal__body"><LoadingState label="Preparando e-mail..." /></div> : draftQuery.isError ? <div className="modal__body"><ErrorState message={apiErrorMessage(draftQuery.error)} onRetry={() => draftQuery.refetch()} /></div> : draftQuery.data ? <form key={`${draftQuery.data.clientId}-${draftQuery.data.contractId ?? 'no-contract'}`} onSubmit={submit}>
        <div className="modal__body client-email-composer">
          <FormError message={formError} />
          <div className="client-email-recipient">
            <span><Mail size={18} /></span>
            <div><strong>{draftQuery.data.tradeName || draftQuery.data.clientName}</strong><small>{draftQuery.data.legalName}</small><b>{draftQuery.data.recipient}</b></div>
            <Badge tone={draftQuery.data.minimumTermCompleted ? 'green' : 'blue'}>{draftQuery.data.minimumTermCompleted ? '3 meses concluídos' : 'Mensagem ao cliente'}</Badge>
          </div>
          {draftQuery.data.contractId && <div className="client-email-contract"><span>Contrato <strong>#{draftQuery.data.contractId}</strong></span><span>Início <strong>{formatDate(draftQuery.data.contractDate)}</strong></span><span>Prazo mínimo <strong>{formatDate(draftQuery.data.minimumTermDate)}</strong></span></div>}
          <FormField label="Destinatário"><input value={draftQuery.data.recipient} readOnly /></FormField>
          <FormField label="Assunto"><input name="subject" required maxLength={250} defaultValue={draftQuery.data.subject} /></FormField>
          <FormField label="Mensagem"><textarea name="body" required maxLength={10000} rows={11} defaultValue={draftQuery.data.body} /></FormField>
        </div>
        <footer className="modal__footer"><Button type="button" variant="secondary" onClick={closeComposer} disabled={sendMutation.isPending}>Cancelar</Button><Button type="submit" icon={<Send size={16} />} disabled={sendMutation.isPending}>{sendMutation.isPending ? 'Enviando...' : 'Enviar e-mail'}</Button></footer>
      </form> : null}
    </Modal>

    {toast && <Toast message={toast} onClose={() => setToast('')} />}
  </>
}
