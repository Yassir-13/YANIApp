import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { servicesApi, Service } from '../api/services';
import { useRequireAuth } from '../utils/useRequireAuth';
import Button from '../components/Button';

export default function ServiceDetailScreen({ route, navigation }: any) {
  const { theme } = useTheme();
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
        <Text style={[typography.body, { color: theme.danger }]}>Service introuvable.</Text>
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

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xxl * 1.5 }}>
        {service.category && (
          <Text style={[typography.small, { color: theme.gold, letterSpacing: 1 }]}>
            {service.category.name.toUpperCase()}
          </Text>
        )}
        <Text style={[typography.heading, { color: theme.text, marginVertical: spacing.sm }]}>
          {service.name}
        </Text>
        <Text style={[typography.caption, { color: theme.textSecondary }]}>
          {service.durationMin} min
        </Text>
        {service.description && (
          <Text style={[typography.body, { color: theme.textSecondary, marginTop: spacing.lg }]}>
            {service.description}
          </Text>
        )}
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <View>
          <Text style={[typography.small, { color: theme.textMuted }]}>À partir de</Text>
          <Text style={[typography.title, { color: theme.gold }]}>{service.price} dh</Text>
        </View>
        <Button label="Réserver" onPress={handleReserve} style={{ flex: 0, paddingHorizontal: spacing.xl }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backButton: { position: 'absolute', top: spacing.xxl, left: spacing.md, zIndex: 10, padding: spacing.sm },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderTopWidth: 1,
  },
});