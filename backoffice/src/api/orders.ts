import { apiClient } from './client';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'READY' | 'COMPLETED' | 'CANCELLED';
export type FulfillmentType = 'PICKUP' | 'DELIVERY';

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  product?: { id: string; name: string };
}

export interface OrderUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string;
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
  user?: OrderUser;
}

export const ordersApi = {
  async getAll(status?: OrderStatus): Promise<Order[]> {
    const { data } = await apiClient.get('/orders', { params: status ? { status } : {} });
    return data;
  },
  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const { data } = await apiClient.patch(`/orders/${id}/status`, { status });
    return data;
  },
};
