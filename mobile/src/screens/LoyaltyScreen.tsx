import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { useAuthStore } from '../stores/authStore';
import { loyaltyApi, LoyaltyAccount, LoyaltyTransaction, Reward } from '../api/loyalty';

export default function LoyaltyScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [history, setHistory] = useState<LoyaltyTransaction[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [acc, hist, rwd] = await Promise.all([
        loyaltyApi.getMyAccount(),
        loyaltyApi.getMyHistory(),
        loyaltyApi.getRewards(),
      ]);
      setAccount(acc);
      setHistory(hist);
      setRewards(rwd);
    } catch {
      // silencieux pour l'instant
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
    else setIsLoading(false);
  }, [user, load]);

  const handleRedeem = (reward: Reward) => {
    Alert.alert(
      'Échanger',
      `Échanger « ${reward.name} » contre ${reward.pointsCost} points ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              await loyaltyApi.redeem(reward.id);
              Alert.alert('Succès', `« ${reward.name} » échangée !`);
              load(); // recharge le solde
            } catch (e: any) {
              Alert.alert('Erreur', e.response?.data?.message || 'Échange impossible.');
            }
          },
        },
      ],
    );
  };

  // Mode invité
  if (!user) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={[typography.heading, { color: theme.gold }]}>Fidélité</Text>
        <Text style={[typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: spacing.md, marginHorizontal: spacing.lg }]}>
          Connectez-vous pour suivre vos points et profiter de vos récompenses.
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.gold }]}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={[typography.subtitle, { color: '#1E1B16' }]}>Se connecter</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.gold} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
    >
      <Text style={[typography.heading, { color: theme.text, marginBottom: spacing.lg }]}>
        Fidélité
      </Text>

      {/* Bandeau solde */}
      <View style={[styles.balanceCard, { backgroundColor: theme.loyaltyBg }]}>
        <Text style={[typography.small, { color: theme.goldLight, letterSpacing: 1 }]}>
          VOTRE SOLDE
        </Text>
        <Text style={[styles.bigPoints, { color: theme.gold }]}>
          {account?.pointsBalance ?? 0}
        </Text>
        <Text style={[typography.caption, { color: theme.loyaltyText }]}>
          points · {account?.tier ?? 'NORMAL'} · {account?.visitCount ?? 0} visite(s)
        </Text>
      </View>

      {/* Récompenses */}
      <Text style={[typography.title, { color: theme.text, marginTop: spacing.xl, marginBottom: spacing.md }]}>
        Récompenses
      </Text>
      {rewards.length === 0 ? (
        <Text style={[typography.caption, { color: theme.textMuted }]}>
          Aucune récompense disponible.
        </Text>
      ) : (
        rewards.map((r) => (
          <TouchableOpacity
            key={r.id}
            style={[styles.rewardCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => handleRedeem(r)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[typography.subtitle, { color: theme.text }]}>{r.name}</Text>
              {r.description && (
                <Text style={[typography.caption, { color: theme.textSecondary }]}>{r.description}</Text>
              )}
            </View>
            <Text style={[typography.subtitle, { color: theme.gold }]}>{r.pointsCost} pts</Text>
          </TouchableOpacity>
        ))
      )}

      {/* Historique */}
      <Text style={[typography.title, { color: theme.text, marginTop: spacing.xl, marginBottom: spacing.md }]}>
        Historique
      </Text>
      {history.length === 0 ? (
        <Text style={[typography.caption, { color: theme.textMuted }]}>
          Aucune transaction.
        </Text>
      ) : (
        history.map((tx) => (
          <View key={tx.id} style={[styles.txRow, { borderBottomColor: theme.border }]}>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>
              {labelForType(tx.type)}
            </Text>
            <Text
              style={[
                typography.subtitle,
                { color: tx.pointsDelta >= 0 ? theme.success : theme.danger },
              ]}
            >
              {tx.pointsDelta >= 0 ? '+' : ''}{tx.pointsDelta}
            </Text>
          </View>
        ))
      )}

      {/* Déconnexion (temporaire) */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.danger, marginTop: spacing.xxl }]}
        onPress={logout}
      >
        <Text style={[typography.subtitle, { color: '#fff' }]}>Se déconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function labelForType(type: string): string {
  switch (type) {
    case 'EARN': return 'Points gagnés';
    case 'REDEEM': return 'Récompense échangée';
    case 'MANUAL': return 'Ajout manuel';
    case 'ADJUSTMENT': return 'Ajustement';
    default: return type;
  }
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  balanceCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  bigPoints: { fontSize: 44, fontWeight: '700', marginVertical: spacing.xs },
  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
});