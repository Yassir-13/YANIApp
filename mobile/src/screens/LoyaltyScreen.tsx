import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { useAuthStore } from '../stores/authStore';
import { loyaltyApi, LoyaltyAccount, LoyaltyTransaction, Reward } from '../api/loyalty';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Button from '../components/Button';
import ErrorView from '../components/ErrorView';

export default function LoyaltyScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
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

  const handleRedeem = (reward: Reward) => {
    Alert.alert('Échanger', `Échanger « ${reward.name} » contre ${reward.pointsCost} points ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Confirmer',
        onPress: async () => {
          try {
            await loyaltyApi.redeem(reward.id);
            Alert.alert('Succès', `« ${reward.name} » échangée !`);
            load();
          } catch (e: any) {
            Alert.alert('Erreur', e.response?.data?.message || 'Échange impossible.');
          }
        },
      },
    ]);
  };

  if (!user) {
    return (
      <Screen>
        <View style={styles.guestCentered}>
          <Text style={[typography.heading, { color: theme.gold }]}>Fidélité</Text>
          <Text style={[typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: spacing.md }]}>
            Connectez-vous pour suivre vos points et profiter de vos récompenses.
          </Text>
          <Button label="Se connecter" onPress={() => navigation.navigate('Login')} style={{ marginTop: spacing.xl }} />
        </View>
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.guestCentered}>
          <ActivityIndicator size="large" color={theme.gold} />
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <ErrorView message={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={[typography.heading, { color: theme.text, marginBottom: spacing.lg }]}>Fidélité</Text>

      <View style={[styles.balanceCard, { backgroundColor: theme.loyaltyBg }]}>
        <Text style={[typography.small, { color: theme.goldLight, letterSpacing: 1 }]}>VOTRE SOLDE</Text>
        <Text style={[styles.bigPoints, { color: theme.gold }]}>{account?.pointsBalance ?? 0}</Text>
        <Text style={[typography.caption, { color: theme.loyaltyText }]}>
          points · {account?.tier ?? 'NORMAL'} · {account?.visitCount ?? 0} visite(s)
        </Text>
      </View>

      <Text style={[typography.title, { color: theme.text, marginTop: spacing.xl, marginBottom: spacing.md }]}>
        Récompenses
      </Text>
      {rewards.length === 0 ? (
        <Text style={[typography.caption, { color: theme.textMuted }]}>Aucune récompense disponible.</Text>
      ) : (
        rewards.map((r) => (
          <Card key={r.id} onPress={() => handleRedeem(r)}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.subtitle, { color: theme.text }]}>{r.name}</Text>
                {r.description && (
                  <Text style={[typography.caption, { color: theme.textSecondary }]}>{r.description}</Text>
                )}
              </View>
              <Text style={[typography.subtitle, { color: theme.gold }]}>{r.pointsCost} pts</Text>
            </View>
          </Card>
        ))
      )}

      <Text style={[typography.title, { color: theme.text, marginTop: spacing.xl, marginBottom: spacing.md }]}>
        Historique
      </Text>
      {history.length === 0 ? (
        <Text style={[typography.caption, { color: theme.textMuted }]}>Aucune transaction.</Text>
      ) : (
        history.map((tx) => (
          <View key={tx.id} style={[styles.txRow, { borderBottomColor: theme.border }]}>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>{labelForType(tx.type)}</Text>
            <Text style={[typography.subtitle, { color: tx.pointsDelta >= 0 ? theme.success : theme.danger }]}>
              {tx.pointsDelta >= 0 ? '+' : ''}{tx.pointsDelta}
            </Text>
          </View>
        ))
      )}
    </Screen>
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
  guestCentered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.md },
  balanceCard: { borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center' },
  bigPoints: { fontSize: 44, fontWeight: '700', marginVertical: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center' },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
});