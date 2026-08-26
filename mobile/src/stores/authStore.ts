import { create } from 'zustand';
import { apiClient } from '../api/client';
import { usersApi } from '../api/users';
import { authApi } from '../api/auth';
import { API_BASE_URL } from '../api/config';
import axios from 'axios';
import { secureStorage } from '../utils/secureStorage';
import { setSessionExpiredHandler } from '../api/sessionEvents';
import { useCartStore } from './cartStore';
import { currentLanguage } from '../i18n';

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: 'CLIENT' | 'STAFF' | 'ADMIN';
  // null tant que l'adresse n'a pas été confirmée par un code.
  emailVerifiedAt: string | null;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string, phone: string) => Promise<void>;  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  setUser: (user: User) => void;
  deleteAccount: () => Promise<void>;
  verifyEmail: (code: string) => Promise<void>;
  resendCode: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isInitialized: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await axios.post(`${API_BASE_URL}/auth/login`, {
        email,
        password,
      });
      await secureStorage.saveTokens(data.accessToken, data.refreshToken);
      set({ user: data.user });
    } finally {
      set({ isLoading: false });
    }
  },

  // UN SEUL appel. Il y en avait deux — `/auth/register` puis `/auth/login` —
  // et entre les deux une fenêtre où le compte existait sans session : si le
  // login échouait (réseau, limite de débit), la cliente lisait « Inscription
  // impossible » alors que son compte venait d'être créé. Elle recommençait, et
  // se voyait répondre « Un compte existe déjà avec cet email ». Bloquée, sans
  // rien comprendre. `/auth/register` renvoie désormais les jetons lui-même.
  register: async (email, password, firstName, lastName, phone) => {
    set({ isLoading: true });
    try {
      const { data } = await axios.post(`${API_BASE_URL}/auth/register`, {
        email,
        password,
        firstName,
        lastName,
        phone,
        // Enregistrée dès l'inscription : le code de confirmation, tout
        // premier email reçu, part ainsi déjà dans la bonne langue.
        // `axios` direct et non `apiClient` ici : pas d'en-tête à ajouter.
        locale: currentLanguage(),
      });
      await secureStorage.saveTokens(data.accessToken, data.refreshToken);
      set({ user: data.user });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    const refreshToken = await secureStorage.getRefreshToken();
    if (refreshToken) {
      try {
        await axios.post(`${API_BASE_URL}/auth/logout`, { refreshToken });
      } catch {
        // on ignore les erreurs de logout côté serveur
      }
    }
    await secureStorage.clearTokens();
    // Le panier est désormais persisté sur le téléphone : sans ce vidage,
    // la cliente suivante à se connecter sur le même appareil retrouverait
    // le panier de la précédente.
    useCartStore.getState().clear();
    set({ user: null });
  },

  setUser: (user) => {
    set({ user });
  },

  verifyEmail: async (code) => {
    const { emailVerifiedAt } = await authApi.verifyEmail(code);
    // Mise à jour locale plutôt qu'un rechargement du profil : le bandeau de
    // rappel disparaît immédiatement, sans aller-retour réseau supplémentaire.
    set((state) =>
      state.user ? { user: { ...state.user, emailVerifiedAt } } : state,
    );
  },

  resendCode: async () => {
    await authApi.resendCode();
  },

  deleteAccount: async () => {
    // Supprime le compte côté serveur puis nettoie la session locale.
    // Passe par `usersApi` et non par un appel monté à la main : la fonction
    // existait déjà et n'était appelée nulle part. Deux chemins vers la même
    // route, c'est un des deux qu'on oubliera de suivre le jour où elle change.
    await usersApi.deleteAccount();
    await secureStorage.clearTokens();
    useCartStore.getState().clear();
    set({ user: null });
  },

  loadSession: async () => {
    try {
      const token = await secureStorage.getAccessToken();
      const refreshToken = await secureStorage.getRefreshToken();


      // Pas de tokens du tout → invité, rien à faire
      if (!token && !refreshToken) {
        set({ isInitialized: true });
        return;
      }

      // On tente /auth/me. Si l'access token est expiré, l'intercepteur
      // rafraîchira automatiquement (grâce à la correction).
      // Plusieurs essais : au lancement, le réseau met parfois une seconde ou
      // deux à revenir (sortie d'ascenseur, de métro, de mode avion). Ces
      // essais tiennent dans la durée du splash, ils ne se voient donc pas.
      const { data } = await getMeAvecReprises();
      set({ user: data });
    } catch (e) {
      // ⚠️ Ne PAS effacer les jetons sur n'importe quelle erreur.
      //
      // Ce `catch` attrapait tout, et une simple absence de réseau était donc
      // traitée comme une session invalide : la cliente se retrouvait
      // déconnectée et devait ressaisir son mot de passe, alors que sa session
      // était parfaitement valable.
      //
      // On ne jette les jetons que si le SERVEUR les a refusés. « Je n'ai pas
      // pu poser la question » n'est pas « on m'a répondu non ».
      const status = axios.isAxiosError(e) ? e.response?.status : undefined;
      if (status === 401 || status === 403) {
        await secureStorage.clearTokens();
        set({ user: null });
      }
      // Sinon les jetons restent en place : la session reprendra d'elle-même
      // au prochain lancement avec du réseau, sans rien redemander à la
      // cliente. Elle reste en mode invité pour ce lancement-ci.
    } finally {
      set({ isInitialized: true });
    }
  },
}));

// Trois essais espacés de 1 puis 2 secondes, et uniquement sur une panne de
// réseau : un refus du serveur (401/403) est définitif, le réessayer ne ferait
// que retarder l'affichage. Même raisonnement que la reconnexion à la base
// côté serveur — on laisse sa chance à une coupure passagère, pas à une panne.
async function getMeAvecReprises() {
  const attentes = [1000, 2000];
  for (let essai = 0; ; essai++) {
    try {
      return await apiClient.get('/auth/me');
    } catch (e) {
      const reseau = axios.isAxiosError(e) && !e.response;
      if (!reseau || essai >= attentes.length) throw e;
      await new Promise((r) => setTimeout(r, attentes[essai]));
    }
  }
}

// Quand l'intercepteur constate qu'un refresh token n'est plus valide
// (expiré, révoqué après un changement de mot de passe, session tuée pour
// réutilisation suspecte), l'utilisateur redevient invité immédiatement.
// L'interface suit sans attendre un redémarrage de l'application.
setSessionExpiredHandler(() => {
  useAuthStore.setState({ user: null });
});