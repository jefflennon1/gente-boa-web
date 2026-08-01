import type { ButtonHTMLAttributes, FormEvent, ReactNode } from 'react'
import { CheckCircle2, X } from 'lucide-react'

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

export function Modal({ open, onClose, title, description, children, size = 'medium' }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; size?: 'medium' | 'large' }) {
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

export function FormField({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

export function ModalForm({ children, onSubmit, onCancel, submitLabel = 'Salvar' }: { children: ReactNode; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; submitLabel?: string }) {
  return (
    <form onSubmit={onSubmit}>
      <div className="modal__body">{children}</div>
      <footer className="modal__footer">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">{submitLabel}</Button>
      </footer>
    </form>
  )
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="toast" role="status">
      <CheckCircle2 size={20} />
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
