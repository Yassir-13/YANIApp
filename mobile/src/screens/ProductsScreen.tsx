import { useEffect, useCallback, useMemo, useState } from 'react';
import {
  Text, StyleSheet, ActivityIndicator, RefreshControl, View, ScrollView, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing } from '../theme/typography';
import { productsApi, Product } from '../api/products';
import ErrorView from '../components/ErrorView';
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

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await productsApi.getAll();
      setProducts(data);
    } catch {
      setError('Impossible de charger les produits.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
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

  const sections = useMemo(() => {
    const groups = new Map<string, { name: string; items: Product[] }>();
    for (const p of visible) {
      const key = p.category?.id ?? 'autres';
      const name = p.category?.name ?? 'Autres';
      if (!groups.has(key)) groups.set(key, { name, items: [] });
      groups.get(key)!.items.push(p);
    }
    return Array.from(groups.values());
  }, [visible]);

  const goDetail = (id: string) => navigation.navigate('ProductDetail', { productId: id });

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

      {/* Sections par catégorie, grille 2 colonnes */}
      {visible.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}>
          <EmptyView message="Aucun produit disponible pour le moment." icon="sparkles-outline" />
        </View>
      ) : (
        sections.map((section) => (
          <View key={section.name} style={{ marginTop: spacing.lg }}>
            <Text style={[typography.sectionLabel, styles.sectionLabel, { color: theme.gold }]}>
              {section.name}
            </Text>
            <View style={styles.grid}>
              {section.items.map((p) => (
                <View key={p.id} style={styles.gridItem}>
                  <ProductCard product={p} onPress={() => goDetail(p.id)} />
                </View>
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