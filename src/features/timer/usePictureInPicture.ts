import { useCallback, useEffect, useState } from 'react'

interface DocumentPictureInPicture {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>
  window: Window | null
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture
  }
}

export interface UsePictureInPictureResult {
  isSupported: boolean
  pipWindow: Window | null
  toggle: () => void
}

export function usePictureInPicture(): UsePictureInPictureResult {
  const [pipWindow, setPipWindow] = useState<Window | null>(null)
  const isSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window

  const toggle = useCallback(() => {
    if (!isSupported) return
    const pip = window.documentPictureInPicture
    if (!pip) return

    if (pip.window) {
      pip.window.close()
      return
    }

    void pip.requestWindow({ width: 240, height: 140 }).then((win) => {
      win.addEventListener('pagehide', () => setPipWindow(null))
      setPipWindow(win)
    })
  }, [isSupported])

  useEffect(() => {
    return () => {
      pipWindow?.close()
    }
  }, [pipWindow])

  return { isSupported, pipWindow, toggle }
}
