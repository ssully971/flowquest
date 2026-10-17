import { beforeEach, describe, expect, it, vi } from 'vitest'

const insertMock = vi.fn()
const fromMock = vi.fn()
fromMock.mockReturnValue({ insert: insertMock })

vi.mock('@/shared/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}))

describe('sendSupportMessage — §7.8 du cahier des charges (formulaire de support)', () => {
  beforeEach(() => {
    insertMock.mockReset()
    fromMock.mockClear()
  })

  it('insère le message avec l’e-mail, le texte et l’utilisateur courant', async () => {
    insertMock.mockResolvedValue({ error: null })
    const { sendSupportMessage } = await import('./send-support-message')

    const result = await sendSupportMessage('a@exemple.com', 'Un problème', 'user-1')

    expect(result.ok).toBe(true)
    expect(fromMock).toHaveBeenCalledWith('support_messages')
    expect(insertMock).toHaveBeenCalledWith({
      email: 'a@exemple.com',
      body: 'Un problème',
      user_id: 'user-1',
    })
  })

  it('accepte un utilisateur invité (user_id nul)', async () => {
    insertMock.mockResolvedValue({ error: null })
    const { sendSupportMessage } = await import('./send-support-message')

    const result = await sendSupportMessage('a@exemple.com', 'Un problème', null)

    expect(result.ok).toBe(true)
    expect(insertMock).toHaveBeenCalledWith({
      email: 'a@exemple.com',
      body: 'Un problème',
      user_id: null,
    })
  })

  it('signale l’échec quand l’insertion retourne une erreur', async () => {
    insertMock.mockResolvedValue({ error: { message: 'boom' } })
    const { sendSupportMessage } = await import('./send-support-message')

    const result = await sendSupportMessage('a@exemple.com', 'Un problème', null)
    expect(result.ok).toBe(false)
  })
})
