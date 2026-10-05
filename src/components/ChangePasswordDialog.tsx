import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { apiErrorMessage, http } from '../api/client'
import { FormError, FormField, Modal, ModalForm, Toast } from './ui'

/** Utilitários > Trocar senha: o próprio usuário altera a sua senha informando a atual. */
export function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const mutation = useMutation({
    mutationFn: (payload: { currentPassword: string; newPassword: string }) => http.post('/auth/change-password', payload),
    onSuccess: () => { setDone(true); onClose(); window.setTimeout(() => setDone(false), 3500) },
    onError: (failure) => setError(apiErrorMessage(failure)),
  })
  return <>
    <Modal open={open} onClose={() => !mutation.isPending && onClose()} title="Trocar senha" description="Informe a senha atual e a nova senha (mínimo de 6 caracteres).">
      <ModalForm key={open ? 'open' : 'closed'} submitting={mutation.isPending} submitLabel={mutation.isPending ? 'Alterando...' : 'Alterar senha'} onCancel={onClose} onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        const newPassword = String(data.get('newPassword') ?? '')
        if (newPassword !== String(data.get('confirmPassword') ?? '')) { setError('A confirmação não confere com a nova senha.'); return }
        setError('')
        mutation.mutate({ currentPassword: String(data.get('currentPassword') ?? ''), newPassword })
      }}>
        <FormError message={error} />
        <FormField label="Senha atual"><input name="currentPassword" type="password" autoComplete="current-password" required /></FormField>
        <FormField label="Nova senha"><input name="newPassword" type="password" autoComplete="new-password" minLength={6} required /></FormField>
        <FormField label="Confirme a nova senha"><input name="confirmPassword" type="password" autoComplete="new-password" minLength={6} required /></FormField>
      </ModalForm>
    </Modal>
    {done && <Toast message="Senha alterada com sucesso." onClose={() => setDone(false)} />}
  </>
}
