import { Landmark } from 'lucide-react'
import type { ClientTaxRetention } from '../types'

/** Aviso destacado de que o cliente retém ISS/INSS na fonte (conforme o cadastro). */
export function TaxRetentionNotice({ retention, className = '' }: { retention?: ClientTaxRetention | null; className?: string }) {
  if (!retention?.notice) return null
  return <p className={`tax-retention-notice ${className}`} role="note"><Landmark size={15} /><span><strong>Retenção de impostos:</strong> {retention.notice}</span></p>
}

/** Selos compactos para listas: "Retém ISS" / "Retém INSS". */
export function TaxRetentionBadges({ iss, inss }: { iss?: boolean | null; inss?: boolean | null }) {
  if (!iss && !inss) return null
  return <span className="tax-retention-badges">{iss && <span className="tax-retention-badge" title="Cliente retém ISS na fonte (cadastro)">Retém ISS</span>}{inss && <span className="tax-retention-badge" title="Cliente retém INSS na fonte (cadastro)">Retém INSS</span>}</span>
}
