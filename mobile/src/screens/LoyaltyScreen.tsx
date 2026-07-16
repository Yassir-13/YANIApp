import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { useAuthStore } from '../stores/authStore';
import { loyaltyApi, LoyaltyAccount, LoyaltyTransaction, Reward } from '../api/loyalty';
import { formatShortDate } from '../utils/format';
import { useAlert } from '../components/AlertProvider';
import Button from '../components/Button';
import ErrorView from '../components/ErrorView';
import Drop from '../components/Drop';

export default function LoyaltyScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { alert, show } = useAlert();
  const user = useAuthStore((s) => s.user);

  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [history, setHistory] = useState<LoyaltyTransaction[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [acc, hist, rwd] = await Promise.all([
        loyaltyApi.getMyAccount(),
        loyaltyApi.getMyHistory(),
        loyaltyApi.getRewards(),
      ]);
      setAccount(acc);
      setHistory(hist);
      setRewards(rwd);
    } catch {
      setError('Impossible de charger votre fidélité.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
    else setIsLoading(false);
  }, [user, load]);

  const balance = account?.pointsBalance ?? 0;

  // Prochaine récompense atteignable : la moins chère au-dessus du solde actuel.
  // Sert à afficher « Plus que X pts pour … » + la barre de progression (données réelles).
  const nextReward = useMemo(() => {
    const above = rewards
      .filter((r) => r.pointsCost > balance)
      .sort((a, b) => a.pointsCost - b.pointsCost);
    return above[0] ?? null;
  }, [rewards, balance]);

  const progress = nextReward ? Math.min(balance / nextReward.pointsCost, 1) : 1;
  const remaining = nextReward ? nextReward.pointsCost - balance : 0;

  const handleRedeem = (reward: Reward) => {
    show({
      title: 'Échanger',
      message: `Échanger « ${reward.name} » contre ${reward.pointsCost} points ?`,
      buttons: [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              await loyaltyApi.redeem(reward.id);
              alert('Succès', `« ${reward.name} » échangée !`);
              load();
            } catch (e: any) {
              alert('Erreur', e.response?.data?.message || 'Échange impossible.');
            }
          },
        },
      ],
    });
  };

  // ── États non nominaux ──────────────────────────────────────────────
  if (!user) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <Text style={[typography.display, { color: theme.text }]}>Fidélité</Text>
        <Text style={[typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: spacing.md }]}>
          Connectez-vous pour suivre vos points et profiter de vos récompenses.
        </Text>
        <Button label="Se connecter" onPress={() => navigation.navigate('Login')} style={{ marginTop: spacing.xl, alignSelf: 'stretch' }} />
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

  if (error) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background, paddingTop: insets.top + spacing.md }]}>
        <ErrorView message={error} onRetry={load} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[typography.display, { color: theme.text, marginBottom: spacing.lg }]}>Fidélité</Text>

      {/* Carte solde à halo */}
      <View style={[styles.balanceCard, { backgroundColor: theme.loyaltyBg }]}>
        <LinearGradient
          colors={[theme.loyaltyGlow, 'transparent']}
          start={{ x: 1, y: 0 }}
          end={{ x: 0.2, y: 1 }}
          style={styles.balanceGlow}
          pointerEvents="none"
        />
        <View style={styles.balanceTop}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.sectionLabel, { color: theme.goldLight, letterSpacing: 1.5 }]}>
              Votre solde
            </Text>
            <View style={styles.pointsRow}>
              <Text style={[typography.priceLg, { color: theme.goldLight, fontSize: 40 }]}>{balance}</Text>
              <Text style={[typography.body, { color: theme.loyaltyText, marginLeft: 6 }]}>points</Text>
            </View>
          </View>
          <Drop size={44} colors={[theme.goldLight, theme.gold, theme.goldDeep]} />
        </View>

        {nextReward && (
          <>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: theme.gold }]} />
            </View>
            <Text style={[typography.caption, { color: 'rgba(245,239,225,0.7)', marginTop: spacing.sm }]}>
              Plus que {remaining} pts pour « {nextReward.name} »
            </Text>
          </>
        )}
      </View>

      {/* Récompenses en grille 2 colonnes */}
      <Text style={[typography.headingSm, { color: theme.text, marginTop: spacing.xl, marginBottom: spacing.md }]}>
        Récompenses
      </Text>
      {rewards.length === 0 ? (
        <Text style={[typography.caption, { color: theme.textMuted }]}>Aucune récompense disponible.</Text>
      ) : (
        <View style={styles.grid}>
          {rewards.map((r) => {
            const affordable = balance >= r.pointsCost;
            return (
              <TouchableOpacity
                key={r.id}
                onPress={() => handleRedeem(r)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`${r.name}, ${r.pointsCost} points`}
                style={[styles.rewardCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={[styles.rewardIcon, { backgroundColor: theme.goldSoft }]}>
                  <Ionicons name="gift-outline" size={22} color={theme.gold} />
                </View>
                <Text numberOfLines={2} style={[typography.subtitle, { color: theme.text, marginTop: spacing.sm }]}>
                  {r.name}
                </Text>
                <Text style={[typography.caption, { color: affordable ? theme.gold : theme.textMuted, marginTop: 2 }]}>
                  {r.pointsCost} pts
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Historique */}
      <Text style={[typography.headingSm, { color: theme.text, marginTop: spacing.xl, marginBottom: spacing.md }]}>
        Historique
      </Text>
      {history.length === 0 ? (
        <Text style={[typography.caption, { color: theme.textMuted }]}>Aucune transaction.</Text>
      ) : (
        history.map((tx) => {
          const positive = tx.pointsDelta >= 0;
          return (
            <View key={tx.id} style={[styles.txRow, { borderBottomColor: theme.border }]}>
              <View
                style={[
                  styles.txIcon,
                  { backgroundColor: positive ? theme.badgeInStockBg : theme.badgeSoonBg },
                ]}
              >
                <Ionicons
                  name={positive ? 'add' : 'remove'}
                  size={18}
                  color={positive ? theme.success : theme.gold}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyMedium, { color: theme.text }]}>{labelForType(tx.type)}</Text>
                <Text style={[typography.small, { color: theme.textMuted }]}>{formatShortDate(tx.createdAt)}</Text>
              </View>
              <Text style={[typography.subtitle, { color: positive ? theme.success : theme.danger }]}>
                {positive ? '+' : ''}{tx.pointsDelta}
              </Text>
            </View>
          );
        })
      )}
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
  fill: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg },
  balanceCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(216,168,72,0.25)',
  },
  balanceGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  balanceTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: spacing.lg,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  rewardCard: {
    width: '47%',
    flexGrow: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  rewardIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});