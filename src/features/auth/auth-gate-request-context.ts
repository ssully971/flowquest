import { createContext } from 'react'

/** Vue sur laquelle AuthGate s'ouvre quand on la demande (connexion par défaut). */
export type AuthGateRequestedView = 'signIn' | 'signUp'

export interface AuthGateRequestValue {
  signInRequested: boolean
  requestedView: AuthGateRequestedView
  requestSignIn: (view?: AuthGateRequestedView) => void
  clearSignInRequest: () => void
}

// Valeur par défaut non throwing plutôt que `null` + erreur : beaucoup de tests de
// composants (FriendsPanel, RoomsPanel, AuthGate lui-même...) montent ces composants
// isolément, sans AuthGateRequestProvider — le bouton « Se connecter » redevient alors un
// simple bouton sans effet plutôt que de faire planter le rendu.
const noopValue: AuthGateRequestValue = {
  signInRequested: false,
  requestedView: 'signIn',
  requestSignIn: () => {},
  clearSignInRequest: () => {},
}

export const AuthGateRequestContext = createContext<AuthGateRequestValue>(noopValue)
