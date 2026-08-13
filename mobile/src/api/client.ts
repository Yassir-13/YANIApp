import axios from 'axios';
import { API_BASE_URL } from './config';
import { secureStorage } from '../utils/secureStorage';
import { notifySessionExpired } from './sessionEvents';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Intercepteur de requête : injecte l'access token ──
apiClient.interceptors.request.use(async (config) => {
  const token = await secureStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Intercepteur de réponse : refresh automatique si 401 ──
let isRefreshing = false;
// `null` = le refresh a échoué, la requête en attente doit être REJETÉE.
// Sans ce cas, les requêtes mises en file étaient simplement oubliées et leurs
// promesses ne se résolvaient jamais — voir le commentaire du `catch`.
let pendingRequests: Array<(token: string | null) => void> = [];

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Si 401 et qu'on n'a pas déjà réessayé cette requête
    // Routes qui ne doivent JAMAIS déclencher un refresh (sinon boucle)
    const noRefreshRoutes = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/register'];
    const isNoRefreshRoute = noRefreshRoutes.some((r) => originalRequest.url?.includes(r));

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isNoRefreshRoute
    ) {
      originalRequest._retry = true;

      // Si un refresh est déjà en cours, on met la requête en attente
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequests.push((token) => {
            if (!token) {
              reject(error);
              return;
            }
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          });
        });
      }

      isRefreshing = true;

      try {
        const refreshToken = await secureStorage.getRefreshToken();
        if (!refreshToken) throw new Error('Pas de refresh token');

        // Appel direct (sans intercepteur) pour rafraîchir.
        // Le délai est explicite : cet appel n'hérite pas de celui d'apiClient,
        // et sans borne un réseau qui pend bloquerait le démarrage de l'app,
        // maintenant que loadSession réessaie jusqu'à trois fois.
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken },
          { timeout: 10000 },
        );

        await secureStorage.saveTokens(data.accessToken, data.refreshToken);

        // On relance les requêtes en attente avec le nouveau token
        pendingRequests.forEach((cb) => cb(data.accessToken));
        pendingRequests = [];

        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // ⚠️ REJETER les requêtes en attente, ne pas les oublier.
        //
        // Cette ligne valait `pendingRequests = []` : les promesses mises en
        // file n'étaient ni résolues ni rejetées, elles restaient donc en
        // suspens POUR TOUJOURS. L'écran Fidélité lance six requêtes d'un coup :
        // hors ligne, la première déclenchait le refresh et les cinq autres se
        // mettaient en file — leur `Promise.all` ne se terminait jamais et le
        // chargement tournait indéfiniment.
        //
        // Tant que l'échec du refresh effaçait la session, l'interface se
        // remettait d'elle-même en repassant en mode invité. Depuis qu'une
        // panne réseau ne déconnecte plus (à raison), plus rien ne la
        // réveillait : le blocage était devenu définitif.
        pendingRequests.forEach((cb) => cb(null));
        pendingRequests = [];

        // Le refresh a échoué — mais pas forcément parce que la session est
        // morte. Sans réponse du serveur, c'est le RÉSEAU qui a manqué, et
        // jeter les jetons dans ce cas déconnecte une cliente dont la session
        // était parfaitement valable (elle doit alors ressaisir son mot de
        // passe pour rien). L'access token expire au bout de 15 minutes : le
        // cas est donc fréquent, pas exotique.
        const refuseParLeServeur =
          axios.isAxiosError(refreshError) && !!refreshError.response;

        if (refuseParLeServeur) {
          await secureStorage.clearTokens();
          // Effacer les tokens ne suffisait pas : l'application restait
          // affichée comme connectée jusqu'au prochain redémarrage. On prévient
          // le store pour qu'il repasse en invité et que l'interface suive.
          // Cas fréquent depuis que le changement de mot de passe révoque
          // toutes les sessions.
          notifySessionExpired();
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);