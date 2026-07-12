import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { appointmentsApi, Appointment } from '../api/appointments';

// Traduit et colore le statut
function statusInfo(status: string, theme: any) {
  switch (status) {
    case 'PENDING': return { label: 'En attente', color: theme.textSecondary };
    case 'CONFIRMED': return { label: 'Confirmé', color: theme.success };
    case 'COMPLETED': return { label: 'Terminé', color: theme.gold };
    case 'CANCELLED': return { label: 'Annulé', color: theme.danger };
    default: return { label: status, color: theme.textSecondary };
  }
}

// Formate la date/heure en heure locale marocaine (UTC+1)
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  // Affiche en heure locale du device ; pour le Maroc c'est correct la plupart de l'année
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
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await appointmentsApi.getMine();
      setAppointments(data);
    } catch {
      // silencieux
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCancel = (appt: Appointment) => {
    Alert.alert('Annuler le rendez-vous', 'Confirmez-vous l\'annulation ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui, annuler',
        style: 'destructive',
        onPress: async () => {
          try {
            await appointmentsApi.cancel(appt.id);
            load();
          } catch (e: any) {
            Alert.alert('Erreur', e.response?.data?.message || 'Annulation impossible.');
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.gold} />
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
        <Text style={[styles.backText, { color: theme.text }]}>‹ Retour</Text>
      </TouchableOpacity>

      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xxl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.gold} />
        }
        ListHeaderComponent={
          <Text style={[typography.heading, { color: theme.text, marginTop: spacing.lg, marginBottom: spacing.lg }]}>
            Mes rendez-vous
          </Text>
        }
        ListEmptyComponent={
          <Text style={[typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: spacing.xl }]}>
            Vous n'avez aucun rendez-vous.
          </Text>
        }
        renderItem={({ item }) => {
          const info = statusInfo(item.status, theme);
          const canCancel = item.status === 'PENDING' || item.status === 'CONFIRMED';
          return (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[typography.subtitle, { color: theme.text }]}>
                  {item.service?.name ?? 'Service'}
                </Text>
                <Text style={[typography.small, { color: info.color, fontWeight: '600' }]}>
                  {info.label}
                </Text>
              </View>
              <Text style={[typography.caption, { color: theme.textSecondary, marginTop: spacing.xs }]}>
                {formatDateTime(item.startAt)}
              </Text>
              {canCancel && (
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: theme.danger }]}
                  onPress={() => handleCancel(item)}
                >
                  <Text style={[typography.caption, { color: theme.danger }]}>Annuler</Text>
                </TouchableOpacity>
              )}
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
  backButton: { position: 'absolute', top: spacing.xxl, left: spacing.md, zIndex: 10, padding: spacing.sm },
  backText: { fontSize: 17, fontWeight: '500' },
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
  cancelBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.md,
  },
});