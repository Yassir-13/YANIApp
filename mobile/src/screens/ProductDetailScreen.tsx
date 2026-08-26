import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { productsApi, Product } from '../api/products';
import { mediaUrl } from '../api/config';
import Badge from '../components/Badge';
import DetailBottomBar from '../components/DetailBottomBar';
import { useCartStore } from '../stores/cartStore';
import { useAlert } from '../components/AlertProvider';
import { mirroredIcon } from '../i18n';

const { width } = Dimensions.get('window');
const HERO_H = width * 0.9;

export default function ProductDetailScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { productId } = route.params;

  const addToCart = useCartStore((s) => s.add);
  const cartCount = useCartStore((s) => s.count());
  // Ce que la cliente a déjà mis de CE produit : le plafond porte sur le total
  // au panier, pas sur ce seul clic.
  const dansLePanier = useCartStore((s) => s.quantityOf(productId));
  const { alert } = useAlert();

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        <Text style={[typography.body, { color: theme.danger }]}>{t('products.notFound')}</Text>
      </View>
    );
  }

  const inStock = product.stockQty > 0;
  // Ce qu'on peut encore ajouter. Avant, le bouton restait actif tant que le
  // stock n'était pas à zéro : avec 1 en stock et 1 déjà au panier, il
  // proposait encore d'ajouter (B8).
  const restant = product.stockQty - dansLePanier;

  const handleAddToCart = () => {
    addToCart(product, 1);
    alert(t('products.addedTitle'), t('products.addedMessage', { name: product.name }));
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* En-tête flottant : retour rond.
          Le cœur « favori » a été retiré : il s'allumait, ne stockait rien
          (aucun endpoint, aucune table, aucun store) et se vidait dès qu'on
          quittait l'écran. Un bouton qui fait semblant coûte plus cher en
          confiance qu'un bouton absent. Il reviendra le jour où les favoris
          existeront vraiment. */}
      <View style={[styles.floatingHeader, { top: insets.top + spacing.sm }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.round, { backgroundColor: 'rgba(20,16,12,0.55)' }]}
        >
          <Ionicons name={mirroredIcon('chevron-back')} size={22} color="#F8F8F8" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {/* Grand visuel */}
        <View style={[styles.hero, { backgroundColor: theme.surface }]}>
          {product.imageUrl ? (
            <Image source={{ uri: mediaUrl(product.imageUrl) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
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
            <Badge kind={inStock ? 'inStock' : 'outOfStock'} />
          </View>

          <Text style={[typography.heading, { color: theme.text, marginTop: spacing.sm }]}>
            {product.name}
          </Text>

          {product.description ? (
            <Text style={[typography.body, { color: theme.textSecondary, marginTop: spacing.md }]}>
              {product.description}
            </Text>
          ) : null}

          {/* Dit pourquoi le bouton est éteint. Un bouton grisé sans
              explication se lit comme une panne de l'app. */}
          {inStock && restant <= 0 && (
            <Text style={[typography.small, { color: theme.textMuted, marginTop: spacing.md }]}>
              {product.stockQty > 1
                ? t('products.allStockInCartQty', { qty: product.stockQty })
                : t('products.allStockInCart')}
            </Text>
          )}
        </View>
      </ScrollView>

      <DetailBottomBar
        priceLabel={t('products.price')}
        price={product.price}
        ctaLabel={
          !inStock
            ? t('products.outOfStock')
            : restant > 0
              ? t('products.addToCart')
              : t('products.maxReached')
        }
        onPress={handleAddToCart}
        disabled={restant <= 0}
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