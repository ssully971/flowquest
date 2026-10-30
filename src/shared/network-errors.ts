const NETWORK_PATTERN =
  /failed to fetch|network ?error|networkerror|load failed|fetch failed|network request failed|err_network|err_internet_disconnected|timeout|timed out/i

/** Vrai pour les messages bruts d'un échec réseau ou d'un délai dépassé (Chrome « Failed to
 * fetch », Firefox « NetworkError when attempting to fetch resource », Safari « Load failed »…).
 * Sert à distinguer un échec PASSAGER (on réessaie) d'un refus définitif du serveur. */
export function isNetworkMessage(message: string | undefined | null): boolean {
  return Boolean(message) && NETWORK_PATTERN.test(message as string)
}
