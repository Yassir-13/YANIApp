import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing } from '../theme/typography';
import Button from './Button';

interface ErrorViewProps {
  message?: string;
  onRetry?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}

export default function ErrorView({
  message = 'Une erreur est survenue.',
  onRetry,
  icon = 'cloud-offline-outline',
}: ErrorViewProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={56} color={theme.textMuted} />
      <Text style={[typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: spacing.md, marginHorizontal: spacing.lg }]}>
        {message}
      </Text>
      {onRetry && (
        <Button
          label="Réessayer"
          variant="outline"
          onPress={onRetry}
          style={{ marginTop: spacing.lg, paddingHorizontal: spacing.xl }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
});