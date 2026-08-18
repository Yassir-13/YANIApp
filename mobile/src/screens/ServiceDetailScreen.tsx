import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { servicesApi, Service } from '../api/services';
import { useRequireAuth } from '../utils/useRequireAuth';
import { formatDuration } from '../utils/format';
import DetailBottomBar from '../components/DetailBottomBar';
import { mirroredIcon } from '../i18n';

const { width } = Dimensions.get('window');
const HERO_H = width * 0.9;

export default function ServiceDetailScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { serviceId } = route.params;
  const requireAuth = useRequireAuth();

  const [service, setService] = useState<Service | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    servicesApi.getOne(serviceId).then(setService).catch(() => {}).finally(() => setIsLoading(false));
  }, [serviceId]);

  const handleReserve = () => {
    requireAuth(() => navigation.navigate('Booking', { serviceId }));
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.gold} />
      </View>
    );
  }

  if (!service) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={[typography.body, { color: theme.danger }]}>{t('services.notFound')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* En-tête flottant : retour rond */}
      <View style={[styles.floatingHeader, { top: insets.top + spacing.sm }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.round, { backgroundColor: 'rgba(20,16,12,0.55)' }]}
        >
          <Ionicons name={mirroredIcon('chevron-back')} size={22} color="#F8F8F8" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {/* Grand visuel */}
        <View style={[styles.hero, { backgroundColor: theme.surface }]}>
          {service.imageUrl ? (
            <Image source={{ uri: service.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <Ionicons name="sparkles-outline" size={48} color={theme.textMuted} />
          )}
        </View>

        {/* Bloc contenu */}
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          {service.category && (
            <Text style={[typography.sectionLabel, { color: theme.gold }]}>
              {service.category.name}
            </Text>
          )}

          <Text style={[typography.heading, { color: theme.text, marginTop: spacing.sm }]}>
            {service.name}
          </Text>

          {/* Durée (donnée réelle) */}
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={16} color={theme.gold} />
            <Text style={[typography.caption, { color: theme.textSecondary }]}>
              {formatDuration(service.durationMin)}
            </Text>
          </View>

          {service.description ? (
            <Text style={[typography.body, { color: theme.textSecondary, marginTop: spacing.lg }]}>
              {service.description}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <DetailBottomBar
        priceLabel={t('services.priceFrom')}
        price={service.price}
        ctaLabel={t('services.book')}
        onPress={handleReserve}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  floatingHeader: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    width: '100%',
    height: HERO_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    marginTop: -radius.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    minHeight: 200,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.sm,
  },
});