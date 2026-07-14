import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography, radius, spacing } from '../theme/typography';

interface ChipProps {
  label: string;
  active?: boolean;
  onPress: () => void;
}

// Puce de filtre (Tous / Huiles / Soins… · Visage / Corps / Mains…).
// Active = pastille dorée pleine, inactive = contour discret.
export default function Chip({ label, active = false, onPress }: ChipProps) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.chip,
        active
          ? { backgroundColor: theme.chipActiveBg, borderColor: theme.chipActiveBg }
          : { backgroundColor: theme.chipInactiveBg, borderColor: theme.chipBorder },
      ]}
    >
      <Text
        style={[
          typography.bodyMedium,
          { color: active ? theme.chipActiveText : theme.chipInactiveText },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    marginRight: spacing.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
});