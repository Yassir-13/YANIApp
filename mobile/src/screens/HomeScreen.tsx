import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { useAuthStore } from '../stores/authStore';
import { servicesApi, Service } from '../api/services';
import { productsApi, Product } from '../api/products';
import { loyaltyApi } from '../api/loyalty';
import Screen from '../components/Screen';
import Card from '../components/Card';

export default function HomeScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);

  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [points, setPoints] = useState<number | null>(null);
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
        // silencieux
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // Charge le solde de points si connecté
  useEffect(() => {
    if (user) {
      loyaltyApi.getMyAccount().then((acc) => setPoints(acc.pointsBalance)).catch(() => {});
    } else {
      setPoints(null);
    }
  }, [user]);

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
    <Screen scroll>
      {/* Bouton profil */}
      <TouchableOpacity
        onPress={() => navigation.navigate('Profile')}
        style={styles.profileBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="person-circle-outline" size={30} color={theme.gold} />
      </TouchableOpacity>

      {/* En-tête */}
      <Text style={[typography.caption, { color: theme.textSecondary }]}>Bienvenue chez</Text>
      <Text style={[typography.heading, { color: theme.gold, marginBottom: spacing.lg }]}>
        Yani Concept
      </Text>

      {/* Bandeau fidélité */}
      <View style={[styles.loyaltyBanner, { backgroundColor: theme.loyaltyBg }]}>
        <Text style={[typography.small, { color: theme.goldLight, letterSpacing: 1 }]}>FIDÉLITÉ</Text>
        {user ? (
          <>
            <Text style={[styles.points, { color: theme.gold }]}>
              {points ?? '—'} <Text style={typography.caption}>points</Text>
            </Text>
            <Text style={[typography.caption, { color: theme.loyaltyText }]}>
              Bonjour {user.firstName ?? user.email}
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

      {/* Services */}
      <SectionHeader title="Services" onPress={() => navigation.navigate('Services')} theme={theme} />
      {services.slice(0, 3).map((s) => (
        <Card key={s.id} onPress={() => navigation.navigate('Services')}>
          <View style={styles.row}>
            <Text style={[typography.subtitle, { color: theme.text, flex: 1 }]}>{s.name}</Text>
            <Text style={[typography.caption, { color: theme.gold }]}>{s.price} dh</Text>
          </View>
        </Card>
      ))}

      {/* Produits */}
      <SectionHeader title="Produits" onPress={() => navigation.navigate('Produits')} theme={theme} />
      {products.slice(0, 3).map((p) => (
        <Card key={p.id} onPress={() => navigation.navigate('Produits')}>
          <View style={styles.row}>
            <Text style={[typography.subtitle, { color: theme.text, flex: 1 }]}>{p.name}</Text>
            <Text style={[typography.caption, { color: theme.gold }]}>{p.price} dh</Text>
          </View>
        </Card>
      ))}
    </Screen>
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
  profileBtn: { alignSelf: 'flex-end', marginBottom: spacing.sm },
  loyaltyBanner: { borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.xl },
  points: { fontSize: 36, fontWeight: '700', marginVertical: spacing.xs },
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
  row: { flexDirection: 'row', alignItems: 'center' },
});