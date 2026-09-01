import type { ButtonHTMLAttributes, FormEvent, ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, LoaderCircle, RefreshCw, Trash2, X } from 'lucide-react'

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}

export function Button({ variant = 'primary', icon, className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: ReactNode }) {
  return (
    <button className={`button button--${variant} ${className}`} {...props}>
      {icon}
      <span>{children}</span>
    </button>
  )
}

export function StatCard({ label, value, helper, icon, tone = 'blue' }: { label: string; value: string; helper: string; icon: ReactNode; tone?: 'blue' | 'orange' | 'green' | 'gold' | 'purple' }) {
  return (
    <article className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__icon">{icon}</div>
      <div>
        <span className="stat-card__label">{label}</span>
        <strong>{value}</strong>
        <small>{helper}</small>
      </div>
    </article>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'green' | 'orange' | 'red' | 'blue' | 'neutral' | 'purple' }) {
  return <span className={`badge badge--${tone}`}><i />{children}</span>
}

export function Modal({ open, onClose, title, description, children, size = 'medium' }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; size?: 'medium' | 'large' | 'xlarge' }) {
  if (!open) return null
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal modal--${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal__header">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </header>
        {children}
      </section>
    </div>
  )
}

export function DetailModal({ open, onClose, title, description, children, actions, size = 'large' }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; actions?: ReactNode; size?: 'medium' | 'large' | 'xlarge' }) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size={size}>
      <div className="modal__body detail-modal__body">{children}</div>
      {actions && <footer className="modal__footer detail-modal__footer">{actions}</footer>}
    </Modal>
  )
}

export function FormField({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

export function ModalForm({ children, onSubmit, onCancel, submitLabel = 'Salvar', submitting = false }: { children: ReactNode; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; submitLabel?: string; submitting?: boolean }) {
  return (
    <form onSubmit={onSubmit}>
      <div className="modal__body">{children}</div>
      <footer className="modal__footer">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>Cancelar</Button>
        <Button type="submit" disabled={submitting}>{submitLabel}</Button>
      </footer>
    </form>
  )
}

export function Toast({ message, onClose, variant = 'success' }: { message: string; onClose: () => void; variant?: 'success' | 'error' }) {
  return (
    <div className={`toast toast--${variant}`} role={variant === 'error' ? 'alert' : 'status'}>
      {variant === 'error' ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
      <span>{message}</span>
      <button onClick={onClose} aria-label="Fechar"><X size={16} /></button>
    </div>
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state__mark">GB</div>
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  )
}

export function LoadingState({ label = 'Carregando dados...' }: { label?: string }) {
  return <div className="api-state"><LoaderCircle className="api-state__spinner" size={24} /><strong>{label}</strong></div>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="api-state api-state--error"><AlertTriangle size={24} /><div><strong>Não foi possível carregar</strong><span>{message}</span></div>{onRetry && <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={onRetry}>Tentar novamente</Button>}</div>
}

export function FormError({ message }: { message?: string }) {
  return message ? <div className="form-error" role="alert"><AlertTriangle size={16} /><span>{message}</span></div> : null
}

export function ConfirmDialog({ open, title, description, confirmLabel = 'Confirmar exclusão', busy = false, error, onConfirm, onCancel }: { open: boolean; title: string; description: string; confirmLabel?: string; busy?: boolean; error?: string; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null
  return (
    <div className="confirm-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel()}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description">
        <button className="confirm-dialog__close" onClick={onCancel} disabled={busy} aria-label="Fechar"><X size={18} /></button>
        <span className="confirm-dialog__icon"><Trash2 size={24} /></span>
        <div className="confirm-dialog__copy"><span>Ação permanente</span><h2 id="confirm-dialog-title">{title}</h2><p id="confirm-dialog-description">{description}</p></div>
        <FormError message={error} />
        <footer><Button variant="secondary" onClick={onCancel} disabled={busy}>Cancelar</Button><Button variant="danger" icon={busy ? <LoaderCircle className="api-state__spinner" size={16} /> : <Trash2 size={16} />} onClick={onConfirm} disabled={busy}>{busy ? 'Excluindo...' : confirmLabel}</Button></footer>
      </section>
    </div>
  )
}
