import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing } from '../theme/typography';

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean; // masque la bordure basse sur la dernière ligne d'un groupe
}

export default function SettingsRow({ icon, label, onPress, danger, last }: SettingsRowProps) {
  const { theme } = useTheme();
  const color = danger ? theme.danger : theme.text;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.row,
        { borderBottomColor: theme.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth },
      ]}
    >
      <Ionicons name={icon} size={20} color={danger ? theme.danger : theme.gold} />
      <Text style={[typography.body, { color, flex: 1, marginLeft: spacing.md }]}>{label}</Text>
      {!danger && <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
});