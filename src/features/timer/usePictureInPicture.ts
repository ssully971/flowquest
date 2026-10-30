import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { isIOSDevice } from '@/features/pwa/platform'

import { loadPipImage } from './pip-background'
import type { PipBackground } from './pip-background'
import { PIP_CANVAS_HEIGHT, PIP_CANVAS_WIDTH, drawPipFrame } from './pip-canvas'

/** Hauteur de la fenêtre Document PiP : un peu plus que le canvas, pour la rangée de boutons. */
const PIP_DOCUMENT_HEIGHT = 170
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
  /** Ferme la fenêtre PiP si elle est ouverte (ex. quand la session se termine). */
  close: () => void
}

export interface PictureInPictureOptions {
  /** Fond d'écran statique à dessiner derrière le minuteur (mode vidéo canvas). */
  background?: PipBackground | null
  /** Commandes natives du PiP vidéo (play / pause de la barre du navigateur) : branchées sur
   * `navigator.mediaSession`. Le bouton « Arrêter » n'existe pas dans ce mode : l'API
   * Picture-in-Picture vidéo n'offre aucun bouton personnalisable en dehors de play/pause. */
  controls?: { isRunning: boolean; onPlay: () => void; onPause: () => void } | null
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
  const hasWebkitApi =
    typeof HTMLVideoElement.prototype.webkitSupportsPresentationMode === 'function'

  return hasStandardApi || hasWebkitApi
}

function detectMode(): PictureInPictureMode {
  // §6.3 / LOT B8 : sur iPad et iPhone, webkitSetPresentationMode est annoncé par
  // Safari mais ne fonctionne pas pour un flux canvas.captureStream() (voir le
  // commentaire ci-dessous) — le bouton y apparaissait donc pour une fonctionnalité
  // qui ne marche jamais. On désactive complètement le PiP sur ces appareils plutôt
  // que de proposer un bouton inopérant ; il reste disponible sur ordinateur (y
  // compris Safari macOS, où webkitSetPresentationMode fonctionne réellement).
  if (isIOSDevice()) return null
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
 * Limite connue sur iPadOS/iOS : Safari y expose bien webkitSetPresentationMode, mais
 * le flux vidéo vient ici d'un <canvas> (canvas.captureStream()), pas d'un média réel —
 * WebKit refuse ou ignore silencieusement le passage en PiP pour ce type de source sur
 * iPad/iPhone dans plusieurs versions connues (contrairement à macOS, où cela
 * fonctionne). `detectMode()` exclut donc ces appareils en amont (voir isIOSDevice) :
 * le PiP n'est proposé que là où il est réellement utilisable.
 */
export function usePictureInPicture(
  baseContent: PipFrameContent,
  options: PictureInPictureOptions = {},
): UsePictureInPictureResult {
  const { background = null, controls = null } = options
  // Image du fond, chargée une fois (mode vidéo canvas) ; le dessin la recadre en « cover ».
  const [loadedImage, setLoadedImage] = useState<{ src: string; image: HTMLImageElement } | null>(
    null,
  )
  const imageSrc = background?.imageSrc ?? null
  useEffect(() => {
    if (!imageSrc) return
    let cancelled = false
    void loadPipImage(imageSrc).then((image) => {
      if (!cancelled && image) setLoadedImage({ src: imageSrc, image })
    })
    return () => {
      cancelled = true
    }
  }, [imageSrc])
  const backgroundImage = loadedImage && loadedImage.src === imageSrc ? loadedImage.image : null
  const backgroundColorFrom = background?.colorFrom
  const backgroundColorTo = background?.colorTo
  const backgroundPosition = background?.position
  const content = useMemo<PipFrameContent>(
    () => ({
      ...baseContent,
      background:
        backgroundColorFrom && backgroundColorTo
          ? {
              image: backgroundImage,
              imageWidth: backgroundImage?.naturalWidth,
              imageHeight: backgroundImage?.naturalHeight,
              anchor: backgroundPosition?.includes('top')
                ? 'top'
                : backgroundPosition?.includes('bottom')
                  ? 'bottom'
                  : 'center',
              colorFrom: backgroundColorFrom,
              colorTo: backgroundColorTo,
            }
          : null,
    }),
    [baseContent, backgroundImage, backgroundColorFrom, backgroundColorTo, backgroundPosition],
  )
  const controlsRef = useRef(controls)
  useEffect(() => {
    controlsRef.current = controls
  }, [controls])

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
    void pip.requestWindow({ width: PIP_CANVAS_WIDTH, height: PIP_DOCUMENT_HEIGHT }).then((win) => {
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

  const close = useCallback(() => {
    if (mode === 'document') {
      window.documentPictureInPicture?.window?.close()
    } else if (mode === 'video') {
      const video = videoElRef.current
      if (video && document.pictureInPictureElement === video) void document.exitPictureInPicture()
      else if (video?.webkitPresentationMode === 'picture-in-picture') {
        video.webkitSetPresentationMode?.('inline')
      }
    }
  }, [mode])

  // Commandes natives du PiP vidéo : la barre du navigateur (play / pause) pilote le minuteur
  // via Media Session. Aucun « Arrêter » ici : l'API ne le permet pas (voir PictureInPictureOptions).
  const isControllable = controls !== null
  useEffect(() => {
    if (mode !== 'video' || !isVideoActive || !isControllable) return
    const session = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined
    if (!session) return
    try {
      session.setActionHandler('play', () => controlsRef.current?.onPlay())
      session.setActionHandler('pause', () => controlsRef.current?.onPause())
    } catch {
      // Action non prise en charge par ce navigateur : les contrôles natifs restent inertes.
    }
    return () => {
      try {
        session.setActionHandler('play', null)
        session.setActionHandler('pause', null)
      } catch {
        // rien à nettoyer
      }
    }
  }, [mode, isVideoActive, isControllable])

  const isRunning = controls?.isRunning ?? false
  useEffect(() => {
    if (mode !== 'video' || !isVideoActive || !isControllable) return
    if (typeof navigator !== 'undefined' && navigator.mediaSession) {
      navigator.mediaSession.playbackState = isRunning ? 'playing' : 'paused'
    }
  }, [mode, isVideoActive, isControllable, isRunning])

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
    close,
  }
}
