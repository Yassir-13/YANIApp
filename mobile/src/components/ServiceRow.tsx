import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { Service } from '../api/services';
import { formatPrice, formatDuration } from '../utils/format';
import { mirroredIcon } from '../i18n';

interface ServiceRowProps {
  service: Service;
  onPress: () => void;
}

// Ligne de service (catalogue) : vignette carrée, nom + durée·description,
// prix en serif, chevron. Reproduit la liste de la maquette Services.
export default function ServiceRow({ service, onPress }: ServiceRowProps) {
  const { theme } = useTheme();

  // Sous-titre = début de description (ex. « éclat & hydratation »)
  const subtitle = service.description
    ? service.description.split(/[.\n]/)[0].trim()
    : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={service.name}
      style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={[styles.thumb, { backgroundColor: theme.surfaceAlt }]}>
        {service.imageUrl ? (
          <Image source={{ uri: service.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Ionicons name="sparkles-outline" size={22} color={theme.textMuted} />
        )}
      </View>

      <View style={styles.body}>
        <Text numberOfLines={1} style={[typography.subtitle, { color: theme.text }]}>
          {service.name}
        </Text>
        <Text numberOfLines={1} style={[typography.caption, { color: theme.textSecondary, marginTop: 2 }]}>
          {formatDuration(service.durationMin)}
          {subtitle ? ` · ${subtitle}` : ''}
        </Text>
        <Text style={[typography.price, { color: theme.gold, marginTop: spacing.xs }]}>
          {formatPrice(service.price)}
        </Text>
      </View>

      <Ionicons name={mirroredIcon('chevron-forward')} size={20} color={theme.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  body: {
    flex: 1,
  },
});