import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { Service } from '../api/services';
import { mediaUrl } from '../api/config';
import { formatPrice, formatDuration } from '../utils/format';

interface ServiceMiniCardProps {
  service: Service;
  subtitle?: string; // ex. « Institut Yani Concept » — sinon durée · prix
}

// Bandeau service compact : vignette + nom + méta. Réutilisé en tête du
// choix de créneau et du récapitulatif.
export default function ServiceMiniCard({ service, subtitle }: ServiceMiniCardProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[styles.thumb, { backgroundColor: theme.surfaceAlt }]}>
        {service.imageUrl ? (
          <Image source={{ uri: mediaUrl(service.imageUrl) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Ionicons name="sparkles-outline" size={20} color={theme.textMuted} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[typography.subtitle, { color: theme.text }]}>
          {service.name}
        </Text>
        <Text numberOfLines={1} style={[typography.caption, { color: theme.textSecondary, marginTop: 2 }]}>
          {subtitle ?? `${formatDuration(service.durationMin)} · ${formatPrice(service.price)}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
    gap: spacing.md,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});