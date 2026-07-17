import { apiClient } from './client';

export type LoyaltyTxType = 'EARN' | 'REDEEM' | 'MANUAL' | 'ADJUSTMENT';

export interface LoyaltyAccount {
  id: string;
  userId: string;
  pointsBalance: number;
  tier: string;
  visitCount: number;
}

export interface Reward {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
  active: boolean;
}

export interface AuditPerson {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role?: string;
}

export interface ManualTransaction {
  id: string;
  pointsDelta: number;
  type: LoyaltyTxType;
  reason: string | null;
  createdAt: string;
  owner?: AuditPerson;      // client crédité
  createdBy?: AuditPerson;  // membre du personnel à l'origine
}

// Plafond par opération manuelle — miroir de MANUAL_POINTS_CAP côté backend
export const MANUAL_POINTS_CAP = 100;

export const loyaltyApi = {
  // Récompenses (ADMIN)
  async getAllRewards(): Promise<Reward[]> {
    const { data } = await apiClient.get('/loyalty/rewards/all');
    return data;
  },
  async createReward(payload: { name: string; description?: string; pointsCost: number }): Promise<Reward> {
    const { data } = await apiClient.post('/loyalty/rewards', payload);
    return data;
  },
  async deactivateReward(id: string): Promise<Reward> {
    const { data } = await apiClient.delete(`/loyalty/rewards/${id}`);
    return data;
  },

  // Comptes clients (STAFF/ADMIN)
  async getClientAccount(userId: string): Promise<LoyaltyAccount> {
    const { data } = await apiClient.get(`/loyalty/accounts/${userId}`);
    return data;
  },
  async addManualPoints(payload: { userId: string; points: number; reason?: string }) {
    const { data } = await apiClient.post('/loyalty/manual', payload);
    return data;
  },

  // Audit (ADMIN)
  async auditManual(): Promise<ManualTransaction[]> {
    const { data } = await apiClient.get('/loyalty/audit/manual');
    return data;
  },
};
