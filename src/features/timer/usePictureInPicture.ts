import { useCallback, useEffect, useRef, useState } from 'react'

import { PIP_CANVAS_HEIGHT, PIP_CANVAS_WIDTH, drawPipFrame } from './pip-canvas'
import type { PipFrameContent } from './pip-canvas'

interface DocumentPictureInPicture {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>
  window: Window | null
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture
  }
}

export type PictureInPictureMode = 'document' | 'video' | null

export interface UsePictureInPictureResult {
  isSupported: boolean
  mode: PictureInPictureMode
  pipWindow: Window | null
  isActive: boolean
  toggle: () => void
}

function supportsVideoPip(): boolean {
  if (typeof document === 'undefined') return false
  if (typeof HTMLVideoElement === 'undefined' || typeof HTMLCanvasElement === 'undefined') {
    return false
  }
  return (
    document.pictureInPictureEnabled === true &&
    typeof HTMLVideoElement.prototype.requestPictureInPicture === 'function' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function'
  )
}

function detectMode(): PictureInPictureMode {
  if (typeof window !== 'undefined' && 'documentPictureInPicture' in window) return 'document'
  if (supportsVideoPip()) return 'video'
  return null
}

/** §6.3 du cahier des charges : Document Picture-in-Picture (Chrome/Edge ordinateur) et,
 * à défaut, une fenêtre vidéo/canvas en PiP classique (Safari et autres navigateurs qui
 * supportent requestPictureInPicture() sur <video> mais pas la fenêtre Document PiP).
 * Comportement non garanti sur Safari iPad — testé au mieux, ne bloque pas la V1. */
export function usePictureInPicture(content: PipFrameContent): UsePictureInPictureResult {
  const [pipWindow, setPipWindow] = useState<Window | null>(null)
  const [isVideoActive, setIsVideoActive] = useState(false)
  const [mode] = useState<PictureInPictureMode>(detectMode)
  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const canvasElRef = useRef<HTMLCanvasElement | null>(null)
  const contentRef = useRef(content)
  useEffect(() => {
    contentRef.current = content
  }, [content])

  // Prépare, une seule fois, le couple canvas/vidéo hors écran utilisé par le mode PiP
  // vidéo classique.
  useEffect(() => {
    if (mode !== 'video') return

    const canvas = document.createElement('canvas')
    canvas.width = PIP_CANVAS_WIDTH
    canvas.height = PIP_CANVAS_HEIGHT

    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.style.position = 'fixed'
    video.style.opacity = '0'
    video.style.pointerEvents = 'none'
    video.style.width = '1px'
    video.style.height = '1px'
    document.body.appendChild(video)

    canvasElRef.current = canvas
    videoElRef.current = video

    const onEnter = () => setIsVideoActive(true)
    const onLeave = () => setIsVideoActive(false)
    video.addEventListener('enterpictureinpicture', onEnter)
    video.addEventListener('leavepictureinpicture', onLeave)

    return () => {
      video.removeEventListener('enterpictureinpicture', onEnter)
      video.removeEventListener('leavepictureinpicture', onLeave)
      video.remove()
      canvasElRef.current = null
      videoElRef.current = null
    }
  }, [mode])

  // Redessine le contenu du canvas tant que le PiP vidéo est actif.
  useEffect(() => {
    if (mode !== 'video' || !isVideoActive) return
    const ctx = canvasElRef.current?.getContext('2d')
    if (!ctx) return
    drawPipFrame(ctx, content)
  }, [mode, isVideoActive, content])

  const toggleDocument = useCallback(() => {
    const pip = window.documentPictureInPicture
    if (!pip) return
    if (pip.window) {
      pip.window.close()
      return
    }
    void pip
      .requestWindow({ width: PIP_CANVAS_WIDTH, height: PIP_CANVAS_HEIGHT })
      .then((win) => {
        win.addEventListener('pagehide', () => setPipWindow(null))
        setPipWindow(win)
      })
  }, [])

  const toggleVideo = useCallback(() => {
    const video = videoElRef.current
    const canvas = canvasElRef.current
    if (!video || !canvas) return

    if (document.pictureInPictureElement === video) {
      void document.exitPictureInPicture()
      return
    }

    const ctx = canvas.getContext('2d')
    if (ctx) drawPipFrame(ctx, contentRef.current)

    const stream = canvas.captureStream(2)
    video.srcObject = stream
    void video
      .play()
      .then(() => video.requestPictureInPicture())
      .catch(() => {
        // Lecture ou PiP refusés (ex. pas d'interaction utilisateur directe) : le
        // bouton reste disponible pour réessayer, pas d'erreur bloquante.
      })
  }, [])

  const toggle = useCallback(() => {
    if (mode === 'document') toggleDocument()
    else if (mode === 'video') toggleVideo()
  }, [mode, toggleDocument, toggleVideo])

  useEffect(() => {
    return () => {
      pipWindow?.close()
    }
  }, [pipWindow])

  return {
    isSupported: mode !== null,
    mode,
    pipWindow,
    isActive: mode === 'document' ? pipWindow !== null : isVideoActive,
    toggle,
  }
}
