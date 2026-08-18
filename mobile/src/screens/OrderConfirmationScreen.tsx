import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing } from '../theme/typography';
import { formatPrice } from '../utils/format';
import Button from '../components/Button';

export default function OrderConfirmationScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { fulfillment, total } = route.params;

  const message =
    fulfillment === 'PICKUP'
      ? t('orders.confirmedPickup')
      : t('orders.confirmedDelivery');

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.content}>
        <View style={styles.checkWrap}>
          <LinearGradient
            colors={[theme.loyaltyGlow, 'transparent']}
            style={styles.halo}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={[styles.checkCircle, { backgroundColor: theme.gold }]}>
            <Ionicons name="checkmark" size={44} color="#1A1712" />
          </View>
        </View>

        <Text style={[typography.display, { color: theme.text, textAlign: 'center', marginTop: spacing.xl }]}>
          {t('orders.confirmedTitle')}
        </Text>
        <Text style={[typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
          {message}
        </Text>

        {total != null && (
          <Text style={[typography.priceLg, { color: theme.gold, marginTop: spacing.lg }]}>
            {formatPrice(total)}
          </Text>
        )}
      </View>

      <View style={{ paddingHorizontal: spacing.lg }}>
        <Button
          label={t('orders.seeMyOrders')}
          onPress={() => {
            navigation.popToTop();
            navigation.navigate('MyOrders');
          }}
        />
        <Button
          label={t('orders.backHome')}
          variant="outline"
          onPress={() => navigation.popToTop()}
          style={{ marginTop: spacing.md }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg },
  checkWrap: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 80 },
  checkCircle: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center' },
});