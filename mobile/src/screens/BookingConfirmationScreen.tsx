import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '../i18n';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing } from '../theme/typography';
import Button from '../components/Button';

export default function BookingConfirmationScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { serviceName, date, time } = route.params;

  const formattedDate = new Date(`${date}T12:00:00`).toLocaleDateString(intlLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.content}>
        {/* Coche dorée à halo */}
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
          {t('booking.confirmedTitle')}
        </Text>
        <Text style={[typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
          {t('booking.weExpectYou', { date: formattedDate, time })}
          {serviceName ? t('booking.confirmedFor', { service: serviceName.toLowerCase() }) : '.'}
        </Text>
      </View>

      <View style={{ paddingHorizontal: spacing.lg }}>
        <Button
          label={t('appointments.seeMyAppointments')}
          onPress={() => {
            navigation.popToTop();
            navigation.navigate('MyAppointments');
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
  checkWrap: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 80,
  },
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});