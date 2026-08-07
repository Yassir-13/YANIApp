// Pont entre l'intercepteur HTTP et le store d'authentification.
//
// `client.ts` doit pouvoir signaler « la session est morte », mais il ne peut
// pas importer `authStore` : celui-ci importe déjà `apiClient`, ce qui créerait
// un cycle d'imports. Ce module minuscule ne dépend de rien, les deux côtés
// peuvent donc l'importer sans risque.

type Handler = () => void;

let onSessionExpired: Handler | null = null;

/** Appelé par le store au démarrage pour enregistrer sa réaction. */
export function setSessionExpiredHandler(handler: Handler) {
  onSessionExpired = handler;
}

/** Appelé par l'intercepteur quand le refresh token n'est plus valide. */
export function notifySessionExpired() {
  onSessionExpired?.();
}
