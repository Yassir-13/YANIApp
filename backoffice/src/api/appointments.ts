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

// Un créneau proposé par le moteur de disponibilité.
// `time` sert à l'affichage (heure locale), `startAt` est l'instant UTC exact
// à renvoyer tel quel lors de la réservation — aucun calcul de fuseau côté client.
export interface Slot {
  time: string;
  startAt: string;
  available: boolean;
}

export interface Availability {
  date: string;
  closed: boolean;
  slots: Slot[];
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

  // Créneaux disponibles pour une prestation à une date (YYYY-MM-DD)
  async getAvailability(serviceId: string, date: string): Promise<Availability> {
    const { data } = await apiClient.get('/appointments/availability', {
      params: { serviceId, date },
    });
    return data;
  },

  // STAFF/ADMIN : réserver pour une cliente (ex. demande par téléphone)
  async createForClient(userId: string, serviceId: string, startAt: string): Promise<Appointment> {
    const { data } = await apiClient.post('/appointments/for-client', {
      userId,
      serviceId,
      startAt,
    });
    return data;
  },

  // STAFF/ADMIN : déplacer un rendez-vous à un nouveau créneau
  async reschedule(id: string, startAt: string): Promise<Appointment> {
    const { data } = await apiClient.patch(`/appointments/${id}/reschedule`, { startAt });
    return data;
  },
};
