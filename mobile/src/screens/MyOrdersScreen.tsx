import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '../i18n';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { ordersApi, Order, OrderStatus } from '../api/orders';
import { formatPrice } from '../utils/format';
import { useAlert } from '../components/AlertProvider';
import Header from '../components/Header';
import ErrorView from '../components/ErrorView';
import EmptyView from '../components/EmptyView';

// Hors composant, donc sans accès à `t` : renvoie la CLÉ de traduction.
// `key: null` pour un statut inconnu — l'écran affiche alors le code brut.
function statusInfo(status: OrderStatus, theme: any) {
  switch (status) {
    case 'PENDING': return { key: 'orders.statusPending' as const, color: theme.textSecondary };
    case 'CONFIRMED': return { key: 'orders.statusConfirmed' as const, color: theme.success };
    case 'READY': return { key: 'orders.statusReady' as const, color: theme.gold };
    case 'COMPLETED': return { key: 'orders.statusCompleted' as const, color: theme.gold };
    case 'CANCELLED': return { key: 'orders.statusCancelled' as const, color: theme.danger };
    default: return { key: null, color: theme.textSecondary };
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
}

const CANCELLABLE: OrderStatus[] = ['PENDING', 'CONFIRMED', 'READY'];

export default function MyOrdersScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { alert, show } = useAlert();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Un drapeau et non le message : un texte figé dans l'état resterait
  // dans l'ancienne langue après un changement de langue.
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      const data = await ordersApi.getMine();
      setOrders(data);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCancel = (order: Order) => {
    show({
      title: t('orders.cancelTitle'),
      message: t('orders.cancelMessage'),
      buttons: [
        { text: t('orders.no'), style: 'cancel' },
        {
          text: t('orders.cancelConfirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await ordersApi.cancel(order.id);
              load();
            } catch (e: any) {
              alert(t('common.error'), e.response?.data?.message || t('orders.cancelFailed'));
            }
          },
        },
      ],
    });
  };

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
        <Header title={t('orders.title')} onBack={() => navigation.goBack()} />
        <ErrorView message={t('orders.loadFailed')} onRetry={load} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title={t('orders.title')} onBack={() => navigation.goBack()} />

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.gold} />
        }
        ListEmptyComponent={<EmptyView message={t('orders.empty')} icon="bag-outline" />}
        renderItem={({ item }) => {
          const info = statusInfo(item.status, theme);
          const itemCount = item.items.reduce((n, i) => n + i.quantity, 0);
          const canCancel = CANCELLABLE.includes(item.status);
          return (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[typography.subtitle, { color: theme.text }]}>
                  {item.fulfillment === 'PICKUP' ? t('orders.pickup') : t('orders.delivery')} · {t('orders.itemCount', { count: itemCount })}
                </Text>
                <Text style={[typography.small, { color: info.color }]}>
                  {info.key ? t(info.key) : item.status}
                </Text>
              </View>

              <Text style={[typography.caption, { color: theme.textMuted, marginTop: 2 }]}>
                {formatDate(item.createdAt)}
              </Text>

              <View style={{ marginTop: spacing.sm }}>
                {item.items.slice(0, 3).map((it) => (
                  <Text key={it.id} numberOfLines={1} style={[typography.caption, { color: theme.textSecondary }]}>
                    {it.quantity}× {it.product?.name ?? t('products.fallbackName')}
                  </Text>
                ))}
                {item.items.length > 3 && (
                  <Text style={[typography.caption, { color: theme.textMuted }]}>
                    {t('orders.moreItems', { count: item.items.length - 3 })}
                  </Text>
                )}
              </View>

              <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
                <Text style={[typography.price, { color: theme.gold }]}>{formatPrice(item.total)}</Text>
                {canCancel && (
                  <TouchableOpacity
                    onPress={() => handleCancel(item)}
                    style={[styles.cancelBtn, { borderColor: theme.danger }]}
                  >
                    <Text style={[typography.caption, { color: theme.danger }]}>{t('orders.cancel')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});