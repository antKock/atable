/**
 * Navigation « dure » (rechargement complet, hors routeur Next) : après un
 * changement de session ou d'identité (créer / rejoindre / quitter un carnet,
 * fusion), l'état client doit repartir de zéro — `router.push` garderait le
 * cache et les layouts de l'ancienne session.
 */
export function hardNavigate(url: string): void {
  window.location.href = url;
}
