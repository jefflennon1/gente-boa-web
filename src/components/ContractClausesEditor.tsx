import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Eye, FileText, ListOrdered, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { apiErrorMessage } from '../api/client'
import { modulesApi, modulesKeys, openPdf } from '../api/modules'
import { Button, ConfirmDialog, ErrorState, FormError, FormField, LoadingState } from './ui'
import { formatDate } from '../lib/format'

type Section = { key: string; title: string; lines: string[] }

const BLOCK_PATTERN = /^\[\[([A-Z_]+)\]\]$/
const CLAUSE_PATTERN = /^\d+ª Cláusula:\s*/

let keySequence = 0
const nextKey = () => `section-${++keySequence}`

/** O modelo do contrato usa uma linha por parágrafo e "# " para iniciar cada seção (ver DocumentTemplateService). */
function parseBody(body: string): Section[] {
  const sections: Section[] = [{ key: nextKey(), title: '', lines: [] }]
  body.replace(/\r\n/g, '\n').split('\n').forEach((raw) => {
    const line = raw.trim()
    if (!line) return
    if (line.startsWith('# ')) sections.push({ key: nextKey(), title: line.slice(2).trim(), lines: [] })
    else sections[sections.length - 1].lines.push(line)
  })
  return sections
}

function serialize(sections: Section[]) {
  return sections.flatMap((section, index) => [
    ...(index === 0 && !section.title ? [] : [`# ${section.title.trim() || 'SEÇÃO'}`]),
    ...section.lines.map((line) => line.replace(/\s*\n+\s*/g, ' ').trim()).filter(Boolean),
  ]).join('\n')
}

/** Renumera as linhas "Nª Cláusula:" na ordem em que aparecem. */
function renumber(sections: Section[]) {
  let number = 0
  return sections.map((section) => ({ ...section, lines: section.lines.map((line) => CLAUSE_PATTERN.test(line) ? `${++number}ª Cláusula: ${line.replace(CLAUSE_PATTERN, '')}` : line) }))
}

function clauseCount(sections: Section[]) {
  return sections.reduce((sum, section) => sum + section.lines.filter((line) => CLAUSE_PATTERN.test(line)).length, 0)
}

/**
 * Parâmetros do sistema → Cláusulas do contrato: edição das seções e cláusulas do contrato enviado aos clientes.
 * Usa o mesmo modelo de "Modelos de documentos"; tabelas e assinaturas geradas pelo sistema ficam travadas.
 */
export function ContractClausesEditor({ onSaved }: { onSaved: (message: string) => void }) {
  const queryClient = useQueryClient()
  const templateQuery = useQuery({ queryKey: [...modulesKeys.templates, 'CONTRATO'], queryFn: () => modulesApi.templates.find('CONTRATO') })
  const template = templateQuery.data
  if (templateQuery.isLoading) return <section className="panel"><LoadingState label="Carregando as cláusulas do contrato..." /></section>
  if (templateQuery.isError || !template) return <section className="panel"><ErrorState message={apiErrorMessage(templateQuery.error)} onRetry={() => templateQuery.refetch()} /></section>
  return <ClausesForm key={`${template.updatedAt ?? 'padrao'}-${template.customized}`} title={template.title} body={template.body} customized={template.customized} updatedAt={template.updatedAt} updatedBy={template.updatedBy} variables={template.variables} onSaved={async (message) => { await queryClient.invalidateQueries({ queryKey: modulesKeys.templates }); onSaved(message) }} />
}

function ClausesForm({ title: initialTitle, body, customized, updatedAt, updatedBy, variables, onSaved }: { title: string; body: string; customized: boolean; updatedAt: string | null; updatedBy: string | null; variables: Array<{ name: string; description: string }>; onSaved: (message: string) => void }) {
  const [title, setTitle] = useState(initialTitle)
  const [sections, setSections] = useState<Section[]>(() => parseBody(body))
  const [previewContract, setPreviewContract] = useState('')
  const [error, setError] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const dirty = useMemo(() => serialize(sections) !== serialize(parseBody(body)) || title !== initialTitle, [body, initialTitle, sections, title])

  const saveMutation = useMutation({
    mutationFn: () => modulesApi.templates.save('CONTRATO', { title, body: serialize(sections) }),
    onSuccess: () => { setError(''); onSaved('Cláusulas do contrato salvas. Os próximos contratos gerados já usam o novo texto.') },
    onError: (reason) => setError(apiErrorMessage(reason)),
  })
  const resetMutation = useMutation({
    mutationFn: () => modulesApi.templates.reset('CONTRATO'),
    onSuccess: () => { setResetOpen(false); setError(''); onSaved('Cláusulas do contrato restauradas para o texto padrão.') },
    onError: (reason) => setError(apiErrorMessage(reason)),
  })
  const previewMutation = useMutation({
    mutationFn: () => modulesApi.templates.preview('CONTRATO', Number(previewContract), { title, body: serialize(sections) }),
    onSuccess: openPdf,
    onError: (reason) => setError(apiErrorMessage(reason, 'Não foi possível gerar a pré-visualização.')),
  })

  function updateSection(index: number, patch: Partial<Section>) {
    setSections((current) => current.map((section, position) => position === index ? { ...section, ...patch } : section))
  }

  function updateLine(sectionIndex: number, lineIndex: number, value: string) {
    setSections((current) => current.map((section, position) => position === sectionIndex ? { ...section, lines: section.lines.map((line, index) => index === lineIndex ? value : line) } : section))
  }

  function insertLine(sectionIndex: number, afterIndex: number, value: string) {
    setSections((current) => current.map((section, position) => {
      if (position !== sectionIndex) return section
      const lines = [...section.lines]
      lines.splice(afterIndex + 1, 0, value)
      return { ...section, lines }
    }))
  }

  function removeLine(sectionIndex: number, lineIndex: number) {
    setSections((current) => current.map((section, position) => position === sectionIndex ? { ...section, lines: section.lines.filter((_, index) => index !== lineIndex) } : section))
  }

  function moveLine(sectionIndex: number, lineIndex: number, direction: -1 | 1) {
    setSections((current) => current.map((section, position) => {
      if (position !== sectionIndex) return section
      const target = lineIndex + direction
      if (target < 0 || target >= section.lines.length) return section
      const lines = [...section.lines]
      ;[lines[lineIndex], lines[target]] = [lines[target], lines[lineIndex]]
      return { ...section, lines }
    }))
  }

  function moveSection(index: number, direction: -1 | 1) {
    setSections((current) => {
      const target = index + direction
      if (index === 0 || target < 1 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function addClause(sectionIndex: number) {
    insertLine(sectionIndex, sections[sectionIndex].lines.length - 1, `${clauseCount(sections) + 1}ª Cláusula: `)
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!serialize(sections).trim()) { setError('O contrato precisa ter ao menos uma cláusula.'); return }
    if (sections.slice(1).some((section) => !section.title.trim())) { setError('Informe o título de todas as seções.'); return }
    saveMutation.mutate()
  }

  return <form className="panel system-parameters-form contract-clauses" onSubmit={submit}>
    <header className="contract-clauses__header">
      <div><strong>Cláusulas do contrato</strong><small>Texto do contrato gerado para envio aos clientes. {customized ? `Personalizado${updatedAt ? ` em ${formatDate(updatedAt, true)}` : ''}${updatedBy ? ` por ${updatedBy}` : ''}.` : 'Usando o texto padrão do sistema.'}</small></div>
      <div className="contract-clauses__actions">
        <label className="contract-clauses__preview"><span>Contrato para pré-visualizar</span><input type="number" min="1" value={previewContract} onChange={(event) => setPreviewContract(event.target.value)} placeholder="Nº do contrato" /></label>
        <Button type="button" variant="secondary" icon={<Eye size={16} />} disabled={!previewContract || previewMutation.isPending} onClick={() => { setError(''); previewMutation.mutate() }}>{previewMutation.isPending ? 'Gerando...' : 'Pré-visualizar'}</Button>
      </div>
    </header>
    <FormError message={error} />
    <FormField label="Título do contrato" hint="{{contrato.numero}} é trocado pelo número do contrato."><input value={title} maxLength={250} onChange={(event) => setTitle(event.target.value)} required /></FormField>

    <details className="contract-clauses__variables">
      <summary>Campos que podem ser usados no texto (trocados pelos dados do contrato)</summary>
      <div>{variables.map((variable) => <span key={variable.name}><code>{`{{${variable.name}}}`}</code>{variable.description}</span>)}</div>
      <p>Use **texto** para negrito e comece a linha com "- " para criar itens a), b), c)...</p>
    </details>

    <div className="contract-clauses__sections">
      {sections.map((section, sectionIndex) => <section key={section.key} className="contract-clauses__section">
        <header>
          {sectionIndex === 0 && !section.title
            ? <strong className="contract-clauses__intro">Abertura (antes da primeira seção)</strong>
            : <input className="contract-clauses__section-title" value={section.title} onChange={(event) => updateSection(sectionIndex, { title: event.target.value.toUpperCase() })} placeholder="TÍTULO DA SEÇÃO" aria-label="Título da seção" />}
          {sectionIndex > 0 && <div className="contract-clauses__tools">
            <button type="button" onClick={() => moveSection(sectionIndex, -1)} disabled={sectionIndex <= 1} title="Subir seção" aria-label="Subir seção"><ArrowUp size={14} /></button>
            <button type="button" onClick={() => moveSection(sectionIndex, 1)} disabled={sectionIndex === sections.length - 1} title="Descer seção" aria-label="Descer seção"><ArrowDown size={14} /></button>
            <button type="button" className="danger" onClick={() => setSections((current) => current.filter((_, index) => index !== sectionIndex))} title="Excluir seção" aria-label="Excluir seção"><Trash2 size={14} /></button>
          </div>}
        </header>
        {section.lines.map((line, lineIndex) => {
          const block = BLOCK_PATTERN.exec(line)
          return <div key={`${section.key}-${lineIndex}`} className={`contract-clauses__line ${block ? 'contract-clauses__line--block' : ''}`}>
            {block
              ? <span className="contract-clauses__block"><FileText size={14} /> Tabela gerada pelo sistema: <strong>{block[1].replace(/_/g, ' ')}</strong></span>
              : <textarea value={line} rows={Math.min(8, Math.max(2, Math.ceil(line.length / 110)))} onChange={(event) => updateLine(sectionIndex, lineIndex, event.target.value)} aria-label={`Parágrafo ${lineIndex + 1} da seção`} />}
            <div className="contract-clauses__tools">
              <button type="button" onClick={() => moveLine(sectionIndex, lineIndex, -1)} disabled={lineIndex === 0} title="Subir" aria-label="Subir parágrafo"><ArrowUp size={14} /></button>
              <button type="button" onClick={() => moveLine(sectionIndex, lineIndex, 1)} disabled={lineIndex === section.lines.length - 1} title="Descer" aria-label="Descer parágrafo"><ArrowDown size={14} /></button>
              <button type="button" onClick={() => insertLine(sectionIndex, lineIndex, '')} title="Novo parágrafo abaixo" aria-label="Novo parágrafo abaixo"><Plus size={14} /></button>
              {!block && <button type="button" className="danger" onClick={() => removeLine(sectionIndex, lineIndex)} title="Excluir parágrafo" aria-label="Excluir parágrafo"><Trash2 size={14} /></button>}
            </div>
          </div>
        })}
        <div className="contract-clauses__section-actions">
          <Button type="button" variant="ghost" icon={<Plus size={15} />} onClick={() => addClause(sectionIndex)}>Nova cláusula</Button>
          <Button type="button" variant="ghost" icon={<Plus size={15} />} onClick={() => insertLine(sectionIndex, section.lines.length - 1, 'Parágrafo único: ')}>Novo parágrafo</Button>
        </div>
      </section>)}
    </div>

    <div className="contract-clauses__footer">
      <Button type="button" variant="secondary" icon={<Plus size={16} />} onClick={() => setSections((current) => [...current, { key: nextKey(), title: 'NOVA SEÇÃO', lines: [`${clauseCount(current) + 1}ª Cláusula: `] }])}>Nova seção</Button>
      <Button type="button" variant="secondary" icon={<ListOrdered size={16} />} onClick={() => setSections((current) => renumber(current))}>Renumerar cláusulas</Button>
      <Button type="button" variant="danger" icon={<RotateCcw size={16} />} disabled={!customized || resetMutation.isPending} onClick={() => setResetOpen(true)}>Restaurar texto padrão</Button>
      <Button type="submit" icon={<Save size={16} />} disabled={!dirty || saveMutation.isPending}>{saveMutation.isPending ? 'Salvando...' : 'Salvar cláusulas'}</Button>
    </div>
    <ConfirmDialog open={resetOpen} title="Restaurar o texto padrão do contrato?" description="As alterações feitas nas cláusulas serão descartadas e os próximos contratos usarão o texto original do sistema." confirmLabel="Restaurar" busy={resetMutation.isPending} onCancel={() => setResetOpen(false)} onConfirm={() => resetMutation.mutate()} />
  </form>
}
