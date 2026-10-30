import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { usePictureInPicture } from './usePictureInPicture'

const CONTENT = { segmentLabel: 'Focus', timeLabel: '24:59', taskLabel: null as string | null }

const ORIGINAL_UA = window.navigator.userAgent
const ORIGINAL_MAX_TOUCH_POINTS = window.navigator.maxTouchPoints

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true })
}

function setMaxTouchPoints(points: number) {
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: points, configurable: true })
}

function resetPlatform() {
  setUserAgent(ORIGINAL_UA)
  setMaxTouchPoints(ORIGINAL_MAX_TOUCH_POINTS)
}

function cleanupGlobals() {
  Reflect.deleteProperty(window, 'documentPictureInPicture')
  Reflect.deleteProperty(document, 'pictureInPictureEnabled')
  Reflect.deleteProperty(document, 'pictureInPictureElement')
  Reflect.deleteProperty(document, 'exitPictureInPicture')
  Reflect.deleteProperty(HTMLVideoElement.prototype, 'requestPictureInPicture')
  Reflect.deleteProperty(HTMLVideoElement.prototype, 'webkitSupportsPresentationMode')
  Reflect.deleteProperty(HTMLVideoElement.prototype, 'webkitSetPresentationMode')
  Reflect.deleteProperty(HTMLVideoElement.prototype, 'webkitPresentationMode')
  Reflect.deleteProperty(HTMLCanvasElement.prototype, 'captureStream')
  for (const video of document.querySelectorAll('video')) video.remove()
}

describe('usePictureInPicture — Document PiP et repli vidéo/canvas (§6.3 du cahier des charges)', () => {
  afterEach(() => {
    cleanupGlobals()
    resetPlatform()
    vi.restoreAllMocks()
  })

  it('signale l’absence de support quand aucune API PiP n’est disponible', () => {
    const { result } = renderHook(() => usePictureInPicture(CONTENT))
    expect(result.current.isSupported).toBe(false)
    expect(result.current.mode).toBeNull()
  })

  it('utilise le Document PiP quand il est disponible, et l’ouvre/le ferme au clic', async () => {
    const fakeWindow = { addEventListener: vi.fn(), close: vi.fn() } as unknown as Window
    const pip = {
      window: null as Window | null,
      requestWindow: vi.fn().mockResolvedValue(fakeWindow),
    }
    Object.defineProperty(window, 'documentPictureInPicture', { value: pip, configurable: true })

    const { result } = renderHook(() => usePictureInPicture(CONTENT))
    expect(result.current.mode).toBe('document')
    expect(result.current.isSupported).toBe(true)

    act(() => result.current.toggle())
    await waitFor(() => expect(result.current.pipWindow).toBe(fakeWindow))
    expect(pip.requestWindow).toHaveBeenCalled()

    // Le navigateur mettrait lui-même à jour `documentPictureInPicture.window` une fois
    // la fenêtre ouverte.
    pip.window = fakeWindow
    act(() => result.current.toggle())
    expect(fakeWindow.close).toHaveBeenCalled()
  })

  it('se replie sur le PiP vidéo classique quand Document PiP est indisponible', async () => {
    Object.defineProperty(document, 'pictureInPictureEnabled', { value: true, configurable: true })
    HTMLVideoElement.prototype.requestPictureInPicture = vi
      .fn()
      .mockResolvedValue({} as PictureInPictureWindow)
    HTMLCanvasElement.prototype.captureStream = vi.fn().mockReturnValue({} as MediaStream)
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)

    const { result } = renderHook(() => usePictureInPicture(CONTENT))
    expect(result.current.mode).toBe('video')
    expect(result.current.isSupported).toBe(true)
    expect(result.current.isActive).toBe(false)

    const videoEl = document.querySelector('video')
    expect(videoEl).not.toBeNull()

    act(() => result.current.toggle())
    await waitFor(() => expect(HTMLVideoElement.prototype.requestPictureInPicture).toHaveBeenCalled())
    expect(HTMLCanvasElement.prototype.captureStream).toHaveBeenCalledWith(2)

    act(() => {
      videoEl?.dispatchEvent(new Event('enterpictureinpicture'))
    })
    expect(result.current.isActive).toBe(true)

    Object.defineProperty(document, 'pictureInPictureElement', {
      value: videoEl,
      configurable: true,
    })
    document.exitPictureInPicture = vi.fn().mockResolvedValue(undefined)

    act(() => result.current.toggle())
    expect(document.exitPictureInPicture).toHaveBeenCalled()
  })

  it('détecte le PiP vidéo via l’API WebKit même sans requestPictureInPicture standard (Safari)', () => {
    // Sur Safari, document.pictureInPictureEnabled n'est pas toujours défini alors que
    // webkitSupportsPresentationMode existe — la détection ne doit pas dépendre du seul
    // test standard, sous peine de signaler le PiP indisponible à tort.
    HTMLCanvasElement.prototype.captureStream = vi.fn().mockReturnValue({} as MediaStream)
    HTMLVideoElement.prototype.webkitSupportsPresentationMode = vi.fn().mockReturnValue(true)

    const { result } = renderHook(() => usePictureInPicture(CONTENT))
    expect(result.current.mode).toBe('video')
    expect(result.current.isSupported).toBe(true)
  })

  it('bascule via webkitSetPresentationMode quand l’API standard est absente (repli WebKit)', async () => {
    HTMLCanvasElement.prototype.captureStream = vi.fn().mockReturnValue({} as MediaStream)
    HTMLVideoElement.prototype.webkitSupportsPresentationMode = vi.fn().mockReturnValue(true)
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)

    const { result } = renderHook(() => usePictureInPicture(CONTENT))
    expect(result.current.mode).toBe('video')

    const videoEl = document.querySelector('video') as HTMLVideoElement
    const setPresentationModeMock = vi.fn((requestedMode: 'picture-in-picture' | 'inline') => {
      Object.defineProperty(videoEl, 'webkitPresentationMode', {
        value: requestedMode,
        configurable: true,
      })
      videoEl.dispatchEvent(new Event('webkitpresentationmodechanged'))
    })
    videoEl.webkitSetPresentationMode = setPresentationModeMock

    act(() => result.current.toggle())
    await waitFor(() =>
      expect(setPresentationModeMock).toHaveBeenCalledWith('picture-in-picture'),
    )
    await waitFor(() => expect(result.current.isActive).toBe(true))

    act(() => result.current.toggle())
    await waitFor(() => expect(setPresentationModeMock).toHaveBeenCalledWith('inline'))
    expect(result.current.isActive).toBe(false)
  })

  it('désactive totalement le PiP sur iPhone, même si l’API WebKit est annoncée (LOT B8)', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15')
    HTMLCanvasElement.prototype.captureStream = vi.fn().mockReturnValue({} as MediaStream)
    HTMLVideoElement.prototype.webkitSupportsPresentationMode = vi.fn().mockReturnValue(true)

    const { result } = renderHook(() => usePictureInPicture(CONTENT))
    expect(result.current.mode).toBeNull()
    expect(result.current.isSupported).toBe(false)
  })

  it('désactive totalement le PiP sur iPad (iPadOS 13+), même avec Document PiP annoncé (LOT B8)', () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15')
    setMaxTouchPoints(5)
    const fakeWindow = { addEventListener: vi.fn(), close: vi.fn() } as unknown as Window
    Object.defineProperty(window, 'documentPictureInPicture', {
      value: { window: null, requestWindow: vi.fn().mockResolvedValue(fakeWindow) },
      configurable: true,
    })

    const { result } = renderHook(() => usePictureInPicture(CONTENT))
    expect(result.current.mode).toBeNull()
    expect(result.current.isSupported).toBe(false)
  })

  it('garde le PiP sur un Mac de bureau (pas d’écran tactile)', () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15')
    setMaxTouchPoints(0)
    HTMLCanvasElement.prototype.captureStream = vi.fn().mockReturnValue({} as MediaStream)
    HTMLVideoElement.prototype.webkitSupportsPresentationMode = vi.fn().mockReturnValue(true)

    const { result } = renderHook(() => usePictureInPicture(CONTENT))
    expect(result.current.mode).toBe('video')
    expect(result.current.isSupported).toBe(true)
  })

  it('n’affiche rien dans la fenêtre PiP quand le hook est démonté (nettoyage)', () => {
    Object.defineProperty(document, 'pictureInPictureEnabled', { value: true, configurable: true })
    HTMLVideoElement.prototype.requestPictureInPicture = vi.fn()
    HTMLCanvasElement.prototype.captureStream = vi.fn()

    const { unmount } = renderHook(() => usePictureInPicture(CONTENT))
    expect(document.querySelector('video')).not.toBeNull()

    unmount()
    expect(document.querySelector('video')).toBeNull()
  })
})

describe('usePictureInPicture — commandes natives du PiP vidéo (Media Session)', () => {
  const handlers: Record<string, (() => void) | null> = {}
  const mediaSession = {
    playbackState: 'none',
    setActionHandler: vi.fn((action: string, handler: (() => void) | null) => {
      handlers[action] = handler
    }),
  }

  function enableVideoPip() {
    Object.defineProperty(document, 'pictureInPictureEnabled', { value: true, configurable: true })
    HTMLVideoElement.prototype.requestPictureInPicture = vi.fn().mockResolvedValue({} as PictureInPictureWindow)
    HTMLCanvasElement.prototype.captureStream = vi.fn().mockReturnValue({} as MediaStream)
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'mediaSession', { value: mediaSession, configurable: true })
  }

  afterEach(() => {
    cleanupGlobals()
    resetPlatform()
    vi.restoreAllMocks()
    Reflect.deleteProperty(navigator, 'mediaSession')
    for (const key of Object.keys(handlers)) delete handlers[key]
    mediaSession.playbackState = 'none'
    mediaSession.setActionHandler.mockClear()
  })

  it('pilote la pause / reprise depuis les contrôles natifs, seulement tant que le PiP est actif', async () => {
    enableVideoPip()
    const onPlay = vi.fn()
    const onPause = vi.fn()
    const { result, rerender } = renderHook(
      ({ isRunning }) =>
        usePictureInPicture(CONTENT, { controls: { isRunning, onPlay, onPause } }),
      { initialProps: { isRunning: true } },
    )
    expect(handlers.play).toBeUndefined() // PiP pas encore actif

    act(() => result.current.toggle())
    await waitFor(() => expect(HTMLVideoElement.prototype.requestPictureInPicture).toHaveBeenCalled())
    act(() => {
      document.querySelector('video')?.dispatchEvent(new Event('enterpictureinpicture'))
    })

    expect(typeof handlers.play).toBe('function')
    expect(typeof handlers.pause).toBe('function')
    expect(mediaSession.playbackState).toBe('playing')
    handlers.pause?.()
    handlers.play?.()
    expect(onPause).toHaveBeenCalledTimes(1)
    expect(onPlay).toHaveBeenCalledTimes(1)

    rerender({ isRunning: false })
    expect(mediaSession.playbackState).toBe('paused')

    act(() => {
      document.querySelector('video')?.dispatchEvent(new Event('leavepictureinpicture'))
    })
    expect(handlers.play).toBeNull()
    expect(handlers.pause).toBeNull()
  })

  it('sans commandes (participant non hôte) : aucun gestionnaire n’est posé', async () => {
    enableVideoPip()
    const { result } = renderHook(() => usePictureInPicture(CONTENT, { controls: null }))
    act(() => result.current.toggle())
    await waitFor(() => expect(HTMLVideoElement.prototype.requestPictureInPicture).toHaveBeenCalled())
    act(() => {
      document.querySelector('video')?.dispatchEvent(new Event('enterpictureinpicture'))
    })
    expect(mediaSession.setActionHandler).not.toHaveBeenCalled()
  })

  it('close() ferme la fenêtre Document PiP et sort du PiP vidéo', () => {
    const fakeWindow = { addEventListener: vi.fn(), close: vi.fn() } as unknown as Window
    Object.defineProperty(window, 'documentPictureInPicture', {
      value: { window: fakeWindow, requestWindow: vi.fn() },
      configurable: true,
    })
    const { result } = renderHook(() => usePictureInPicture(CONTENT))
    result.current.close()
    expect(fakeWindow.close).toHaveBeenCalled()
  })

  it('dessine le fond statique dans le canvas du PiP vidéo une fois l’image chargée', async () => {
    enableVideoPip()
    const drawImage = vi.fn()
    const gradient = { addColorStop: vi.fn() }
    const ctx = {
      fillRect: vi.fn(),
      fillText: vi.fn(),
      drawImage,
      createLinearGradient: vi.fn(() => gradient),
    } as unknown as CanvasRenderingContext2D
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never)
    // Image factice qui « charge » aussitôt, avec des dimensions.
    class FakeImage {
      naturalWidth = 1920
      naturalHeight = 1080
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) {
        queueMicrotask(() => this.onload?.())
      }
    }
    vi.stubGlobal('Image', FakeImage)

    const { result } = renderHook(() =>
      usePictureInPicture(CONTENT, {
        background: { imageSrc: '/backgrounds/test.webp', position: 'center center', colorFrom: '#000', colorTo: '#111' },
      }),
    )
    act(() => result.current.toggle())
    await waitFor(() => expect(HTMLVideoElement.prototype.requestPictureInPicture).toHaveBeenCalled())
    act(() => {
      document.querySelector('video')?.dispatchEvent(new Event('enterpictureinpicture'))
    })

    await waitFor(() => expect(drawImage).toHaveBeenCalled())
    vi.unstubAllGlobals()
  })
})
