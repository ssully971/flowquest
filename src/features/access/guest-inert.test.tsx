import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { usePillarSync } from '@/features/pillars/usePillarSync'
import { useSessionSync } from '@/features/stats/useSessionSync'
import { useTaskSync } from '@/features/tasks/useTaskSync'

import { AuthStub } from './AuthStub'

const fromMock = vi.hoisted(() => vi.fn())
vi.mock('@/shared/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: { from: fromMock, channel: vi.fn() },
}))

function SyncHooks() {
  useSessionSync()
  useTaskSync()
  usePillarSync()
  return null
}

describe('synchronisations — inertes pour un invité', () => {
  it('useSessionSync, useTaskSync et usePillarSync ne contactent jamais Supabase sans compte', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <AuthStub status="guest">
        <SyncHooks />
      </AuthStub>,
    )
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(fromMock).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
