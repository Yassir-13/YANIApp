import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { productsApi, Product } from '../api/products';

export default function ProductDetailScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { productId } = route.params;

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    productsApi
      .getOne(productId)
      .then(setProduct)
      .catch(() => {})
      .finally(() => setIsLoading(false));
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
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={[styles.backText, { color: theme.text }]}>‹ Retour</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xxl }}>
        {product.category && (
          <Text style={[typography.small, { color: theme.gold, letterSpacing: 1, marginTop: spacing.lg }]}>
            {product.category.name.toUpperCase()}
          </Text>
        )}
        <Text style={[typography.heading, { color: theme.text, marginVertical: spacing.sm }]}>
          {product.name}
        </Text>

        <Text
          style={[
            typography.caption,
            { color: inStock ? theme.success : theme.danger, marginTop: spacing.xs },
          ]}
        >
          {inStock ? 'En stock' : 'Rupture de stock'}
        </Text>

        {product.description && (
          <Text style={[typography.body, { color: theme.textSecondary, marginTop: spacing.lg }]}>
            {product.description}
          </Text>
        )}
      </ScrollView>

      {/* Barre du bas */}
      <View style={[styles.bottomBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <View>
          <Text style={[typography.small, { color: theme.textMuted }]}>Prix</Text>
          <Text style={[typography.title, { color: theme.gold }]}>{product.price} dh</Text>
        </View>
        <TouchableOpacity
          style={[styles.cartBtn, { backgroundColor: inStock ? theme.gold : theme.textMuted, opacity: inStock ? 1 : 0.5 }]}
          disabled={!inStock}
          onPress={() => {
            // Panier à venir (dépend de la décision métier sur les commandes)
          }}
        >
          <Text style={[typography.subtitle, { color: '#1E1B16' }]}>
            {inStock ? 'Ajouter au panier' : 'Indisponible'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backButton: { position: 'absolute', top: spacing.xxl, left: spacing.md, zIndex: 10, padding: spacing.sm },
  backText: { fontSize: 17, fontWeight: '500' },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderTopWidth: 1,
  },
  cartBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
});