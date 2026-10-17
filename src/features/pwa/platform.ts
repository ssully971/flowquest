export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isAppleTouch = /iPad|iPhone|iPod/.test(ua)
  // iPadOS 13+ se présente comme un Mac avec écran tactile : pas de « iPad » dans l'UA.
  const isIpadOs13Plus = ua.includes('Macintosh') && navigator.maxTouchPoints > 1
  return isAppleTouch || isIpadOs13Plus
}

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  if (nav.standalone === true) return true
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(display-mode: standalone)').matches
}
