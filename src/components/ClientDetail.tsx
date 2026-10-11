import { useQuery } from '@tanstack/react-query'
import { Building2, ChevronRight } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { enumLabel, formatDate, money } from '../lib/format'
import { useRouter } from '../router'
import type { Client } from '../types'
import { Badge } from './ui'

export function flagIsOn(value?: string | null) {
  return ['1', 'S', 'SIM', 'TRUE'].includes(value?.toUpperCase() ?? '')
}

function yesNo(value?: string | null) {
  return flagIsOn(value) ? 'Sim' : 'Não'
}

export function formatCep(value?: string | null) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

/** Ficha cadastral completa do cliente (usada no cadastro de clientes e no modal "Dados do cliente"). */
export function ClientDetail({ client }: { client: Client }) {
  const { navigate } = useRouter()
  const contractsQuery = useQuery({
    queryKey: [...queryKeys.contracts, 'client', client.id],
    queryFn: () => api.contracts.byClient(client.id, { page: 0, size: 10 }),
  })

  return <div className="detail-modal-content">
    <div className="detail-modal__hero-row"><div className="detail-drawer__hero"><span className="detail-avatar"><Building2 /></span><div><span>Cliente #{client.id}</span>
      
    <h2>{client.nmfanta || client.name ||'Sem nome'}</h2><p>{client.document || 'Documento não informado'}</p></div></div></div>
    <div className="detail-metrics"><span><small>Tipo de pessoa</small><strong>{enumLabel(client.kind)}</strong></span><span><small>Fantasia / Apelido</small><strong>{client.nmfanta || 'Não informado'}</strong></span><span><small>Data de cadastro</small><strong>{formatDate(client.dtcadas, true)}</strong></span><span><small>Usuário responsável</small><strong>{client.dsusuario || 'Não informado'}</strong></span></div>
    <div className="detail-sections-grid">
    <section className="drawer-section"><h3>Documentos e contato principal</h3><dl>
      <div><dt>CNPJ</dt><dd>{client.nrcnpj || 'Não informado'}</dd></div>
      <div><dt>CPF</dt><dd>{client.nrcpf || 'Não informado'}</dd></div>
      <div><dt>RG / Inscrição estadual</dt><dd>{client.dsinscr || 'Não informado'}</dd></div>
      <div><dt>Aniversário</dt><dd>{client.dtanive || 'Não informado'}</dd></div>
      <div><dt>E-mail</dt><dd>{client.email || 'Não informado'}</dd></div>
      <div><dt>Telefone</dt><dd>{client.phone || 'Não informado'}</dd></div>
      <div><dt>Celular</dt><dd>{client.nrtele2 || 'Não informado'}</dd></div>
      <div><dt>Fax</dt><dd>{client.nrfax || 'Não informado'}</dd></div>
      <div><dt>Indicado por</dt><dd>{client.dsindic || 'Não informado'}</dd></div>
    </dl></section>
    <section className="drawer-section"><h3>Pessoas de contato</h3><dl>
      <div><dt>{client.nmcont1 || 'Contato 1'}</dt><dd>{client.nrtelc1 || 'Sem telefone'}</dd></div>
      <div><dt>{client.nmcont2 || 'Contato 2'}</dt><dd>{client.nrtelc2 || 'Sem telefone'}</dd></div>
      <div><dt>{client.nmcont3 || 'Contato 3'}</dt><dd>{client.nrtelc3 || 'Sem telefone'}</dd></div>
      <div><dt>{client.nmcont4 || 'Contato 4'}</dt><dd>{client.nrtelc4 || 'Sem telefone'}</dd></div>
    </dl></section>
    <section className="drawer-section"><h3>Endereço de cobrança</h3><dl>
      <div><dt>Endereço</dt><dd>{client.address || 'Não informado'}</dd></div>
      <div><dt>Complemento</dt><dd>{client.dscompl || 'Não informado'}</dd></div>
      <div><dt>Bairro</dt><dd>{client.dsbairr || 'Não informado'}</dd></div>
      <div><dt>Cidade / UF</dt><dd>{[client.city, client.dsestad].filter(Boolean).join(' / ') || 'Não informado'}</dd></div>
      <div><dt>CEP</dt><dd>{formatCep(client.nrcep) || 'Não informado'}</dd></div>
      <div><dt>Ponto de referência</dt><dd>{client.dsponto || 'Não informado'}</dd></div>
    </dl></section>
    <section className="drawer-section"><h3>Tributação e envios</h3><dl>
      <div><dt>Auditado</dt><dd>{yesNo(client.flaudit)}</dd></div>
      <div><dt>Retém ISS</dt><dd>{yesNo(client.fliss)}{client.vliss != null ? ` · ${money(client.vliss)}` : ''}</dd></div>
      <div><dt>Retém INSS</dt><dd>{yesNo(client.flinss)}{client.vlinss != null ? ` · ${money(client.vlinss)}` : ''}</dd></div>
      <div><dt>Envio de boleto</dt><dd>{client.flenvioboleto || 'Não informado'}</dd></div>
      <div><dt>Boleto automático por e-mail</dt><dd>{client.billEmailEnabled ? 'Sim' : 'Não'}</dd></div>
      <div><dt>Envio de extrato</dt><dd>{client.flenvioextrato || 'Não informado'}</dd></div>
      <div><dt>Comunicações habilitadas</dt><dd>{yesNo(client.flenvio)}</dd></div>
    </dl></section>
    {/* <section className="drawer-section drawer-section--wide"><div className="drawer-section__heading"><h3>Locais e endereços adicionais</h3><span>{client.addresses?.length ?? 0}</span></div>
      {(client.addresses?.length ?? 0) === 0 ? <p className="drawer-section__text">Nenhum endereço adicional vinculado a este cliente.</p> : <div className="client-address-detail-list">{client.addresses?.map((address, index) => <article key={address.id}>
        <header><span className="client-address-detail-list__number">{index + 1}</span><div><strong>{address.description || `Endereço ${index + 1}`}</strong><small>Código #{address.id}</small></div></header>
        <p>{[address.street, address.complement, address.district].filter(Boolean).join(' · ') || 'Endereço não informado'}</p>
        <div className="client-address-detail-list__meta">
          <span><small>Cidade / UF</small><strong>{[address.city, address.state].filter(Boolean).join(' / ') || 'Não informado'}</strong></span>
          <span><small>CEP</small><strong>{formatCep(address.zipCode) || 'Não informado'}</strong></span>
          <span><small>Conta / contato</small><strong>{address.accountName || 'Não informado'}</strong></span>
          <span><small>Telefone</small><strong>{address.phone || 'Não informado'}</strong></span>
        </div>
        {(address.reference || address.map) && <footer>{address.reference && <span><small>Referência</small><strong>{address.reference}</strong></span>}{address.map && <span><small>Mapa</small><strong>{address.map}</strong></span>}</footer>}
      </article>)}</div>}
    </section> */}
    {client.dsobser && <section className="drawer-section drawer-section--wide"><h3>Observações</h3><p className="drawer-section__text">{client.dsobser}</p></section>}
    <section className="drawer-section drawer-section--contract drawer-section--wide"><h3>Contratos</h3>
      {contractsQuery.isLoading ? <p className="drawer-section__text">Consultando histórico...</p> : contractsQuery.isError ? <p className="drawer-section__text">Não foi possível consultar os contratos deste cliente.</p> : (contractsQuery.data?.content.length ?? 0) === 0 ? <p className="drawer-section__text">Nenhum contrato cadastrado para este cliente.</p> : <div className="client-contract-history">{contractsQuery.data?.content.map((contract) => <article key={contract.id}><span><strong>Contrato #{contract.id}</strong><small>{formatDate(contract.contractDate)} · renovação {formatDate(contract.renewalDate)}</small></span><Badge tone={contract.status === 'ATIVO' ? 'green' : 'neutral'}>{enumLabel(contract.status)}</Badge></article>)}</div>}
      <button className="drawer-section__action" onClick={() => navigate(`/contratos?clientId=${client.id}`)}>Abrir contratos deste cliente <ChevronRight size={15} /></button>
      <button className="drawer-section__action" onClick={() => navigate(`/contas-a-receber?clientId=${client.id}`)}>Abrir contas a receber deste cliente <ChevronRight size={15} /></button>
    </section>
    </div>
  </div>
}
