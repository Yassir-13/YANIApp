import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography, radius } from '../theme/typography';

type BadgeKind = 'inStock' | 'soon' | 'new';

interface BadgeProps {
  kind: BadgeKind;
  label?: string; // texte optionnel, sinon libellé par défaut
}

// Petit statut coloré vu sur les cartes produit (« En stock », « Bientôt », « Nouv! »).
// Un point + un texte : l'info ne repose jamais sur la couleur seule (guide UI color-not-only).
export default function Badge({ kind, label }: BadgeProps) {
  const { theme } = useTheme();

  const config = {
    inStock: { bg: theme.badgeInStockBg, fg: theme.badgeInStock, text: label ?? 'En stock' },
    soon: { bg: theme.badgeSoonBg, fg: theme.badgeSoon, text: label ?? 'Bientôt' },
    new: { bg: theme.badgeNewBg, fg: theme.badgeNew, text: label ?? 'Nouv !' },
  }[kind];

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <View style={[styles.dot, { backgroundColor: config.fg }]} />
      <Text style={[typography.small, { color: config.fg }]}>{config.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});