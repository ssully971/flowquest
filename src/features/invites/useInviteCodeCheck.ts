import { useEffect, useRef, useState } from 'react'

import { checkInviteCode } from './invites-repository'

export type InviteCodeCheck = 'idle' | 'checking' | 'valid' | 'invalid' | 'rate_limited'

const DEBOUNCE_MS = 400

interface Resolved {
  code: string
  result: Exclude<InviteCodeCheck, 'idle' | 'checking'>
}

/** Vérification en direct (check_invite_code) d'un code déjà normalisé et bien formé.
 * Indice UX uniquement : la vraie garde est côté serveur à l'inscription. `enabled` doit
 * être faux tant que la saisie n'a pas la bonne forme (aucun appel réseau pour rien). */
export function useInviteCodeCheck(code: string, enabled: boolean): InviteCodeCheck {
  const [resolved, setResolved] = useState<Resolved | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!enabled) return
    const requestId = ++requestIdRef.current
    const timeoutId = window.setTimeout(() => {
      checkInviteCode(code)
        .then((valid) => (valid ? 'valid' : 'invalid') as Resolved['result'])
        .catch((): Resolved['result'] => 'rate_limited')
        .then((result) => {
          if (requestIdRef.current !== requestId) return
          setResolved({ code, result })
        })
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(timeoutId)
  }, [code, enabled])

  if (!enabled) return 'idle'
  if (resolved && resolved.code === code) return resolved.result
  return 'checking'
}
