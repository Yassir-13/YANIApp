import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography, radius } from '../theme/typography';

// Deux états, les deux seuls qui existent au catalogue. « Bientôt » et
// « Nouv ! » ont été retirés : ils n'étaient utilisés nulle part, et « Bientôt »
// servait même à annoncer une rupture — une nouveauté à venir là où il n'y
// avait plus rien à vendre.
type BadgeKind = 'inStock' | 'outOfStock';

interface BadgeProps {
  kind: BadgeKind;
}

// Petit statut coloré vu sur les cartes produit (« En stock », « Épuisé »).
// Un point + un texte : l'info ne repose jamais sur la couleur seule (guide UI color-not-only).
export default function Badge({ kind }: BadgeProps) {
  const { theme } = useTheme();

  const config = {
    inStock: { bg: theme.badgeInStockBg, fg: theme.badgeInStock, text: 'En stock' },
    // Gris neutre et non doré : le doré annonce une bonne nouvelle, une
    // rupture n'en est pas une.
    outOfStock: { bg: theme.badgeOutBg, fg: theme.badgeOut, text: 'Épuisé' },
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