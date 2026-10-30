import { strings } from '@/shared/i18n'
import { isNetworkMessage } from '@/shared/network-errors'

/** `server` : message du serveur (déjà en français, voir migrations) ; `network` : requête
 * partie dans le vide (hors ligne, DNS, coupure) ; `timeout` : le serveur ne répond pas
 * assez vite (voir ACTION_TIMEOUT_MS dans useActiveRoom). */
export type RoomsErrorKind = 'server' | 'network' | 'timeout'

export class RoomsError extends Error {
  readonly kind: RoomsErrorKind

  constructor(message: string, kind: RoomsErrorKind = 'server') {
    super(message)
    this.kind = kind
  }
}

/** Erreur renvoyée par une RPC : message serveur tel quel, sauf échec réseau (traduit). */
export function rpcError(message: string | undefined | null): RoomsError {
  if (isNetworkMessage(message)) return new RoomsError(strings.rooms.errors.network, 'network')
  return new RoomsError(message || strings.rooms.errors.generic)
}

/** Normalise n'importe quelle erreur (RoomsError, TypeError de fetch, texte…) en RoomsError
 * avec un message français compréhensible. */
export function toRoomsError(err: unknown): RoomsError {
  if (err instanceof RoomsError) return err
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  if (isNetworkMessage(message)) return new RoomsError(strings.rooms.errors.network, 'network')
  return new RoomsError(strings.rooms.errors.generic)
}

export function timeoutError(): RoomsError {
  return new RoomsError(strings.rooms.errors.timeout, 'timeout')
}

/** Au-delà, on affiche « Le serveur met du temps à répondre » avec un bouton Réessayer (les
 * actions de salon étant idempotentes côté serveur, réessayer est sans risque). */
export const ACTION_TIMEOUT_MS = 8_000

/** Rejette avec une erreur `timeout` si la promesse ne se résout pas dans le délai. La requête
 * elle-même n'est pas annulée (elle peut encore aboutir côté serveur) : l'appelant recharge
 * l'état ensuite. */
export function withTimeout<T>(promise: Promise<T>, ms: number = ACTION_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(timeoutError()), ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (err: unknown) => {
        window.clearTimeout(timer)
        reject(err)
      },
    )
  })
}
