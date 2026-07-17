import { useEffect, useCallback, useMemo, useState } from 'react';
import {
  Text, StyleSheet, ActivityIndicator, RefreshControl, View, ScrollView, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing } from '../theme/typography';
import { servicesApi, Service } from '../api/services';
import ErrorView from '../components/ErrorView';
import EmptyView from '../components/EmptyView';
import Chip from '../components/Chip';
import ServiceRow from '../components/ServiceRow';

const ALL = '__all__';

export default function ServicesScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCat, setActiveCat] = useState<string>(ALL);

  const load = useCallback(async () => {
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
  }, []);

  
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of services) {
      if (s.category) map.set(s.category.id, s.category.name);
    }
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [services]);

  const visible = useMemo(
    () => (activeCat === ALL ? services : services.filter((s) => s.categoryId === activeCat)),
    [services, activeCat]
  );

  const sections = useMemo(() => {
    const groups = new Map<string, { name: string; items: Service[] }>();
    for (const s of visible) {
      const key = s.category?.id ?? 'autres';
      const name = s.category?.name ?? 'Autres';
      if (!groups.has(key)) groups.set(key, { name, items: [] });
      groups.get(key)!.items.push(s);
    }
    return Array.from(groups.values());
  }, [visible]);

  const goDetail = (id: string) => navigation.navigate('ServiceDetail', { serviceId: id });

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.gold} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background, paddingTop: insets.top + spacing.md }]}>
        <ErrorView message={error} onRetry={load} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />
      }
    >
      {/* Titre + recherche */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.lg }]}>
        <Text style={[typography.display, { color: theme.text, flex: 1 }]}>Services</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Rechercher"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[styles.searchBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Ionicons name="search" size={20} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Chips de filtres */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip label="Tous" active={activeCat === ALL} onPress={() => setActiveCat(ALL)} />
        {categories.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            active={activeCat === c.id}
            onPress={() => setActiveCat(c.id)}
          />
        ))}
      </ScrollView>

      {/* Sections par catégorie, liste de lignes */}
      {visible.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}>
          <EmptyView message="Aucun service disponible pour le moment." icon="sparkles-outline" />
        </View>
      ) : (
        sections.map((section) => (
          <View key={section.name} style={{ marginTop: spacing.lg }}>
            <Text style={[typography.sectionLabel, styles.sectionLabel, { color: theme.gold }]}>
              {section.name}
            </Text>
            <View style={{ paddingHorizontal: spacing.lg }}>
              {section.items.map((s) => (
                <ServiceRow key={s.id} service={s} onPress={() => goDetail(s.id)} />
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  sectionLabel: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
});