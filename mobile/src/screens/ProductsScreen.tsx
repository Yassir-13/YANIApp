import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import {
  Text, StyleSheet, ActivityIndicator, RefreshControl, View, ScrollView, SectionList, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing } from '../theme/typography';
import { productsApi, Product } from '../api/products';
import ErrorView from '../components/ErrorView';
import ErrorBanner from '../components/ErrorBanner';
import EmptyView from '../components/EmptyView';
import Chip from '../components/Chip';
import ProductCard from '../components/ProductCard';
import { useCartStore } from '../stores/cartStore';

const ALL = '__all__';

export default function ProductsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const cartCount = useCartStore((s) => s.count());

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCat, setActiveCat] = useState<string>(ALL);

  // Numéro de la dernière demande. Deux allers-retours rapides lancent deux
  // requêtes concurrentes, et sans ce compteur c'est la dernière RÉPONSE
  // ARRIVÉE qui gagnait — pas la dernière demandée. L'écran pouvait donc
  // afficher un catalogue plus ancien que celui qu'on venait de réclamer.
  const derniereDemande = useRef(0);

  const load = useCallback(async () => {
    const demande = ++derniereDemande.current;
    // Une réponse dépassée est ignorée. La requête n'est pas coupée sur le
    // réseau — elle est simplement sans effet, ce qui suffit à garantir que
    // c'est la dernière demande qui décide de ce qui s'affiche.
    const depassee = () => demande !== derniereDemande.current;
    try {
      setError(null);
      const data = await productsApi.getAll();
      if (depassee()) return;
      setProducts(data);
    } catch {
      if (depassee()) return;
      setError('Impossible de charger les produits.');
    } finally {
      if (!depassee()) {
        setIsLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Recharge à chaque focus : le catalogue peut avoir changé côté institut
  // (prix, stock, produit désactivé). Évite d'afficher des produits retirés.
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
    for (const p of products) {
      if (p.category) map.set(p.category.id, p.category.name);
    }
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [products]);

  const visible = useMemo(
    () => (activeCat === ALL ? products : products.filter((p) => p.categoryId === activeCat)),
    [products, activeCat]
  );

  // Regroupement par catégorie, puis découpage en rangées de deux : une
  // `SectionList` n'accepte pas `numColumns`, c'est donc la RANGÉE qui devient
  // l'élément de liste. La grille reste visuellement identique.
  const sections = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; items: Product[] }>();
    for (const p of visible) {
      const key = p.category?.id ?? 'autres';
      const name = p.category?.name ?? 'Autres';
      if (!groups.has(key)) groups.set(key, { id: key, name, items: [] });
      groups.get(key)!.items.push(p);
    }
    return Array.from(groups.values(), ({ id, name, items }) => ({
      id,
      name,
      data: items.reduce<Product[][]>((rangees, p, i) => {
        if (i % 2 === 0) rangees.push([p]);
        else rangees[rangees.length - 1].push(p);
        return rangees;
      }, []),
    }));
  }, [visible]);

  // Un filtre peut pointer vers une catégorie qui n'existe plus après un
  // rechargement : aucun chip ne paraîtrait alors sélectionné, et la liste
  // serait vide sans explication. On revient sur « Tous ».
  useEffect(() => {
    if (activeCat !== ALL && !categories.some((c) => c.id === activeCat)) {
      setActiveCat(ALL);
    }
  }, [categories, activeCat]);

  const goDetail = (id: string) => navigation.navigate('ProductDetail', { productId: id });

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.gold} />
      </View>
    );
  }

  // Écran d'erreur plein UNIQUEMENT si l'on n'a rien à montrer.
  // Si le catalogue est déjà chargé, une coupure passagère ne doit pas le
  // faire disparaître : on garde la liste et on signale l'échec par un bandeau.
  if (error && products.length === 0) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background, paddingTop: insets.top + spacing.md }]}>
        <ErrorView message={error} onRetry={load} />
      </View>
    );
  }

  // `SectionList` ne monte que ce qui est visible. Avec l'ancien `.map` dans
  // un `ScrollView`, 150 produits déclenchaient 150 téléchargements d'images
  // d'un coup, dont l'immense majorité hors de l'écran.
  return (
    <SectionList
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />
      }
      sections={sections}
      keyExtractor={(rangee) => rangee[0].id}
      // Les en-têtes de section se figeaient en haut de l'écran sur iOS : on
      // garde le défilement d'origine, où ils remontent avec la liste.
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Text style={[typography.sectionLabel, styles.sectionLabel, { color: theme.gold }]}>
          {section.name}
        </Text>
      )}
      renderItem={({ item: rangee }) => (
        <View style={styles.grid}>
          {rangee.map((p) => (
            <View key={p.id} style={styles.gridItem}>
              <ProductCard product={p} onPress={() => goDetail(p.id)} />
            </View>
          ))}
        </View>
      )}
      ListEmptyComponent={
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}>
          <EmptyView
            message={
              activeCat === ALL
                ? 'Aucun produit disponible pour le moment.'
                : 'Aucun produit dans cette catégorie.'
            }
            icon="sparkles-outline"
          />
        </View>
      }
      ListHeaderComponent={
        <>
          {/* Titre + panier */}
          <View style={[styles.headerRow, { paddingHorizontal: spacing.lg }]}>
            <Text style={[typography.display, { color: theme.text, flex: 1 }]}>Produits</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Cart')}
              accessibilityRole="button"
              accessibilityLabel="Panier"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[styles.searchBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Ionicons name="bag-outline" size={20} color={theme.text} />
              {cartCount > 0 && (
                <View style={[styles.cartBadge, { backgroundColor: theme.gold }]}>
                  <Text style={styles.cartBadgeText}>{cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Échec du rafraîchissement, sans masquer le catalogue déjà affiché */}
          {error && (
            <ErrorBanner message="Catalogue non actualisé (connexion)." onRetry={load} />
          )}

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
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#1A1712',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg - spacing.sm / 2,
  },
  gridItem: {
    width: '50%',
    paddingHorizontal: spacing.sm / 2,
  },
});