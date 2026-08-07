import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

/**
 * Signalement discret d'un échec de rafraîchissement, sans masquer le contenu.
 *
 * À utiliser quand on a DÉJÀ des données à l'écran : sur mobile, une coupure
 * d'une seconde ne doit pas faire disparaître une liste entière. `ErrorView`
 * reste le bon choix quand il n'y a rien à afficher.
 */
export default function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
      ]}
    >
      <Ionicons name="cloud-offline-outline" size={16} color={theme.textSecondary} />
      <Text
        style={[typography.caption, { color: theme.textSecondary, flex: 1, marginLeft: spacing.sm }]}
        numberOfLines={2}
      >
        {message}
      </Text>
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[typography.caption, { color: theme.gold, fontWeight: '600' }]}>
            Réessayer
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
