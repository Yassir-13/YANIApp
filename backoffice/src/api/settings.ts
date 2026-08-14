import { apiClient } from './client';

// Réglages de réservation du centre. Ils vivaient jusqu'ici en constantes dans
// le code du moteur de créneaux : ajouter une cabine demandait un redéploiement.
export interface CenterSettings {
  id: number;
  capacity: number;
  slotIntervalMin: number;
  updatedAt: string;
}

// Miroir de ECARTS_AUTORISES côté backend. Une valeur libre n'aurait pas de
// sens au comptoir, et un écart minuscule ferait exploser la liste de créneaux.
export const ECARTS_AUTORISES = [15, 20, 30, 45, 60];

export const CAPACITE_MIN = 1;
export const CAPACITE_MAX = 20;

export const settingsApi = {
  async get(): Promise<CenterSettings> {
    const { data } = await apiClient.get('/settings');
    return data;
  },
  // ADMIN uniquement
  async update(payload: {
    capacity: number;
    slotIntervalMin: number;
  }): Promise<CenterSettings> {
    const { data } = await apiClient.put('/settings', payload);
    return data;
  },
};
