import { apiClient } from './client';
import { Product } from './products';

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
  async getMine(): Promise<Order[]> {
    const { data } = await apiClient.get('/orders/me');
    return data;
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