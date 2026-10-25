import { useContext } from 'react'

import { AuthGateRequestContext, type AuthGateRequestValue } from './auth-gate-request-context'

export function useAuthGateRequest(): AuthGateRequestValue {
  return useContext(AuthGateRequestContext)
}
