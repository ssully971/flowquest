import { useEffect, useRef } from 'react'

interface TimerPathProps {
  progress: number
}

const AMPLITUDE = 6
const FREQUENCY = 0.045
const SMOOTHING = 0.15

export function TimerPath({ progress }: TimerPathProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const targetProgressRef = useRef(progress)
  const drawnProgressRef = useRef(progress)

  useEffect(() => {
    targetProgressRef.current = Math.min(1, Math.max(0, progress))
  }, [progress])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let width = 0
    let height = 0

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)

    const wave = (x: number, centerY: number) => centerY + Math.sin(x * FREQUENCY) * AMPLITUDE

    const draw = () => {
      const styles = getComputedStyle(canvas)
      const lineColor = styles.getPropertyValue('--line').trim() || 'rgba(168, 129, 255, 0.15)'
      const accentColor = styles.getPropertyValue('--accent').trim() || '#a881ff'
      const centerY = height / 2

      const target = targetProgressRef.current
      drawnProgressRef.current += (target - drawnProgressRef.current) * SMOOTHING
      if (Math.abs(drawnProgressRef.current - target) < 0.001) {
        drawnProgressRef.current = target
      }
      const currentX = width * drawnProgressRef.current

      ctx.clearRect(0, 0, width, height)

      ctx.beginPath()
      for (let x = 0; x <= width; x++) {
        const y = wave(x, centerY)
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = lineColor
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.stroke()

      if (currentX > 0) {
        ctx.beginPath()
        for (let x = 0; x <= currentX; x++) {
          const y = wave(x, centerY)
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = accentColor
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(currentX, wave(currentX, centerY), 4, 0, Math.PI * 2)
        ctx.fillStyle = accentColor
        ctx.fill()
      }

      frameId = requestAnimationFrame(draw)
    }

    let frameId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
    }
  }, [])

  return (
    <div
      className="mx-auto flex h-16 w-full max-w-xs items-center justify-center rounded-2xl border border-[var(--contour)] bg-[var(--surface)] px-5 shadow-[0_10px_24px_var(--glow)]"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}
