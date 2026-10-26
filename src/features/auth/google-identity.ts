// Intégration Google Identity Services (GIS) : contrairement à l'OAuth redirigé
// (signInWithOAuth), la fenêtre de consentement affiche ici le nom et le domaine de
// Fokitsu plutôt que l'URL technique du projet Supabase. Voir docs/GOOGLE_AUTH.md.

export interface GoogleCredentialResponse {
  credential: string
}

interface GoogleIdentityConfig {
  client_id: string
  nonce: string
  callback: (response: GoogleCredentialResponse) => void
  use_fedcm_for_prompt?: boolean
}

interface GoogleButtonOptions {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  locale?: string
  width?: number
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdentityConfig) => void
          renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void
        }
      }
    }
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

let scriptPromise: Promise<void> | null = null

export function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Échec du chargement de Google Identity Services')))
      return
    }

    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Échec du chargement de Google Identity Services'))
    document.head.appendChild(script)
  })

  return scriptPromise
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Supabase exige un nonce brut (passé à signInWithIdToken) et son empreinte SHA-256
 * (passée à Google) pour vérifier que le jeton d'identité a bien été émis pour cette
 * tentative de connexion précise.
 */
export async function generateNonce(): Promise<{ nonce: string; hashedNonce: string }> {
  const randomBytes = new Uint8Array(32)
  window.crypto.getRandomValues(randomBytes)
  const nonce = toBase64Url(randomBytes)

  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce))
  const hashedNonce = toHex(new Uint8Array(digest))

  return { nonce, hashedNonce }
}
