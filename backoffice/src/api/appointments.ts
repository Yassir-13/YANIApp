import { apiClient } from './client';

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export interface Appointment {
  id: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  service?: { id: string; name: string; durationMin: number; price: string };
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  };
}

export const appointmentsApi = {
  // En tant que STAFF/ADMIN, cette route renvoie TOUS les rendez-vous
  async getAll(): Promise<Appointment[]> {
    const { data } = await apiClient.get('/appointments');
    return data;
  },
  async updateStatus(id: string, status: AppointmentStatus): Promise<Appointment> {
    const { data } = await apiClient.patch(`/appointments/${id}/status`, { status });
    return data;
  },
};
