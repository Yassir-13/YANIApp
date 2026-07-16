import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { ordersApi, Order, OrderStatus } from '../api/orders';
import { formatPrice } from '../utils/format';
import { useAlert } from '../components/AlertProvider';
import Header from '../components/Header';
import ErrorView from '../components/ErrorView';
import EmptyView from '../components/EmptyView';

function statusInfo(status: OrderStatus, theme: any) {
  switch (status) {
    case 'PENDING': return { label: 'En attente', color: theme.textSecondary };
    case 'CONFIRMED': return { label: 'Confirmée', color: theme.success };
    case 'READY': return { label: 'Prête', color: theme.gold };
    case 'COMPLETED': return { label: 'Terminée', color: theme.gold };
    case 'CANCELLED': return { label: 'Annulée', color: theme.danger };
    default: return { label: status, color: theme.textSecondary };
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

const CANCELLABLE: OrderStatus[] = ['PENDING', 'CONFIRMED', 'READY'];

export default function MyOrdersScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { alert, show } = useAlert();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await ordersApi.getMine();
      setOrders(data);
    } catch {
      setError('Impossible de charger vos commandes.');
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
      title: 'Annuler la commande',
      message: "Confirmez-vous l'annulation de cette commande ?",
      buttons: [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            try {
              await ordersApi.cancel(order.id);
              load();
            } catch (e: any) {
              alert('Erreur', e.response?.data?.message || 'Annulation impossible.');
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
        <Header title="Mes commandes" onBack={() => navigation.goBack()} />
        <ErrorView message={error} onRetry={load} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Mes commandes" onBack={() => navigation.goBack()} />

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.gold} />
        }
        ListEmptyComponent={<EmptyView message="Vous n'avez aucune commande." icon="bag-outline" />}
        renderItem={({ item }) => {
          const info = statusInfo(item.status, theme);
          const itemCount = item.items.reduce((n, i) => n + i.quantity, 0);
          const canCancel = CANCELLABLE.includes(item.status);
          return (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[typography.subtitle, { color: theme.text }]}>
                  {item.fulfillment === 'PICKUP' ? 'Retrait' : 'Livraison'} · {itemCount} article{itemCount > 1 ? 's' : ''}
                </Text>
                <Text style={[typography.small, { color: info.color }]}>{info.label}</Text>
              </View>

              <Text style={[typography.caption, { color: theme.textMuted, marginTop: 2 }]}>
                {formatDate(item.createdAt)}
              </Text>

              <View style={{ marginTop: spacing.sm }}>
                {item.items.slice(0, 3).map((it) => (
                  <Text key={it.id} numberOfLines={1} style={[typography.caption, { color: theme.textSecondary }]}>
                    {it.quantity}× {it.product?.name ?? 'Produit'}
                  </Text>
                ))}
                {item.items.length > 3 && (
                  <Text style={[typography.caption, { color: theme.textMuted }]}>
                    +{item.items.length - 3} autre(s)
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
                    <Text style={[typography.caption, { color: theme.danger }]}>Annuler</Text>
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