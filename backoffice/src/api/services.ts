import { apiClient } from './client';
import { Category } from './products';

export interface Service {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  durationMin: number;
  price: string;
  imageUrl: string | null;
  active: boolean;
  category?: Category;
}

export interface ServicePayload {
  categoryId?: string;
  name?: string;
  description?: string;
  durationMin?: number;
  price?: number;
  imageUrl?: string;
  active?: boolean;
}

export const servicesApi = {
  // Prestations actives uniquement (pour proposer une réservation)
  async getActive(): Promise<Service[]> {
    const { data } = await apiClient.get('/services');
    return data;
  },
  async getAllIncludingInactive(): Promise<Service[]> {
    const { data } = await apiClient.get('/services/all');
    return data;
  },
  async getCategories(): Promise<Category[]> {
    const { data } = await apiClient.get('/services/categories');
    return data;
  },
  async create(
    payload: ServicePayload & { categoryId: string; name: string; price: number; durationMin: number }
  ): Promise<Service> {
    const { data } = await apiClient.post('/services', payload);
    return data;
  },
  async update(id: string, payload: ServicePayload): Promise<Service> {
    const { data } = await apiClient.patch(`/services/${id}`, payload);
    return data;
  },
  async deactivate(id: string): Promise<Service> {
    const { data } = await apiClient.delete(`/services/${id}`);
    return data;
  },
  async createCategory(name: string): Promise<Category> {
    const { data } = await apiClient.post('/services/categories', { name });
    return data;
  },
  // Une faute de frappe dans un nom de catégorie était définitive.
  async renameCategory(id: string, name: string): Promise<Category> {
    const { data } = await apiClient.patch(`/services/categories/${id}`, { name });
    return data;
  },
  // Refusé par le serveur si la catégorie contient encore des prestations.
  async deleteCategory(id: string): Promise<void> {
    await apiClient.delete(`/services/categories/${id}`);
  },
};