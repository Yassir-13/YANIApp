import { ReactNode } from 'react';
import { View, StyleSheet, ScrollView, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/typography';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;          // true = contenu défilable
  padded?: boolean;          // true = padding horizontal standard
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

export default function Screen({
  children,
  scroll = false,
  padded = true,
  style,
  contentStyle,
}: ScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const basePadding = {
    paddingTop: insets.top + spacing.md,
    paddingHorizontal: padded ? spacing.lg : 0,
  };

  if (scroll) {
    return (
      <ScrollView
        style={[{ flex: 1, backgroundColor: theme.background }, style]}
        contentContainerStyle={[
          basePadding,
          { paddingBottom: spacing.xxl },
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View
      style={[
        { flex: 1, backgroundColor: theme.background },
        basePadding,
        style,
      ]}
    >
      {children}
    </View>
  );
}