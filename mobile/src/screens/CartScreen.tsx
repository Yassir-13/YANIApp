import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import { formatPrice } from '../utils/format';
import Header from '../components/Header';
import Button from '../components/Button';
import Drop from '../components/Drop';
import EmptyView from '../components/EmptyView';

export default function CartScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const lines = useCartStore((s) => s.lines);
  const increment = useCartStore((s) => s.increment);
  const decrement = useCartStore((s) => s.decrement);
  const subtotal = useCartStore((s) => s.subtotal);
  const user = useAuthStore((s) => s.user);

  const total = subtotal();
  const pointsToEarn = Math.round(total * 0.05);

  const goCheckout = () => navigation.navigate('Checkout');

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Mon panier" onBack={() => navigation.goBack()} />

      {lines.length === 0 ? (
        <View style={{ flex: 1, paddingHorizontal: spacing.lg }}>
          <EmptyView message="Votre panier est vide." icon="bag-outline" />
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
            showsVerticalScrollIndicator={false}
          >
            {lines.map((line) => (
              <View key={line.product.id} style={[styles.line, { borderBottomColor: theme.border }]}>
                <View style={[styles.thumb, { backgroundColor: theme.surface }]}>
                  {line.product.imageUrl ? (
                    <Image source={{ uri: line.product.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  ) : (
                    <Ionicons name="image-outline" size={22} color={theme.textMuted} />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[typography.subtitle, { color: theme.text }]}>
                    {line.product.name}
                  </Text>

                  <View style={[styles.stepper, { borderColor: theme.border }]}>
                    <TouchableOpacity
                      onPress={() => decrement(line.product.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Diminuer"
                    >
                      <Ionicons name="remove" size={18} color={theme.gold} />
                    </TouchableOpacity>
                    <Text style={[typography.bodyMedium, { color: theme.text, minWidth: 24, textAlign: 'center' }]}>
                      {line.quantity}
                    </Text>
                    <TouchableOpacity
                      onPress={() => increment(line.product.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Augmenter"
                    >
                      <Ionicons name="add" size={18} color={theme.gold} />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={[typography.price, { color: theme.gold }]}>
                  {formatPrice(parseFloat(line.product.price) * line.quantity)}
                </Text>
              </View>
            ))}

            {!user && (
              <View style={[styles.loyaltyHint, { backgroundColor: theme.loyaltyBg }]}>
                <Drop size={28} colors={[theme.goldLight, theme.gold, theme.goldDeep]} />
                <Text style={[typography.caption, { color: theme.loyaltyText, flex: 1, marginLeft: spacing.sm }]}>
                  Connectez-vous pour gagner{' '}
                  <Text style={{ color: theme.goldLight }}>+{pointsToEarn} points</Text>
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Login')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={[typography.subtitle, { color: theme.goldLight }]}>Connexion</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          <View
            style={[
              styles.footer,
              { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: insets.bottom + spacing.md },
            ]}
          >
            <View style={styles.recapRow}>
              <Text style={[typography.body, { color: theme.textSecondary }]}>Sous-total</Text>
              <Text style={[typography.body, { color: theme.text }]}>{formatPrice(total)}</Text>
            </View>
            <View style={styles.recapRow}>
              <Text style={[typography.body, { color: theme.textSecondary }]}>Livraison</Text>
              <Text style={[typography.body, { color: theme.success }]}>Offerte</Text>
            </View>
            <View style={[styles.recapRow, { marginTop: spacing.sm }]}>
              <Text style={[typography.subtitle, { color: theme.text }]}>Total</Text>
              <Text style={[typography.priceLg, { color: theme.gold }]}>{formatPrice(total)}</Text>
            </View>

            <Button label="Valider la commande" onPress={goCheckout} style={{ marginTop: spacing.md }} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  loyaltyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  recapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
});