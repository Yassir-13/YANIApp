import { apiClient } from './client';
import { Paginated, PAGE_MOBILE } from './pagination';

export interface Slot {
  time: string; // « 14:00 » — heure locale du centre, pour l'affichage
  startAt: string; // instant UTC exact (ISO 8601), à renvoyer tel quel à la réservation
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
  // Prix annoncé à la cliente au moment de la réservation. Il ne bouge plus,
  // même si le tarif de la prestation change ensuite. C'est ce montant qui
  // fait foi (facturation, points de fidélité) — jamais service.price.
  priceAtBooking: string | null;
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

  // Paginé côté serveur, du plus récent au plus ancien.
  //
  // 📌 Cet ordre est VOULU, ne pas le « corriger ». « Mes rendez-vous » est un
  // historique, et un historique se lit du plus récent au plus ancien — comme
  // « Mes commandes » juste à côté. L'ordre croissant d'avant mettait les plus
  // VIEUX rendez-vous en tête, ce qui ne se voyait pas sur une liste complète
  // mais remplissait la première page de passé une fois la liste paginée.
  // Décision prise le 2026-08-12, après que l'audit l'ait signalé (I18).
  async getMine(): Promise<Appointment[]> {
    const { data } = await apiClient.get<Paginated<Appointment>>(
      '/appointments',
      { params: { limit: PAGE_MOBILE } },
    );
    return data.data;
  },

  async cancel(id: string) {
    const { data } = await apiClient.patch(`/appointments/${id}/cancel`);
    return data;
  },
};