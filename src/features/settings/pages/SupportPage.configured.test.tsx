import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ToastProvider } from '@/shared/toast'

import { SupportPage } from './SupportPage'

const getSessionMock = vi.fn()
const onAuthStateChangeMock = vi.fn()
const insertMock = vi.fn()
const fromMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChangeMock(...args),
    },
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

function renderSupportPage() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <SupportPage />
      </AuthProvider>
    </ToastProvider>,
  )
}

beforeEach(() => {
  getSessionMock.mockReset()
  onAuthStateChangeMock.mockReset()
  insertMock.mockReset()
  fromMock.mockReset()
  // Mode invité (pas de session) : le formulaire de support ne nécessite pas de compte.
  getSessionMock.mockResolvedValue({ data: { session: null } })
  onAuthStateChangeMock.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  fromMock.mockReturnValue({ insert: insertMock })
})

describe('SupportPage — formulaire envoyé (Supabase configuré)', () => {
  it('envoie le message et affiche la confirmation', async () => {
    insertMock.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    renderSupportPage()

    await user.type(screen.getByLabelText('E-mail'), 'a@exemple.com')
    await user.type(screen.getByLabelText('Message'), 'J’ai un souci avec le minuteur.')
    await user.click(screen.getByRole('button', { name: 'Envoyer' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Message envoyé. Tu recevras une réponse par e-mail.',
    )
    expect(fromMock).toHaveBeenCalledWith('support_messages')
    expect(insertMock).toHaveBeenCalledWith({
      email: 'a@exemple.com',
      body: 'J’ai un souci avec le minuteur.',
      user_id: null,
    })
  })

  it('affiche une erreur quand l’envoi échoue, sans perdre le message saisi', async () => {
    insertMock.mockResolvedValue({ error: { message: 'boom' } })
    const user = userEvent.setup()
    renderSupportPage()

    await user.type(screen.getByLabelText('E-mail'), 'a@exemple.com')
    await user.type(screen.getByLabelText('Message'), 'Un souci')
    await user.click(screen.getByRole('button', { name: 'Envoyer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'L’envoi a échoué. Réessaie dans un instant.',
    )
    expect(screen.getByLabelText('Message')).toHaveValue('Un souci')
  })
})
