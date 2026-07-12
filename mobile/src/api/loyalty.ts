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
  type: 'EARN' | 'REDEEM' | 'MANUAL' | 'ADJUSTMENT';
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
};