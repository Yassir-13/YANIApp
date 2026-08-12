import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { appointmentsApi, Appointment } from '../api/appointments';
import { formatPrice } from '../utils/format';
import { useAlert } from '../components/AlertProvider';
import Card from '../components/Card';
import ErrorView from '../components/ErrorView';
import EmptyView from '../components/EmptyView';

function statusInfo(status: string, theme: any) {
  switch (status) {
    case 'PENDING': return { label: 'En attente', color: theme.textSecondary };
    case 'CONFIRMED': return { label: 'Confirmé', color: theme.success };
    case 'COMPLETED': return { label: 'Terminé', color: theme.gold };
    case 'CANCELLED': return { label: 'Annulé', color: theme.danger };
    default: return { label: status, color: theme.textSecondary };
  }
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MyAppointmentsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { alert, show } = useAlert();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await appointmentsApi.getMine();
      setAppointments(data);
    } catch {
      setError('Impossible de charger vos rendez-vous.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCancel = (appt: Appointment) => {
    show({
      title: 'Annuler le rendez-vous',
      message: "Confirmez-vous l'annulation ?",
      buttons: [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            try {
              await appointmentsApi.cancel(appt.id);
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </TouchableOpacity>
        <ErrorView message={error} onRetry={load} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="chevron-back" size={26} color={theme.text} />
      </TouchableOpacity>

      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xxl * 1.5, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.gold} />
        }
        ListHeaderComponent={
          <Text style={[typography.heading, { color: theme.text, marginBottom: spacing.lg }]}>
            Mes rendez-vous
          </Text>
        }
        ListEmptyComponent={
          <EmptyView message="Vous n'avez aucun rendez-vous." icon="calendar-outline" />
        }
        renderItem={({ item }) => {
          const info = statusInfo(item.status, theme);
          const canCancel = item.status === 'PENDING' || item.status === 'CONFIRMED';
          return (
            <Card>
              <View style={styles.cardHeader}>
                <Text style={[typography.subtitle, { color: theme.text }]}>
                  {item.service?.name ?? 'Service'}
                </Text>
                <Text style={[typography.small, { color: info.color, fontWeight: '600' }]}>
                  {info.label}
                </Text>
              </View>
              <View style={styles.cardMeta}>
                <Text style={[typography.caption, { color: theme.textSecondary }]}>
                  {formatDateTime(item.startAt)}
                </Text>
                {/* Le prix FIGÉ à la réservation, et non le tarif du jour :
                    c'est celui qui sera facturé même si le catalogue a changé
                    depuis. Il arrivait déjà dans la réponse de l'API et
                    n'était affiché nulle part. */}
                {item.priceAtBooking != null && (
                  <Text style={[typography.caption, { color: theme.gold }]}>
                    {formatPrice(item.priceAtBooking)}
                  </Text>
                )}
              </View>
              {canCancel && (
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: theme.danger }]}
                  onPress={() => handleCancel(item)}
                >
                  <Text style={[typography.caption, { color: theme.danger }]}>Annuler</Text>
                </TouchableOpacity>
              )}
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backButton: { position: 'absolute', top: spacing.xxl, left: spacing.md, zIndex: 10, padding: spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  cancelBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.md,
  },
});