import { useQuery } from '@tanstack/react-query'
import { modulesApi, modulesKeys } from '../api/modules'
import { formatDate, money } from '../lib/format'

/** Histórico de renovações/reajustes do contrato (tela de Contratos e modal "Dados do cliente"). */
export function RenewalHistorySection({ contractId }: { contractId: number }) {
  const historyQuery = useQuery({ queryKey: [...modulesKeys.readjustment, 'history', 'contract', contractId], queryFn: () => modulesApi.readjustment.history({ contractId }) })
  const rows = historyQuery.data ?? []
  return <section className="drawer-section drawer-section--wide"><h3>Histórico de contratos renovados</h3>
    {historyQuery.isLoading ? <p className="drawer-section__text">Carregando...</p> : rows.length === 0 ? <p className="drawer-section__text">Nenhum reajuste registrado.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Alterado em</th><th>Renovação</th><th className="num">Total anterior</th><th className="num">Total atualizado</th><th className="num">Minuto anterior</th><th className="num">Minuto atualizado</th><th className="num">%</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}><td>{formatDate(row.changedAt)}</td><td>{formatDate(row.renewalDate)}</td><td className="num">{money(row.previousTotal)}</td><td className="num">{money(row.newTotal)}</td><td className="num">{money(row.previousMinute)}</td><td className="num">{money(row.newMinute)}</td><td className="num">{row.percentage.toLocaleString('pt-BR')}%</td></tr>)}</tbody></table></div>}
  </section>
}
