import { apiClient } from './client';

// Une PLAGE d'ouverture. Un même jour en porte autant que nécessaire
// (9h-13h puis 14h-18h). dayOfWeek : 0 = dimanche … 6 = samedi, heure locale
// du centre. Un jour absent de la liste est fermé.
export interface OpeningRange {
  id: string;
  dayOfWeek: number;
  startTime: string; // "09:00"
  endTime: string; // "13:00"
}

export interface RangePayload {
  startTime: string;
  endTime: string;
}

// Fermeture exceptionnelle : congés, jour férié. Elle prime sur les horaires
// hebdomadaires. Les deux bornes sont incluses.
export interface Closure {
  id: string;
  startDate: string; // "2026-08-20"
  endDate: string;
  reason: string | null;
  createdAt: string;
}

export const openingHoursApi = {
  // Lecture publique (mais on l'utilise authentifié depuis le backoffice)
  async getAll(): Promise<OpeningRange[]> {
    const { data } = await apiClient.get('/opening-hours');
    return data;
  },

  // ADMIN : redéfinit ENTIÈREMENT les plages d'un jour. Une liste vide ferme
  // le jour — c'est ce qui a remplacé l'ancienne case « Fermé ».
  async setForDay(dayOfWeek: number, ranges: RangePayload[]): Promise<OpeningRange[]> {
    const { data } = await apiClient.put('/opening-hours', { dayOfWeek, ranges });
    return data;
  },

  async getClosures(): Promise<Closure[]> {
    const { data } = await apiClient.get('/opening-hours/closures');
    return data;
  },
  async createClosure(payload: {
    startDate: string;
    endDate: string;
    reason?: string;
  }): Promise<Closure> {
    const { data } = await apiClient.post('/opening-hours/closures', payload);
    return data;
  },
  async deleteClosure(id: string): Promise<void> {
    await apiClient.delete(`/opening-hours/closures/${id}`);
  },
};
