import { create } from 'zustand';
import axios from 'axios';
import { apiClient, tokenStorage } from '../api/client';
import { API_BASE_URL } from '../api/config';

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: 'CLIENT' | 'STAFF' | 'ADMIN';
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isInitialized: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await axios.post(`${API_BASE_URL}/auth/login`, { email, password });

      // Le backoffice est réservé au personnel : un CLIENT n'a rien à y faire.
      if (data.user.role === 'CLIENT') {
        throw new Error("Accès réservé au personnel de l'institut.");
      }

      tokenStorage.save(data.accessToken, data.refreshToken);
      set({ user: data.user });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    const refreshToken = tokenStorage.getRefresh();
    if (refreshToken) {
      try {
        await axios.post(`${API_BASE_URL}/auth/logout`, { refreshToken });
      } catch {
        // erreurs serveur ignorées : on nettoie quand même la session locale
      }
    }
    tokenStorage.clear();
    set({ user: null });
  },

  loadSession: async () => {
    try {
      if (!tokenStorage.getAccess() && !tokenStorage.getRefresh()) {
        set({ isInitialized: true });
        return;
      }
      const { data } = await apiClient.get('/auth/me');
      if (data.role === 'CLIENT') {
        tokenStorage.clear();
        set({ user: null });
        return;
      }
      set({ user: data });
    } catch {
      tokenStorage.clear();
      set({ user: null });
    } finally {
      set({ isInitialized: true });
    }
  },
}));
