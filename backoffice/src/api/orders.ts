import { apiClient } from './client';
import type { Paginated, PageQuery, TabCounts } from './pagination';

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
  // Liste paginée PAR LE SERVEUR. Elle renvoyait auparavant toutes les
  // commandes depuis l'ouverture, que cette page découpait ensuite elle-même :
  // la pagination affichée était donc décorative (I4).
  //
  // `counts` porte sur l'ensemble des commandes et non sur la page : sans lui,
  // les onglets ne pourraient plus annoncer « À confirmer (7) ».
  async getAll(
    params: PageQuery & { status?: OrderStatus } = {},
  ): Promise<Paginated<Order> & { counts: TabCounts }> {
    const { status, page, limit } = params;
    const { data } = await apiClient.get('/orders', {
      params: {
        ...(status ? { status } : {}),
        ...(page ? { page } : {}),
        ...(limit ? { limit } : {}),
      },
    });
    return data;
  },
  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const { data } = await apiClient.patch(`/orders/${id}/status`, { status });
    return data;
  },
};
