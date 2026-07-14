import { apiClient } from './client';

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export const usersApi = {
  async updateProfile(payload: UpdateProfilePayload) {
    const { data } = await apiClient.patch('/users/me', payload);
    return data;
  },

  async changePassword(currentPassword: string, newPassword: string) {
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