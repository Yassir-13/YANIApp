import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../stores/authStore';
import { servicesApi, Service } from '../api/services';
import { productsApi, Product } from '../api/products';

export default function HomeScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();

  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [srv, prd] = await Promise.all([
          servicesApi.getAll(),
          productsApi.getAll(),
        ]);
        setServices(srv);
        setProducts(prd);
      } catch {
        // erreurs silencieuses ici, on affinera
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.gold} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={{
        padding: spacing.lg,
        paddingTop: insets.top + spacing.md,
        paddingBottom: spacing.xxl,
      }}
    >
      {/* Bouton profil en haut à droite */}
      <TouchableOpacity
        onPress={() => navigation.navigate('Profile')}
        style={{ alignSelf: 'flex-end', marginBottom: spacing.sm }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={[typography.caption, { color: theme.gold }]}>Profil ›</Text>
      </TouchableOpacity>

      {/* En-tête */}
      <Text style={[typography.caption, { color: theme.textSecondary }]}>
        Bienvenue chez
      </Text>
      <Text style={[typography.heading, { color: theme.gold, marginBottom: spacing.lg }]}>
        Yani Concept
      </Text>

      {/* Bandeau fidélité */}
      <View style={[styles.loyaltyBanner, { backgroundColor: theme.loyaltyBg }]}>
        <Text style={[typography.small, { color: theme.goldLight, letterSpacing: 1 }]}>
          FIDÉLITÉ
        </Text>
        {user ? (
          <>
            <Text style={[styles.points, { color: theme.gold }]}>Bonjour</Text>
            <Text style={[typography.caption, { color: theme.loyaltyText }]}>
              {user.firstName ?? user.email}
            </Text>
          </>
        ) : (
          <>
            <Text style={[typography.title, { color: theme.loyaltyText, marginVertical: spacing.xs }]}>
              Suivez vos points
            </Text>
            <TouchableOpacity
              style={[styles.connectBtn, { backgroundColor: theme.gold }]}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={[typography.caption, { color: '#1E1B16', fontWeight: '600' }]}>
                Se connecter
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Section Services */}
      <SectionHeader
        title="Services"
        onPress={() => navigation.navigate('Services')}
        theme={theme}
      />
      {services.slice(0, 3).map((s) => (
        <View key={s.id} style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[typography.subtitle, { color: theme.text, flex: 1 }]}>{s.name}</Text>
          <Text style={[typography.caption, { color: theme.gold }]}>{s.price} dh</Text>
        </View>
      ))}

      {/* Section Produits */}
      <SectionHeader
        title="Produits"
        onPress={() => navigation.navigate('Produits')}
        theme={theme}
      />
      {products.slice(0, 3).map((p) => (
        <View key={p.id} style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[typography.subtitle, { color: theme.text, flex: 1 }]}>{p.name}</Text>
          <Text style={[typography.caption, { color: theme.gold }]}>{p.price} dh</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function SectionHeader({ title, onPress, theme }: any) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[typography.title, { color: theme.text }]}>{title}</Text>
      <TouchableOpacity onPress={onPress}>
        <Text style={[typography.caption, { color: theme.gold }]}>Voir plus →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loyaltyBanner: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  points: { fontSize: 24, fontWeight: '700', marginVertical: spacing.xs },
  connectBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    marginTop: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
});