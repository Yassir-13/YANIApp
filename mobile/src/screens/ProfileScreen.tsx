import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { useAuthStore } from '../stores/authStore';
import { useAlert } from '../components/AlertProvider';
import Button from '../components/Button';
import SettingsRow from '../components/SettingsRow';

export default function ProfileScreen({ navigation }: any) {
  const { theme, preference, setPreference } = useTheme();
  const insets = useSafeAreaInsets();
  const { alert, show } = useAlert();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);

  const themeOptions: { key: 'system' | 'light' | 'dark'; label: string }[] = [
    { key: 'system', label: 'Système' },
    { key: 'light', label: 'Clair' },
    { key: 'dark', label: 'Sombre' },
  ];

  const confirmLogout = () => {
    show({
      title: 'Se déconnecter',
      message: 'Voulez-vous vraiment vous déconnecter ?',
      buttons: [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se déconnecter', style: 'destructive', onPress: () => logout() },
      ],
    });
  };

  const confirmDelete = () => {
    show({
      title: 'Supprimer le compte',
      message:
        'Cette action est définitive. Toutes vos données (rendez-vous, points de fidélité) seront supprimées. Voulez-vous continuer ?',
      buttons: [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            // Seconde confirmation forte avant l'irréversible
            show({
              title: 'Confirmer',
              message: 'Confirmez-vous la suppression définitive de votre compte ?',
              buttons: [
                { text: 'Annuler', style: 'cancel' },
                {
                  text: 'Oui, supprimer',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await deleteAccount();
                      navigation.goBack();
                    } catch (e: any) {
                      alert('Erreur', e.response?.data?.message || 'Suppression impossible.');
                    }
                  },
                },
              ],
            });
          },
        },
      ],
    });
  };

  const displayName =
    user && (user.firstName || user.lastName)
      ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
      : 'Client';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[typography.display, { color: theme.text, marginBottom: spacing.lg }]}>Profil</Text>

      {/* Carte compte */}
      <View style={[styles.accountCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[styles.avatar, { borderColor: theme.gold }]}>
          <Ionicons name="person-outline" size={26} color={theme.gold} />
        </View>
        {user ? (
          <View style={{ flex: 1 }}>
            <Text style={[typography.subtitle, { color: theme.text }]}>{displayName}</Text>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>{user.email}</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <Text style={[typography.subtitle, { color: theme.text }]}>Bonjour, invité</Text>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>
              Connectez-vous pour vos points & réservations
            </Text>
          </View>
        )}
      </View>

      {!user && (
        <Button
          label="Se connecter / Créer un compte"
          onPress={() => navigation.navigate('Login')}
          style={{ marginTop: spacing.md }}
        />
      )}

      {/* Compte (si connecté) */}
      {user && (
        <>
          <SectionLabel theme={theme}>Compte</SectionLabel>
          <Group theme={theme}>
            <SettingsRow icon="person-outline" label="Modifier le profil" onPress={() => navigation.navigate('EditProfile')} />
            <SettingsRow icon="bag-outline" label="Mes commandes" onPress={() => navigation.navigate('MyOrders')} /> <SettingsRow icon="bag-outline" label="Mes commandes" onPress={() => navigation.navigate('MyOrders')} />
            <SettingsRow icon="calendar-outline" label="Mes rendez-vous" onPress={() => navigation.navigate('MyAppointments')} />
            <SettingsRow icon="heart-outline" label="Ma fidélité" onPress={() => { navigation.goBack(); navigation.navigate('Main', { screen: 'Fidélité' }); }} last />
          </Group>

          <SectionLabel theme={theme}>Sécurité</SectionLabel>
          <Group theme={theme}>
            <SettingsRow icon="lock-closed-outline" label="Changer le mot de passe" onPress={() => navigation.navigate('ChangePassword')} last />
          </Group>
        </>
      )}

      {/* Apparence */}
      <SectionLabel theme={theme}>Apparence</SectionLabel>
      <Group theme={theme}>
        {themeOptions.map((opt, i) => (
          <TouchableOpacity
            key={opt.key}
            onPress={() => setPreference(opt.key)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: preference === opt.key }}
            style={[
              styles.themeRow,
              { borderBottomColor: theme.border, borderBottomWidth: i < themeOptions.length - 1 ? StyleSheet.hairlineWidth : 0 },
            ]}
          >
            <Text style={[typography.body, { color: theme.text }]}>{opt.label}</Text>
            {preference === opt.key && <Ionicons name="checkmark" size={20} color={theme.gold} />}
          </TouchableOpacity>
        ))}
      </Group>

      {/* Actions de compte */}
      {user && (
        <>
          <Button label="Se déconnecter" variant="outline" onPress={confirmLogout} style={{ marginTop: spacing.xl }} />
          <TouchableOpacity onPress={confirmDelete} accessibilityRole="button" style={{ marginTop: spacing.lg, alignItems: 'center' }}>
            <Text style={[typography.caption, { color: theme.danger }]}>Supprimer mon compte</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

function SectionLabel({ children, theme }: any) {
  return (
    <Text style={[typography.sectionLabel, { color: theme.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm, paddingHorizontal: spacing.xs }]}>
      {children}
    </Text>
  );
}

function Group({ children, theme }: any) {
  return (
    <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  group: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
  },
  themeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
});