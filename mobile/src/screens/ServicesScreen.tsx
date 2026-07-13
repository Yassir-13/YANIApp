import { useEffect, useState } from 'react';
import { Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing } from '../theme/typography';
import { servicesApi, Service } from '../api/services';
import Screen from '../components/Screen';
import Card from '../components/Card';
import ErrorView from '../components/ErrorView';
import EmptyView from '../components/EmptyView';

export default function ServicesScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadServices = async () => {
    try {
      setError(null);
      const data = await servicesApi.getAll();
      setServices(data);
    } catch {
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

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.gold} />
        </View>
      </Screen>
    );
  }

   if (error) {
    return (
      <Screen>
        <ErrorView message={error} onRetry={loadServices} />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <Text style={[typography.heading, { color: theme.text, marginHorizontal: spacing.lg, marginBottom: spacing.lg }]}>
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
          <EmptyView message="Aucun service disponible pour le moment." icon="sparkles-outline" />
        }
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('ServiceDetail', { serviceId: item.id })}>
            <View style={styles.cardRow}>
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
              <Text style={[typography.subtitle, { color: theme.gold }]}>{item.price} dh</Text>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
});