import { create } from 'zustand';
import { apiClient } from '../api/client';
import { API_BASE_URL } from '../api/config';
import axios from 'axios';
import { secureStorage } from '../utils/secureStorage';

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: 'CLIENT' | 'STAFF' | 'ADMIN';
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  setUser: (user: User) => void;
  deleteAccount: () => Promise<void>;
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

  register: async (email, password, firstName, lastName) => {
    set({ isLoading: true });
    try {
      await axios.post(`${API_BASE_URL}/auth/register`, {
        email,
        password,
        firstName,
        lastName,
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
    set({ user: null });
  },

  setUser: (user) => {
    set({ user });
  },

  deleteAccount: async () => {
    // Supprime le compte côté serveur puis nettoie la session locale.
    await apiClient.delete('/users/me');
    await secureStorage.clearTokens();
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