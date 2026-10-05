import { useState } from 'react'
import { PageHeader, Toast } from '../components/ui'
import { ClientStatementsTab } from './Statements'

export function AttendancePeriodReport() {
  const [toast, setToast] = useState('')
  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }
  return <>
    <PageHeader eyebrow="Relatórios" title="Consulta de atendimentos por período" subtitle="Consulta operacional por cliente; o extrato oficial de cobrança permanece vinculado a cada boleto." />
    <ClientStatementsTab showToast={showToast} />
    {toast && <Toast message={toast} onClose={() => setToast('')} />}
  </>
}
