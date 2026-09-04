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

  // Le back-office travaille en français, toujours : c'est la langue dans
  // laquelle la gérante saisit ses fiches, et celle des colonnes que ce
  // formulaire enregistre.
  //
  // Sans cette ligne, la langue serait celle du NAVIGATEUR. `Accept-Language`
  // est un en-tête qu'une page web ne peut pas écrire — le navigateur le pose
  // seul. Un Chrome en anglais aurait donc chargé la traduction anglaise dans
  // le champ français du formulaire, et l'aurait réenregistrée par-dessus
  // l'original au premier « Enregistrer ».
  if (config.headers) {
    config.headers['X-Locale'] = 'fr';
  }

  return config;
});

// ── Refresh automatique sur 401 ────────────────────────────────────────
let isRefreshing = false;
let pending: ((token: string | null) => void)[] = [];

// Session refusée par le serveur : on efface et on renvoie à la connexion.
// À n'appeler QUE lorsque le serveur a répondu — voir le commentaire du catch.
function terminerLaSession() {
  tokenStorage.clear();
  window.location.href = '/login';
}

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
      if (!refreshToken) {
        // Un 401 sans jeton de renouvellement : il n'y a rien à tenter, la
        // session est bel et bien finie. Ce cas est traité ici et non dans le
        // `catch`, où il serait confondu avec une panne réseau.
        pending.forEach((cb) => cb(null));
        pending = [];
        terminerLaSession();
        return Promise.reject(error);
      }

      const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
      tokenStorage.save(data.accessToken, data.refreshToken);

      pending.forEach((cb) => cb(data.accessToken));
      pending = [];

      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return apiClient(original);
    } catch (e) {
      // Les requêtes en attente sont REJETÉES, jamais oubliées : sans ça leurs
      // promesses resteraient en suspens et l'écran tournerait indéfiniment
      // (c'est le défaut N3, qui n'a jamais touché le backoffice).
      pending.forEach((cb) => cb(null));
      pending = [];

      // Le renouvellement a échoué — mais pas forcément parce que la session
      // est morte. Sans réponse du serveur, c'est le RÉSEAU qui a manqué, et
      // déconnecter dans ce cas éjecte Fati en pleine saisie pour une
      // micro-coupure : filtres perdus, page en cours perdue, mot de passe à
      // ressaisir pour rien. L'access token expire toutes les 15 minutes, donc
      // l'occasion se présente souvent.
      //
      // Même correctif qu'I14 côté mobile, même raisonnement.
      const refuseParLeServeur = axios.isAxiosError(e) && !!e.response;
      if (refuseParLeServeur) {
        terminerLaSession();
      }

      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  }
);
