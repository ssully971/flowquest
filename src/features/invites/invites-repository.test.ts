import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpcMock = vi.fn()
vi.mock('@/shared/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}))

import {
  InviteError,
  checkInviteCode,
  consumeInviteCode,
  generateUserInviteCode,
  getInviteEligibility,
} from './invites-repository'

describe('invites-repository', () => {
  beforeEach(() => rpcMock.mockReset())

  it('traduit les erreurs typées du serveur en InviteError', async () => {
    for (const kind of ['account_too_young', 'not_enough_focus', 'monthly_limit_reached']) {
      rpcMock.mockResolvedValueOnce({ data: null, error: { message: kind } })
      await expect(generateUserInviteCode()).rejects.toMatchObject({ kind })
    }
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'autre chose' } })
    await expect(generateUserInviteCode()).rejects.toBeInstanceOf(InviteError)
  })

  it('renvoie le code généré', async () => {
    rpcMock.mockResolvedValue({ data: [{ code: 'ABCD2345', expires_at: 'x' }], error: null })
    await expect(generateUserInviteCode()).resolves.toEqual({ code: 'ABCD2345', expires_at: 'x' })
    expect(rpcMock).toHaveBeenCalledWith('user_generate_invite_code')
  })

  it('check/consume passent le code tel quel et renvoient un booléen', async () => {
    rpcMock.mockResolvedValue({ data: true, error: null })
    await expect(checkInviteCode('ABCD2345')).resolves.toBe(true)
    expect(rpcMock).toHaveBeenCalledWith('check_invite_code', { p_code: 'ABCD2345' })
    rpcMock.mockResolvedValue({ data: false, error: null })
    await expect(consumeInviteCode('ZZZZZZZZ')).resolves.toBe(false)
  })

  it('check remonte too_many_attempts', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'too_many_attempts' } })
    await expect(checkInviteCode('ABCD2345')).rejects.toMatchObject({ kind: 'too_many_attempts' })
  })

  it('getInviteEligibility renvoie la première ligne', async () => {
    rpcMock.mockResolvedValue({ data: [{ focus_seconds: 5 }], error: null })
    await expect(getInviteEligibility()).resolves.toEqual({ focus_seconds: 5 })
  })
})
