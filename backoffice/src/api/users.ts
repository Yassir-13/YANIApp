import { apiClient } from './client';

export type Role = 'CLIENT' | 'STAFF' | 'ADMIN';

export interface AppUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: Role;
  createdAt: string;
}

export const usersApi = {
  // STAFF/ADMIN : liste, avec recherche optionnelle (nom, email, téléphone)
  async findAll(search?: string): Promise<AppUser[]> {
    const { data } = await apiClient.get('/users', { params: search ? { search } : {} });
    return data;
  },
  // ADMIN : changer le rôle d'un utilisateur
  async updateRole(id: string, role: Role): Promise<AppUser> {
    const { data } = await apiClient.patch(`/users/${id}/role`, { role });
    return data;
  },
};
