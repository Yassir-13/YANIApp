import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius, shadow } from '../theme/typography';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export default function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;

  // Le variant primary est un dégradé doré avec halo (comme les CTA maquette).
  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        style={[
          styles.wrapper,
          !isDisabled && shadow.gold,
          { opacity: isDisabled ? 0.5 : 1 },
          style,
        ]}
      >
        <LinearGradient
          colors={theme.goldGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          {loading ? (
            <ActivityIndicator color="#1A1712" />
          ) : (
            <Text style={[typography.button, { color: '#1A1712' }]}>{label}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  // outline / danger : contour, pas de remplissage.
  const variantStyle: ViewStyle = {
    outline: { backgroundColor: 'transparent', borderColor: theme.border, borderWidth: 1 },
    danger: { backgroundColor: 'transparent', borderColor: theme.danger, borderWidth: 1 },
  }[variant];

  const textColor = variant === 'danger' ? theme.danger : theme.text;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={[
        styles.button,
        variantStyle,
        { opacity: isDisabled ? 0.5 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[typography.button, { color: textColor }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radius.md,
  },
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52, // > 44pt touch target (guide UI)
  },
});