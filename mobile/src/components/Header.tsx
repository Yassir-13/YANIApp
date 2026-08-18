import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { mirroredIcon } from '../i18n';

interface HeaderProps {
  title?: string;           // titre serif optionnel (« Choisir un créneau »)
  onBack?: () => void;      // affiche la flèche ronde de retour
}

// En-tête réutilisable : bouton retour rond translucide (comme les fiches
// détail de la maquette), titre centré ou aligné à gauche selon la présence du
// retour.
//
// `right` (action à droite) et `serifTitle` ont été retirés : aucun écran ne
// les passait, et une option jamais exercée est une option jamais vérifiée.
export default function Header({ title, onBack }: HeaderProps) {
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
            <Ionicons name={mirroredIcon('chevron-back')} size={22} color={theme.text} />
          </TouchableOpacity>
        )}
      </View>

      {title ? (
        <Text
          numberOfLines={1}
          style={[
            typography.headingSm,
            { color: theme.text, flex: 1, textAlign: onBack ? 'left' : 'center' },
          ]}
        >
          {title}
        </Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}

      {/* Contrepoids du bouton retour : sans lui, un titre centré ne le serait
          pas vraiment. */}
      <View style={styles.side} />
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