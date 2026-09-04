import { apiClient } from './client';
import { Category, CategoryPayload } from './products';

export interface Service {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  // Traductions saisies dans le back-office. `null` = pas encore traduit :
  // l'application sert alors le français.
  nameAr: string | null;
  nameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  // Facultative : purement informative, sans effet sur les créneaux.
  durationMin: number | null;
  price: string;
  imageUrl: string | null;
  active: boolean;
  category?: Category;
}

export interface ServicePayload {
  categoryId?: string;
  name?: string;
  description?: string;
  // `null` pour effacer une traduction ; absent pour ne pas y toucher.
  nameAr?: string | null;
  nameEn?: string | null;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  // `null` pour effacer la durée ; absent pour ne pas y toucher.
  durationMin?: number | null;
  price?: number;
  // `null` pour retirer la photo ; absent pour ne pas y toucher.
  imageUrl?: string | null;
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
    payload: ServicePayload & { categoryId: string; name: string; price: number }
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
  async createCategory(payload: CategoryPayload): Promise<Category> {
    const { data } = await apiClient.post('/services/categories', payload);
    return data;
  },
  // Une faute de frappe dans un nom de catégorie était définitive.
  async renameCategory(id: string, payload: CategoryPayload): Promise<Category> {
    const { data } = await apiClient.patch(`/services/categories/${id}`, payload);
    return data;
  },
  // Refusé par le serveur si la catégorie contient encore des prestations.
  async deleteCategory(id: string): Promise<void> {
    await apiClient.delete(`/services/categories/${id}`);
  },
};