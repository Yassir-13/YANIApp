import { useEffect, useState } from 'react';
import {
  View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '../components/AlertProvider';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import { formatPrice } from '../utils/format';
import Header from '../components/Header';
import Button from '../components/Button';
import Drop from '../components/Drop';
import EmptyView from '../components/EmptyView';
import { mediaUrl } from '../api/config';

export default function CartScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const lines = useCartStore((s) => s.lines);
  const increment = useCartStore((s) => s.increment);
  const decrement = useCartStore((s) => s.decrement);
  const subtotal = useCartStore((s) => s.subtotal);
  const sync = useCartStore((s) => s.sync);
  const hasHydrated = useCartStore((s) => s.hasHydrated);
  const user = useAuthStore((s) => s.user);
  const { alert } = useAlert();

  const [syncing, setSyncing] = useState(true);

  // Le panier survit désormais à la fermeture de l'app : il peut donc être
  // ancien. On le confronte au catalogue avant que la cliente ne commande,
  // et on la prévient si quelque chose a changé entre-temps.
  useEffect(() => {
    if (!hasHydrated) return;
    let annule = false;

    (async () => {
      try {
        const { removed, repriced, reduced } = await sync();
        if (annule) return;

        if (removed.length > 0) {
          alert(
            // Les accords étaient bricolés à coups de ternaires ; les formes
            // CLDR les portent maintenant, y compris le duel arabe.
            t('cart.unavailableTitle', { count: removed.length }),
            t('cart.unavailableMessage', { count: removed.length, names: removed.join(', ') })
          );
        } else if (reduced.length > 0) {
          // Le stock a baissé pendant que le panier dormait. On nomme le
          // produit et ce qu'il en reste : le serveur refuserait la commande
          // au dernier moment, sans dire lequel poser.
          alert(
            t('cart.stockUpdatedTitle'),
            reduced
              .map((r) =>
                r.after === 0
                  ? t('cart.stockSoldOut', { name: r.name })
                  : t('cart.stockReduced', { name: r.name, after: r.after, before: r.before })
              )
              .join('\n')
          );
        } else if (repriced.length > 0) {
          alert(
            t('cart.priceUpdatedTitle'),
            repriced
              .map((r) => t('cart.priceChanged', { name: r.name, before: formatPrice(r.before), after: formatPrice(r.after) }))
              .join('\n')
          );
        }
      } catch {
        // Hors ligne ou API injoignable : on garde le panier tel quel.
        // Le serveur revalidera de toute façon au moment de la commande.
      } finally {
        if (!annule) setSyncing(false);
      }
    })();

    return () => {
      annule = true;
    };
  }, [hasHydrated, sync, alert]);

  const total = subtotal();
  const pointsToEarn = Math.round(total * 0.05);

  const goCheckout = () => navigation.navigate('Checkout');

  // Tant que le panier n'est pas relu depuis le disque, afficher « vide »
  // ferait croire à la cliente qu'elle a tout perdu.
  if (!hasHydrated || syncing) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Header title={t('cart.title')} onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.gold} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title={t('cart.title')} onBack={() => navigation.goBack()} />

      {lines.length === 0 ? (
        <View style={{ flex: 1, paddingHorizontal: spacing.lg }}>
          <EmptyView message={t('cart.empty')} icon="bag-outline" />
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
            showsVerticalScrollIndicator={false}
          >
            {lines.map((line) => {
              // Le « + » ne doit pas proposer ce que l'institut ne peut pas
              // servir. Le store plafonne de toute façon, mais un bouton qui
              // s'enfonce sans rien changer se lit comme un bug (B8).
              const auMax = line.quantity >= line.product.stockQty;
              return (
                <View key={line.product.id} style={[styles.line, { borderBottomColor: theme.border }]}>
                  <View style={[styles.thumb, { backgroundColor: theme.surface }]}>
                    {line.product.imageUrl ? (
                      <Image source={{ uri: mediaUrl(line.product.imageUrl) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
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
                        disabled={auMax}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel="Augmenter"
                        accessibilityState={{ disabled: auMax }}
                      >
                        <Ionicons name="add" size={18} color={auMax ? theme.textMuted : theme.gold} />
                      </TouchableOpacity>
                    </View>

                    {auMax && (
                      <Text style={[typography.small, { color: theme.textMuted, marginTop: 4 }]}>
                        {t('cart.maxStock', { qty: line.product.stockQty })}
                      </Text>
                    )}
                  </View>

                  <Text style={[typography.price, { color: theme.gold }]}>
                    {formatPrice(parseFloat(line.product.price) * line.quantity)}
                  </Text>
                </View>
              );
            })}

            {!user && (
              <View style={[styles.loyaltyHint, { backgroundColor: theme.loyaltyBg }]}>
                <Drop size={28} colors={[theme.goldLight, theme.gold, theme.goldDeep]} />
                <Text style={[typography.caption, { color: theme.loyaltyText, flex: 1, marginLeft: spacing.sm }]}>
                  {t('cart.loginToEarn')}{' '}
                  <Text style={{ color: theme.goldLight }}>
                    {t('cart.pointsToEarn', { points: pointsToEarn })}
                  </Text>
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Login')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={[typography.subtitle, { color: theme.goldLight }]}>{t('cart.login')}</Text>
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
              <Text style={[typography.body, { color: theme.textSecondary }]}>{t('cart.subtotal')}</Text>
              <Text style={[typography.body, { color: theme.text }]}>{formatPrice(total)}</Text>
            </View>
            <View style={styles.recapRow}>
              <Text style={[typography.body, { color: theme.textSecondary }]}>{t('cart.delivery')}</Text>
              <Text style={[typography.body, { color: theme.success }]}>{t('cart.deliveryFree')}</Text>
            </View>
            <View style={[styles.recapRow, { marginTop: spacing.sm }]}>
              <Text style={[typography.subtitle, { color: theme.text }]}>{t('cart.total')}</Text>
              <Text style={[typography.priceLg, { color: theme.gold }]}>{formatPrice(total)}</Text>
            </View>

            <Button label={t('cart.checkout')} onPress={goCheckout} style={{ marginTop: spacing.md }} />
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