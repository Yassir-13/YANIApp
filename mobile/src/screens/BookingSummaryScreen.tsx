import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { servicesApi, Service } from '../api/services';
import { appointmentsApi } from '../api/appointments';
import Card from '../components/Card';
import Button from '../components/Button';

function buildStartAt(dateStr: string, time: string): string {
  const [h, m] = time.split(':').map(Number);
  const CASABLANCA_OFFSET_HOURS = 1;
  const utcHour = h - CASABLANCA_OFFSET_HOURS;
  const [year, month, day] = dateStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day, utcHour, m, 0));
  return utcDate.toISOString();
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function BookingSummaryScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { serviceId, date, time } = route.params;

  const [service, setService] = useState<Service | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    servicesApi.getOne(serviceId).then(setService).catch(() => {}).finally(() => setIsLoading(false));
  }, [serviceId]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const startAt = buildStartAt(date, time);
      await appointmentsApi.create(serviceId, startAt);
      // Va vers la confirmation (en remplaçant, pour ne pas revenir en arrière ici)
      navigation.replace('BookingConfirmation', {
        serviceName: service?.name,
        date,
        time,
      });
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.message || 'Réservation impossible.');
    } finally {
      setSubmitting(false);
    }
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
        <Ionicons name="chevron-back" size={26} color={theme.text} />
      </TouchableOpacity>

      <View style={{ flex: 1, padding: spacing.lg, paddingTop: spacing.xxl * 1.5 }}>
        <Text style={[typography.heading, { color: theme.text, marginBottom: spacing.lg }]}>
          Récapitulatif
        </Text>

        <Card>
          <Row label="Service" value={service?.name ?? '—'} theme={theme} />
          <Divider theme={theme} />
          <Row label="Date" value={formatDate(date)} theme={theme} />
          <Divider theme={theme} />
          <Row label="Heure" value={time} theme={theme} />
          <Divider theme={theme} />
          <Row label="Durée" value={`${service?.durationMin ?? '—'} min`} theme={theme} />
          <Divider theme={theme} />
          <Row label="Prix" value={`${service?.price ?? '—'} dh`} theme={theme} highlight />
        </Card>
      </View>

      <View style={[styles.bottomBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <Button
          label={submitting ? 'Confirmation...' : 'Confirmer la réservation'}
          onPress={handleConfirm}
          loading={submitting}
        />
      </View>
    </View>
  );
}

function Row({ label, value, theme, highlight }: any) {
  return (
    <View style={styles.row}>
      <Text style={[typography.caption, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[highlight ? typography.subtitle : typography.body, { color: highlight ? theme.gold : theme.text }]}>
        {value}
      </Text>
    </View>
  );
}

function Divider({ theme }: any) {
  return <View style={{ height: 1, backgroundColor: theme.border, marginVertical: spacing.xs }} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backButton: { position: 'absolute', top: spacing.xxl, left: spacing.md, zIndex: 10, padding: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  bottomBar: { padding: spacing.lg, borderTopWidth: 1 },
});