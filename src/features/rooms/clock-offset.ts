/**
 * Écart d'horloge appareil − serveur, estimé « à la NTP » (LOT P1).
 *
 * Chaque réponse du serveur porte son heure (`server_now`). Une mesure naïve
 * (`réception − server_now`) intègre toute la latence de la réponse : quand les requêtes
 * ralentissent, l'écart varie de plusieurs secondes d'un appel à l'autre et le compte à
 * rebours saute. Ici :
 *  - on mesure l'aller-retour (RTT) et on place l'heure serveur au MILIEU : décalage =
 *    (envoi + réception) / 2 − heure serveur ;
 *  - on garde l'échantillon au plus faible RTT (le plus fiable) et on ignore ceux au-dessus
 *    de MAX_RTT_MS (réseau saturé, onglet suspendu pendant l'appel) ;
 *  - quand l'estimation change, l'affichage ne saute pas : les écarts de moins de
 *    ABSORB_MS sont absorbés, les autres sont résorbés progressivement (SLEW_RATE), voir
 *    `reconcileClockOffset`.
 */

export interface ClockSample {
  /** Appareil − serveur (ms). */
  offsetMs: number
  /** Durée de l'aller-retour (ms). */
  rttMs: number
  /** Heure locale de la mesure (ms), pour vieillir l'échantillon. */
  takenAt: number
}

/** Au-delà, l'échantillon est trop imprécis pour remplacer un bon (sauf s'il n'y en a aucun). */
export const MAX_RTT_MS = 2_000
/** Un meilleur échantillon plus vieux que ça peut être remplacé par n'importe quel échantillon valide. */
export const SAMPLE_MAX_AGE_MS = 5 * 60_000
/** Un recalage de moins que ça n'est jamais visible : on garde l'affichage tel quel. */
export const ABSORB_MS = 1_000
/** Vitesse de résorption d'un recalage plus grand (secondes d'écart par seconde réelle).
 * Strictement < 1 : le temps affiché ne recule jamais, il accélère ou ralentit seulement. */
export const SLEW_RATE = 0.5

export interface Exchange {
  /** `Date.now()` juste avant l'envoi. */
  sentAt: number
  /** `Date.now()` à la réception. */
  receivedAt: number
  /** Durée mesurée avec `performance.now()` (monotone, insensible au changement d'heure). */
  perfRttMs: number
  /** Heure du serveur (`server_now`) en ms. */
  serverNowMs: number
}

/** Échantillon d'un échange. Le RTT retenu est le plus grand des deux horloges : un onglet
 * suspendu pendant l'appel allonge l'écart d'horloge murale même si `performance.now()`
 * s'est arrêté — l'échantillon est alors écarté plutôt que de fausser l'écart. */
export function sampleFromExchange(exchange: Exchange): ClockSample {
  const wallRtt = Math.max(0, exchange.receivedAt - exchange.sentAt)
  const rttMs = Math.max(wallRtt, Math.max(0, exchange.perfRttMs))
  const midpoint = exchange.sentAt + wallRtt / 2
  return { offsetMs: midpoint - exchange.serverNowMs, rttMs, takenAt: exchange.receivedAt }
}

/** Deux échantillons sont cohérents si leur écart reste dans l'incertitude de leurs RTT. */
function isConsistent(a: ClockSample, b: ClockSample): boolean {
  return Math.abs(a.offsetMs - b.offsetMs) <= (a.rttMs + b.rttMs) / 2 + 50
}

/**
 * Meilleur échantillon après ajout de `next` (fonction pure) :
 *  - aucun échantillon : on prend `next`, même lent (mieux que rien) ;
 *  - `next` au RTT plus faible ou égal : il remplace ;
 *  - `next` valide (RTT ≤ MAX_RTT_MS) mais incohérent avec le meilleur (l'heure de
 *    l'appareil a été changée) ou quand le meilleur est trop vieux : il remplace ;
 *  - sinon (RTT élevé, ou moins bon) : on garde le meilleur.
 */
export function pickBestSample(best: ClockSample | null, next: ClockSample): ClockSample {
  if (!best) return next
  if (next.rttMs <= best.rttMs) return next
  // Plus lent que le meilleur : jamais retenu s'il dépasse MAX_RTT_MS.
  if (next.rttMs > MAX_RTT_MS) return best
  if (next.takenAt - best.takenAt > SAMPLE_MAX_AGE_MS) return next
  if (!isConsistent(best, next)) return next
  return best
}

/** Estimateur (état minimal) : un seul pour tout l'appareil, partagé par tous les salons. */
export class ServerClock {
  private best: ClockSample | null = null

  /** Ajoute une mesure et renvoie l'écart estimé (appareil − serveur, ms). */
  addExchange(exchange: Exchange): number {
    this.best = pickBestSample(this.best, sampleFromExchange(exchange))
    return this.best.offsetMs
  }

  get offsetMs(): number | null {
    return this.best ? this.best.offsetMs : null
  }

  reset(): void {
    this.best = null
  }
}

/** Estimateur partagé de l'application. */
export const serverClock = new ServerClock()

// ─── Affichage sans saut ────────────────────────────────────────────────────

/** Écart utilisé à l'affichage : l'estimation cible + un reliquat qui se résorbe. */
export interface ClockOffsetState {
  /** Écart cible (appareil − serveur, ms). */
  targetMs: number
  /** Écart déjà affiché moins la cible, à l'instant `slewStartedAt` ; décroît vers 0. */
  residualMs: number
  /** Heure locale du début de la résorption. */
  slewStartedAt: number
}

/** Écart à appliquer à l'instant `now` (fonction pure du temps : aucun état en rendu). */
export function effectiveOffsetMs(state: ClockOffsetState, now: number): number {
  const elapsed = Math.max(0, now - state.slewStartedAt)
  const remaining = Math.max(0, Math.abs(state.residualMs) - SLEW_RATE * elapsed)
  return state.targetMs + Math.sign(state.residualMs) * remaining
}

/**
 * Intègre une nouvelle estimation `targetMs` à l'état d'affichage `prev` (reçue à `now`).
 *  - Autre salon / autre état (`sameState` faux) : on repart de la nouvelle estimation, la
 *    phase vient de changer, aucun saut n'est visible.
 *  - Même état, écart < ABSORB_MS : absorbé, l'affichage ne bouge pas.
 *  - Même état, écart plus grand : l'écart affiché est résorbé à SLEW_RATE (< 1), donc le
 *    temps restant ne remonte jamais.
 */
export function reconcileClockOffset(
  prev: ClockOffsetState | null,
  targetMs: number,
  now: number,
  sameState: boolean,
): ClockOffsetState {
  if (!prev || !sameState) return { targetMs, residualMs: 0, slewStartedAt: now }
  const displayed = effectiveOffsetMs(prev, now)
  const delta = displayed - targetMs
  if (Math.abs(delta) < ABSORB_MS) return { targetMs: displayed, residualMs: 0, slewStartedAt: now }
  return { targetMs, residualMs: delta, slewStartedAt: now }
}
