import { apiClient } from './client';

export type LoyaltyTxType = 'EARN' | 'REDEEM' | 'MANUAL' | 'ADJUSTMENT' | 'MILESTONE';

export interface LoyaltyAccount {
  id: string;
  userId: string;
  pointsBalance: number;
  tier: string;
  visitCount: number;
  // Récompenses offertes non encore réclamées (fiche cliente au comptoir)
  grants?: MilestoneGrant[];
}

export interface Reward {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
  active: boolean;
}

// Palier de visites : au bout de N visites, une récompense du catalogue est
// offerte. `recurring` la rejoue à chaque multiple du seuil.
export interface Milestone {
  id: string;
  visitThreshold: number;
  rewardId: string;
  recurring: boolean;
  active: boolean;
  reward: Reward;
}

export interface MilestoneGrant {
  id: string;
  cycle: number;
  claimedAt: string | null;
  createdAt: string;
  reward: Reward;
}

// Bornes du seuil — miroir de create-milestone.dto.ts côté backend
export const MIN_VISIT_THRESHOLD = 2;
export const MAX_VISIT_THRESHOLD = 100;

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
  async updateReward(
    id: string,
    payload: { name?: string; description?: string; pointsCost?: number; active?: boolean },
  ): Promise<Reward> {
    const { data } = await apiClient.patch(`/loyalty/rewards/${id}`, payload);
    return data;
  },
  async deactivateReward(id: string): Promise<Reward> {
    const { data } = await apiClient.delete(`/loyalty/rewards/${id}`);
    return data;
  },

  // Paliers de visites (ADMIN)
  async getAllMilestones(): Promise<Milestone[]> {
    const { data } = await apiClient.get('/loyalty/milestones/all');
    return data;
  },
  async createMilestone(payload: {
    visitThreshold: number;
    rewardId: string;
    recurring?: boolean;
  }): Promise<Milestone> {
    const { data } = await apiClient.post('/loyalty/milestones', payload);
    return data;
  },
  async updateMilestone(
    id: string,
    payload: { visitThreshold?: number; rewardId?: string; recurring?: boolean; active?: boolean },
  ): Promise<Milestone> {
    const { data } = await apiClient.patch(`/loyalty/milestones/${id}`, payload);
    return data;
  },
  async deactivateMilestone(id: string): Promise<Milestone> {
    const { data } = await apiClient.delete(`/loyalty/milestones/${id}`);
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
