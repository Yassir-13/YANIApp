import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { servicesApi, Service } from '../api/services';
import { useNavigation } from '@react-navigation/native';

export default function ServicesScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadServices = async () => {
    try {
      setError(null);
      const data = await servicesApi.getAll();
      setServices(data);
    } catch (e: any) {
      setError('Impossible de charger les services.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadServices();
  };

  // État de chargement
  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.gold} />
      </View>
    );
  }

  // État d'erreur
  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={[typography.body, { color: theme.danger }]}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[typography.heading, { color: theme.text, margin: spacing.lg }]}>
        Services
      </Text>
      <FlatList
        data={services}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />
        }
        ListEmptyComponent={
          <Text style={[typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: spacing.xl }]}>
            Aucun service disponible pour le moment.
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('ServiceDetail', { serviceId: item.id })}
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[typography.subtitle, { color: theme.text }]}>{item.name}</Text>
              {item.category && (
                <Text style={[typography.small, { color: theme.textMuted, marginTop: 2 }]}>
                  {item.category.name}
                </Text>
              )}
              <Text style={[typography.caption, { color: theme.textSecondary, marginTop: spacing.xs }]}>
                {item.durationMin} min
              </Text>
            </View>
            <Text style={[typography.subtitle, { color: theme.gold }]}>
              {item.price} dh
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
});