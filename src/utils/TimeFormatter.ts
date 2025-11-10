/**
 * Utilitaire de formatage du temps
 */

/**
 * Formate le temps écoulé en texte lisible
 * @param seconds Nombre de secondes
 * @returns Texte formaté (ex: "2h 30m", "5m 42s", "15s")
 */
export function formatTimeElapsed(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Formate une durée en millisecondes en texte lisible
 * @param ms Durée en millisecondes
 * @returns Texte formaté
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return formatTimeElapsed(seconds);
}

