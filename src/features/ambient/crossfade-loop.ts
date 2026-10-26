// Points de courbe par seconde pour l'enveloppe de fondu (lot 4, §1) : assez fin pour un
// fondu cos/sin perçu comme continu (`AudioParam.setValueCurveAtTime` interpole
// linéairement entre deux points consécutifs), sans générer un tableau inutilement gros
// pour des fichiers de 10 à 30 s.
const CURVE_POINTS_PER_SECOND = 50

export interface CrossfadeLoopHandle {
  /** GainNode de volume (LOT C3) : en aval de l'enveloppe de fondu enchaîné, donc
   * `setVolume` reste instantané et n'interfère jamais avec le raccord entre deux
   * lectures. */
  volumeGain: GainNode
  /** Arrête immédiatement toute lecture en cours et désinstalle la chaîne. */
  stop: () => void
}

/**
 * Valeur de l'enveloppe à l'instant `t` (secondes depuis le début de CETTE lecture) :
 * fondu d'entrée en sinus sur `[0, overlap[`, plateau à 1 au milieu, fondu de sortie en
 * cosinus sur `]duration-overlap, duration]`. Sinus/cosinus plutôt qu'une rampe linéaire :
 * à puissance égale, la somme des deux fondus (celui qui sort, celui qui entre) reste
 * perceptiblement à volume constant pendant tout le recouvrement — un fondu linéaire
 * creuse le volume au milieu du croisement (sin²+cos²=1, pas x+(1-x) perçu linéairement en
 * pression sonore).
 */
function envelopeValueAt(t: number, duration: number, overlap: number): number {
  if (overlap <= 0) return 1
  if (t < overlap) return Math.sin((t / overlap) * (Math.PI / 2))
  if (t > duration - overlap) return Math.cos(((t - (duration - overlap)) / overlap) * (Math.PI / 2))
  return 1
}

export function buildEqualPowerEnvelope(duration: number, overlap: number): Float32Array {
  const pointCount = Math.max(8, Math.round(duration * CURVE_POINTS_PER_SECOND))
  const curve = new Float32Array(pointCount)
  for (let i = 0; i < pointCount; i++) {
    const t = (i / (pointCount - 1)) * duration
    curve[i] = envelopeValueAt(t, duration, overlap)
  }
  return curve
}

interface ScheduledSource {
  source: AudioBufferSourceNode
  envelopeGain: GainNode
}

/**
 * Boucle d'ambiance sans coupure (lot 4, §1) : jamais `source.loop = true` au-delà de
 * quelques secondes — une boucle native recolle la fin au début à l'échantillon près,
 * mais c'est justement ce raccord instantané qui s'entend comme un à-coup quand le début
 * et la fin du fichier source n'ont pas le même niveau/la même phase (cas général d'un
 * enregistrement de 10 à 30 s, pas conçu pour boucler à la perfection). Ici, deux
 * `AudioBufferSourceNode` jouent la même mémoire tampon en alternance, chacun démarrant
 * `buffer.duration - overlapSeconds` après le précédent, avec une enveloppe de gain à
 * puissance égale posée par `setValueCurveAtTime` : le début du suivant se mélange à la
 * fin du précédent pendant `overlapSeconds`, masquant le raccord.
 *
 * Tous les instants de lecture (`source.start(when)`, `setValueCurveAtTime(curve, when,
 * duration)`) sont des valeurs de `context.currentTime` calculées à l'avance par
 * arithmétique — jamais un `setTimeout` qui déclencherait `start()` au moment de son
 * exécution (imprécis, et les navigateurs ralentissent volontairement les timers JS en
 * arrière-plan). Au-delà de la deuxième lecture, la chaîne se poursuit par relais : chaque
 * lecture, à sa fin (`onended`, un évènement du moteur audio, pas un minuteur), programme
 * celle de deux crans plus loin — à tout instant, exactement deux lectures sont donc
 * programmées (l'une qui joue, l'une déjà prête à prendre le relais), avec une marge large
 * (`duration - overlap`, plusieurs secondes pour tous les sons du catalogue) avant que ce
 * calcul ne soit nécessaire, largement assez pour survivre à un `onended` retardé par un
 * onglet mis en arrière-plan.
 */
export function createCrossfadeLoop(
  context: AudioContext,
  buffer: AudioBuffer,
  destination: AudioNode,
  overlapSeconds: number,
): CrossfadeLoopHandle {
  const volumeGain = context.createGain()
  volumeGain.connect(destination)

  const duration = buffer.duration
  const overlap = Math.min(overlapSeconds, duration / 2)
  const envelope = buildEqualPowerEnvelope(duration, overlap)
  const step = duration - overlap
  const startedAt = context.currentTime

  let stopped = false
  const active = new Set<ScheduledSource>()

  function scheduleGeneration(generation: number) {
    if (stopped) return
    const startAt = startedAt + generation * step
    const source = context.createBufferSource()
    source.buffer = buffer
    const envelopeGain = context.createGain()
    source.connect(envelopeGain)
    envelopeGain.connect(volumeGain)
    envelopeGain.gain.setValueCurveAtTime(envelope, startAt, duration)
    source.start(startAt)

    const entry: ScheduledSource = { source, envelopeGain }
    active.add(entry)
    source.onended = () => {
      active.delete(entry)
      source.disconnect()
      envelopeGain.disconnect()
      scheduleGeneration(generation + 2)
    }
  }

  // Les deux premières lectures, programmées tout de suite (voir la jsdoc) : c'est elles
  // qui réalisent le premier recouvrement d'`overlapSeconds`.
  scheduleGeneration(0)
  scheduleGeneration(1)

  function stop() {
    if (stopped) return
    stopped = true
    for (const entry of active) {
      entry.source.onended = null
      try {
        entry.source.stop()
      } catch {
        // Déjà arrêté : sans conséquence.
      }
      entry.source.disconnect()
      entry.envelopeGain.disconnect()
    }
    active.clear()
    volumeGain.disconnect()
  }

  return { volumeGain, stop }
}
