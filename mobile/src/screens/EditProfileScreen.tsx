import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { useAuthStore } from '../stores/authStore';
import { usersApi } from '../api/users';
import { validatePhone } from '../utils/phoneRules';
import { apiErrorMessage } from '../utils/apiError';
import Header from '../components/Header';
import Button from '../components/Button';
import { useAlert } from '../components/AlertProvider';

export default function EditProfileScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { alert } = useAlert();

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState((user as any)?.phone ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!firstName.trim()) {
      alert(t('auth.fieldRequired'), t('auth.firstNameRequired'));
      return;
    }
    if (!lastName.trim()) {
      alert(t('auth.fieldRequired'), t('auth.lastNameRequired'));
      return;
    }
    // Le champ est optionnel, mais s'il est rempli il doit être valide — le
    // backend l'exige (IsMoroccanPhone), et cet écran ne le vérifiait pas :
    // le refus arrivait du serveur, en langage de serveur.
    const numero = phone.trim();
    if (numero) {
      const erreurNumero = validatePhone(numero);
      if (erreurNumero) {
        alert(t('auth.invalidPhone'), t(erreurNumero));
        return;
      }
    }
    setSaving(true);
    try {
      const updated = await usersApi.updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        // `null` et non `undefined` quand le champ est vidé. `undefined`
        // disparaît du JSON : le serveur ne voyait aucun champ `phone` et
        // laissait donc l'ancien numéro en base, pendant que l'app affichait
        // « Votre profil a été mis à jour ». Un champ libellé « (optionnel) »
        // doit pouvoir redevenir vide.
        phone: numero || null,
      });
      if (user) setUser({ ...user, ...updated });
      alert(t('auth.savedTitle'), t('auth.savedMessage'));
      navigation.goBack();
    } catch (e) {
      alert(t('common.error'), apiErrorMessage(e, t('auth.updateFailed')));
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <Header title={t('auth.editProfileTitle')} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Field label={t('auth.firstName')} theme={theme}>
          <TextInput style={inputStyle} value={firstName} onChangeText={setFirstName} placeholder={t('auth.firstName')} placeholderTextColor={theme.textMuted} />
        </Field>
        <Field label={t('auth.lastName')} theme={theme}>
          <TextInput style={inputStyle} value={lastName} onChangeText={setLastName} placeholder={t('auth.lastName')} placeholderTextColor={theme.textMuted} />
        </Field>
        <Field label={t('auth.phoneOptional')} theme={theme}>
          <TextInput
            style={inputStyle}
            value={phone}
            onChangeText={setPhone}
            placeholder="0612345678"
            placeholderTextColor={theme.textMuted}
            keyboardType="phone-pad"
          />
        </Field>

        {/* Email en lecture seule (non modifiable via l'API) */}
        <Field label={t('auth.email')} theme={theme}>
          <View style={[styles.input, styles.readonly, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
            <Text style={[typography.body, { color: theme.textMuted }]}>{user?.email}</Text>
          </View>
        </Field>

        <Button label={saving ? t('auth.saving') : t('common.save')} onPress={handleSave} loading={saving} style={{ marginTop: spacing.md }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, theme, children }: any) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={[typography.caption, { color: theme.textSecondary, marginBottom: spacing.sm }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  readonly: {
    justifyContent: 'center',
  },
});