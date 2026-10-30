import { Pause, Play, Square } from 'lucide-react'

import { strings } from '@/shared/i18n'

import type { PipBackground } from '../pip-background'

interface PipDocumentViewProps {
  segmentLabel: string
  timeLabel: string
  taskLabel?: string | null
  background: PipBackground
  status: 'idle' | 'running' | 'paused' | 'completed'
  /** Lancer / mettre en pause / reprendre ; absent pour un participant non hôte (lecture seule). */
  onPrimary?: () => void
  /** Arrêter la session ; absent quand l'utilisateur ne peut pas terminer. */
  onEnd?: () => void
}

/**
 * Contenu de la fenêtre Document Picture-in-Picture : vrai DOM rendu par un portail React. La fenêtre
 * est un document SÉPARÉ sans les feuilles de style de l'application : tout est donc en styles en
 * ligne (pas de classes Tailwind à recopier), plus une minuscule balise <style> pour l'anneau de
 * focus clavier. Le fond est une version statique du fond d'écran choisi (voir pip-background.ts)
 * sous un voile sombre, texte clair ombré : lisible sur n'importe quel fond.
 */
export function PipDocumentView({
  segmentLabel,
  timeLabel,
  taskLabel,
  background,
  status,
  onPrimary,
  onEnd,
}: PipDocumentViewProps) {
  const s = strings.focus.controls
  const isRunning = status === 'running'
  const primaryLabel = isRunning ? s.pause : status === 'paused' ? s.resume : s.start
  const PrimaryIcon = isRunning ? Pause : Play

  return (
    <div
      data-testid="pip-document"
      style={{
        position: 'relative',
        height: '100%',
        overflow: 'hidden',
        fontFamily: 'system-ui, sans-serif',
        color: '#f2ecfc',
        background: `linear-gradient(135deg, ${background.colorFrom}, ${background.colorTo})`,
      }}
    >
      <style>{`
        .pip-btn { transition: transform 120ms; }
        .pip-btn:hover { transform: scale(1.06); }
        .pip-btn:focus-visible { outline: 2px solid #ffffff; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .pip-btn { transition: none; } .pip-btn:hover { transform: none; } }
      `}</style>
      {background.imageSrc ? (
        <img
          src={background.imageSrc}
          alt=""
          data-testid="pip-background-image"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: background.position,
          }}
        />
      ) : null}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(8, 4, 20, 0.5)' }} />
      <div
        style={{
          position: 'relative',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          textShadow: '0 1px 6px rgba(0, 0, 0, 0.55)',
        }}
      >
        <div style={{ fontSize: 14, opacity: 0.8 }}>{segmentLabel}</div>
        <div
          role="timer"
          style={{ fontSize: 40, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
        >
          {timeLabel}
        </div>
        {taskLabel ? (
          <div style={{ fontSize: 12, opacity: 0.7, maxWidth: '90%', textAlign: 'center' }}>
            {taskLabel}
          </div>
        ) : null}
        {onPrimary || onEnd ? (
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            {onPrimary ? (
              <button
                type="button"
                className="pip-btn"
                onClick={onPrimary}
                aria-label={primaryLabel}
                style={buttonStyle(true)}
              >
                <PrimaryIcon
                  size={16}
                  strokeWidth={2}
                  aria-hidden="true"
                  fill={isRunning ? 'none' : 'currentColor'}
                />
              </button>
            ) : null}
            {onEnd ? (
              <button
                type="button"
                className="pip-btn"
                onClick={onEnd}
                aria-label={s.endSession}
                style={buttonStyle(false)}
              >
                <Square size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function buttonStyle(primary: boolean): React.CSSProperties {
  return {
    width: 34,
    height: 34,
    borderRadius: '50%',
    border: primary ? 'none' : '1px solid rgba(255, 255, 255, 0.55)',
    background: primary ? '#ffffff' : 'rgba(255, 255, 255, 0.12)',
    color: primary ? '#20103b' : '#ffffff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
  }
}
