import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { useAuthStore } from '../stores/authStore';
import {
  loyaltyApi,
  LoyaltyAccount,
  LoyaltyTransaction,
  Reward,
  Milestone,
  MilestoneGrant,
  RewardVoucher,
} from '../api/loyalty';
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
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [grants, setGrants] = useState<MilestoneGrant[]>([]);
  const [vouchers, setVouchers] = useState<RewardVoucher[]>([]);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [acc, hist, rwd, mil, grt, vch] = await Promise.all([
        loyaltyApi.getMyAccount(),
        loyaltyApi.getMyHistory(),
        loyaltyApi.getRewards(),
        loyaltyApi.getMilestones(),
        loyaltyApi.getMyGrants(),
        loyaltyApi.getMyVouchers(),
      ]);
      setAccount(acc);
      setHistory(hist);
      setRewards(rwd);
      setMilestones(mil);
      setGrants(grt);
      setVouchers(vch);
    } catch {
      setError('Impossible de charger votre fidélité.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Recharge solde, historique et récompenses à chaque focus : les points
  // peuvent avoir changé côté institut pendant que l'app était ouverte.
  useFocusEffect(
    useCallback(() => {
      if (user) load();
      else setIsLoading(false);
    }, [user, load])
  );

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

  const visits = account?.visitCount ?? 0;

  // Prochain palier de visites à atteindre : le plus proche en nombre de
  // visites restantes. Un palier non récurrent déjà franchi est écarté.
  const nextMilestone = useMemo(() => {
    let best: { milestone: Milestone; remaining: number } | null = null;
    for (const m of milestones) {
      if (m.visitThreshold <= 0) continue;
      const cycle = Math.floor(visits / m.visitThreshold);
      if (!m.recurring && cycle >= 1) continue;
      const left = (cycle + 1) * m.visitThreshold - visits;
      if (!best || left < best.remaining) best = { milestone: m, remaining: left };
    }
    return best;
  }, [milestones, visits]);

  // Progression dans le cycle en cours (7 visites sur 10)
  const visitsInCycle = nextMilestone
    ? nextMilestone.milestone.visitThreshold - nextMilestone.remaining
    : 0;
  const visitProgress = nextMilestone
    ? visitsInCycle / nextMilestone.milestone.visitThreshold
    : 0;

  // Récompenses offertes en attente : mises en avant, elles ne coûtent rien.
  const unclaimed = useMemo(() => grants.filter((g) => !g.claimedAt), [grants]);

  // Ce que l'institut lui doit encore. Réclamer ne fait plus disparaître une
  // récompense : elle devient un bon, qui reste visible ici et au comptoir.
  const aPresenter = useMemo(
    () => vouchers.filter((v) => !v.honoredAt).length,
    [vouchers]
  );

  // Après une réclamation ou un échange, la cliente doit pouvoir aller voir
  // son code tout de suite — c'est ce qu'elle présentera à l'institut.
  const annonceBon = (titre: string, message: string) => {
    show({
      title: titre,
      message,
      buttons: [
        { text: 'Plus tard', style: 'cancel' },
        { text: 'Voir mon bon', onPress: () => navigation.navigate('MyRewards') },
      ],
    });
  };

  const handleClaim = (grant: MilestoneGrant) => {
    show({
      title: 'Récompense offerte',
      message: `Réclamer « ${grant.reward.name} » ? Présentez-la ensuite à l'institut.`,
      buttons: [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réclamer',
          onPress: async () => {
            setClaimingId(grant.id);
            try {
              const res = await loyaltyApi.claimGrant(grant.id);
              await load();
              annonceBon(
                'Récompense réclamée',
                `Votre code : ${res.voucher.code}. Présentez-le à l'institut.`
              );
            } catch (e: any) {
              alert('Erreur', e.response?.data?.message || 'Réclamation impossible.');
            } finally {
              setClaimingId(null);
            }
          },
        },
      ],
    });
  };

  const handleRedeem = (reward: Reward) => {
    show({
      title: 'Échanger',
      message: `Échanger « ${reward.name} » contre ${reward.pointsCost} points ?`,
      buttons: [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            // Verrou pendant la requête : sans lui, rien n'empêchait de
            // confirmer deux fois. Le serveur refuse bien le second débit,
            // mais autant ne pas le lui envoyer.
            setRedeemingId(reward.id);
            try {
              const res = await loyaltyApi.redeem(reward.id);
              await load();
              annonceBon(
                'Récompense échangée',
                `Votre code : ${res.voucher.code}. Présentez-le à l'institut.`
              );
            } catch (e: any) {
              alert('Erreur', e.response?.data?.message || 'Échange impossible.');
            } finally {
              setRedeemingId(null);
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

        {/* Carte de visites : la récompense s'obtient sans dépenser de points */}
        {nextMilestone && (
          <View style={styles.visitBlock}>
            <View style={styles.visitHeader}>
              <Text style={[typography.sectionLabel, { color: theme.goldLight, letterSpacing: 1.5 }]}>
                Vos visites
              </Text>
              <Text style={[typography.caption, { color: theme.loyaltyText }]}>
                {visitsInCycle} / {nextMilestone.milestone.visitThreshold}
              </Text>
            </View>

            {/* Une pastille par visite du cycle en cours */}
            <View style={styles.stampRow}>
              {Array.from({ length: nextMilestone.milestone.visitThreshold }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.stamp,
                    {
                      backgroundColor: i < visitsInCycle ? theme.gold : 'transparent',
                      borderColor: i < visitsInCycle ? theme.gold : 'rgba(245,239,225,0.25)',
                    },
                  ]}
                />
              ))}
            </View>

            <Text style={[typography.caption, { color: 'rgba(245,239,225,0.7)', marginTop: spacing.sm }]}>
              {nextMilestone.remaining === 1
                ? `Encore 1 visite et « ${nextMilestone.milestone.reward.name} » vous est offert`
                : `Encore ${nextMilestone.remaining} visites pour « ${nextMilestone.milestone.reward.name} » offert`}
            </Text>
          </View>
        )}
      </View>

      {/* Accès aux bons. Toujours visible : la cliente doit savoir où les
          retrouver, même quand il n'y en a aucun en attente. */}
      <TouchableOpacity
        onPress={() => navigation.navigate('MyRewards')}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={
          aPresenter > 0
            ? `Mes récompenses, ${aPresenter} à présenter`
            : 'Mes récompenses'
        }
        style={[
          styles.vouchersRow,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={[styles.rewardIcon, { backgroundColor: theme.goldSoft }]}>
          <Ionicons name="ticket-outline" size={22} color={theme.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.subtitle, { color: theme.text }]}>
            Mes récompenses
          </Text>
          <Text style={[typography.small, { color: theme.textSecondary, marginTop: 2 }]}>
            {aPresenter === 0
              ? 'Vos récompenses obtenues et utilisées'
              : aPresenter === 1
                ? '1 récompense à présenter à l’institut'
                : `${aPresenter} récompenses à présenter à l’institut`}
          </Text>
        </View>
        {aPresenter > 0 && (
          <View style={[styles.badge, { backgroundColor: theme.gold }]}>
            <Text style={[typography.small, { color: theme.surface, fontWeight: '700' }]}>
              {aPresenter}
            </Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
      </TouchableOpacity>

      {/* Récompenses offertes débloquées, en attente de réclamation */}
      {unclaimed.length > 0 && (
        <>
          <Text style={[typography.headingSm, { color: theme.text, marginTop: spacing.xl, marginBottom: spacing.md }]}>
            Offert pour vous
          </Text>
          {unclaimed.map((g) => (
            <View
              key={g.id}
              style={[styles.grantCard, { backgroundColor: theme.goldSoft, borderColor: theme.gold }]}
            >
              <View style={[styles.rewardIcon, { backgroundColor: theme.surface }]}>
                <Ionicons name="ribbon-outline" size={22} color={theme.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.subtitle, { color: theme.text }]}>{g.reward.name}</Text>
                <Text style={[typography.small, { color: theme.textSecondary, marginTop: 2 }]}>
                  Débloqué à votre {g.cycle * g.milestone.visitThreshold}e visite
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleClaim(g)}
                disabled={claimingId === g.id}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Réclamer ${g.reward.name}`}
                style={[styles.claimBtn, { backgroundColor: theme.gold, opacity: claimingId === g.id ? 0.6 : 1 }]}
              >
                <Text style={[typography.subtitle, { color: theme.surface }]}>
                  {claimingId === g.id ? '…' : 'Réclamer'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

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
            const enCours = redeemingId === r.id;
            // Une carte qu'on ne peut pas payer ne doit pas être cliquable :
            // avant, `affordable` ne servait qu'à colorer le prix, la boîte de
            // dialogue proposait « Confirmer », et c'est le serveur qui
            // refusait. On annonçait un échange qu'on savait impossible.
            const disabled = !affordable || redeemingId !== null;
            return (
              <TouchableOpacity
                key={r.id}
                onPress={() => handleRedeem(r)}
                disabled={disabled}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ disabled }}
                accessibilityLabel={
                  affordable
                    ? `${r.name}, ${r.pointsCost} points`
                    : `${r.name}, ${r.pointsCost} points, il vous manque ${r.pointsCost - balance} points`
                }
                style={[
                  styles.rewardCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    opacity: affordable ? (enCours ? 0.6 : 1) : 0.55,
                  },
                ]}
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
                {!affordable && (
                  <Text style={[typography.small, { color: theme.textMuted, marginTop: 2 }]}>
                    Il vous manque {r.pointsCost - balance} pts
                  </Text>
                )}
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
          // Une récompense de palier ne bouge pas le solde : ni gain ni dépense.
          const offered = tx.type === 'MILESTONE';
          const positive = tx.pointsDelta >= 0;
          return (
            <View key={tx.id} style={[styles.txRow, { borderBottomColor: theme.border }]}>
              <View
                style={[
                  styles.txIcon,
                  { backgroundColor: offered || positive ? theme.badgeInStockBg : theme.badgeSoonBg },
                ]}
              >
                <Ionicons
                  name={offered ? 'ribbon-outline' : positive ? 'add' : 'remove'}
                  size={18}
                  color={offered ? theme.gold : positive ? theme.success : theme.gold}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyMedium, { color: theme.text }]}>{labelForType(tx.type)}</Text>
                {/* « Récompense échangée » sans dire laquelle ne servait à
                    rien des mois plus tard. Le nom vient du serveur. */}
                <Text style={[typography.small, { color: theme.textMuted }]}>
                  {tx.reward ? `${tx.reward.name} · ` : ''}
                  {formatShortDate(tx.createdAt)}
                </Text>
              </View>
              <Text
                style={[
                  typography.subtitle,
                  { color: offered ? theme.gold : positive ? theme.success : theme.danger },
                ]}
              >
                {offered ? 'Offert' : `${positive ? '+' : ''}${tx.pointsDelta}`}
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
    case 'MILESTONE': return 'Récompense offerte';
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
  visitBlock: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  visitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stampRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.sm,
  },
  stamp: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
  },
  grantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  vouchersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
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