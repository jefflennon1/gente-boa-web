import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ChevronRight, CircleDollarSign, ExternalLink, FileBarChart, FileCheck2, FileSignature, MapPin, ReceiptText, Timer, UserRound, WalletCards, Wrench } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import { enumLabel, formatDate, money } from '../lib/format'
import { contractMinuteValue } from '../lib/contracts'
import { useRouter } from '../router'
import type { AccountsReceivableListItem, Client } from '../types'
import type { BillStatementSource } from '../api/modules'
import { ClientDetail, formatCep } from './ClientDetail'
import { ClientHourTracking } from './ClientHourTracking'
import { ClientStatementDetails, DetailTable, formatMinutes } from './BillingDetails'
import { RenewalHistorySection } from './ContractRenewalHistory'
import { PartyReceipts } from './ReceiptsPanel'
import { Badge, Button, EmptyState, ErrorState, LoadingState, Modal } from './ui'

type Section = 'profile' | 'bill' | 'pending' | 'bills' | 'receivables' | 'contracts' | 'locations' | 'orders' | 'hours' | 'statement' | 'receipts' | `extra:${string}`

/** Seção própria de quem abre o modal (ex.: o contrato), exibida no topo do menu lateral. */
export type ClientWorkspaceExtraSection = { id: string; label: string; icon: ReactNode; content: ReactNode; actions?: ReactNode }

type ClientWorkspaceModalProps = {
  open: boolean
  clientId: number | null
  /** Nome exibido enquanto o cadastro carrega (ex.: o nome que já aparece na linha do boleto). */
  clientLabel?: string
  /** Boleto que originou a consulta: vira a seção "Boleto selecionado", com as ações dele no rodapé. */
  bill?: { label?: string; title: string; content: ReactNode; actions?: ReactNode; showPendingBills?: boolean } | null
  /** Quando informado, os boletos da lista do cliente podem ser abertos na seção do boleto. */
  onSelectBill?: (billId: number) => void
  /** Abre o extrato de um boleto a gerar (horas utilizadas, rateio por local e valores). */
  onOpenStatement?: (source: BillStatementSource) => void
  /** Ações do rodapé em "Dados cadastrais" (ex.: editar/excluir no cadastro de clientes). */
  profileActions?: ReactNode
  /** Mostra "Boletos a gerar" como item do menu (usado quando não há boleto selecionado). */
  showPendingBills?: boolean
  /** Seções extras no topo do menu; a primeira abre por padrão. */
  extraSections?: ClientWorkspaceExtraSection[]
  title?: string
  description?: string
  onClose: () => void
}

/**
 * Modal "Dados do cliente" no formato da tela do Delphi: ficha cadastral à primeira vista e um menu lateral
 * com tudo o que está vinculado ao cliente (boletos, contas a receber, contratos, locais, OS, horas e extrato).
 */
export function ClientWorkspaceModal({ open, clientId, clientLabel, bill, onSelectBill, onOpenStatement, profileActions, showPendingBills, extraSections = [], title, description, onClose }: ClientWorkspaceModalProps) {
  const { navigate } = useRouter()
  const [section, setSection] = useState<Section>(extraSections.length ? `extra:${extraSections[0].id}` : 'profile')
  const activeExtra = extraSections.find((item) => section === `extra:${item.id}`)
  const clientQuery = useQuery({ queryKey: [...queryKeys.clients, 'detail', clientId], queryFn: () => api.clients.find(clientId!), enabled: open && clientId !== null })
  const client = clientQuery.data
  const name = client?.nmfanta || client?.name || client?.nmrazao || clientLabel || (clientId ? `Cliente #${clientId}` : 'Cliente')

  const menu: Array<{ id: Section; label: string; icon: ReactNode; hidden?: boolean }> = [
    ...extraSections.map((item) => ({ id: `extra:${item.id}` as Section, label: item.label, icon: item.icon })),
    { id: 'profile', label: 'Dados cadastrais', icon: <UserRound size={17} /> },
    { id: 'bill', label: bill?.label ?? 'Boleto selecionado', icon: <ReceiptText size={17} />, hidden: !bill },
    { id: 'pending', label: 'Boletos a gerar', icon: <ReceiptText size={17} />, hidden: Boolean(bill) || !showPendingBills },
    { id: 'bills', label: 'Boletos do cliente', icon: <WalletCards size={17} /> },
    { id: 'receivables', label: 'Contas a receber', icon: <CircleDollarSign size={17} /> },
    { id: 'receipts', label: 'Recibos', icon: <FileCheck2 size={17} /> },
    { id: 'contracts', label: 'Contratos', icon: <FileSignature size={17} /> },
    { id: 'locations', label: 'Locais de atendimento', icon: <MapPin size={17} /> },
    { id: 'orders', label: 'Ordens de serviço', icon: <Wrench size={17} /> },
    { id: 'hours', label: 'Acompanhamento de horas', icon: <Timer size={17} /> },
    { id: 'statement', label: 'Extrato e rateio', icon: <FileBarChart size={17} /> },
  ]

  function selectBill(billId: number) {
    onSelectBill?.(billId)
    setSection('bill')
  }

  const footer = activeExtra ? activeExtra.actions : section === 'bill' ? bill?.actions : section === 'profile' && profileActions ? profileActions : section === 'profile' && clientId ? <Button variant="secondary" icon={<ExternalLink size={16} />} onClick={() => navigate(`/clientes?id=${clientId}`)}>Abrir no cadastro de clientes</Button> : null

  return <Modal open={open} onClose={onClose} title={title ?? `Dados do cliente · ${name}`} description={description ?? (clientId ? `Cliente #${clientId}${client?.document ? ` · ${client.document}` : ''}` : undefined)} size="xlarge">
    <div className="modal__body client-workspace">
      <nav className="client-workspace__menu" aria-label="Informações do cliente">
        {menu.filter((item) => !item.hidden).map((item) => <button key={item.id} type="button" className={section === item.id ? 'active' : ''} aria-current={section === item.id ? 'page' : undefined} onClick={() => setSection(item.id)}>{item.icon}<span>{item.label}</span></button>)}
      </nav>
      <div className="client-workspace__content">
        {activeExtra ? <div className="client-workspace__section">{activeExtra.content}</div>
          : section === 'bill' && bill ? <div className="client-workspace__section">{bill.content}{bill.showPendingBills && clientId !== null && <PendingBillsBlock clientId={clientId} client={client} onOpenStatement={onOpenStatement} />}</div>
          : clientId === null ? <EmptyState title="Cliente não identificado" description="Este registro não está vinculado a um cadastro de cliente." />
          : section === 'profile' ? (clientQuery.isLoading ? <LoadingState label="Carregando cadastro do cliente..." /> : clientQuery.isError ? <ErrorState message={apiErrorMessage(clientQuery.error)} onRetry={() => clientQuery.refetch()} /> : client ? <ClientDetail client={client} /> : null)
          : section === 'pending' ? <div className="client-workspace__section"><PendingBillsBlock clientId={clientId} client={client} onOpenStatement={onOpenStatement} /></div>
          : section === 'bills' ? <ClientBillsSection clientId={clientId} client={client} onSelect={onSelectBill ? selectBill : undefined} onOpenStatement={onOpenStatement} />
          : section === 'receivables' ? <ClientReceivablesSection clientId={clientId} />
          : section === 'receipts' ? <PartyReceipts kind="receivable" partyId={clientId} />
          : section === 'contracts' ? <ClientContractsSection clientId={clientId} />
          : section === 'locations' ? <ClientLocationsSection clientId={clientId} />
          : section === 'orders' ? <ClientOrdersSection clientId={clientId} />
          : section === 'hours' ? <ClientHoursSection clientId={clientId} clientName={name} />
          : <ClientStatementSection clientId={clientId} />}
      </div>
    </div>
    {footer && <footer className="modal__footer detail-modal__footer">{footer}</footer>}
  </Modal>
}

function SectionHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <header className="client-workspace__heading"><div><h3>{title}</h3><p>{description}</p></div>{action}</header>
}

function LinkButton({ to, children }: { to: string; children: ReactNode }) {
  const { navigate } = useRouter()
  return <button type="button" className="drawer-section__action" onClick={() => navigate(to)}>{children} <ChevronRight size={15} /></button>
}

function ClientBillsSection({ clientId, client, onSelect, onOpenStatement }: { clientId: number; client?: Client; onSelect?: (billId: number) => void; onOpenStatement?: (source: BillStatementSource) => void }) {
  // A listagem de boletos filtra por documento ou nome; o resultado é conferido pelo código do cliente.
  const cpf = client?.nrcpf?.replace(/\D/g, '') || undefined
  const cnpj = client?.nrcnpj?.replace(/\D/g, '') || undefined
  const clientName = cpf || cnpj ? undefined : client?.nmrazao || client?.name || client?.nmfanta || undefined
  const billsQuery = useQuery({
    queryKey: [...queryKeys.bills, 'client', clientId, cpf, cnpj, clientName],
    queryFn: () => api.bills.list({ cpf, cnpj, clientName, paymentStatus: 'ALL', billingType: 'ALL', page: 0, size: 100 }),
    enabled: Boolean(cpf || cnpj || clientName),
  })
  const bills = (billsQuery.data?.content ?? []).filter((bill) => bill.clientId === clientId)
  const pending = bills.filter((bill) => !bill.paid)
  return <div className="client-workspace__section">
    <PendingBillsBlock clientId={clientId} client={client} onOpenStatement={onOpenStatement} />
    <SectionHeader title="Boletos do cliente" description={onSelect ? 'Clique em um boleto para ver a cobrança completa e as ações de pagamento e envio.' : 'Boletos já gerados para este cliente.'} />
    <div className="detail-metrics"><span><small>Boletos</small><strong>{bills.length}</strong></span><span><small>Pendentes</small><strong>{pending.length}</strong></span><span><small>Valor pendente</small><strong>{money(pending.reduce((sum, bill) => sum + Number(bill.amount || 0), 0))}</strong></span></div>
    {!client || billsQuery.isLoading ? <LoadingState label="Carregando boletos do cliente..." /> : billsQuery.isError ? <ErrorState message={apiErrorMessage(billsQuery.error)} onRetry={() => billsQuery.refetch()} /> : bills.length === 0 ? <EmptyState title="Nenhum boleto encontrado" description="Este cliente ainda não possui boletos gerados." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Boleto</th><th>OS</th><th>Contrato</th><th>Processado</th><th>Vencimento</th><th>Valor</th><th>Situação</th></tr></thead><tbody>{bills.map((bill) => <tr key={bill.id} onClick={onSelect ? () => onSelect(bill.id) : undefined}>
      <td><strong>#{bill.number || bill.id}</strong></td><td>{bill.serviceOrderId || 'CR'}</td><td>{bill.contractId ? `#${bill.contractId}` : 'Avulso'}</td><td>{formatDate(bill.processedAt)}</td><td>{formatDate(bill.dueAt)}</td><td><strong>{money(bill.amount)}</strong></td>
      <td><Badge tone={bill.paid ? 'green' : 'orange'}>{bill.paid ? 'Pago' : 'Pendente'}</Badge>{bill.paidAt && <small className="table-secondary">{formatDate(bill.paidAt)}</small>}</td>
    </tr>)}</tbody></table></div>}
  </div>
}

/**
 * Boletos a gerar: contas a receber ainda não faturadas, agrupadas por vencimento (cada vencimento vira um boleto).
 * A OS de contrato vence no mês seguinte, no dia do contrato, e entra no mesmo boleto da parcela do contrato.
 */
function PendingBillsBlock({ clientId, client, onOpenStatement }: { clientId: number; client?: Client; onOpenStatement?: (source: BillStatementSource) => void }) {
  // A busca compara com o documento do jeito que está gravado; o resultado é conferido pelo código do cliente.
  const search = client?.nrcnpj?.trim() || client?.nrcpf?.trim() || client?.nmrazao || client?.name || ''
  const receivablesQuery = useQuery({
    queryKey: [...queryKeys.accountsReceivable, 'client-pending', clientId, search],
    queryFn: () => api.accountsReceivable.list({ query: search, generatedStatus: 'PENDING', paymentStatus: 'PENDING', billingType: 'ALL', page: 0, size: 200 }),
    enabled: Boolean(search),
  })
  const groups = useMemo(() => {
    const byDueDate = new Map<string, AccountsReceivableListItem[]>()
    ;(receivablesQuery.data?.content ?? [])
      .filter((item) => item.clientId === clientId && !item.generated && !item.paid)
      .forEach((item) => {
        const dueDate = String(item.dueAt ?? '').slice(0, 10)
        byDueDate.set(dueDate, [...(byDueDate.get(dueDate) ?? []), item])
      })
    return [...byDueDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dueDate, items]) => ({ dueDate, items, total: items.reduce((sum, item) => sum + Number(item.balance || item.amount || 0), 0) }))
  }, [clientId, receivablesQuery.data])

  return <>
    <SectionHeader title="Boletos a gerar" description="Todas as cobranças deste cliente que ainda não viraram boleto, agrupadas pelo vencimento. A OS de contrato entra no boleto do mês seguinte, junto com a parcela do contrato." />
    {!client || receivablesQuery.isLoading ? <LoadingState label="Carregando boletos a gerar..." /> : receivablesQuery.isError ? <ErrorState message={apiErrorMessage(receivablesQuery.error)} onRetry={() => receivablesQuery.refetch()} /> : groups.length === 0 ? <EmptyState title="Nenhum boleto a gerar" description="Não há contas a receber pendentes de faturamento para este cliente." /> : <div className="table-wrap"><table className="data-table client-workspace__pending-bills"><thead><tr><th>Vencimento</th><th>Composição</th><th>Valor</th><th /></tr></thead><tbody>{groups.map((group) => {
      const orders = group.items.filter((item) => item.serviceOrderId)
      return <tr key={group.dueDate}>
        <td><strong>{formatDate(group.dueDate)}</strong>{orders.length > 0 && <small className="table-secondary"><Badge tone="orange">{orders.length === 1 ? `OS ${orders[0].serviceOrderId}` : `${orders.length} OS`}</Badge></small>}</td>
        <td>{group.items.map((item) => <small key={item.id} className="client-workspace__pending-line">CR {item.id} · {item.description || 'Sem descrição'} · <strong>{money(item.balance || item.amount)}</strong></small>)}</td>
        <td><strong>{money(group.total)}</strong></td>
        <td>{onOpenStatement && <Button type="button" variant="secondary" icon={<FileBarChart size={15} />} onClick={() => onOpenStatement({ clientId, dueDate: group.dueDate })}>Extrato e rateio</Button>}</td>
      </tr>
    })}</tbody></table></div>}
  </>
}

function useClientBillingContext(clientId: number) {
  return useQuery({ queryKey: [...queryKeys.bills, 'client-context', clientId], queryFn: () => api.bills.clientContext(clientId) })
}

function ClientReceivablesSection({ clientId }: { clientId: number }) {
  const contextQuery = useClientBillingContext(clientId)
  // Vencimento mais próximo primeiro e o mais distante por último (sem vencimento vai para o fim).
  const receivables = [...(contextQuery.data?.openReceivables ?? [])].sort((a, b) => {
    const left = a.dueAt ? String(a.dueAt).slice(0, 10) : '9999-12-31'
    const right = b.dueAt ? String(b.dueAt).slice(0, 10) : '9999-12-31'
    return left.localeCompare(right) || Number(a.id) - Number(b.id)
  })
  const total = receivables.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const balance = receivables.reduce((sum, item) => sum + Number(item.balance || 0), 0)
  return <div className="client-workspace__section">
    <SectionHeader title="Contas a receber" description="Títulos ainda não pagos deste cliente." action={<LinkButton to={`/contas-a-receber?clientId=${clientId}`}>Abrir contas a receber</LinkButton>} />
    {contextQuery.isLoading ? <LoadingState label="Carregando contas do cliente..." /> : contextQuery.isError ? <ErrorState message={apiErrorMessage(contextQuery.error)} onRetry={() => contextQuery.refetch()} /> : <>
      <div className="detail-metrics"><span><small>Títulos em aberto</small><strong>{receivables.length}</strong></span><span><small>Valor lançado</small><strong>{money(total)}</strong></span><span><small>Saldo em aberto</small><strong>{money(balance)}</strong></span></div>
      <DetailTable title="Contas a receber em aberto" empty="Este cliente não possui contas a receber em aberto." headers={['CR', 'OS', 'Contrato', 'Descrição', 'Cadastro', 'Vencimento', 'Valor', 'Saldo']} rows={receivables.map((item) => [item.id, item.serviceOrderId || '—', item.contractId || '—', item.description || 'Não informada', formatDate(item.createdAt), formatDate(item.dueAt), money(item.amount), money(item.balance)])} />
    </>}
  </div>
}

function ClientContractsSection({ clientId }: { clientId: number }) {
  const contractsQuery = useQuery({ queryKey: [...queryKeys.contracts, 'client', clientId, 'workspace'], queryFn: () => api.contracts.byClient(clientId, { page: 0, size: 50 }) })
  const contracts = contractsQuery.data?.content ?? []
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const currentId = selectedId ?? (contracts.find((contract) => contract.status === 'ATIVO') ?? contracts[0])?.id ?? null
  return <div className="client-workspace__section">
    <SectionHeader title="Contratos" description={contracts.length > 1 ? 'Selecione um contrato para ver todos os dados dele.' : 'Dados completos do contrato do cliente.'} action={<LinkButton to={`/contratos?clientId=${clientId}`}>Abrir contratos do cliente</LinkButton>} />
    {contractsQuery.isLoading ? <LoadingState label="Carregando contratos..." /> : contractsQuery.isError ? <ErrorState message={apiErrorMessage(contractsQuery.error)} onRetry={() => contractsQuery.refetch()} /> : contracts.length === 0 ? <EmptyState title="Nenhum contrato" description="Este cliente não possui contratos cadastrados." /> : <>
      {contracts.length > 1 && <div className="client-workspace__contract-picker" role="tablist" aria-label="Contratos do cliente">{contracts.map((contract) => <button key={contract.id} type="button" role="tab" aria-selected={contract.id === currentId} className={contract.id === currentId ? 'active' : ''} onClick={() => setSelectedId(contract.id)}>
        <strong>Contrato #{contract.id}</strong><small>{formatDate(contract.contractDate)}</small><Badge tone={contract.status === 'ATIVO' ? 'green' : 'neutral'}>{enumLabel(contract.status)}</Badge>
      </button>)}</div>}
      {currentId !== null && <ContractOverview key={currentId} clientId={clientId} contractId={currentId} />}
    </>}
  </div>
}

function ContractOverview({ clientId, contractId }: { clientId: number; contractId: number }) {
  const contractQuery = useQuery({ queryKey: [...queryKeys.contracts, 'detail', contractId], queryFn: () => api.contracts.find(contractId) })
  const today = useMemo(() => localIsoDate(new Date()), [])
  const activeQuery = useQuery({ queryKey: [...queryKeys.contracts, 'active-for-client', clientId, today], queryFn: () => api.contracts.activeByClient(clientId, today) })
  const locationsQuery = useQuery({ queryKey: [...queryKeys.attendanceLocations, 'client', clientId], queryFn: () => api.attendanceLocations.byClient(clientId) })
  const contract = contractQuery.data
  if (contractQuery.isLoading) return <LoadingState label="Carregando dados do contrato..." />
  if (contractQuery.isError || !contract) return <ErrorState message={apiErrorMessage(contractQuery.error)} onRetry={() => contractQuery.refetch()} />

  const services = contract.services ?? []
  const monthlyValue = services.reduce((sum, service) => sum + Number(service.totalValue || 0), 0)
  // O saldo do mês só existe para o contrato ativo do cliente.
  const balance = activeQuery.data?.contract?.id === contract.id ? activeQuery.data.balance : null
  const excessMinutes = balance ? Math.max(0, balance.usedMinutes - balance.contractedMinutes) : 0
  const locations = (locationsQuery.data ?? []).filter((location) => location.contractId === contract.id)
  const flag = (value: boolean) => value ? 'Sim' : 'Não'
  const percent = (value: number | null) => value == null ? 'Não informado' : `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`

  return <div className="detail-modal-content">
    <div className="detail-modal__hero-row"><div className="detail-drawer__hero"><span className="detail-avatar"><FileSignature /></span><div><span>Contrato #{contract.id} · Cliente #{contract.clientId}</span><h2>{contract.clientTradeName || contract.clientName || `Cliente #${contract.clientId}`}</h2><p>{contract.clientName || 'Razão social não informada'}</p></div></div><Badge tone={contract.status === 'ATIVO' ? 'green' : 'neutral'}>{enumLabel(contract.status)}</Badge></div>

    <div className="detail-metrics client-workspace__contract-hours">
      <span><small>Horas contratadas (mês)</small><strong>{balance ? balance.contracted : '—'}</strong></span>
      <span><small>Utilizadas no mês</small><strong>{balance ? balance.used : '—'}</strong></span>
      <span><small>Saldo do mês</small><strong>{balance ? balance.balance : '—'}</strong></span>
      <span><small>Excedente no mês</small><strong className={excessMinutes > 0 ? 'client-workspace__negative' : ''}>{balance ? formatMinutes(excessMinutes) : '—'}</strong></span>
      <span><small>Valor mensal dos serviços</small><strong>{money(monthlyValue)}</strong></span>
    </div>
    {!balance && contract.status === 'ATIVO' && activeQuery.isSuccess && <p className="drawer-section__text">Saldo de horas do mês indisponível para este contrato.</p>}

    <div className="detail-sections-grid">
      <section className="drawer-section"><h3>Datas e cobrança</h3><dl>
        <div><dt>Data do contrato</dt><dd>{formatDate(contract.contractDate)}</dd></div>
        <div><dt>Renovação</dt><dd>{formatDate(contract.renewalDate)}</dd></div>
        <div><dt>Último reajuste</dt><dd>{formatDate(contract.lastAdjustmentDate)}</dd></div>
        <div><dt>Dia do vencimento</dt><dd>{contract.dueDay ? `Dia ${contract.dueDay}` : 'Não informado'}</dd></div>
        <div><dt>Taxa de adesão</dt><dd>{money(contract.adhesionFee)}</dd></div>
        <div><dt>Carência</dt><dd>{flag(contract.gracePeriod)}</dd></div>
      </dl></section>
      <section className="drawer-section"><h3>Condições comerciais</h3><dl>
        <div><dt>Índice de reajuste</dt><dd>{contract.adjustmentIndexId ? `#${contract.adjustmentIndexId}` : 'Não informado'}</dd></div>
        <div><dt>Percentual de venda</dt><dd>{percent(contract.salePercentage)}</dd></div>
        <div><dt>Percentual de renovação</dt><dd>{percent(contract.renewalPercentage)}</dd></div>
        <div><dt>Funcionário (comissão)</dt><dd>{contract.employeeId ? `#${contract.employeeId} · ${percent(contract.employeePercentage)}` : 'Não informado'}</dd></div>
        <div><dt>Fornecedor</dt><dd>{contract.supplierId ? `#${contract.supplierId}` : 'Não informado'}</dd></div>
        <div><dt>Situação</dt><dd>{enumLabel(contract.status)}{contract.statusFlag ? ` (${contract.statusFlag})` : ''}</dd></div>
      </dl></section>
      {contract.canceled && <section className="drawer-section contract-cancellation drawer-section--wide"><h3>Cancelamento</h3><dl><div><dt>Data</dt><dd>{formatDate(contract.cancellationDate)}</dd></div><div><dt>Motivo</dt><dd>{contract.cancellationReason || 'Não informado'}</dd></div></dl></section>}
    </div>

    <DetailTable title="Serviços contratados" empty="Nenhum serviço vinculado ao contrato." headers={['Seq.', 'Serviço', 'Qtd.', 'Unidade', 'Bônus', 'Valor unitário', 'Minuto extra', 'Total']} rows={services.map((service) => [service.sequence, service.serviceName || service.serviceDescription || `Serviço #${service.serviceId}`, service.quantity, service.unit || 'un.', service.bonusQuantity ?? 0, money(service.unitValue), contractMinuteValue(service) > 0 ? money(contractMinuteValue(service)) : '—', money(service.totalValue)])} />

    <section className="drawer-section"><h3>Locais de atendimento do contrato</h3>
      {locationsQuery.isLoading ? <p className="drawer-section__text">Carregando locais...</p> : locations.length === 0 ? <p className="drawer-section__text">Nenhum local vinculado a este contrato.</p> : <div className="client-workspace__cards">{locations.map((location) => <article key={location.id}>
        <header><strong>{location.description || `Local #${location.id}`}</strong><small>{location.contactName || 'Contato não informado'}{location.contactPhone ? ` · ${location.contactPhone}` : ''}</small></header>
        <p>{[location.address, location.complement, location.district, location.city, formatCep(location.zipCode)].filter(Boolean).join(' · ') || 'Endereço não informado'}</p>
      </article>)}</div>}
    </section>

    <RenewalHistorySection contractId={contract.id} />
  </div>
}

function ClientLocationsSection({ clientId }: { clientId: number }) {
  const locationsQuery = useQuery({ queryKey: [...queryKeys.attendanceLocations, 'client', clientId], queryFn: () => api.attendanceLocations.byClient(clientId) })
  const locations = locationsQuery.data ?? []
  return <div className="client-workspace__section">
    <SectionHeader title="Locais de atendimento" description="Endereços onde o cliente recebe os atendimentos." action={<LinkButton to={`/locais-de-atendimento?clientId=${clientId}`}>Gerenciar locais do cliente</LinkButton>} />
    {locationsQuery.isLoading ? <LoadingState label="Carregando locais..." /> : locationsQuery.isError ? <ErrorState message={apiErrorMessage(locationsQuery.error)} onRetry={() => locationsQuery.refetch()} /> : locations.length === 0 ? <EmptyState title="Nenhum local cadastrado" description="Os locais são cadastrados no contrato ou na ordem de serviço." /> : <div className="client-workspace__cards">{locations.map((location) => <article key={location.id}>
      <header><strong>{location.description || `Local #${location.id}`}</strong><small>{location.contractId ? `Contrato #${location.contractId}` : 'Sem contrato'}</small></header>
      <p>{[location.address, location.complement, location.district, location.city, formatCep(location.zipCode)].filter(Boolean).join(' · ') || 'Endereço não informado'}</p>
      <dl><div><dt>Contato</dt><dd>{location.contactName || 'Não informado'}{location.contactPhone ? ` · ${location.contactPhone}` : ''}</dd></div>{location.referencePoint && <div><dt>Ponto de referência</dt><dd>{location.referencePoint}</dd></div>}</dl>
    </article>)}</div>}
  </div>
}

function ClientOrdersSection({ clientId }: { clientId: number }) {
  const { navigate } = useRouter()
  const ordersQuery = useQuery({ queryKey: [...queryKeys.serviceOrders, 'client', clientId], queryFn: () => api.serviceOrders.list({ clientId, page: 0, size: 50 }) })
  const orders = ordersQuery.data?.content ?? []
  return <div className="client-workspace__section">
    <SectionHeader title="Ordens de serviço" description="Últimos atendimentos do cliente. Clique para abrir a OS." />
    {ordersQuery.isLoading ? <LoadingState label="Carregando ordens de serviço..." /> : ordersQuery.isError ? <ErrorState message={apiErrorMessage(ordersQuery.error)} onRetry={() => ordersQuery.refetch()} /> : orders.length === 0 ? <EmptyState title="Nenhuma ordem de serviço" description="Este cliente ainda não possui atendimentos." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>OS</th><th>Abertura</th><th>Descrição / Serviço</th><th>Profissional</th><th>Situação</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} onClick={() => navigate(`/ordens-de-servico?id=${order.id}`)}>
      <td><strong>{order.id}</strong></td><td>{formatDate(order.orderedAt)}</td>
      <td><strong className="table-primary">{order.description || 'Não informado'}</strong><small className="table-secondary">{order.serviceDescriptions.length ? order.serviceDescriptions.join(' · ') : 'Nenhum serviço vinculado'}</small></td>
      <td>{order.professionalNames?.length ? order.professionalNames.join(', ') : 'Aguardando'}</td><td><Badge tone={order.status === 'FINALIZADA' ? 'green' : order.status === 'CANCELADA' ? 'neutral' : 'orange'}>{enumLabel(order.status)}</Badge></td>
    </tr>)}</tbody></table></div>}
  </div>
}

function ClientHoursSection({ clientId, clientName }: { clientId: number; clientName: string }) {
  const contextQuery = useClientBillingContext(clientId)
  return contextQuery.isLoading ? <LoadingState label="Carregando acompanhamento de horas..." /> : contextQuery.isError ? <ErrorState message={apiErrorMessage(contextQuery.error)} onRetry={() => contextQuery.refetch()} /> : <ClientHourTracking clientId={clientId} clientName={clientName} context={contextQuery.data} />
}

function ClientStatementSection({ clientId }: { clientId: number }) {
  const initial = useMemo(previousMonth, [])
  const [startDate, setStartDate] = useState(initial.startDate)
  const [endDate, setEndDate] = useState(initial.endDate)
  const validPeriod = Boolean(startDate && endDate && startDate <= endDate)
  const statementQuery = useQuery({ queryKey: [...queryKeys.clientStatements, 'workspace', clientId, startDate, endDate], queryFn: () => api.clientStatements.find(clientId, startDate, endDate), enabled: validPeriod })
  const pdfMutation = useMutation({
    mutationFn: () => api.clientStatements.pdf(clientId, startDate, endDate),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    },
  })
  return <div className="client-workspace__section">
    <SectionHeader title="Extrato e rateio de horas" description="Movimentação do período com o rateio por local de atendimento." action={<Button variant="secondary" icon={<FileBarChart size={16} />} disabled={!validPeriod || pdfMutation.isPending} onClick={() => pdfMutation.mutate()}>{pdfMutation.isPending ? 'Gerando PDF...' : 'Abrir PDF do extrato'}</Button>} />
    <div className="client-workspace__period">
      <label><span>De</span><input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} /></label>
      <label><span>Até</span><input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} /></label>
    </div>
    {pdfMutation.isError && <ErrorState message={apiErrorMessage(pdfMutation.error, 'Não foi possível gerar o PDF do extrato.')} onRetry={() => pdfMutation.mutate()} />}
    {!validPeriod ? <EmptyState title="Período inválido" description="A data inicial deve ser anterior ou igual à data final." /> : statementQuery.isLoading ? <LoadingState label="Consolidando extrato..." /> : statementQuery.isError ? <ErrorState message={apiErrorMessage(statementQuery.error)} onRetry={() => statementQuery.refetch()} /> : statementQuery.data ? <ClientStatementDetails statement={statementQuery.data} /> : null}
  </div>
}

function localIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function previousMonth() {
  const today = new Date()
  return { startDate: localIsoDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)), endDate: localIsoDate(new Date(today.getFullYear(), today.getMonth(), 0)) }
}
