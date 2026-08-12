import { apiClient } from './client';
import { Product } from './products';
import { Paginated, PAGE_MOBILE } from './pagination';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'READY' | 'COMPLETED' | 'CANCELLED';
export type FulfillmentType = 'PICKUP' | 'DELIVERY';

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  product?: Product;
}

export interface Order {
  id: string;
  status: OrderStatus;
  fulfillment: FulfillmentType;
  address: string | null;
  total: string;
  note: string | null;
  createdAt: string;
  items: OrderItem[];
}

export interface CreateOrderPayload {
  items: { productId: string; quantity: number }[];
  fulfillment: FulfillmentType;
  address?: string;
  note?: string;
}

export const ordersApi = {
  async create(payload: CreateOrderPayload): Promise<Order> {
    const { data } = await apiClient.post('/orders', payload);
    return data;
  },
  // Paginé côté serveur, du plus récent au plus ancien : la première page
  // contient les commandes qu'une cliente vient consulter.
  async getMine(): Promise<Order[]> {
    const { data } = await apiClient.get<Paginated<Order>>('/orders/me', {
      params: { limit: PAGE_MOBILE },
    });
    return data.data;
  },
  async getOne(id: string): Promise<Order> {
    const { data } = await apiClient.get(`/orders/me/${id}`);
    return data;
  },
  async cancel(id: string): Promise<Order> {
    const { data } = await apiClient.patch(`/orders/me/${id}/cancel`);
    return data;
  },
};