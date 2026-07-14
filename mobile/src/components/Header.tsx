import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';

interface HeaderProps {
  title?: string;           // titre serif optionnel (« Choisir un créneau »)
  onBack?: () => void;      // affiche la flèche ronde de retour
  right?: React.ReactNode;  // action à droite (cœur, recherche…)
  serifTitle?: boolean;     // true = titre en serif display (défaut), false = sans
}

// En-tête réutilisable : bouton retour rond translucide (comme les fiches
// détail de la maquette), titre centré/aligné, action optionnelle à droite.
export default function Header({ title, onBack, right, serifTitle = true }: HeaderProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.side}>
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.round, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </TouchableOpacity>
        )}
      </View>

      {title ? (
        <Text
          numberOfLines={1}
          style={[
            serifTitle ? typography.headingSm : typography.title,
            { color: theme.text, flex: 1, textAlign: onBack ? 'left' : 'center' },
          ]}
        >
          {title}
        </Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}

      <View style={[styles.side, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  side: {
    minWidth: 44,
    justifyContent: 'center',
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});