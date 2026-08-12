import { apiClient } from './client';

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  // `null` efface le numéro, `undefined` le laisse tel quel. La distinction
  // n'est pas cosmétique : `undefined` disparaît du JSON, le serveur ne voit
  // donc aucun champ `phone` et ne touche pas à la colonne — un champ vidé
  // dans l'app restait alors renseigné en base.
  phone?: string | null;
}

export const usersApi = {
  async updateProfile(payload: UpdateProfilePayload) {
    const { data } = await apiClient.patch('/users/me', payload);
    return data;
  },

  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const { data } = await apiClient.patch('/users/me/password', {
      currentPassword,
      newPassword,
    });
    return data;
  },

  async deleteAccount() {
    const { data } = await apiClient.delete('/users/me');
    return data;
  },
};