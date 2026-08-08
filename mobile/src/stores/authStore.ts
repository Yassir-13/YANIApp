import { create } from 'zustand';
import { apiClient } from '../api/client';
import { authApi } from '../api/auth';
import { API_BASE_URL } from '../api/config';
import axios from 'axios';
import { secureStorage } from '../utils/secureStorage';
import { setSessionExpiredHandler } from '../api/sessionEvents';
import { useCartStore } from './cartStore';

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

 register: async (email, password, firstName, lastName, phone) => {
    set({ isLoading: true });
    try {
      await axios.post(`${API_BASE_URL}/auth/register`, {
        email,
        password,
        firstName,
        lastName,
        phone,
      });
      // Après inscription, on connecte directement
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
    await apiClient.delete('/users/me');
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
      const { data } = await apiClient.get('/auth/me');
      set({ user: data });
    } catch {
      // Échec réel (refresh token mort ou invalide) → on nettoie
      await secureStorage.clearTokens();
      set({ user: null });
    } finally {
      set({ isInitialized: true });
    }
  },
}));

// Quand l'intercepteur constate qu'un refresh token n'est plus valide
// (expiré, révoqué après un changement de mot de passe, session tuée pour
// réutilisation suspecte), l'utilisateur redevient invité immédiatement.
// L'interface suit sans attendre un redémarrage de l'application.
setSessionExpiredHandler(() => {
  useAuthStore.setState({ user: null });
});