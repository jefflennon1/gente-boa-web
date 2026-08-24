import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Clock3, FolderOpen, Landmark, LoaderCircle, Percent, Save, Settings2, Trash2 } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import type { SystemParametersPayload } from '../types'
import { Button, ConfirmDialog, ErrorState, FormError, FormField, LoadingState, PageHeader, Toast } from '../components/ui'

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
    }
    saveMutation.mutate({ payload, exists: Boolean(parameters) })
  }

  return (
    <>
      <PageHeader
        eyebrow="Configurações"
        title="Parâmetros do sistema"
        subtitle="Configurações globais usadas pelos cadastros de clientes e contratos. Acesso restrito a administradores."
        
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
