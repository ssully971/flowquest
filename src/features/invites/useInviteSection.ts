import { useCallback, useEffect, useState } from 'react'

import type {
  InviteCodeIssued,
  InviteEligibilityRow,
  MyInviteCodeRow,
} from '@/shared/supabase/database.types'

import {
  InviteError,
  generateUserInviteCode,
  getInviteEligibility,
  listMyInviteCodes,
} from './invites-repository'
import type { InviteErrorKind } from './invites-repository'

interface InviteSectionState {
  loading: boolean
  loadFailed: boolean
  eligibility: InviteEligibilityRow | null
  codes: MyInviteCodeRow[]
  generating: boolean
  issued: InviteCodeIssued | null
  errorKind: InviteErrorKind | null
}

const INITIAL: InviteSectionState = {
  loading: true,
  loadFailed: false,
  eligibility: null,
  codes: [],
  generating: false,
  issued: null,
  errorKind: null,
}

/** État de la section « Inviter un ami » : progression (get_invite_eligibility), mes codes,
 * génération. Toutes les règles sont appliquées par le serveur ; ce hook ne fait que les
 * relayer (une erreur typée est conservée pour être traduite par l'interface). */
export function useInviteSection() {
  const [state, setState] = useState<InviteSectionState>(INITIAL)

  const load = useCallback(() => {
    return Promise.all([getInviteEligibility(), listMyInviteCodes()])
      .then(([eligibility, codes]) =>
        setState((current) => ({
          ...current,
          loading: false,
          loadFailed: false,
          eligibility,
          codes,
        })),
      )
      .catch(() => setState((current) => ({ ...current, loading: false, loadFailed: true })))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const retry = useCallback(() => {
    setState((current) => ({ ...current, loading: true }))
    void load()
  }, [load])

  const generate = useCallback(async () => {
    setState((current) => ({ ...current, generating: true, errorKind: null }))
    try {
      const issued = await generateUserInviteCode()
      setState((current) => ({ ...current, issued }))
    } catch (error) {
      const errorKind = error instanceof InviteError ? error.kind : 'unknown'
      setState((current) => ({ ...current, errorKind, issued: null }))
    }
    await load()
    setState((current) => ({ ...current, generating: false }))
  }, [load])

  return { ...state, generate, retry }
}
