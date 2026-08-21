import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { Service } from '../api/services';
import { mediaUrl } from '../api/config';
import { formatPrice, formatDuration } from '../utils/format';

interface ServiceCardProps {
  service: Service;
  onPress: () => void;
  width?: number;
}

// Carte service : grand visuel avec nom + durée/prix.
export default function ServiceCard({ service, onPress, width }: ServiceCardProps) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={service.name}
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, width ? { width } : { flex: 1 }]}
    >
      <View style={styles.image}>
        {service.imageUrl ? (
          <Image source={{ uri: mediaUrl(service.imageUrl) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Ionicons name="sparkles-outline" size={28} color={theme.textMuted} />
        )}
      </View>
      <View style={styles.body}>
        <Text numberOfLines={1} style={[typography.subtitle, { color: theme.text }]}>
          {service.name}
        </Text>
        <View style={styles.footer}>
          <Text style={[typography.caption, { color: theme.textSecondary }]}>
            {formatDuration(service.durationMin)}
          </Text>
          <Text style={[typography.price, { color: theme.gold }]}>{formatPrice(service.price)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  image: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
});