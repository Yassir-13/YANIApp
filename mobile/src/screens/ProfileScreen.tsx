import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { useAuthStore } from '../stores/authStore';
import { useAlert } from '../components/AlertProvider';
import Button from '../components/Button';
import SettingsRow from '../components/SettingsRow';
import { usersApi } from '../api/users';
import { LANGUAGES, LANGUAGE_NAMES, currentLanguage, setLanguage, type Language, mirroredIcon } from '../i18n';

export default function ProfileScreen({ navigation }: any) {
  const { theme, preference, setPreference } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { alert, show } = useAlert();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);

  const themeOptions: { key: 'system' | 'light' | 'dark'; label: string }[] = [
    { key: 'system', label: t('profile.themeSystem') },
    { key: 'light', label: t('profile.themeLight') },
    { key: 'dark', label: t('profile.themeDark') },
  ];

  // `useTranslation` réabonne le composant aux changements de langue : la
  // coche se déplace donc dès la sélection, sans attendre le redémarrage.
  const activeLanguage = currentLanguage();

  const handleLanguageChange = async (lang: Language) => {
    const { needsRestart } = await setLanguage(lang);

    // Le serveur doit connaître la langue pour ses EMAILS : ils partent
    // longtemps après, sans requête en cours dont lire l'en-tête.
    //
    // Volontairement silencieux en cas d'échec : la langue de l'application
    // est déjà changée, et faire échouer un simple choix de langue à cause du
    // réseau serait absurde. La prochaine modification du profil corrigera.
    if (user) {
      usersApi.updateProfile({ locale: lang }).catch(() => {});
    }

    if (needsRestart) {
      // Le message s'affiche dans la langue qui vient d'être choisie — c'est
      // elle que la cliente doit pouvoir lire.
      show({
        title: t('language.restartTitle'),
        message: t('language.restartMessage'),
        buttons: [{ text: t('language.restartUnderstood') }],
      });
    }
  };

  const confirmLogout = () => {
    show({
      title: t('profile.logout'),
      message: t('profile.logoutConfirmMessage'),
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('profile.logout'), style: 'destructive', onPress: () => logout() },
      ],
    });
  };

  const confirmDelete = () => {
    show({
      title: t('profile.deleteTitle'),
      message: t('profile.deleteMessage'),
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            // Seconde confirmation forte avant l'irréversible
            show({
              title: t('profile.deleteConfirmTitle'),
              message: t('profile.deleteConfirmMessage'),
              buttons: [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('profile.deleteConfirmAction'),
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await deleteAccount();
                      navigation.goBack();
                    } catch (e: any) {
                      alert(t('common.error'), e.response?.data?.message || t('profile.deleteFailed'));
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
      : t('profile.defaultName');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[typography.display, { color: theme.text, marginBottom: spacing.lg }]}>{t('profile.title')}</Text>

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
            <Text style={[typography.subtitle, { color: theme.text }]}>{t('profile.guestGreeting')}</Text>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>
              {t('profile.guestSubtitle')}
            </Text>
          </View>
        )}
      </View>

      {/* Rappel de confirmation d'email.
          Volontairement doré et non rouge : le compte fonctionne parfaitement
          sans, ce n'est pas une erreur mais une action qui reste à faire.
          C'est elle qui rendra possible la récupération du mot de passe. */}
      {user && !user.emailVerifiedAt && (
        <TouchableOpacity
          onPress={() => navigation.navigate('VerifyEmail')}
          activeOpacity={0.7}
          accessibilityRole="button"
          style={[styles.verifyBanner, { backgroundColor: theme.goldSoft, borderColor: theme.gold }]}
        >
          <Ionicons name="mail-unread-outline" size={22} color={theme.gold} />
          <View style={{ flex: 1 }}>
            <Text style={[typography.body, { color: theme.text }]}>{t('profile.verifyEmailTitle')}</Text>
            <Text style={[typography.caption, { color: theme.textSecondary, marginTop: 2 }]}>
              {t('profile.verifyEmailSubtitle')}
            </Text>
          </View>
          <Ionicons name={mirroredIcon('chevron-forward')} size={18} color={theme.textMuted} />
        </TouchableOpacity>
      )}

      {!user && (
        <Button
          label={t('profile.signInOrRegister')}
          onPress={() => navigation.navigate('Login')}
          style={{ marginTop: spacing.md }}
        />
      )}

      {/* Compte (si connecté) */}
      {user && (
        <>
          <SectionLabel theme={theme}>{t('profile.sectionAccount')}</SectionLabel>
          <Group theme={theme}>
            <SettingsRow icon="person-outline" label={t('profile.editProfile')} onPress={() => navigation.navigate('EditProfile')} />
            <SettingsRow icon="bag-outline" label={t('profile.myOrders')} onPress={() => navigation.navigate('MyOrders')} />
            <SettingsRow icon="calendar-outline" label={t('profile.myAppointments')} onPress={() => navigation.navigate('MyAppointments')} />
            <SettingsRow icon="heart-outline" label={t('profile.myLoyalty')} onPress={() => { navigation.goBack(); navigation.navigate('Main', { screen: 'Fidélité' }); }} last />
          </Group>

          <SectionLabel theme={theme}>{t('profile.sectionSecurity')}</SectionLabel>
          <Group theme={theme}>
            <SettingsRow icon="lock-closed-outline" label={t('profile.changePassword')} onPress={() => navigation.navigate('ChangePassword')} last />
          </Group>
        </>
      )}

      {/* Apparence */}
      <SectionLabel theme={theme}>{t('profile.sectionAppearance')}</SectionLabel>
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

      {/* Langue.
          Chaque langue est écrite dans sa propre écriture, jamais traduite :
          une cliente qui ne lit pas le français ne trouverait pas « Arabe »
          dans une liste rédigée en français. */}
      <SectionLabel theme={theme}>{t('profile.sectionLanguage')}</SectionLabel>
      <Group theme={theme}>
        {LANGUAGES.map((lang, i) => (
          <TouchableOpacity
            key={lang}
            onPress={() => handleLanguageChange(lang)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: activeLanguage === lang }}
            style={[
              styles.themeRow,
              { borderBottomColor: theme.border, borderBottomWidth: i < LANGUAGES.length - 1 ? StyleSheet.hairlineWidth : 0 },
            ]}
          >
            <Text style={[typography.body, { color: theme.text }]}>{LANGUAGE_NAMES[lang]}</Text>
            {activeLanguage === lang && <Ionicons name="checkmark" size={20} color={theme.gold} />}
          </TouchableOpacity>
        ))}
      </Group>

      {/* Actions de compte */}
      {user && (
        <>
          <Button label={t('profile.logout')} variant="outline" onPress={confirmLogout} style={{ marginTop: spacing.xl }} />
          <TouchableOpacity onPress={confirmDelete} accessibilityRole="button" style={{ marginTop: spacing.lg, alignItems: 'center' }}>
            <Text style={[typography.caption, { color: theme.danger }]}>{t('profile.deleteAccount')}</Text>
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
  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginTop: spacing.md,
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