import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing } from '../theme/typography';
import { formatPrice } from '../utils/format';
import Button from './Button';

interface DetailBottomBarProps {
  priceLabel: string;        // « Prix » ou « À partir de »
  price: string | number;
  ctaLabel: string;
  onPress: () => void;
  disabled?: boolean;
}

// Barre d'action ancrée en bas des fiches détail : libellé + prix serif à
// gauche, CTA doré à droite. Respecte la safe area basse.
export default function DetailBottomBar({
  priceLabel,
  price,
  ctaLabel,
  onPress,
  disabled = false,
}: DetailBottomBarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          paddingBottom: insets.bottom + spacing.md,
        },
      ]}
    >
      <View style={{ marginRight: spacing.lg }}>
        <Text style={[typography.small, { color: theme.textMuted }]}>{priceLabel}</Text>
        <Text style={[typography.priceLg, { color: theme.gold }]}>{formatPrice(price)}</Text>
      </View>
      <Button
        label={ctaLabel}
        onPress={onPress}
        disabled={disabled}
        style={{ flex: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
});