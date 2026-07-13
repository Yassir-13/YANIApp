import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing } from '../theme/typography';

interface EmptyViewProps {
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export default function EmptyView({ message, icon = 'file-tray-outline' }: EmptyViewProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color={theme.textMuted} />
      <Text style={[typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: spacing.md, marginHorizontal: spacing.lg }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    minHeight: 200,
  },
});