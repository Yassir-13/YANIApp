import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { productsApi, Product } from '../api/products';
import { useNavigation } from '@react-navigation/native';

export default function ProductsScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadProducts = async () => {
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
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts();
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.gold} />
      </View>
    );
  }

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
        Produits
      </Text>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />
        }
        ListEmptyComponent={
          <Text style={[typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: spacing.xl }]}>
            Aucun produit disponible pour le moment.
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[typography.subtitle, { color: theme.text }]}>{item.name}</Text>
              {item.category && (
                <Text style={[typography.small, { color: theme.textMuted, marginTop: 2 }]}>
                  {item.category.name}
                </Text>
              )}
              <Text
                style={[
                  typography.small,
                  { color: item.stockQty > 0 ? theme.success : theme.danger, marginTop: spacing.xs },
                ]}
              >
                {item.stockQty > 0 ? 'En stock' : 'Rupture'}
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