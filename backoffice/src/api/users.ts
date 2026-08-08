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
  // null tant que la cliente n'a pas saisi le code reçu par email.
  emailVerifiedAt: string | null;
}

// Enveloppe renvoyée par les endpoints paginés du backend.
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const usersApi = {
  // STAFF/ADMIN : liste paginée, avec recherche optionnelle (nom, email, téléphone).
  // Le backend plafonne `limit` à 100.
  async findAll(
    params: { search?: string; role?: Role; page?: number; limit?: number } = {},
  ): Promise<Paginated<AppUser>> {
    const { search, role, page, limit } = params;
    const { data } = await apiClient.get('/users', {
      params: {
        ...(search ? { search } : {}),
        ...(role ? { role } : {}),
        ...(page ? { page } : {}),
        ...(limit ? { limit } : {}),
      },
    });
    return data;
  },
  // ADMIN : changer le rôle d'un utilisateur
  async updateRole(id: string, role: Role): Promise<AppUser> {
    const { data } = await apiClient.patch(`/users/${id}/role`, { role });
    return data;
  },
};
