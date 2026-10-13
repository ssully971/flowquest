import { useCallback, useEffect, useState } from 'react'

import type { TimerSnapshot } from './engine/timer-engine'
import type { TimerController } from './timer-controller'

const REFRESH_INTERVAL_MS = 250

export function useTimerSnapshot(
  controller: TimerController | null,
): [TimerSnapshot | null, () => void] {
  const [trackedController, setTrackedController] = useState(controller)
  const [snapshot, setSnapshot] = useState<TimerSnapshot | null>(
    () => controller?.getSnapshot() ?? null,
  )

  if (controller !== trackedController) {
    setTrackedController(controller)
    setSnapshot(controller ? controller.getSnapshot() : null)
  }

  const refresh = useCallback(() => {
    setSnapshot(controller ? controller.getSnapshot() : null)
  }, [controller])

  useEffect(() => {
    if (!controller) return

    const intervalId = window.setInterval(refresh, REFRESH_INTERVAL_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [controller, refresh])

  return [snapshot, refresh]
}
