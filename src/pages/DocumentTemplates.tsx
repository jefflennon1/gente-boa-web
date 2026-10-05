import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, FileSignature, Mail, RotateCcw, Save } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { modulesApi, modulesKeys, openPdf, type DocumentTemplate, type TemplateKey } from '../api/modules'
import { Badge, Button, ConfirmDialog, ErrorState, FormError, LoadingState, PageHeader, Toast } from '../components/ui'
import { formatDate } from '../lib/format'

const templateOptions: Array<{ key: TemplateKey; title: string; detail: string; icon: typeof FileSignature }> = [
  { key: 'CONTRATO', title: 'Contrato de prestação de serviços', detail: 'Texto do contrato gerado em Contratos > Exibir documento de contrato.', icon: FileSignature },
  { key: 'BOAS_VINDAS', title: 'Carta de boas-vindas', detail: 'Carta enviada ao cliente quando o contrato é fechado.', icon: Mail },
]

/** Modelos editáveis do contrato e da carta de boas-vindas (POP p.27-28). */
export function DocumentTemplates() {
  const queryClient = useQueryClient()
  const [key, setKey] = useState<TemplateKey>('CONTRATO')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [previewContractId, setPreviewContractId] = useState('')
  const [formError, setFormError] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const [toast, setToast] = useState('')
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const templateQuery = useQuery({ queryKey: [...modulesKeys.templates, key], queryFn: () => modulesApi.templates.find(key) })
  const template = templateQuery.data
  const dirty = !!template && (template.title !== title || template.body !== body)

  useEffect(() => {
    if (!template) return
    setTitle(template.title)
    setBody(template.body)
    setFormError('')
  }, [template])

  const applySaved = (saved: DocumentTemplate) => queryClient.setQueryData([...modulesKeys.templates, key], saved)
  const saveMutation = useMutation({
    mutationFn: () => modulesApi.templates.save(key, { title, body }),
    onSuccess: (saved) => { applySaved(saved); setToast('Modelo gravado. Os próximos documentos já usam o novo texto.') },
    onError: (error) => setFormError(apiErrorMessage(error)),
  })
  const resetMutation = useMutation({
    mutationFn: () => modulesApi.templates.reset(key),
    onSuccess: (saved) => { applySaved(saved); setConfirmReset(false); setToast('Texto padrão restaurado.') },
    onError: (error) => { setConfirmReset(false); setFormError(apiErrorMessage(error)) },
  })
  const previewMutation = useMutation({
    mutationFn: () => modulesApi.templates.preview(key, Number(previewContractId), { title, body }),
    onSuccess: (blob) => openPdf(blob),
    onError: (error) => setFormError(apiErrorMessage(error, 'Não foi possível gerar a prévia. Confira o código do contrato.')),
  })

  function switchTemplate(next: TemplateKey) {
    if (next === key) return
    if (dirty && !window.confirm('Há alterações não gravadas neste modelo. Deseja descartá-las?')) return
    setKey(next)
  }

  function insert(text: string) {
    const area = bodyRef.current
    if (!area) { setBody((current) => current + text); return }
    const start = area.selectionStart
    const end = area.selectionEnd
    const next = body.slice(0, start) + text + body.slice(end)
    setBody(next)
    window.requestAnimationFrame(() => { area.focus(); area.setSelectionRange(start + text.length, start + text.length) })
  }

  return <>
    <PageHeader eyebrow="Utilitários" title="Modelos de documentos" subtitle="Edite o texto do contrato e da carta de boas-vindas. Os dados do cliente e do contrato entram pelas variáveis." />
    <section className="report-picker">{templateOptions.map((option) => <button key={option.key} className={key === option.key ? 'active' : ''} onClick={() => switchTemplate(option.key)}><strong>{option.title}</strong><small>{option.detail}</small></button>)}</section>
    <section className="panel data-panel">
      {templateQuery.isLoading ? <LoadingState label="Carregando modelo..." /> : templateQuery.isError ? <ErrorState message={apiErrorMessage(templateQuery.error)} onRetry={() => templateQuery.refetch()} /> : template && <div className="template-editor">
        <div className="template-editor__main">
          <FormError message={formError} />
          <div className="template-editor__status">
            {template.customized ? <Badge tone="blue">Texto personalizado</Badge> : <Badge>Texto padrão do sistema</Badge>}
            {template.updatedAt && <small>Última alteração em {formatDate(template.updatedAt)}{template.updatedBy ? ` por ${template.updatedBy}` : ''}</small>}
            {dirty && <Badge tone="orange">Alterações não gravadas</Badge>}
          </div>
          <label className="template-editor__field"><span>Título do documento</span><input value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} /></label>
          <label className="template-editor__field"><span>Texto</span><textarea ref={bodyRef} value={body} spellCheck onChange={(event) => setBody(event.target.value)} /></label>
          <div className="template-editor__actions">
            <Button icon={<Save size={16} />} disabled={!dirty || !title.trim() || !body.trim() || saveMutation.isPending} onClick={() => { setFormError(''); saveMutation.mutate() }}>{saveMutation.isPending ? 'Gravando...' : 'Gravar modelo'}</Button>
            <Button variant="secondary" disabled={!dirty} onClick={() => { setTitle(template.title); setBody(template.body) }}>Descartar alterações</Button>
            <Button variant="ghost" icon={<RotateCcw size={16} />} disabled={!template.customized} onClick={() => setConfirmReset(true)}>Restaurar texto padrão</Button>
            <span className="template-editor__preview">
              <input value={previewContractId} onChange={(event) => setPreviewContractId(event.target.value.replace(/\D/g, ''))} placeholder="Nº do contrato" aria-label="Contrato para a prévia" />
              <Button variant="secondary" icon={<Eye size={16} />} disabled={!previewContractId || previewMutation.isPending} onClick={() => { setFormError(''); previewMutation.mutate() }}>{previewMutation.isPending ? 'Gerando...' : 'Prévia em PDF'}</Button>
            </span>
          </div>
        </div>
        <aside className="template-editor__help">
          <h3>Como escrever</h3>
          <ul>
            <li><code># Título</code> abre uma nova cláusula/seção.</li>
            <li><code>- texto</code> vira um item de lista.</li>
            <li><code>**texto**</code> deixa o trecho em negrito.</li>
            <li>Linha em branco separa parágrafos.</li>
          </ul>
          <h3>Variáveis <small>(clique para inserir)</small></h3>
          <div className="template-editor__chips">{template.variables.map((variable) => <button key={variable.name} type="button" title={variable.description} onClick={() => insert(`{{${variable.name}}}`)}><code>{`{{${variable.name}}}`}</code><small>{variable.description}</small></button>)}</div>
          {template.blocks.length > 0 && <><h3>Blocos automáticos</h3><div className="template-editor__chips">{template.blocks.map((block) => <button key={block.name} type="button" title={block.description} onClick={() => insert(`\n[[${block.name}]]\n`)}><code>{`[[${block.name}]]`}</code><small>{block.description}</small></button>)}</div></>}
        </aside>
      </div>}
    </section>
    <ConfirmDialog open={confirmReset} title="Restaurar o texto padrão?" description="O texto personalizado deste modelo será descartado e o sistema voltará a usar o texto padrão." confirmLabel="Restaurar" busyLabel="Restaurando..." eyebrow="Modelo de documento" variant="primary" busy={resetMutation.isPending} onCancel={() => setConfirmReset(false)} onConfirm={() => resetMutation.mutate()} />
    {toast && <Toast message={toast} onClose={() => setToast('')} />}
  </>
}
