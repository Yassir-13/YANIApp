import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { loyaltyApi, RewardVoucher } from '../api/loyalty';
import { formatShortDate } from '../utils/format';
import Header from '../components/Header';
import ErrorView from '../components/ErrorView';
import EmptyView from '../components/EmptyView';

// L'écran qu'on ouvre debout devant le comptoir. Il ne charge QUE les bons :
// séparé de l'écran Fidélité, une panne côté catalogue ou historique ne peut
// plus effacer ce que la cliente est venue montrer.

export default function MyRewardsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [vouchers, setVouchers] = useState<RewardVoucher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setVouchers(await loyaltyApi.getMyVouchers());
    } catch {
      setError('Impossible de charger vos récompenses.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Rechargement au focus : l'institut vient peut-être de remettre la
  // récompense pendant que l'écran était ouvert en arrière-plan.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const aPresenter = vouchers.filter((v) => !v.honoredAt).length;

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.gold} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Header title="Mes récompenses" onBack={() => navigation.goBack()} />
        <ErrorView message={error} onRetry={load} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Mes récompenses" onBack={() => navigation.goBack()} />

      <FlatList
        data={vouchers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={theme.gold}
          />
        }
        ListHeaderComponent={
          aPresenter > 0 ? (
            <Text
              style={[
                typography.caption,
                { color: theme.textSecondary, marginBottom: spacing.md },
              ]}
            >
              Présentez le code à l'institut lors de votre prochaine visite.
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <EmptyView
            message="Vous n'avez aucune récompense pour le moment."
            icon="gift-outline"
          />
        }
        renderItem={({ item }) => <VoucherCard voucher={item} />}
      />
    </View>
  );
}

function VoucherCard({ voucher }: { voucher: RewardVoucher }) {
  const { theme } = useTheme();
  const utilise = !!voucher.honoredAt;

  // Ce qui a permis d'obtenir la récompense : offerte par les visites, ou
  // payée en points. La cliente doit pouvoir le relire des mois plus tard.
  const origine =
    voucher.source === 'MILESTONE'
      ? 'Offerte pour vos visites'
      : `Échangée contre ${voucher.pointsSpent} points`;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: utilise ? theme.surface : theme.goldSoft,
          borderColor: utilise ? theme.border : theme.gold,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.icon, { backgroundColor: theme.surface }]}>
          <Ionicons
            name={utilise ? 'checkmark-circle-outline' : 'gift-outline'}
            size={22}
            color={utilise ? theme.textMuted : theme.gold}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.subtitle, { color: theme.text }]}>
            {voucher.reward.name}
          </Text>
          <Text
            style={[typography.small, { color: theme.textSecondary, marginTop: 2 }]}
          >
            {origine}
          </Text>
        </View>
      </View>

      {utilise ? (
        <Text
          style={[
            typography.caption,
            { color: theme.textMuted, marginTop: spacing.md },
          ]}
        >
          Utilisée le {formatShortDate(voucher.honoredAt!)}
        </Text>
      ) : (
        <View style={[styles.codeBox, { borderColor: theme.gold }]}>
          <Text style={[typography.caption, { color: theme.textSecondary }]}>
            À présenter
          </Text>
          {/* Espacé et sélectionnable : il se lit à voix haute au comptoir. */}
          <Text
            selectable
            accessibilityLabel={`Code ${voucher.code.split('').join(' ')}`}
            style={[styles.code, { color: theme.gold }]}
          >
            {voucher.code}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBox: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  code: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 6,
    marginTop: 4,
  },
});
