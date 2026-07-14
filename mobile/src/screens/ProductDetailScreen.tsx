import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { productsApi, Product } from '../api/products';
import Badge from '../components/Badge';
import DetailBottomBar from '../components/DetailBottomBar';

const { width } = Dimensions.get('window');
const HERO_H = width * 0.9;

export default function ProductDetailScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { productId } = route.params;

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    productsApi.getOne(productId).then(setProduct).catch(() => {}).finally(() => setIsLoading(false));
  }, [productId]);

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.gold} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={[typography.body, { color: theme.danger }]}>Produit introuvable.</Text>
      </View>
    );
  }

  const inStock = product.stockQty > 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* En-tête flottant : retour rond + favori */}
      <View style={[styles.floatingHeader, { top: insets.top + spacing.sm }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.round, { backgroundColor: 'rgba(20,16,12,0.55)' }]}
        >
          <Ionicons name="chevron-back" size={22} color="#F8F8F8" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFavorite((f) => !f)}
          accessibilityRole="button"
          accessibilityLabel={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          accessibilityState={{ selected: favorite }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.round, { backgroundColor: 'rgba(20,16,12,0.55)' }]}
        >
          <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={22} color={theme.gold} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {/* Grand visuel */}
        <View style={[styles.hero, { backgroundColor: theme.surface }]}>
          {product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <Ionicons name="image-outline" size={48} color={theme.textMuted} />
          )}
        </View>

        {/* Bloc contenu qui remonte par-dessus le visuel */}
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={styles.catRow}>
            {product.category && (
              <Text style={[typography.sectionLabel, { color: theme.gold }]}>
                {product.category.name}
              </Text>
            )}
            <Badge kind={inStock ? 'inStock' : 'soon'} />
          </View>

          <Text style={[typography.heading, { color: theme.text, marginTop: spacing.sm }]}>
            {product.name}
          </Text>

          {product.description ? (
            <Text style={[typography.body, { color: theme.textSecondary, marginTop: spacing.md }]}>
              {product.description}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <DetailBottomBar
        priceLabel="Prix"
        price={product.price}
        ctaLabel={inStock ? 'Ajouter au panier' : 'Indisponible'}
        onPress={() => {}}
        disabled={!inStock}
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
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});