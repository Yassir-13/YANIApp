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
  // Pas de `durationMin` : l'API la renvoie encore, mais l'application ne
  // l'affiche plus — le centre ne communique pas ses durées aux clientes. Ne
  // pas la remettre ici sans que ce choix change.
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