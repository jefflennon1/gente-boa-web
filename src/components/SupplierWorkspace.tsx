import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Banknote, CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, Edit3, FileCheck2, FileText, HandCoins, Package, PieChart, Plus, SplitSquareHorizontal, Truck, WalletCards } from 'lucide-react'
import { apiErrorMessage } from '../api/client'
import { financeApi, type PayableFilterParams } from '../api/finance'
import { api, queryKeys } from '../api/services'
import { todayIso } from '../lib/export'
import { formatDate, money } from '../lib/format'
import { useRouter } from '../router'
import type { PayableAccount, Supplier } from '../types'
import type { usePayableDialogs } from './PayableDialogs'
import { PartyReceipts } from './ReceiptsPanel'
import { Badge, Button, EmptyState, ErrorState, LoadingState } from './ui'

type Section = 'profile' | 'payables' | 'receipts' | 'allocation' | 'purchases'
type PayableDialogs = ReturnType<typeof usePayableDialogs>
type StatusFilter = NonNullable<PayableFilterParams['status']>

/**
 * Conteúdo do modal "Dados do fornecedor": cadastro à primeira vista e um menu lateral com as contas a pagar
 * (pagamento e parcelamento), o rateio das contas e os pedidos de compra do fornecedor.
 * Os diálogos de conta a pagar ficam na página (fora deste modal) e chegam por `payableDialogs`.
 */
export function SupplierWorkspace({ supplier, form, payableDialogs, onOpenReport }: { supplier: Supplier; form: ReactNode; payableDialogs: PayableDialogs; onOpenReport: () => void }) {
  const [section, setSection] = useState<Section>('profile')
  const menu: Array<{ id: Section | 'report'; label: string; icon: ReactNode }> = [
    { id: 'profile', label: 'Cadastro', icon: <Truck size={17} /> },
    { id: 'payables', label: 'Contas a pagar', icon: <HandCoins size={17} /> },
    { id: 'receipts', label: 'Recibos', icon: <FileCheck2 size={17} /> },
    { id: 'allocation', label: 'Rateio das contas', icon: <PieChart size={17} /> },
    { id: 'purchases', label: 'Pedidos de compra', icon: <Package size={17} /> },
    { id: 'report', label: 'Relatório (PDF / Excel)', icon: <FileText size={17} /> },
  ]
  return <div className="modal__body client-workspace supplier-workspace">
    <nav className="client-workspace__menu" aria-label="Informações do fornecedor">
      {menu.map((item) => <button key={item.id} type="button" className={section === item.id ? 'active' : ''} aria-current={section === item.id ? 'page' : undefined} onClick={() => item.id === 'report' ? onOpenReport() : setSection(item.id)}>{item.icon}<span>{item.label}</span></button>)}
    </nav>
    <div className="client-workspace__content">
      {section === 'profile' ? form
        : section === 'payables' ? <SupplierPayables supplier={supplier} payableDialogs={payableDialogs} />
        : section === 'receipts' ? <PartyReceipts kind="payable" partyId={supplier.id} />
        : section === 'allocation' ? <SupplierAllocation supplierId={supplier.id} />
        : <SupplierPurchases supplierId={supplier.id} />}
    </div>
  </div>
}

function SectionHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <header className="client-workspace__heading"><div><h3>{title}</h3><p>{description}</p></div>{action}</header>
}

function overdue(account: PayableAccount) { return Number(account.balance) > 0 && Boolean(account.dueAt) && account.dueAt!.slice(0, 10) < todayIso() }
function statusLabel(account: PayableAccount) { return account.status === 'PAID' ? 'Quitada' : account.status === 'CLOSED' ? 'Fechada' : overdue(account) ? 'Vencida' : 'Aberta' }
function statusTone(account: PayableAccount): 'green' | 'orange' | 'neutral' | 'red' { return account.status === 'PAID' ? 'green' : account.status === 'CLOSED' ? 'neutral' : overdue(account) ? 'red' : 'orange' }

function SupplierPayables({ supplier, payableDialogs }: { supplier: Supplier; payableDialogs: PayableDialogs }) {
  const [status, setStatus] = useState<StatusFilter>('OPEN')
  const [page, setPage] = useState(0)
  const pageSize = 20
  const filters: PayableFilterParams = { supplierId: supplier.id, status }
  const accountsQuery = useQuery({ queryKey: [...queryKeys.payables, 'list', filters, page, pageSize], queryFn: () => financeApi.payables.list({ ...filters, page, size: pageSize }), placeholderData: keepPreviousData })
  // Totais do fornecedor sem filtro de situação: o que já foi pago e o que ainda falta pagar.
  const summaryQuery = useQuery({ queryKey: [...queryKeys.payables, 'summary', { supplierId: supplier.id, status: 'ALL' }], queryFn: () => financeApi.payables.summary({ supplierId: supplier.id, status: 'ALL' }) })
  const accounts = accountsQuery.data?.content ?? []
  const total = accountsQuery.data?.total ?? 0
  const totalPages = accountsQuery.data?.totalPages ?? 0
  const summary = summaryQuery.data
  const supplierValue = { id: supplier.id, label: `${supplier.tradeName || supplier.legalName || 'Fornecedor'} · #${supplier.id}` }
  const tabs: Array<{ value: StatusFilter; label: string }> = [{ value: 'OPEN', label: 'A pagar' }, { value: 'OVERDUE', label: 'Vencidas' }, { value: 'PAID', label: 'Pagas' }, { value: 'ALL', label: 'Todas' }]

  return <div className="client-workspace__section">
    <SectionHeader title="Contas a pagar" description="Clique em uma conta para ver o detalhe. Nas contas em aberto você pode informar o pagamento ou parcelar o valor." action={<Button type="button" variant="secondary" icon={<Plus size={16} />} onClick={() => payableDialogs.openNew(supplierValue)}>Nova conta</Button>} />
    <div className="detail-metrics">
      <span><small><CircleDollarSign size={13} /> Total devido</small><strong>{money(summary?.amountDue)}</strong></span>
      <span><small><Banknote size={13} /> Já pago</small><strong className="positive-value">{money(summary?.amountPaid)}</strong><small>{(summary?.paidCount ?? 0).toLocaleString('pt-BR')} quitadas</small></span>
      <span><small><HandCoins size={13} /> A pagar</small><strong className="negative-value">{money(summary?.balance)}</strong><small>{(summary?.openCount ?? 0).toLocaleString('pt-BR')} em aberto</small></span>
      <span><small><CalendarDays size={13} /> Vencidas</small><strong>{money(summary?.overdueBalance)}</strong><small>{(summary?.overdueCount ?? 0).toLocaleString('pt-BR')} contas</small></span>
    </div>
    <div className="segmented-control supplier-workspace__tabs" role="tablist" aria-label="Situação das contas">{tabs.map((tab) => <button key={tab.value} type="button" role="tab" aria-selected={status === tab.value} className={status === tab.value ? 'active' : ''} onClick={() => { setStatus(tab.value); setPage(0) }}>{tab.label}</button>)}</div>
    {accountsQuery.isLoading ? <LoadingState label="Carregando contas a pagar..." /> : accountsQuery.isError ? <ErrorState message={apiErrorMessage(accountsQuery.error)} onRetry={() => accountsQuery.refetch()} /> : accounts.length === 0 ? <EmptyState title="Nenhuma conta nesta situação" description="Altere a situação ou cadastre uma nova conta para este fornecedor." /> : <div className={`table-wrap ${accountsQuery.isFetching ? 'table-wrap--refreshing' : ''}`}>
      <table className="data-table supplier-payables-table"><thead><tr><th>Código</th><th>Descrição</th><th>Pedido / OS</th><th>Vencimento</th><th>Pagamento</th><th>Devido</th><th>Pago</th><th>Saldo</th><th>Situação</th><th /></tr></thead><tbody>{accounts.map((account) => {
        const open = Number(account.balance) > 0
        return <tr key={account.id} onClick={() => payableDialogs.openEdit(account)}>
          <td><strong>#{account.id}</strong></td>
          <td><strong className="table-primary">{account.description || 'Sem descrição'}</strong>{account.invoiceNumber && <small className="table-secondary">NF {account.invoiceNumber}</small>}</td>
          <td>{account.purchaseOrderId ? `Pedido #${account.purchaseOrderId}` : 'Avulsa'}{account.serviceOrderId ? <small className="table-secondary">OS #{account.serviceOrderId}</small> : null}</td>
          <td>{formatDate(account.dueAt)}</td><td>{account.paidAt ? formatDate(account.paidAt) : '—'}</td>
          <td><strong>{money(account.amountDue)}</strong></td><td>{money(account.amountPaid)}</td>
          <td><strong className={open ? 'negative-value' : 'positive-value'}>{money(account.balance)}</strong></td>
          <td><Badge tone={statusTone(account)}>{statusLabel(account)}</Badge></td>
          <td><div className="supplier-payables-actions" onClick={(event) => event.stopPropagation()}>
            {open && <Button type="button" variant="secondary" icon={<WalletCards size={15} />} onClick={() => payableDialogs.openSettlement(account)}>Informar pagamento</Button>}
            {open && Number(account.amountPaid) === 0 && <Button type="button" variant="secondary" icon={<SplitSquareHorizontal size={15} />} onClick={() => payableDialogs.openInstallments(account)}>Parcelar</Button>}
            <button type="button" className="row-action" onClick={() => payableDialogs.openEdit(account)} title="Detalhe e alteração da conta" aria-label={`Abrir conta ${account.id}`}><Edit3 size={16} /></button>
          </div></td>
        </tr>
      })}</tbody></table>
    </div>}
    {totalPages > 1 && <footer className="table-footer table-footer--pagination"><span>Mostrando <strong>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong> contas</span><div className="pagination-controls">
      <button type="button" disabled={page === 0 || accountsQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button>
      <span>Página <strong>{page + 1}</strong> de <strong>{totalPages}</strong></span>
      <button type="button" disabled={page + 1 >= totalPages || accountsQuery.isFetching} onClick={() => setPage((value) => value + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button>
    </div></footer>}
  </div>
}

type AllocationRow = { key: string; label: string; detail?: string; count: number; amountDue: number; amountPaid: number; balance: number }

function allocate(accounts: PayableAccount[], keyOf: (account: PayableAccount) => { key: string; label: string; detail?: string }) {
  const groups = new Map<string, AllocationRow>()
  accounts.forEach((account) => {
    const { key, label, detail } = keyOf(account)
    const row = groups.get(key) ?? { key, label, detail, count: 0, amountDue: 0, amountPaid: 0, balance: 0 }
    row.count += 1
    row.amountDue += Number(account.amountDue || 0)
    row.amountPaid += Number(account.amountPaid || 0)
    row.balance += Number(account.balance || 0)
    groups.set(key, row)
  })
  return [...groups.values()]
}

function SupplierAllocation({ supplierId }: { supplierId: number }) {
  // Todas as contas do fornecedor (até 2.000), para o rateio por centro de custo e por mês de vencimento.
  const accountsQuery = useQuery({
    queryKey: [...queryKeys.payables, 'supplier-allocation', supplierId],
    queryFn: async () => {
      const first = await financeApi.payables.list({ supplierId, status: 'ALL', page: 0, size: 100 })
      const all = [...first.content]
      for (let index = 1; index < Math.min(first.totalPages, 20); index++) all.push(...(await financeApi.payables.list({ supplierId, status: 'ALL', page: index, size: 100 })).content)
      return all
    },
  })
  const accounts = accountsQuery.data ?? []
  const byCostCenter = useMemo(() => allocate(accounts, (account) => ({
    key: `${account.costCenterId ?? 0}-${account.subCostCenterId ?? 0}`,
    label: account.costCenterName ? `${account.costCenterId} · ${account.costCenterName}` : 'Sem centro de custo',
    detail: account.subCostCenterName ? `${account.subCostCenterId} · ${account.subCostCenterName}` : undefined,
  })).sort((a, b) => b.amountDue - a.amountDue), [accounts])
  const byMonth = useMemo(() => allocate(accounts, (account) => {
    const month = account.dueAt?.slice(0, 7) ?? ''
    return { key: month || 'sem-data', label: month ? `${month.slice(5, 7)}/${month.slice(0, 4)}` : 'Sem vencimento' }
  }).sort((a, b) => b.key.localeCompare(a.key)), [accounts])
  const totalDue = accounts.reduce((sum, account) => sum + Number(account.amountDue || 0), 0)

  if (accountsQuery.isLoading) return <LoadingState label="Calculando o rateio das contas..." />
  if (accountsQuery.isError) return <ErrorState message={apiErrorMessage(accountsQuery.error)} onRetry={() => accountsQuery.refetch()} />
  const table = (title: string, rows: AllocationRow[], firstHeader: string) => <section className="drawer-section bill-detail-table"><h3>{title}</h3>{rows.length === 0 ? <p className="drawer-section__text">Nenhuma conta para este fornecedor.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>{firstHeader}</th><th>Contas</th><th>Devido</th><th>% do total</th><th>Pago</th><th>A pagar</th></tr></thead><tbody>{rows.map((row) => <tr key={row.key}>
    <td><strong className="table-primary">{row.label}</strong>{row.detail && <small className="table-secondary">{row.detail}</small>}</td>
    <td>{row.count}</td><td><strong>{money(row.amountDue)}</strong></td>
    <td>{totalDue > 0 ? `${(row.amountDue / totalDue * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—'}</td>
    <td className="positive-value">{money(row.amountPaid)}</td><td><strong className={row.balance > 0 ? 'negative-value' : ''}>{money(row.balance)}</strong></td>
  </tr>)}</tbody></table></div>}</section>

  return <div className="client-workspace__section">
    <SectionHeader title="Rateio das contas" description="Como as contas deste fornecedor se distribuem por centro de custo e por mês de vencimento, com o que já foi pago e o que falta pagar." />
    {table('Por centro e subcentro de custo', byCostCenter, 'Centro / subcentro')}
    {table('Por mês de vencimento', byMonth, 'Mês')}
  </div>
}

function SupplierPurchases({ supplierId }: { supplierId: number }) {
  const { navigate } = useRouter()
  const ordersQuery = useQuery({ queryKey: [...queryKeys.purchaseOrders, 'supplier', supplierId], queryFn: () => api.purchaseOrders.list({ supplierId, page: 0, size: 50 }) })
  const orders = ordersQuery.data?.content ?? []
  return <div className="client-workspace__section">
    <SectionHeader title="Pedidos de compra" description="Compras deste fornecedor registradas nas ordens de serviço." />
    {ordersQuery.isLoading ? <LoadingState label="Carregando pedidos de compra..." /> : ordersQuery.isError ? <ErrorState message={apiErrorMessage(ordersQuery.error)} onRetry={() => ordersQuery.refetch()} /> : orders.length === 0 ? <EmptyState title="Nenhum pedido de compra" description="Os pedidos são criados dentro das ordens de serviço." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Pedido</th><th>Entrada</th><th>OS</th><th>NF</th><th>Itens</th><th>Total</th><th>Conta a pagar</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} onClick={() => order.serviceOrderId && navigate(`/ordens-de-servico?id=${order.serviceOrderId}`)}>
      <td><strong>#{order.id}</strong></td><td>{formatDate(order.entryDate)}</td><td>{order.serviceOrderId ? `#${order.serviceOrderId}` : '—'}</td><td>{order.invoiceNumber || '—'}</td><td>{order.itemCount}</td><td><strong>{money(order.netValue)}</strong></td>
      <td>{order.payableId ? <>#{order.payableId}{order.payableStatus && <small className="table-secondary">{order.payableStatus === 'PAID' ? 'Quitada' : 'Em aberto'}</small>}</> : 'Não gerada'}</td>
    </tr>)}</tbody></table></div>}
  </div>
}
