import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';

// ── Types ────────────────────────────────────────────────────────────────
interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface AlertOptions {
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

interface AlertContextValue {
  // Alerte simple (un seul bouton « OK »)
  alert: (title: string, message?: string) => void;
  // Alerte à boutons personnalisés (confirmations, choix)
  show: (options: AlertOptions) => void;
}

const AlertContext = createContext<AlertContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────
export function AlertProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<AlertOptions>({ title: '' });

  const show = useCallback((opts: AlertOptions) => {
    setOptions(opts);
    setVisible(true);
  }, []);

  const alert = useCallback((title: string, message?: string) => {
    show({ title, message, buttons: [{ text: t('common.ok') }] });
  }, [show, t]);

  const close = () => setVisible(false);

  const buttons = options.buttons?.length ? options.buttons : [{ text: t('common.ok') }];

  return (
    <AlertContext.Provider value={{ alert, show }}>
      {children}

      <Modal transparent visible={visible} animationType="fade" onRequestClose={close} statusBarTranslucent>
        <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={close}>
          {/* Le contenu stoppe la propagation pour ne pas fermer en cliquant dedans */}
          <Pressable style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => {}}>
            {/* Filet doré en haut */}
            <LinearGradient
              colors={[theme.goldLight, theme.gold]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.topAccent}
            />

            <Text style={[typography.headingSm, { color: theme.text, marginBottom: options.message ? spacing.sm : spacing.lg }]}>
              {options.title}
            </Text>

            {options.message ? (
              <Text style={[typography.body, { color: theme.textSecondary, marginBottom: spacing.lg }]}>
                {options.message}
              </Text>
            ) : null}

            <View style={[styles.actions, buttons.length > 2 && styles.actionsStacked]}>
              {buttons.map((btn, i) => {
                const isDestructive = btn.style === 'destructive';
                const isCancel = btn.style === 'cancel';
                const onPress = () => {
                  close();
                  // Laisse le modal se fermer avant d'exécuter l'action
                  setTimeout(() => btn.onPress?.(), 0);
                };
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={onPress}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    style={[
                      styles.btn,
                      buttons.length > 2 && styles.btnStacked,
                    ]}
                  >
                    <Text
                      style={[
                        typography.button,
                        {
                          color: isDestructive ? theme.danger : isCancel ? theme.textMuted : theme.gold,
                          textAlign: 'center',
                        },
                      ]}
                    >
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AlertContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────
export function useAlert(): AlertContextValue {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert doit être utilisé dans un <AlertProvider>.');
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    overflow: 'hidden',
  },
  topAccent: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  actionsStacked: {
    flexDirection: 'column-reverse',
  },
  btn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  btnStacked: {
    width: '100%',
  },
});