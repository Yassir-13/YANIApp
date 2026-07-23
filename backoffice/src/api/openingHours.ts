import { apiClient } from './client';

// Un jour d'ouverture. dayOfWeek : 0 = dimanche … 6 = samedi (heure locale du centre).
export interface OpeningDay {
  id: string;
  dayOfWeek: number;
  openTime: string; // "09:00"
  closeTime: string; // "19:00"
  isClosed: boolean;
  updatedAt: string;
}

// Charge utile du PUT — miroir de UpdateHoursDto côté backend.
export interface OpeningDayPayload {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed?: boolean;
}

export const openingHoursApi = {
  // Lecture publique (mais on l'utilise authentifié depuis le backoffice)
  async getAll(): Promise<OpeningDay[]> {
    const { data } = await apiClient.get('/opening-hours');
    return data;
  },
  // ADMIN : upsert d'un jour (le backend crée ou met à jour selon dayOfWeek)
  async setForDay(payload: OpeningDayPayload): Promise<OpeningDay> {
    const { data } = await apiClient.put('/opening-hours', payload);
    return data;
  },
};
