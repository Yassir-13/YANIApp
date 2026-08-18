import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import {
  Text, StyleSheet, ActivityIndicator, RefreshControl, View, ScrollView, SectionList,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing } from '../theme/typography';
import { servicesApi, Service } from '../api/services';
import ErrorView from '../components/ErrorView';
import ErrorBanner from '../components/ErrorBanner';
import EmptyView from '../components/EmptyView';
import Chip from '../components/Chip';
import ServiceRow from '../components/ServiceRow';

const ALL = '__all__';

export default function ServicesScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Un drapeau et non le message : un texte figé dans l'état resterait
  // dans l'ancienne langue après un changement de langue.
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCat, setActiveCat] = useState<string>(ALL);

  // Voir ProductsScreen : sans ce compteur, deux allers-retours rapides
  // laissaient gagner la dernière réponse ARRIVÉE, pas la dernière demandée.
  const derniereDemande = useRef(0);

  const load = useCallback(async () => {
    const demande = ++derniereDemande.current;
    const depassee = () => demande !== derniereDemande.current;
    try {
      setError(false);
      const data = await servicesApi.getAll();
      if (depassee()) return;
      setServices(data);
    } catch {
      if (depassee()) return;
      setError(true);
    } finally {
      if (!depassee()) {
        setIsLoading(false);
        setRefreshing(false);
      }
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
    const groups = new Map<string, { id: string; name: string; data: Service[] }>();
    for (const s of visible) {
      const key = s.category?.id ?? 'autres';
      const name = s.category?.name ?? t('products.otherCategory');
      if (!groups.has(key)) groups.set(key, { id: key, name, data: [] });
      groups.get(key)!.data.push(s);
    }
    return Array.from(groups.values());
  }, [visible]);

  // Filtre pointant vers une catégorie disparue après rechargement : on
  // revient sur « Tous » plutôt que d'afficher une liste vide inexplicable.
  useEffect(() => {
    if (activeCat !== ALL && !categories.some((c) => c.id === activeCat)) {
      setActiveCat(ALL);
    }
  }, [categories, activeCat]);

  const goDetail = (id: string) => navigation.navigate('ServiceDetail', { serviceId: id });

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.gold} />
      </View>
    );
  }

  // Plein écran seulement si l'on n'a rien à montrer : une coupure passagère
  // ne doit pas effacer un catalogue déjà chargé.
  if (error && services.length === 0) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background, paddingTop: insets.top + spacing.md }]}>
        <ErrorView message={t('services.loadFailed')} onRetry={load} />
      </View>
    );
  }

  // `SectionList` ne monte que les lignes visibles, au lieu de construire la
  // liste entière à chaque rendu comme le faisait `.map` dans un `ScrollView`.
  return (
    <SectionList
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />
      }
      sections={sections}
      keyExtractor={(s) => s.id}
      // Comme avant : les en-têtes remontent avec la liste au lieu de rester
      // collés en haut de l'écran (comportement iOS par défaut).
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Text style={[typography.sectionLabel, styles.sectionLabel, { color: theme.gold }]}>
          {section.name}
        </Text>
      )}
      renderItem={({ item: s }) => (
        <View style={styles.row}>
          <ServiceRow service={s} onPress={() => goDetail(s.id)} />
        </View>
      )}
      ListEmptyComponent={
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}>
          <EmptyView
            message={
              activeCat === ALL
                ? t('services.empty')
                : t('services.emptyCategory')
            }
            icon="sparkles-outline"
          />
        </View>
      }
      ListHeaderComponent={
        <>
          {/* Titre.
              La loupe « Rechercher » a été retirée : elle n'avait aucun
              `onPress`. Elle s'enfonçait visuellement sans rien faire, et un
              lecteur d'écran l'annonçait comme actionnable — donc pire que
              rien pour qui ne voit pas l'écran. Les filtres par catégorie
              ci-dessous restent le moyen de s'y retrouver en attendant une
              vraie recherche. */}
          <View style={[styles.headerRow, { paddingHorizontal: spacing.lg }]}>
            <Text style={[typography.display, { color: theme.text, flex: 1 }]}>{t('nav.services')}</Text>
          </View>

          {/* Échec du rafraîchissement, sans masquer les prestations affichées */}
          {error && (
            <ErrorBanner message={t('services.staleBanner')} onRetry={load} />
          )}

          {/* Chips de filtres */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            <Chip label={t('products.allCategories')} active={activeCat === ALL} onPress={() => setActiveCat(ALL)} />
            {categories.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                active={activeCat === c.id}
                onPress={() => setActiveCat(c.id)}
              />
            ))}
          </ScrollView>
        </>
      }
    />
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
  chips: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  sectionLabel: {
    paddingHorizontal: spacing.lg,
    // Portée par l'en-tête depuis le passage en SectionList : c'est lui qui
    // ouvre chaque catégorie, là où c'était le conteneur de section avant.
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  row: {
    paddingHorizontal: spacing.lg,
  },
});