import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { intlLocale, mirroredIcon } from '../i18n';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { appointmentsApi, Appointment } from '../api/appointments';
import { formatPrice } from '../utils/format';
import { useAlert } from '../components/AlertProvider';
import Card from '../components/Card';
import ErrorView from '../components/ErrorView';
import EmptyView from '../components/EmptyView';

// Hors composant, donc sans accès à `t` : renvoie la CLÉ de traduction.
function statusInfo(status: string, theme: any) {
  switch (status) {
    case 'PENDING': return { key: 'appointments.statusPending' as const, color: theme.textSecondary };
    case 'CONFIRMED': return { key: 'appointments.statusConfirmed' as const, color: theme.success };
    case 'COMPLETED': return { key: 'appointments.statusCompleted' as const, color: theme.gold };
    case 'CANCELLED': return { key: 'appointments.statusCancelled' as const, color: theme.danger };
    default: return { key: null, color: theme.textSecondary };
  }
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(intlLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MyAppointmentsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { alert, show } = useAlert();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Un drapeau et non le message : un texte figé dans l'état resterait
  // dans l'ancienne langue après un changement de langue.
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      const data = await appointmentsApi.getMine();
      setAppointments(data);
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

  const handleCancel = (appt: Appointment) => {
    show({
      title: t('appointments.cancelTitle'),
      message: t('appointments.cancelMessage'),
      buttons: [
        { text: t('orders.no'), style: 'cancel' },
        {
          text: t('orders.cancelConfirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await appointmentsApi.cancel(appt.id);
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name={mirroredIcon('chevron-back')} size={26} color={theme.text} />
        </TouchableOpacity>
        <ErrorView message={t('appointments.loadFailed')} onRetry={load} />
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
        <Ionicons name={mirroredIcon('chevron-back')} size={26} color={theme.text} />
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
            {t('appointments.title')}
          </Text>
        }
        ListEmptyComponent={
          <EmptyView message={t('appointments.empty')} icon="calendar-outline" />
        }
        renderItem={({ item }) => {
          const info = statusInfo(item.status, theme);
          const canCancel = item.status === 'PENDING' || item.status === 'CONFIRMED';
          return (
            <Card>
              <View style={styles.cardHeader}>
                <Text style={[typography.subtitle, { color: theme.text }]}>
                  {item.service?.name ?? t('services.fallbackName')}
                </Text>
                <Text style={[typography.small, { color: info.color, fontWeight: '600' }]}>
                  {info.key ? t(info.key) : item.status}
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
                  <Text style={[typography.caption, { color: theme.danger }]}>{t('orders.cancel')}</Text>
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