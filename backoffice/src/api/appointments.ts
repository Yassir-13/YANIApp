import { apiClient } from './client';
import type { Paginated, PageQuery, TabCounts } from './pagination';

// Les onglets de la page Rendez-vous, miroir de l'énumération du backend.
export type AppointmentFilter =
  | AppointmentStatus
  | 'ALL'
  | 'TODAY'
  | 'UPCOMING';

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export interface Appointment {
  id: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  // Prix figé au moment de la réservation : c'est CE montant qui a été annoncé
  // à la cliente, et donc celui à lui facturer — même si le tarif de la
  // prestation a changé depuis. Null pour les RDV antérieurs à ce champ.
  priceAtBooking: string | null;
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
  // Liste paginée PAR LE SERVEUR, filtre compris.
  //
  // Le filtre ne peut plus être appliqué ici : sur une liste paginée, il ne
  // porterait que sur la page affichée — « À confirmer » ne montrerait que les
  // rendez-vous à confirmer PARMI les vingt derniers. Même raison pour
  // `counts`, qui porte sur l'ensemble.
  //
  // Effet de bord bienvenu : « Aujourd'hui » est désormais le jour du CENTRE,
  // calculé par le serveur, et non celui du navigateur qui consulte.
  async getAll(
    params: PageQuery & { filter?: AppointmentFilter } = {},
  ): Promise<Paginated<Appointment> & { counts: TabCounts }> {
    const { filter, page, limit } = params;
    const { data } = await apiClient.get('/appointments', {
      params: {
        ...(filter ? { filter } : {}),
        ...(page ? { page } : {}),
        ...(limit ? { limit } : {}),
      },
    });
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
