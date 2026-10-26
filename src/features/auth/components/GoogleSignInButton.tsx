import { useEffect, useRef, useState } from 'react'

import { useAuth } from '../useAuth'
import { generateNonce, loadGoogleIdentityScript } from '../google-identity'
import { GoogleButton } from './GoogleButton'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

interface GoogleSignInButtonProps {
  label: string
}

/**
 * Affiche le bouton natif Google Identity Services (GIS) quand VITE_GOOGLE_CLIENT_ID est
 * configuré : la fenêtre de consentement montre alors le nom et le domaine de Fokitsu,
 * pas l'URL technique du projet Supabase. Voir docs/GOOGLE_AUTH.md. Sans cette variable,
 * ou si GIS ne charge pas (réseau, bloqueur de script), on retombe sur l'OAuth redirigé
 * déjà en place.
 */
export function GoogleSignInButton({ label }: GoogleSignInButtonProps) {
  const { signInWithGoogle, signInWithGoogleIdToken } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const [gisReady, setGisReady] = useState(false)

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    let cancelled = false

    void (async () => {
      try {
        await loadGoogleIdentityScript()
        const { nonce, hashedNonce } = await generateNonce()
        if (cancelled || !containerRef.current || !window.google) return

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: hashedNonce,
          callback: (response) => {
            void signInWithGoogleIdToken(response.credential, nonce)
          },
        })
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          locale: 'fr',
          width: 320,
        })
        if (!cancelled) setGisReady(true)
      } catch (error) {
        console.error(
          '[Fokitsu] Google Identity Services indisponible, repli sur la connexion redirigée :',
          error,
        )
      }
    })()

    return () => {
      cancelled = true
    }
  }, [signInWithGoogleIdToken])

  if (!GOOGLE_CLIENT_ID) {
    return <GoogleButton onClick={() => void signInWithGoogle()} label={label} />
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={containerRef} className={gisReady ? '' : 'hidden'} />
      {!gisReady ? <GoogleButton onClick={() => void signInWithGoogle()} label={label} /> : null}
    </div>
  )
}
