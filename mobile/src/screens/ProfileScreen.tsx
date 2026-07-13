import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing } from '../theme/typography';
import { useAuthStore } from '../stores/authStore';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Button from '../components/Button';

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
    <Screen scroll>
      <TouchableOpacity
        style={{ marginBottom: spacing.md }}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="chevron-back" size={26} color={theme.text} />
      </TouchableOpacity>

      <Text style={[typography.heading, { color: theme.text, marginBottom: spacing.lg }]}>Profil</Text>

      {/* Carte compte */}
      <Card>
        {user ? (
          <>
            <Text style={[typography.subtitle, { color: theme.text }]}>
              {user.firstName ?? 'Client'} {user.lastName ?? ''}
            </Text>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>{user.email}</Text>
          </>
        ) : (
          <>
            <Text style={[typography.subtitle, { color: theme.text, marginBottom: spacing.md }]}>Invité</Text>
            <Button label="Se connecter / Créer un compte" onPress={() => navigation.navigate('Login')} />
          </>
        )}
      </Card>

      {/* Mes rendez-vous (si connecté) */}
      {user && (
        <>
          <Text style={[typography.small, { color: theme.textMuted, letterSpacing: 1, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
            MON COMPTE
          </Text>
          <Card onPress={() => navigation.navigate('MyAppointments')}>
            <View style={styles.linkRow}>
              <Text style={[typography.body, { color: theme.text }]}>Mes rendez-vous</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
            </View>
          </Card>
        </>
      )}

      {/* Apparence */}
      <Text style={[typography.small, { color: theme.textMuted, letterSpacing: 1, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
        APPARENCE
      </Text>
      <Card>
        {themeOptions.map((opt, i) => (
          <TouchableOpacity
            key={opt.key}
            onPress={() => setPreference(opt.key)}
            style={[styles.themeRow, i < themeOptions.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}
          >
            <Text style={[typography.body, { color: theme.text }]}>{opt.label}</Text>
            {preference === opt.key && <Ionicons name="checkmark" size={20} color={theme.gold} />}
          </TouchableOpacity>
        ))}
      </Card>

      {/* Déconnexion */}
      {user && (
        <Button label="Se déconnecter" variant="danger" onPress={logout} style={{ marginTop: spacing.xl }} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  themeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md },
});