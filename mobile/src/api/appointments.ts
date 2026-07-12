import { apiClient } from './client';

export interface Slot {
  time: string;
  available: boolean;
}

export interface Availability {
  date: string;
  closed: boolean;
  slots: Slot[];
}

export interface Appointment {
  id: string;
  serviceId: string;
  startAt: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  service?: {
    id: string;
    name: string;
    durationMin: number;
    price: string;
  };
}

export const appointmentsApi = {
  async getAvailability(serviceId: string, date: string): Promise<Availability> {
    const { data } = await apiClient.get('/appointments/availability', {
      params: { serviceId, date },
    });
    return data;
  },

  async create(serviceId: string, startAt: string) {
    const { data } = await apiClient.post('/appointments', { serviceId, startAt });
    return data;
  },

  async getMine(): Promise<Appointment[]> {
    const { data } = await apiClient.get('/appointments');
    return data;
  },

  async cancel(id: string) {
    const { data } = await apiClient.patch(`/appointments/${id}/cancel`);
    return data;
  },
};