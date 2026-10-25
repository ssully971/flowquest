import { createContext } from 'react'

export interface AuthGateRequestValue {
  signInRequested: boolean
  requestSignIn: () => void
  clearSignInRequest: () => void
}

// Valeur par défaut non throwing plutôt que `null` + erreur : beaucoup de tests de
// composants (FriendsPanel, RoomsPanel, AuthGate lui-même...) montent ces composants
// isolément, sans AuthGateRequestProvider — le bouton « Se connecter » redevient alors un
// simple bouton sans effet plutôt que de faire planter le rendu.
const noopValue: AuthGateRequestValue = {
  signInRequested: false,
  requestSignIn: () => {},
  clearSignInRequest: () => {},
}

export const AuthGateRequestContext = createContext<AuthGateRequestValue>(noopValue)
