import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, CalendarClock, Clock3, FolderOpen, Landmark, LoaderCircle, Mail, Percent, Save, Settings2, Trash2 } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import type { SystemParametersPayload } from '../types'
import { Button, ConfirmDialog, ErrorState, FormError, FormField, LoadingState, PageHeader, Toast } from '../components/ui'
import { useRouter } from '../router'

function textValue(data: FormData, field: string) {
  return String(data.get(field) ?? '').trim()
}

function nullableNumber(data: FormData, field: string) {
  const value = textValue(data, field)
  return value === '' ? null : Number(value)
}

function nullableDateTime(data: FormData, field: string) {
  const value = textValue(data, field)
  return value ? `${value}:00` : null
}

function toDateTimeInput(value?: string | null) {
  return value ? value.slice(0, 16) : ''
}

export function SystemParametersPage() {
  const { navigate } = useRouter()
  const queryClient = useQueryClient()
  const [toast, setToast] = useState('')
  const [formError, setFormError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  const parametersQuery = useQuery({
    queryKey: queryKeys.systemParameters,
    queryFn: api.systemParameters.get,
  })

  const saveMutation = useMutation({
    mutationFn: ({ payload, exists }: { payload: SystemParametersPayload; exists: boolean }) => exists ? api.systemParameters.update(payload) : api.systemParameters.create(payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.systemParameters })
      setFormError('')
      showToast(variables.exists ? 'Parâmetros do sistema atualizados.' : 'Parâmetros do sistema cadastrados.')
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: api.systemParameters.remove,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.systemParameters })
      setDeleteOpen(false)
      setDeleteError('')
      showToast('Parâmetros do sistema removidos.')
    },
    onError: (error) => setDeleteError(apiErrorMessage(error)),
  })

  const parameters = parametersQuery.data

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const data = new FormData(event.currentTarget)
    const payload: SystemParametersPayload = {
      nmempre: textValue(data, 'nmempre'),
      dsender: textValue(data, 'dsender') || null,
      dsbairr: textValue(data, 'dsbairr') || null,
      dscidad: textValue(data, 'dscidad') || null,
      nrbolet: textValue(data, 'nrbolet') || null,
      qtinadi: nullableNumber(data, 'qtinadi'),
      dtrenov: nullableDateTime(data, 'dtrenov'),
      dspath: textValue(data, 'dspath') || null,
      dspdf: textValue(data, 'dspdf') || null,
      vlorcam: nullableNumber(data, 'vlorcam'),
      vliss: nullableNumber(data, 'vliss'),
      vlaliq: nullableNumber(data, 'vlaliq'),
      contractMinimumMinutes: nullableNumber(data, 'contractMinimumMinutes'),
      oneOffMinimumMinutes: nullableNumber(data, 'oneOffMinimumMinutes'),
      minimumContractMonths: nullableNumber(data, 'minimumContractMonths'),
      serviceWarrantyDays: nullableNumber(data, 'serviceWarrantyDays'),
      annualAdjustmentMonth: nullableNumber(data, 'annualAdjustmentMonth'),
      primaryDueDay: nullableNumber(data, 'primaryDueDay'),
      secondaryDueDay: nullableNumber(data, 'secondaryDueDay'),
      contractRules: textValue(data, 'contractRules') || null,
      oneOffRules: textValue(data, 'oneOffRules') || null,
      minimumTermEmailSubject: textValue(data, 'minimumTermEmailSubject') || null,
      minimumTermEmailBody: textValue(data, 'minimumTermEmailBody') || null,
    }
    saveMutation.mutate({ payload, exists: Boolean(parameters) })
  }

  return (
    <>
      <PageHeader
        eyebrow="Configurações"
        title="Parâmetros do sistema"
        subtitle="Configurações globais usadas pelos cadastros de clientes e contratos. Acesso restrito a administradores."
        actions={<Button type="button" icon={<Mail size={17} />} onClick={() => navigate('/envio-de-emails')}>Enviar e-mails</Button>}
      />

      {parametersQuery.isLoading ? <section className="panel"><LoadingState label="Carregando parâmetros do sistema..." /></section> : parametersQuery.isError ? <section className="panel"><ErrorState message={apiErrorMessage(parametersQuery.error)} onRetry={() => parametersQuery.refetch()} /></section> : (
        <form className="panel system-parameters-form" key={parameters?.nmempre ?? 'new-system-parameters'} onSubmit={submit}>
          

          <div className="system-parameters-form__body">
            <FormError message={formError} />

            <div className="form-section-title"><span><Building2 size={14} /></span><div><strong>Empresa</strong><small>Identificação e endereço da prestadora</small></div></div>
            <div className="form-grid form-grid--two">
              <FormField label="Nome da empresa "><input name="nmempre" required maxLength={250} defaultValue={parameters?.nmempre ?? ''} /></FormField>
              <FormField label="Endereço "><input name="dsender" maxLength={250} defaultValue={parameters?.dsender ?? ''} /></FormField>
              <FormField label="Bairro "><input name="dsbairr" maxLength={50} defaultValue={parameters?.dsbairr ?? ''} /></FormField>
              <FormField label="Cidade "><input name="dscidad" maxLength={50} defaultValue={parameters?.dscidad ?? ''} /></FormField>
            </div>

            <div className="form-section-title"><span><Landmark size={14} /></span><div><strong>Cobrança e operação</strong><small>Boleto, inadimplência e referência temporal</small></div></div>
            <div className="form-grid form-grid--three">
              <FormField label="Número do boleto "><input name="nrbolet" maxLength={50} defaultValue={parameters?.nrbolet ?? ''} /></FormField>
              <FormField label="Dias para inadimplência "><input name="qtinadi" type="number" min="0" step="1" defaultValue={parameters?.qtinadi ?? ''} /></FormField>
              <FormField label="Data de atualização / renovação "><input name="dtrenov" type="datetime-local" defaultValue={toDateTimeInput(parameters?.dtrenov)} /></FormField>
            </div>

            {/* <div className="form-section-title"><span><FolderOpen size={14} /></span><div><strong>Diretórios</strong><small>Referências legadas para documentos de contrato e arquivos do site</small></div></div>
            <div className="form-grid form-grid--two">
              <FormField label="Diretório de contratos (dspath)"><input name="dspath" maxLength={500} defaultValue={parameters?.dspath ?? ''} placeholder="Ex.: \\SERVIDOR\CONTRATOS\" /></FormField>
              <FormField label="Diretório de arquivos do site / PDF (dspdf)"><input name="dspdf" maxLength={300} defaultValue={parameters?.dspdf ?? ''} placeholder="Ex.: \\SERVIDOR\SITE\" /></FormField>
            </div> */}

            <div className="form-section-title"><span><Percent size={14} /></span><div><strong>Valores e alíquotas</strong><small>Parâmetros financeiros reutilizados pelos módulos</small></div></div>
            <div className="form-grid form-grid--three system-parameters-financial">
              <FormField label="Valor do orçamento "><input name="vlorcam" type="number" min="0" step="0.01" defaultValue={parameters?.vlorcam ?? ''} /></FormField>
              <FormField label="ISS % "><input name="vliss" type="number" min="0" step="0.01" defaultValue={parameters?.vliss ?? ''} /></FormField>
              <FormField label="Alíquota % "><input name="vlaliq" type="number" min="0" step="0.01" defaultValue={parameters?.vlaliq ?? ''} /></FormField>
            </div>

            <div className="form-section-title"><span><Clock3 size={14} /></span><div><strong>Regras das ordens de serviço</strong><small>Tempos mínimos contabilizados por atendimento</small></div></div>
            <div className="form-grid form-grid--two system-parameters-financial">
              <FormField label="Mínimo para contrato (minutos)" hint="Descontado das horas contratadas por atendimento"><input name="contractMinimumMinutes" type="number" min="1" step="1" required defaultValue={parameters?.contractMinimumMinutes ?? 20} /></FormField>
              <FormField label="Mínimo para avulsa (minutos)" hint="Tempo mínimo cobrado por atendimento"><input name="oneOffMinimumMinutes" type="number" min="1" step="1" required defaultValue={parameters?.oneOffMinimumMinutes ?? 30} /></FormField>
              <FormField label="Observações para contrato"><textarea name="contractRules" rows={4} defaultValue={parameters?.contractRules ?? 'Cada atendimento de contrato contabiliza no mínimo 20 minutos. Horas excedentes são cobradas na mensalidade seguinte e horas não utilizadas não acumulam para o próximo mês.'} /></FormField>
              <FormField label="Observações para serviço avulso"><textarea name="oneOffRules" rows={4} defaultValue={parameters?.oneOffRules ?? 'Cada atendimento avulso é cobrado pelo mínimo de 30 minutos, mesmo quando a permanência do técnico for menor.'} /></FormField>
            </div>

            <div className="form-section-title"><span><CalendarClock size={14} /></span><div><strong>Regras dos contratos</strong><small>Prazo mínimo, garantia, reajuste e datas permitidas</small></div></div>
            <div className="form-grid form-grid--three system-parameters-financial">
              <FormField label="Prazo mínimo (meses)"><input name="minimumContractMonths" type="number" min="1" step="1" required defaultValue={parameters?.minimumContractMonths ?? 3} /></FormField>
              <FormField label="Garantia dos serviços (dias)"><input name="serviceWarrantyDays" type="number" min="1" step="1" required defaultValue={parameters?.serviceWarrantyDays ?? 90} /></FormField>
              <FormField label="Mês do reajuste"><select name="annualAdjustmentMonth" defaultValue={parameters?.annualAdjustmentMonth ?? 5}>{['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></FormField>
              <FormField label="Primeiro dia de vencimento"><input name="primaryDueDay" type="number" min="1" max="31" required defaultValue={parameters?.primaryDueDay ?? 10} /></FormField>
              <FormField label="Segundo dia de vencimento"><input name="secondaryDueDay" type="number" min="1" max="31" required defaultValue={parameters?.secondaryDueDay ?? 20} /></FormField>
            </div>

            <div className="form-section-title"><span><Mail size={14} /></span><div><strong>Aviso do prazo mínimo</strong><small>Modelo preparado para a notificação de três meses</small></div></div>
            <div className="form-grid form-grid--two">
              <FormField label="Assunto do e-mail"><input name="minimumTermEmailSubject" maxLength={250} defaultValue={parameters?.minimumTermEmailSubject ?? 'Período mínimo do contrato concluído'} /></FormField>
              <FormField label="Corpo do e-mail" hint="Variáveis: {cliente}, {contrato}, {meses} e {data_contrato}"><textarea name="minimumTermEmailBody" rows={5} defaultValue={parameters?.minimumTermEmailBody ?? 'Olá, {cliente}! O contrato #{contrato} completou o período mínimo de {meses} meses. Agradecemos pela confiança e por continuar conosco.'} /></FormField>
            </div>

            <aside className="system-parameters-note"><Clock3 size={18} /><span><strong>Configuração global</strong><small>Salvar uma alteração muda o valor vigente utilizado pelos próximos cadastros e atualizações de clientes.</small></span></aside>
          </div>

          <footer className="system-parameters-form__footer">
            <span>{parameters ? 'Atualize os campos necessários e salve.' : 'Preencha os dados para criar o registro único de parâmetros.'}</span>
            <Button type="submit" icon={saveMutation.isPending ? <LoaderCircle className="api-state__spinner" size={16} /> : <Save size={17} />} disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Salvando...' : parameters ? 'Salvar alterações' : 'Cadastrar parâmetros'}</Button>
          </footer>
        </form>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Excluir os parâmetros do sistema?"
        description="O registro global será removido. Enquanto não houver um novo cadastro, o ISS automático ficará sem valor nos novos clientes."
        confirmLabel="Excluir parâmetros"
        busy={deleteMutation.isPending}
        error={deleteError}
        onCancel={() => { if (!deleteMutation.isPending) { setDeleteOpen(false); setDeleteError('') } }}
        onConfirm={() => !deleteMutation.isPending && deleteMutation.mutate()}
      />
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </>
  )
}
