import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import Drop from './Drop';

interface LoyaltyBannerProps {
  points: number;
  // Ligne du bas : soit un CTA « Se connecter » (invité), soit un texte libre.
  guest?: boolean;
  subtitle?: string;          // ex. « Mode invité · suivez vos points »
  ctaLabel?: string;          // ex. « Se connecter »
  onCtaPress?: () => void;
  style?: ViewStyle;
}

// Bandeau fidélité : fond sombre (dans les deux thèmes), halo doré radial en
// haut-droite, goutte dorée vectorielle, gros solde en serif.
export default function LoyaltyBanner({
  points,
  guest = false,
  subtitle,
  ctaLabel,
  onCtaPress,
  style,
}: LoyaltyBannerProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.loyaltyBg }, style]}>
      {/* Halo doré radial simulé par un dégradé diagonal translucide */}
      <LinearGradient
        colors={[theme.loyaltyGlow, 'transparent']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.2, y: 0.9 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.sectionLabel, { color: theme.goldLight, letterSpacing: 2 }]}>
            Fidélité
          </Text>
          <View style={styles.pointsRow}>
            <Text style={[typography.priceLg, { color: theme.goldLight }]}>{points}</Text>
            <Text style={[typography.body, { color: theme.loyaltyText, marginLeft: 6 }]}>
              points
            </Text>
          </View>
        </View>

        <Drop size={52} colors={[theme.goldLight, theme.gold, theme.goldDeep]} />
      </View>

      <View style={[styles.divider, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />

      <View style={styles.bottomRow}>
        <Text style={[typography.caption, { color: 'rgba(245,239,225,0.6)', flex: 1 }]}>
          {subtitle}
        </Text>
        {guest && ctaLabel && (
          <TouchableOpacity
            onPress={onCtaPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.cta}
          >
            <Text style={[typography.subtitle, { color: theme.goldLight }]}>{ctaLabel}</Text>
            <Ionicons name="arrow-forward" size={16} color={theme.goldLight} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(216,168,72,0.25)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: spacing.md,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});