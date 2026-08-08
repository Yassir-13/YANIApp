import { apiClient } from './client';

export interface LoyaltyAccount {
  id: string;
  userId: string;
  pointsBalance: number;
  tier: 'NORMAL' | 'BRONZE' | 'SILVER' | 'GOLD';
  visitCount: number;
}

export interface LoyaltyTransaction {
  id: string;
  pointsDelta: number;
  type: 'EARN' | 'REDEEM' | 'MANUAL' | 'ADJUSTMENT' | 'MILESTONE';
  createdAt: string;
  appointmentId: string | null;
  rewardId: string | null;
}

export interface Reward {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
  active: boolean;
}

// Palier de visites : au bout de N prestations à l'institut, une récompense
// est offerte. `recurring` la rejoue à chaque multiple du seuil.
export interface Milestone {
  id: string;
  visitThreshold: number;
  rewardId: string;
  recurring: boolean;
  active: boolean;
  reward: Reward;
}

// Récompense offerte débloquée, en attente de réclamation ou déjà réclamée.
export interface MilestoneGrant {
  id: string;
  cycle: number;
  claimedAt: string | null;
  createdAt: string;
  reward: Reward;
  milestone: { visitThreshold: number };
}

export const loyaltyApi = {
  async getMyAccount(): Promise<LoyaltyAccount> {
    const { data } = await apiClient.get('/loyalty/me');
    return data;
  },
  async getMyHistory(): Promise<LoyaltyTransaction[]> {
    const { data } = await apiClient.get('/loyalty/me/history');
    return data;
  },
  async getRewards(): Promise<Reward[]> {
    const { data } = await apiClient.get('/loyalty/rewards');
    return data;
  },
  async redeem(rewardId: string) {
    const { data } = await apiClient.post('/loyalty/redeem', { rewardId });
    return data;
  },

  // Paliers de visites en vigueur
  async getMilestones(): Promise<Milestone[]> {
    const { data } = await apiClient.get('/loyalty/milestones');
    return data;
  },
  // Récompenses offertes débloquées par la cliente
  async getMyGrants(): Promise<MilestoneGrant[]> {
    const { data } = await apiClient.get('/loyalty/me/grants');
    return data;
  },
  // Réclamer une récompense offerte (aucun point dépensé)
  async claimGrant(grantId: string) {
    const { data } = await apiClient.post(`/loyalty/grants/${grantId}/claim`);
    return data;
  },
};