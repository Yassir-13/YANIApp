import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator,ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '../i18n';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { servicesApi, Service } from '../api/services';
import { appointmentsApi } from '../api/appointments';
import { formatPrice } from '../utils/format';
import Header from '../components/Header';
import Button from '../components/Button';
import ServiceMiniCard from '../components/ServiceMiniCard';
import { useAlert } from '../components/AlertProvider';

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  const s = d.toLocaleDateString(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function BookingSummaryScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { alert } = useAlert();
  // startAt : instant UTC fourni par le serveur (voir BookingScreen).
  const { serviceId, date, time, startAt } = route.params;

  const [service, setService] = useState<Service | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    servicesApi.getOne(serviceId).then(setService).catch(() => {}).finally(() => setIsLoading(false));
  }, [serviceId]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await appointmentsApi.create(serviceId, startAt);
      navigation.replace('BookingConfirmation', { serviceName: service?.name, date, time });
    } catch (e: any) {
      alert(t('common.error'), e.response?.data?.message || t('booking.bookingFailed'));
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
      <Header title={t('booking.summaryTitle')} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {service && (
          <View style={{ marginBottom: spacing.lg }}>
            <ServiceMiniCard service={service} subtitle={t('booking.brandSubtitle')} />
          </View>
        )}

        {/* Détails */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Row label={t('booking.date')} value={formatDate(date)} theme={theme} />
          <Divider theme={theme} />
          <Row label={t('booking.time')} value={time} theme={theme} />
        </View>
      </ScrollView>

      {/* Barre : total + confirmation */}
      <View
        style={[
          styles.bottomBar,
          { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: insets.bottom + spacing.md },
        ]}
      >
        <View style={styles.totalRow}>
          <Text style={[typography.body, { color: theme.textSecondary }]}>{t('booking.totalOnSite')}</Text>
          <Text style={[typography.priceLg, { color: theme.gold }]}>
            {service ? formatPrice(service.price) : '—'}
          </Text>
        </View>
        <Button
          label={submitting ? t('booking.confirming') : t('booking.confirmBooking')}
          onPress={handleConfirm}
          loading={submitting}
        />
      </View>
    </View>
  );
}

function Row({ label, value, theme }: any) {
  return (
    <View style={styles.row}>
      <Text style={[typography.body, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[typography.subtitle, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function Divider({ theme }: any) {
  return <View style={{ height: 1, backgroundColor: theme.border }} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
});