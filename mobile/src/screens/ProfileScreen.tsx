import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { useAuthStore } from '../stores/authStore';

export default function ProfileScreen({ navigation }: any) {
  const { theme, preference, setPreference } = useTheme();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const themeOptions: { key: 'system' | 'light' | 'dark'; label: string }[] = [
    { key: 'system', label: 'Système' },
    { key: 'light', label: 'Clair' },
    { key: 'dark', label: 'Sombre' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={[styles.backText, { color: theme.text }]}>‹ Retour</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xxl }}>
        <Text style={[typography.heading, { color: theme.text, marginTop: spacing.lg, marginBottom: spacing.lg }]}>
          Profil
        </Text>

        {/* Carte compte */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {user ? (
            <>
              <Text style={[typography.subtitle, { color: theme.text }]}>
                {user.firstName ?? 'Client'} {user.lastName ?? ''}
              </Text>
              <Text style={[typography.caption, { color: theme.textSecondary }]}>
                {user.email}
              </Text>
            </>
          ) : (
            <>
              <Text style={[typography.subtitle, { color: theme.text }]}>Invité</Text>
              <TouchableOpacity
                style={[styles.connectBtn, { backgroundColor: theme.gold }]}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={[typography.caption, { color: '#1E1B16', fontWeight: '600' }]}>
                  Se connecter / Créer un compte
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Sélecteur de thème */}
        <Text style={[typography.small, { color: theme.textMuted, letterSpacing: 1, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
          APPARENCE
        </Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {themeOptions.map((opt, i) => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setPreference(opt.key)}
              style={[
                styles.themeRow,
                i < themeOptions.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
              ]}
            >
              <Text style={[typography.body, { color: theme.text }]}>{opt.label}</Text>
              {preference === opt.key && (
                <Text style={[typography.subtitle, { color: theme.gold }]}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {user && (
          <>
            <Text style={[typography.small, { color: theme.textMuted, letterSpacing: 1, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
              MON COMPTE
            </Text>
            <TouchableOpacity
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => navigation.navigate('MyAppointments')}
            >
              <Text style={[typography.body, { color: theme.text }]}>Mes rendez-vous ›</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Déconnexion (seulement si connecté) */}
        {user && (
          <TouchableOpacity
            style={[styles.logoutBtn, { borderColor: theme.danger }]}
            onPress={logout}
          >
            <Text style={[typography.subtitle, { color: theme.danger }]}>Se déconnecter</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: { position: 'absolute', top: spacing.xxl, left: spacing.md, zIndex: 10, padding: spacing.sm },
  backText: { fontSize: 17, fontWeight: '500' },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  connectBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    marginTop: spacing.md,
  },
  themeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  logoutBtn: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
});