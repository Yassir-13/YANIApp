import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { Product } from '../api/products';
import { mediaUrl } from '../api/config';
import { formatPrice } from '../utils/format';
import Badge from './Badge';

interface ProductCardProps {
  product: Product;
  onPress: () => void;
  width?: number; // largeur fixe pour les grilles/carrousels
}

// Carte produit : visuel carré en haut, nom, prix (serif) + badge de stock.
export default function ProductCard({ product, onPress, width }: ProductCardProps) {
  const { theme } = useTheme();
  const inStock = product.stockQty > 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={product.name}
      style={[styles.card, width ? { width } : { flex: 1 }]}
    >
      <View style={[styles.image, { backgroundColor: theme.surface }]}>
        {product.imageUrl ? (
          <Image source={{ uri: mediaUrl(product.imageUrl) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Ionicons name="image-outline" size={28} color={theme.textMuted} />
        )}
      </View>
      <Text numberOfLines={1} style={[typography.subtitle, { color: theme.text, marginTop: spacing.sm }]}>
        {product.name}
      </Text>
      <View style={styles.footer}>
        <Text style={[typography.price, { color: theme.gold }]}>{formatPrice(product.price)}</Text>
        <Badge kind={inStock ? 'inStock' : 'outOfStock'} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  image: {
    aspectRatio: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
});