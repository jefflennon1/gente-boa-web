import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Cake, LoaderCircle, Save, Send } from 'lucide-react'
import { api, queryKeys } from '../api/services'
import { apiErrorMessage } from '../api/client'
import type { BirthdayEmailSettings } from '../types'
import { formatDate } from '../lib/format'
import { Badge, Button, ErrorState, FormError, FormField, LoadingState } from './ui'

const statusLabels: Record<string, { label: string; tone: 'green' | 'orange' | 'red' | 'neutral' }> = {
  ENVIADO: { label: 'Enviado', tone: 'green' },
  PENDENTE: { label: 'A enviar', tone: 'orange' },
  ERRO: { label: 'Falhou', tone: 'red' },
  IGNORADO: { label: 'E-mail inválido', tone: 'neutral' },
}

/** Felicitações de aniversário automáticas: usa o mesmo envio de e-mails do sistema (boletos, prazo mínimo). */
export function BirthdayEmailSettingsForm({ onSaved }: { onSaved: (message: string) => void }) {
  const settingsQuery = useQuery({ queryKey: [...queryKeys.systemParameters, 'birthday-email'], queryFn: api.systemParameters.getBirthdayEmailSettings })
  if (settingsQuery.isLoading) return <section className="panel"><LoadingState label="Carregando felicitações de aniversário..." /></section>
  if (settingsQuery.isError || !settingsQuery.data) return <section className="panel"><ErrorState message={apiErrorMessage(settingsQuery.error)} onRetry={() => settingsQuery.refetch()} /></section>
  return <BirthdayForm key={`${settingsQuery.data.subject}-${settingsQuery.data.enabled}`} settings={settingsQuery.data} onSaved={onSaved} />
}

function BirthdayForm({ settings, onSaved }: { settings: BirthdayEmailSettings; onSaved: (message: string) => void }) {
  const queryClient = useQueryClient()
  const [enabled, setEnabled] = useState(settings.enabled)
  const [onlyContracted, setOnlyContracted] = useState(settings.onlyContracted)
  const [onlyOptedIn, setOnlyOptedIn] = useState(settings.onlyOptedIn)
  const [subject, setSubject] = useState(settings.subject)
  const [body, setBody] = useState(settings.body)
  const [formError, setFormError] = useState('')
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const dirty = enabled !== settings.enabled || onlyContracted !== settings.onlyContracted || onlyOptedIn !== settings.onlyOptedIn || subject !== settings.subject || body !== settings.body
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [...queryKeys.systemParameters, 'birthday-email'] })

  const saveMutation = useMutation({
    mutationFn: () => api.systemParameters.updateBirthdayEmailSettings({ enabled, onlyContracted, onlyOptedIn, subject: subject.trim(), body: body.trim() }),
    onSuccess: async (saved) => {
      queryClient.setQueryData([...queryKeys.systemParameters, 'birthday-email'], saved)
      await queryClient.invalidateQueries({ queryKey: queryKeys.systemParameters })
      setFormError('')
      onSaved(saved.enabled ? 'Felicitações de aniversário ativadas.' : 'Configuração de aniversários gravada.')
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })
  const sendMutation = useMutation({
    mutationFn: api.systemParameters.sendBirthdayEmailsToday,
    onSuccess: async (result) => {
      await invalidate()
      setFormError('')
      onSaved(result.queued === 0 ? 'Nenhuma felicitação pendente para hoje.' : `Felicitações de hoje: ${result.sent} enviada(s), ${result.failed} com falha, ${result.ignored} com e-mail inválido.`)
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })

  function insert(text: string) {
    const area = bodyRef.current
    if (!area) { setBody((current) => current + text); return }
    const start = area.selectionStart
    const next = body.slice(0, start) + text + body.slice(area.selectionEnd)
    setBody(next)
    window.requestAnimationFrame(() => { area.focus(); area.setSelectionRange(start + text.length, start + text.length) })
  }

  const pending = settings.todayClients.filter((client) => client.status !== 'ENVIADO').length
  return <form className="panel system-parameters-form service-adjustment-form" onSubmit={(event) => { event.preventDefault(); if (!subject.trim() || !body.trim()) { setFormError('Informe o assunto e o texto do e-mail.'); return } saveMutation.mutate() }}>
    <header className="system-parameters-form__header">
      <span className="system-parameters-form__icon"><Cake size={21} /></span>
      <div><span>Relacionamento</span><h2>Felicitações de aniversário</h2><p>Envia automaticamente um e-mail de parabéns aos clientes no dia do aniversário (cadastro do cliente, campo Aniversário).</p></div>
      <label className={`service-adjustment-toggle ${enabled ? 'service-adjustment-toggle--active' : ''}`}>
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        <span aria-hidden="true"><i /></span><strong>{enabled ? 'Ativado' : 'Desativado'}</strong>
      </label>
    </header>
    <div className="system-parameters-form__body">
      <FormError message={formError} />
      {!settings.mailEnabled && <div className="service-adjustment-intro birthday-warning"><Send size={18} /><span><strong>Envio de e-mails desligado neste servidor</strong><small>A configuração pode ser gravada, mas os e-mails só saem quando o envio estiver habilitado na API (MAIL_ENABLED=true), o mesmo usado para boletos.</small></span></div>}
      <section className="service-adjustment-scope">
        <strong>Quem recebe</strong>
        <div className="adjustment-scope-options">
          <label className="checkbox-inline"><input type="checkbox" checked={onlyContracted} onChange={(event) => setOnlyContracted(event.target.checked)} /> Somente clientes com contrato ativo</label>
          <label className="checkbox-inline"><input type="checkbox" checked={onlyOptedIn} onChange={(event) => setOnlyOptedIn(event.target.checked)} /> Somente clientes marcados com “Enviar felicitação de aniversário = Sim”</label>
        </div>
        <small>Clientes marcados com “Não” no cadastro nunca recebem. É preciso ter e-mail e data de aniversário (dd/mm). O envio ocorre a partir das 8h, com novas tentativas ao longo do dia em caso de falha.</small>
      </section>
      <div className="form-grid">
        <FormField label="Assunto do e-mail"><input value={subject} maxLength={250} onChange={(event) => setSubject(event.target.value)} required /></FormField>
        <FormField label="Texto do e-mail" hint="Linha em branco separa parágrafos. Clique nas variáveis abaixo para inseri-las no texto."><textarea ref={bodyRef} rows={11} value={body} onChange={(event) => setBody(event.target.value)} required /></FormField>
      </div>
      <div className="birthday-variables">{settings.variables.map((variable) => <button type="button" key={variable.name} title={variable.description} onClick={() => insert(`{{${variable.name}}}`)}><code>{`{{${variable.name}}}`}</code><small>{variable.description}</small></button>)}</div>

      <section className="service-adjustment-scope">
        <strong>Aniversariantes de hoje ({formatDate(settings.today)})</strong>
        {settings.todayClients.length === 0 ? <small>Nenhum cliente faz aniversário hoje com os critérios atuais.</small> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Cliente</th><th>E-mail</th><th>Contrato</th><th>Situação</th></tr></thead>
          <tbody>{settings.todayClients.map((client) => { const status = statusLabels[client.status] ?? { label: client.status, tone: 'neutral' as const }; return <tr key={client.clientId}><td><strong>#{client.clientId}</strong> {client.name}</td><td>{client.email}</td><td>{client.contracted ? 'Ativo' : 'Avulso'}</td><td><Badge tone={status.tone}>{status.label}</Badge>{client.processedAt && <small className="table-secondary">{formatDate(client.processedAt, true)}</small>}{client.error && <small className="table-secondary">{client.error}</small>}</td></tr> })}</tbody></table></div>}
        <small>Os critérios exibidos são os gravados; salve antes de conferir a lista com novos critérios.</small>
      </section>
    </div>
    <footer className="system-parameters-form__footer">
      <span>{enabled ? 'As felicitações são enviadas automaticamente todos os dias.' : 'Ative para enviar as felicitações automaticamente.'}</span>
      <Button type="button" variant="secondary" icon={sendMutation.isPending ? <LoaderCircle className="api-state__spinner" size={16} /> : <Send size={16} />} disabled={sendMutation.isPending || dirty || pending === 0} title={dirty ? 'Grave as alterações antes de enviar' : undefined} onClick={() => sendMutation.mutate()}>{sendMutation.isPending ? 'Enviando...' : `Enviar as de hoje agora${pending ? ` (${pending})` : ''}`}</Button>
      <Button type="submit" icon={saveMutation.isPending ? <LoaderCircle className="api-state__spinner" size={16} /> : <Save size={17} />} disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Salvando...' : 'Salvar configuração'}</Button>
    </footer>
  </form>
}
