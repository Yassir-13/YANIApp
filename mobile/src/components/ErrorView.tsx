import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing } from '../theme/typography';
import Button from './Button';

interface ErrorViewProps {
  message?: string;
  onRetry?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}

// Le message par défaut n'est plus une valeur de paramètre : il dépend de la
// langue, donc il se résout dans le corps du composant, là où `t` existe.
export default function ErrorView({
  message,
  onRetry,
  icon = 'cloud-offline-outline',
}: ErrorViewProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={56} color={theme.textMuted} />
      <Text style={[typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: spacing.md, marginHorizontal: spacing.lg }]}>
        {message ?? t('common.genericError')}
      </Text>
      {onRetry && (
        <Button
          label={t('common.retry')}
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