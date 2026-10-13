function formatSeconds(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds)
  const hours = Math.floor(clamped / 3600)
  const minutes = Math.floor((clamped % 3600) / 60)
  const seconds = clamped % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`
}

export function formatCountdown(remainingMs: number): string {
  return formatSeconds(Math.ceil(remainingMs / 1000))
}

export function formatElapsed(elapsedMs: number): string {
  return formatSeconds(Math.floor(elapsedMs / 1000))
}
