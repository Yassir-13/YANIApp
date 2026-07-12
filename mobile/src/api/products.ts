import { apiClient } from './client';

export interface ProductCategory {
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
  category?: ProductCategory;
}

export const productsApi = {
  async getAll(): Promise<Product[]> {
    const { data } = await apiClient.get('/products');
    return data;
  },
  async getOne(id: string): Promise<Product> {
    const { data } = await apiClient.get(`/products/${id}`);
    return data;
  },
  async getCategories(): Promise<ProductCategory[]> {
    const { data } = await apiClient.get('/products/categories');
    return data;
  },
};