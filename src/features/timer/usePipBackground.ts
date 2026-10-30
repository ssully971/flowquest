import { useContext, useMemo } from 'react'

import { useBackgroundSettings } from '@/app/useBackgroundSettings'
import type { AppMode } from '@/app/useAppMode'
import { CustomBackgroundContext } from '@/features/settings/custom-background-context'
import { useResolvedTheme } from '@/shared/design-system'

import { readThemeColors, resolvePipBackground } from './pip-background'
import type { PipBackground } from './pip-background'

/** Fond statique de la fenêtre PiP : celui du mode `mode` pour le thème actif. Lit le contexte du
 * fond personnel directement (sans erreur s'il est absent, comme dans les tests d'écran isolés). */
export function usePipBackground(mode: AppMode): PipBackground {
  const { resolve } = useBackgroundSettings()
  const custom = useContext(CustomBackgroundContext)
  const theme = useResolvedTheme()
  const id = resolve(mode)
  const customUrl = custom?.objectUrl ?? null
  const customPosition = custom?.position

  return useMemo(
    () => resolvePipBackground(id, { customUrl, customPosition, colors: readThemeColors() }),
    // Le thème change les couleurs du dégradé de repli : il faut les relire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, customUrl, customPosition, theme],
  )
}
