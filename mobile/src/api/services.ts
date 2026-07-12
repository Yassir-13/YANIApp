import { apiClient } from './client';

export interface ServiceCategory {
  id: string;
  name: string;
}

export interface Service {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  durationMin: number;
  price: string; // Decimal renvoyé en string par Prisma
  imageUrl: string | null;
  active: boolean;
  category?: ServiceCategory;
}

export const servicesApi = {
  // Liste des services actifs (route publique)
  async getAll(): Promise<Service[]> {
    const { data } = await apiClient.get('/services');
    return data;
  },

  // Détail d'un service
  async getOne(id: string): Promise<Service> {
    const { data } = await apiClient.get(`/services/${id}`);
    return data;
  },

  // Liste des catégories
  async getCategories(): Promise<ServiceCategory[]> {
    const { data } = await apiClient.get('/services/categories');
    return data;
  },
};