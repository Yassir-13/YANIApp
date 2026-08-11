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
  // Nom de la récompense concernée, joint par le serveur. Il ne vient PAS du
  // catalogue chargé par l'app : celui-ci ne contient que les récompenses
  // actives, donc une récompense retirée depuis laisserait un blanc.
  reward: { name: string } | null;
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

// Ce que l'institut doit à la cliente : une récompense offerte qu'elle a
// réclamée, ou une récompense qu'elle a payée avec ses points. `honoredAt`
// est la seule source de vérité de « reste à honorer » — l'app et le comptoir
// lisent le même champ, ce qui n'était pas le cas avant.
export interface RewardVoucher {
  id: string;
  code: string;
  source: 'MILESTONE' | 'REDEEM';
  pointsSpent: number;
  createdAt: string;
  honoredAt: string | null;
  reward: Reward;
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

  // Les bons de la cliente : à présenter d'abord, déjà utilisés ensuite.
  async getMyVouchers(): Promise<RewardVoucher[]> {
    const { data } = await apiClient.get('/loyalty/me/vouchers');
    return data;
  },
};