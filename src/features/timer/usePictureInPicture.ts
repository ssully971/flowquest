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

  interface HTMLVideoElement {
    // API WebKit historique (Safari, y compris iOS/iPadOS avant l'adoption de
    // requestPictureInPicture()) : utilisée en repli quand l'API standard est absente.
    webkitSupportsPresentationMode?: (mode: 'picture-in-picture' | 'inline') => boolean
    webkitSetPresentationMode?: (mode: 'picture-in-picture' | 'inline') => void
    webkitPresentationMode?: 'picture-in-picture' | 'inline' | 'fullscreen'
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
  if (typeof HTMLCanvasElement.prototype.captureStream !== 'function') return false

  const hasStandardApi =
    document.pictureInPictureEnabled === true &&
    typeof HTMLVideoElement.prototype.requestPictureInPicture === 'function'
  // Repli WebKit (§6.3) : sur Safari, `document.pictureInPictureEnabled` n'est pas
  // toujours renseigné alors que l'API `webkitSetPresentationMode` existe — sans ce
  // second test, le PiP serait signalé indisponible à tort sur ces navigateurs.
  const hasWebkitApi = typeof HTMLVideoElement.prototype.webkitSupportsPresentationMode === 'function'

  return hasStandardApi || hasWebkitApi
}

function detectMode(): PictureInPictureMode {
  if (typeof window !== 'undefined' && 'documentPictureInPicture' in window) return 'document'
  if (supportsVideoPip()) return 'video'
  return null
}

/**
 * §6.3 du cahier des charges : Document Picture-in-Picture (Chrome/Edge ordinateur) et,
 * à défaut, une fenêtre vidéo/canvas en PiP classique — via requestPictureInPicture()
 * standard, ou via webkitSetPresentationMode() sur les navigateurs WebKit qui n'ont que
 * l'API historique.
 *
 * Limite connue et honnête sur iPadOS : Safari y expose bien webkitSetPresentationMode,
 * mais le flux vidéo vient ici d'un <canvas> (canvas.captureStream()), pas d'un média
 * réel — WebKit refuse ou ignore silencieusement le passage en PiP pour ce type de
 * source sur iPad dans plusieurs versions connues (contrairement à macOS, où cela
 * fonctionne). Aucune contournement fiable n'existe à ce jour : le bouton reste donc
 * affiché dès que l'API est détectée (meilleur effort), mais `isActive` ne passe à vrai
 * que si le navigateur confirme réellement l'entrée en PiP — jamais de faux positif.
 */
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

    // Repli WebKit : requestPictureInPicture()/les événements standards peuvent être
    // absents alors que l'API webkitSetPresentationMode() fonctionne — on dérive alors
    // l'état actif de son propre événement plutôt que de supposer l'échec.
    const onWebkitPresentationModeChanged = () => {
      setIsVideoActive(video.webkitPresentationMode === 'picture-in-picture')
    }
    video.addEventListener('webkitpresentationmodechanged', onWebkitPresentationModeChanged)

    return () => {
      video.removeEventListener('enterpictureinpicture', onEnter)
      video.removeEventListener('leavepictureinpicture', onLeave)
      video.removeEventListener('webkitpresentationmodechanged', onWebkitPresentationModeChanged)
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
    if (video.webkitPresentationMode === 'picture-in-picture') {
      video.webkitSetPresentationMode?.('inline')
      return
    }

    const ctx = canvas.getContext('2d')
    if (ctx) drawPipFrame(ctx, contentRef.current)

    const stream = canvas.captureStream(2)
    video.srcObject = stream
    void video
      .play()
      .then(() => {
        if (typeof video.requestPictureInPicture === 'function') {
          return video.requestPictureInPicture()
        }
        // Repli WebKit (ex. Safari/iPadOS sans requestPictureInPicture standard) :
        // appel synchrone, pas de promesse — l'état actif vient de l'événement
        // webkitpresentationmodechanged, pas de ce retour.
        video.webkitSetPresentationMode?.('picture-in-picture')
        return undefined
      })
      .catch(() => {
        // Lecture ou PiP refusés (ex. pas d'interaction utilisateur directe, ou source
        // canvas non prise en charge par WebKit sur cet appareil) : le bouton reste
        // disponible pour réessayer, pas d'erreur bloquante ni d'état actif supposé.
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
