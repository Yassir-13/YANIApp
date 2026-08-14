import { apiClient } from './client';

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: string;
  stockQty: number;
  imageUrl: string | null;
  active: boolean;
  category?: Category;
}

// Champs modifiables (tous optionnels : mise à jour partielle)
export interface ProductPayload {
  categoryId?: string;
  name?: string;
  description?: string;
  price?: number;
  stockQty?: number;
  imageUrl?: string;
  active?: boolean;
}

export const productsApi = {
  // Catalogue public (actifs uniquement) — utilisé par le dashboard
  async getAll(): Promise<Product[]> {
    const { data } = await apiClient.get('/products');
    return data;
  },
  // Vue staff : inclut les produits désactivés
  async getAllIncludingInactive(): Promise<Product[]> {
    const { data } = await apiClient.get('/products/all');
    return data;
  },
  async getCategories(): Promise<Category[]> {
    const { data } = await apiClient.get('/products/categories');
    return data;
  },
  async create(payload: ProductPayload & { categoryId: string; name: string; price: number }): Promise<Product> {
    const { data } = await apiClient.post('/products', payload);
    return data;
  },
  async update(id: string, payload: ProductPayload): Promise<Product> {
    const { data } = await apiClient.patch(`/products/${id}`, payload);
    return data;
  },
  async deactivate(id: string): Promise<Product> {
    const { data } = await apiClient.delete(`/products/${id}`);
    return data;
  },
  async createCategory(name: string): Promise<Category> {
    const { data } = await apiClient.post('/products/categories', { name });
    return data;
  },
  // Une faute de frappe dans un nom de catégorie était définitive.
  async renameCategory(id: string, name: string): Promise<Category> {
    const { data } = await apiClient.patch(`/products/categories/${id}`, { name });
    return data;
  },
  // Refusé par le serveur si la catégorie contient encore des produits.
  async deleteCategory(id: string): Promise<void> {
    await apiClient.delete(`/products/categories/${id}`);
  },
};