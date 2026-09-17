import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { api } from '../api/services'
import { apiErrorMessage } from '../api/client'
import type { ClientKind, PublicClientSignupPayload } from '../types'
import { Button, FormError, FormField } from '../components/ui'

const OTHER_OPTION = '__outro__'

function referralDisplayName(description: string) {
  return description
    .trim()
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_match, separator: string, letter: string) => `${separator}${letter.toLocaleUpperCase('pt-BR')}`)
}

function textValue(data: FormData, name: string) {
  return String(data.get(name) || '').trim()
}

export function PublicClientSignup() {
  const [kind, setKind] = useState<ClientKind>('PESSOA_FISICA')
  const [referralSelection, setReferralSelection] = useState('')
  const [otherReferral, setOtherReferral] = useState('')
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError] = useState('')
  const [addressFields, setAddressFields] = useState({ dsender: '', dscompl: '', dsbairr: '', dscidad: '', dsestad: '' })
  const [formError, setFormError] = useState('')

  const referralDescriptionsQuery = useQuery({
    queryKey: ['public-referral-descriptions'],
    queryFn: api.publicClients.referralDescriptions,
  })
  const referralDescriptions = referralDescriptionsQuery.data ?? []

  const signupMutation = useMutation({
    mutationFn: (payload: PublicClientSignupPayload) => api.publicClients.create(payload),
    onError: (error) => setFormError(apiErrorMessage(error)),
  })

  async function handleCepBlur(event: React.FocusEvent<HTMLInputElement>) {
    const cep = event.target.value.replace(/\D/g, '')
    if (cep.length !== 8) return
    setCepLoading(true)
    setCepError('')
    try {
      const address = await api.addresses.findByCep(cep)
      setAddressFields({
        dsender: address.logradouro ?? '',
        dscompl: address.complemento ?? '',
        dsbairr: address.bairro ?? '',
        dscidad: address.localidade ?? '',
        dsestad: (address.uf ?? '').toUpperCase(),
      })
    } catch (error) {
      setCepError(apiErrorMessage(error, 'Não foi possível localizar o CEP.'))
    } finally {
      setCepLoading(false)
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const data = new FormData(event.currentTarget)
    const name = textValue(data, 'nmrazao')
    if (!name) {
      setFormError('Informe seu nome ou razão social.')
      return
    }
    const cnpj = textValue(data, 'nrcnpj')
    const cpf = textValue(data, 'nrcpf')
    const document = kind === 'PESSOA_JURIDICA' ? cnpj : cpf
    if (!document) {
      setFormError(`Informe o ${kind === 'PESSOA_JURIDICA' ? 'CNPJ' : 'CPF'}.`)
      return
    }
    const dsindic = referralSelection === OTHER_OPTION ? otherReferral.trim() : referralSelection

    const payload: PublicClientSignupPayload = {
      kind,
      nmrazao: name,
      nmfanta: textValue(data, 'nmfanta'),
      nrcnpj: kind === 'PESSOA_JURIDICA' ? cnpj : '',
      nrcpf: kind === 'PESSOA_FISICA' ? cpf : '',
      dsinscr: textValue(data, 'dsinscr'),
      dtanive: textValue(data, 'dtanive'),
      nrtele1: textValue(data, 'nrtele1'),
      nrtele2: textValue(data, 'nrtele2'),
      nrfax: textValue(data, 'nrfax'),
      dsemail: textValue(data, 'dsemail'),
      dsindic,
      nmcont1: textValue(data, 'nmcont1'),
      nrtelc1: textValue(data, 'nrtelc1'),
      nmcont2: textValue(data, 'nmcont2'),
      nrtelc2: textValue(data, 'nrtelc2'),
      nmcont3: textValue(data, 'nmcont3'),
      nrtelc3: textValue(data, 'nrtelc3'),
      nmcont4: textValue(data, 'nmcont4'),
      nrtelc4: textValue(data, 'nrtelc4'),
      dsender: textValue(data, 'dsender'),
      dscompl: textValue(data, 'dscompl'),
      dsbairr: textValue(data, 'dsbairr'),
      dscidad: textValue(data, 'dscidad'),
      dsestad: textValue(data, 'dsestad').toUpperCase(),
      nrcep: textValue(data, 'nrcep').replace(/\D/g, ''),
      dsponto: textValue(data, 'dsponto'),
      flaudit: textValue(data, 'flaudit') || '0',
      fliss: textValue(data, 'fliss') || '0',
      flenvioboleto: textValue(data, 'flenvioboleto') || 'E-mail',
      flenvioextrato: textValue(data, 'flenvioextrato') || 'NÃO',
      dsobser: textValue(data, 'dsobser'),
    }
    signupMutation.mutate(payload)
  }

  if (signupMutation.isSuccess) {
    return (
      <div className="public-signup">
        <div className="public-signup__card public-signup__card--success">
          <CheckCircle2 size={48} />
          <h1>Cadastro recebido!</h1>
          <p>Obrigado por se cadastrar. Nossa equipe vai entrar em contato em breve.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="public-signup">
      <div className="public-signup__card">
        <header className="public-signup__header">
          <div className="brand-mark pre-cadastro" style={{margin : "auto"}}><img src="/images/logo.jpg" alt="Gente Boa" /></div>
          <h1>Seja um cliente da Gente Boa Serviços</h1>
          <p>Preencha seus dados abaixo para se cadastrar. É rápido e fácil.</p>
        </header>

        <form onSubmit={submit} className="public-signup__form">
          <FormError message={formError} />

          <div className="public-signup__section-title">Dados cadastrais</div>
          <div className="form-grid form-grid--two">
            <FormField label="Tipo de pessoa *">
              <select name="kind" value={kind} onChange={(event) => setKind(event.target.value as ClientKind)}>
                <option value="PESSOA_FISICA">Pessoa física</option>
                <option value="PESSOA_JURIDICA">Pessoa jurídica</option>
              </select>
            </FormField>
            <FormField label={kind === 'PESSOA_JURIDICA' ? 'Razão social *' : 'Nome *'}>
              <input name="nmrazao" maxLength={100} required />
            </FormField>
            <FormField label="Fantasia / Apelido"><input name="nmfanta" maxLength={100} /></FormField>
            <FormField label="Data de aniversário" hint="Formato DD/MM"><input name="dtanive" placeholder="DD/MM" maxLength={5} /></FormField>
            {kind === 'PESSOA_JURIDICA'
              ? <FormField label="CNPJ *"><input name="nrcnpj" maxLength={20} required /></FormField>
              : <FormField label="CPF *"><input name="nrcpf" maxLength={15} required /></FormField>}
            <FormField label="RG / Inscrição estadual"><input name="dsinscr" maxLength={30} /></FormField>
          </div>

          <div className="public-signup__section-title">Contato</div>
          <div className="form-grid form-grid--two">
            <FormField label="Telefone"><input name="nrtele1" maxLength={20} /></FormField>
            <FormField label="Celular"><input name="nrtele2" maxLength={20} /></FormField>
            <FormField label="Fax"><input name="nrfax" maxLength={20} /></FormField>
            <FormField label="E-mail"><input name="dsemail" type="email" maxLength={50} /></FormField>
            <FormField label="Indicado por" hint={referralDescriptionsQuery.isLoading ? 'Carregando...' : undefined}>
              <select value={referralSelection} onChange={(event) => setReferralSelection(event.target.value)}>
                <option value="">Sem indicação</option>
                {referralDescriptions.map((description) => (
                  <option key={description.toLocaleLowerCase('pt-BR')} value={description}>{referralDisplayName(description)}</option>
                ))}
                <option value={OTHER_OPTION}>Outro...</option>
              </select>
            </FormField>
            {referralSelection === OTHER_OPTION && (
              <FormField label="Quem indicou?">
                <input value={otherReferral} onChange={(event) => setOtherReferral(event.target.value)} maxLength={50} placeholder="Digite quem indicou" autoFocus />
              </FormField>
            )}
          </div>

          <div className="public-signup__section-title">Outros contatos</div>
          <div className="form-grid form-grid--two">
            <FormField label="Contato 1"><input name="nmcont1" maxLength={100} /></FormField>
            <FormField label="Fone do contato 1"><input name="nrtelc1" maxLength={20} /></FormField>
            <FormField label="Contato 2"><input name="nmcont2" maxLength={100} /></FormField>
            <FormField label="Fone do contato 2"><input name="nrtelc2" maxLength={20} /></FormField>
            <FormField label="Contato 3"><input name="nmcont3" maxLength={100} /></FormField>
            <FormField label="Fone do contato 3"><input name="nrtelc3" maxLength={20} /></FormField>
            <FormField label="Contato 4"><input name="nmcont4" maxLength={100} /></FormField>
            <FormField label="Fone do contato 4"><input name="nrtelc4" maxLength={20} /></FormField>
          </div>

          <div className="public-signup__section-title">Endereço de cobrança</div>
          <div className="form-grid form-grid--two">
            <FormField label="CEP" hint={cepLoading ? 'Consultando endereço...' : cepError || 'Digite os 8 números do CEP.'}>
              <input name="nrcep" inputMode="numeric" maxLength={9} onBlur={handleCepBlur} />
            </FormField>
            <FormField label="Endereço"><input name="dsender" maxLength={255} value={addressFields.dsender} onChange={(event) => setAddressFields((current) => ({ ...current, dsender: event.target.value }))} /></FormField>
            <FormField label="Complemento"><input name="dscompl" maxLength={100} value={addressFields.dscompl} onChange={(event) => setAddressFields((current) => ({ ...current, dscompl: event.target.value }))} /></FormField>
            <FormField label="Bairro"><input name="dsbairr" maxLength={100} value={addressFields.dsbairr} onChange={(event) => setAddressFields((current) => ({ ...current, dsbairr: event.target.value }))} /></FormField>
            <FormField label="Cidade"><input name="dscidad" maxLength={100} value={addressFields.dscidad} onChange={(event) => setAddressFields((current) => ({ ...current, dscidad: event.target.value }))} /></FormField>
            <FormField label="UF"><input name="dsestad" maxLength={2} value={addressFields.dsestad} onChange={(event) => setAddressFields((current) => ({ ...current, dsestad: event.target.value.toUpperCase() }))} /></FormField>
            <FormField label="Ponto de referência"><input name="dsponto" maxLength={255} /></FormField>
          </div>

          <div className="public-signup__section-title">Preferências</div>
          <div className="form-grid form-grid--two">
            <FormField label="Auditado"><select name="flaudit" defaultValue="0"><option value="0">Não</option><option value="1">Sim</option></select></FormField>
            <FormField label="ISS"><select name="fliss" defaultValue="0"><option value="0">Não</option><option value="1">Sim</option></select></FormField>
            <FormField label="Tipo de envio do boleto"><select name="flenvioboleto" defaultValue="E-mail"><option value="E-mail">E-mail</option><option value="Cobrança">Cobrança</option></select></FormField>
            <FormField label="Envio de extrato"><select name="flenvioextrato" defaultValue="NÃO"><option value="NÃO">Não</option><option value="SIM">Sim</option></select></FormField>
          </div>

          <FormField label="Observações"><textarea name="dsobser" rows={4} maxLength={2000} /></FormField>

          <footer className="public-signup__footer">
            <Button type="submit" disabled={signupMutation.isPending}>{signupMutation.isPending ? 'Enviando...' : 'Cadastrar'}</Button>
          </footer>
        </form>
      </div>
    </div>
  )
}
