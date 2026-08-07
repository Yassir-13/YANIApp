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
let pendingRequests: Array<(token: string) => void> = [];

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
        return new Promise((resolve) => {
          pendingRequests.push((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          });
        });
      }

      isRefreshing = true;

      try {
        const refreshToken = await secureStorage.getRefreshToken();
        if (!refreshToken) throw new Error('Pas de refresh token');

        // Appel direct (sans intercepteur) pour rafraîchir
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        await secureStorage.saveTokens(data.accessToken, data.refreshToken);

        // On relance les requêtes en attente avec le nouveau token
        pendingRequests.forEach((cb) => cb(data.accessToken));
        pendingRequests = [];

        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Le refresh a échoué : session morte, on nettoie.
        pendingRequests = [];
        await secureStorage.clearTokens();
        // Effacer les tokens ne suffisait pas : l'application restait affichée
        // comme connectée jusqu'au prochain redémarrage. On prévient le store
        // pour qu'il repasse en invité et que l'interface suive.
        // Cas fréquent depuis que le changement de mot de passe révoque
        // toutes les sessions.
        notifySessionExpired();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);