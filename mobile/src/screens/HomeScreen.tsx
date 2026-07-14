import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing } from '../theme/typography';
import { useAuthStore } from '../stores/authStore';
import { servicesApi, Service } from '../api/services';
import { productsApi, Product } from '../api/products';
import { loyaltyApi } from '../api/loyalty';
import ErrorView from '../components/ErrorView';
import LoyaltyBanner from '../components/LoyaltyBanner';
import ProductCard from '../components/ProductCard';
import ServiceCard from '../components/ServiceCard';

const CARD_W = 150; // largeur des cartes en carrousel horizontal

export default function HomeScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [points, setPoints] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setError(null);
      const [srv, prd] = await Promise.all([servicesApi.getAll(), productsApi.getAll()]);
      setServices(srv);
      setProducts(prd);
    } catch {
      setError('Impossible de charger le contenu.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (user) {
      loyaltyApi.getMyAccount().then((acc) => setPoints(acc.pointsBalance)).catch(() => {});
    } else {
      setPoints(null);
    }
  }, [user]);

  const goProduct = (id: string) =>
    navigation.navigate('Produits', { screen: 'ProductDetail', params: { productId: id } });
  const goService = (id: string) =>
    navigation.navigate('Services', { screen: 'ServiceDetail', params: { serviceId: id } });

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
    >
      {/* En-tête : salutation serif + bouton profil */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.lg }]}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.body, { color: theme.textSecondary }]}>Bonjour</Text>
          <Text style={[typography.headingSm, { color: theme.text }]}>Bienvenue chez Yani</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile')}
          accessibilityRole="button"
          accessibilityLabel="Profil"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[styles.profileBtn, { borderColor: theme.gold }]}
        >
          <Ionicons name="person-outline" size={22} color={theme.gold} />
        </TouchableOpacity>
      </View>

      {/* Bandeau fidélité */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
        <LoyaltyBanner
          points={points ?? 0}
          guest={!user}
          subtitle={
            user
              ? `Bonjour ${user.firstName}`
              : 'Mode invité · suivez vos points'
          }
          ctaLabel="Se connecter"
          onCtaPress={() => navigation.navigate('Login')}
        />
      </View>

      {/* Produits */}
      <SectionHeader
        title="Produits"
        onPress={() => navigation.navigate('Produits')}
        theme={theme}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
      >
        {products.slice(0, 6).map((p) => (
          <ProductCard key={p.id} product={p} width={CARD_W} onPress={() => goProduct(p.id)} />
        ))}
      </ScrollView>

      {/* Services */}
      <SectionHeader
        title="Services"
        onPress={() => navigation.navigate('Services')}
        theme={theme}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
      >
        {services.slice(0, 6).map((s) => (
          <ServiceCard key={s.id} service={s} width={220} onPress={() => goService(s.id)} />
        ))}
      </ScrollView>
    </ScrollView>
  );
}

function SectionHeader({ title, onPress, theme }: any) {
  return (
    <View style={[styles.sectionHeader, { paddingHorizontal: spacing.lg }]}>
      <Text style={[typography.headingSm, { color: theme.text }]}>{title}</Text>
      <TouchableOpacity onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={[typography.bodyMedium, { color: theme.gold }]}>Voir plus →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  carousel: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
});