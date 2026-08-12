import axios from 'axios';
import { apiClient } from './client';
import { API_BASE_URL } from './config';

// Délai que le SERVEUR impose entre deux envois de code (VerificationCodeService).
// Il est redit ici pour que les écrans puissent afficher un compte à rebours :
// sans lui, on annonce « un nouveau code a été envoyé » alors que le serveur
// n'a rien envoyé, et la cliente attend un email qui ne viendra pas.
export const RESEND_COOLDOWN_SECONDS = 60;

export const authApi = {
  // ── Confirmation d'adresse email ──
  // Routes authentifiées : l'inscription connecte immédiatement, le compte
  // visé est donc déduit du token et jamais envoyé par le client.

  async verifyEmail(code: string): Promise<{ message: string; emailVerifiedAt: string }> {
    const { data } = await apiClient.post('/auth/verify-email', { code });
    return data;
  },

  async resendCode(): Promise<{ message: string }> {
    const { data } = await apiClient.post('/auth/resend-code');
    return data;
  },

  // ── Mot de passe oublié ──
  // Routes publiques : la cliente ne peut pas se connecter, donc pas de token
  // à joindre. On passe par axios directement, comme pour login et register.

  async forgotPassword(email: string): Promise<{ message: string }> {
    const { data } = await axios.post(`${API_BASE_URL}/auth/forgot-password`, {
      email,
    });
    return data;
  },

  async resetPassword(payload: {
    email: string;
    code: string;
    newPassword: string;
  }): Promise<{ message: string }> {
    const { data } = await axios.post(
      `${API_BASE_URL}/auth/reset-password`,
      payload,
    );
    return data;
  },
};
