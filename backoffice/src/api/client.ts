import axios from 'axios';
import { API_BASE_URL } from './config';

const ACCESS_KEY = 'yani_bo_access';
const REFRESH_KEY = 'yani_bo_refresh';

export const tokenStorage = {
  save(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export const apiClient = axios.create({ baseURL: API_BASE_URL });

// Routes d'auth qui ne doivent jamais déclencher un refresh (sinon boucle)
const NO_REFRESH = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/register'];

// ── Injection du token à chaque requête ────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Refresh automatique sur 401 ────────────────────────────────────────
let isRefreshing = false;
let pending: ((token: string | null) => void)[] = [];

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const url: string = original?.url ?? '';
    const isAuthRoute = NO_REFRESH.some((r) => url.includes(r));

    if (error.response?.status !== 401 || original._retry || isAuthRoute) {
      return Promise.reject(error);
    }

    // Un refresh est déjà en cours : on met la requête en file d'attente
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pending.push((token) => {
          if (!token) return reject(error);
          original.headers.Authorization = `Bearer ${token}`;
          resolve(apiClient(original));
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = tokenStorage.getRefresh();
      if (!refreshToken) throw new Error('no refresh token');

      const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
      tokenStorage.save(data.accessToken, data.refreshToken);

      pending.forEach((cb) => cb(data.accessToken));
      pending = [];

      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return apiClient(original);
    } catch (e) {
      pending.forEach((cb) => cb(null));
      pending = [];
      tokenStorage.clear();
      // Session morte : on renvoie vers la connexion
      window.location.href = '/login';
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  }
);
