import { useEffect, useState } from 'react';
import { Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing } from '../theme/typography';
import { productsApi, Product } from '../api/products';
import Screen from '../components/Screen';
import Card from '../components/Card';

export default function ProductsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
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
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.gold} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <Text style={[typography.heading, { color: theme.text, marginHorizontal: spacing.lg, marginBottom: spacing.lg }]}>
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
          error ? (
            <Text style={[typography.body, { color: theme.danger, textAlign: 'center', marginTop: spacing.xl }]}>
              {error}
            </Text>
          ) : (
            <Text style={[typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: spacing.xl }]}>
              Aucun produit disponible.
            </Text>
          )
        }
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}>
            <View style={styles.cardRow}>
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