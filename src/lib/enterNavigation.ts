// Enter funciona como Tab dentro de formulários: avança para o próximo campo (Shift+Enter volta).
// Botões comuns são ignorados na navegação para evitar acionar ações sem querer; o botão de envio
// entra na sequência, então após o último campo o foco vai para "Salvar" e o próximo Enter confirma.
// Outros botões entram na sequência quando marcados com data-enter-target (o Enter neles aciona o botão).
// Formulários com data-allow-enter-submit="true" mantêm o envio padrão pelo Enter.

const NAVIGATION_SCOPE = 'form, [data-enter-navigation]'
const FIELD_SELECTOR = 'input:not([type="hidden"]), select, textarea, button'
const BUTTON_INPUTS = new Set(['button', 'submit', 'reset', 'image'])
const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'file', 'color', 'range', ...BUTTON_INPUTS])

function isNavigable(element: HTMLElement) {
  if (element instanceof HTMLButtonElement && element.type !== 'submit' && !element.hasAttribute('data-enter-target')) return false
  if (element.matches(':disabled') || element.tabIndex < 0) return false
  if ((element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && element.readOnly) return false
  if (element.closest('[aria-hidden="true"], [inert]')) return false
  return element.getClientRects().length > 0
}

function isField(element: HTMLElement) {
  if (element instanceof HTMLInputElement) return !BUTTON_INPUTS.has(element.type)
  return element instanceof HTMLSelectElement
}

function focusElement(element: HTMLElement) {
  element.focus()
  if (element instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(element.type)) {
    try { element.select() } catch { /* alguns tipos (date, number) não suportam seleção */ }
  }
}

export function handleEnterNavigation(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.isComposing || event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return

  const target = event.target
  if (!(target instanceof HTMLElement) || target instanceof HTMLTextAreaElement || target.isContentEditable) return

  const scope = target.closest<HTMLElement>(NAVIGATION_SCOPE)
  if (!scope || scope.dataset.allowEnterSubmit === 'true') return

  // Em botões e links o Enter mantém o comportamento nativo (acionar o elemento).
  if (!isField(target)) return

  event.preventDefault()
  moveFocus(scope, target, event.shiftKey)
}

function moveFocus(scope: HTMLElement, from: HTMLElement, backwards: boolean) {
  const elements = Array.from(scope.querySelectorAll<HTMLElement>(FIELD_SELECTOR)).filter((element) => element === from || isNavigable(element))
  const index = elements.indexOf(from)
  if (index === -1) return

  const next = elements[backwards ? index - 1 : index + 1]
  if (next) focusElement(next)
}

/** Leva o foco ao próximo campo do formulário, na mesma ordem da navegação pelo Enter. */
export function focusNextField(from: HTMLElement) {
  const scope = from.closest<HTMLElement>(NAVIGATION_SCOPE)
  if (scope) moveFocus(scope, from, false)
}
