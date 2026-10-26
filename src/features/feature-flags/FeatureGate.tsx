import type { ReactNode } from 'react'

import { ErrorBoundary } from '@/shared/design-system'

import { useFeatureFlag } from './useFeatureFlag'
import type { FlagKey } from './flag-defaults'

interface FeatureGateProps {
  flag: FlagKey
  children: ReactNode
  /** Rendu quand le drapeau est coupé — rien par défaut (la fonctionnalité disparaît
   * simplement), jamais un message d'erreur pour un simple coupe-circuit volontaire. */
  disabledFallback?: ReactNode
  /** Rendu si le contenu plante une fois affiché — repli discret, jamais la page entière
   * qui tombe avec lui (lot I2, §1 : FeatureGate ET frontière d'erreur). */
  errorFallback?: ReactNode
}

export function FeatureGate({
  flag,
  children,
  disabledFallback = null,
  errorFallback = null,
}: FeatureGateProps) {
  const enabled = useFeatureFlag(flag)
  if (!enabled) return <>{disabledFallback}</>
  return <ErrorBoundary fallback={errorFallback}>{children}</ErrorBoundary>
}
