import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { useAuthStore } from '../stores/authStore';
import Button from '../components/Button';
import { useAlert } from '../components/AlertProvider';
import { validatePassword, PASSWORD_MIN_LENGTH } from '../utils/passwordRules';
import { validatePhone, formatPhoneForDisplay } from '../utils/phoneRules';
import { apiErrorMessage } from '../utils/apiError';
import { mirroredIcon } from '../i18n';

// Les règles de numéro et de mot de passe vivaient ici, recopiées à la main.
// Elles sont désormais dans utils/ : trois écrans les appliquaient, chacun à sa
// façon — et celui du changement de mot de passe en avait oublié la moitié.

export default function RegisterScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const { alert , show } = useAlert();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = async () => {
    if (!firstName.trim()) {
      alert(t('auth.fieldRequired'), t('auth.firstNameRequired'));
      return;
    }
    if (!lastName.trim()) {
      alert(t('auth.fieldRequired'), t('auth.lastNameRequired'));
      return;
    }
    // Les validateurs renvoient une CLÉ, pas un message : c'est ici qu'elle
    // devient du texte, dans la langue active.
    const erreurNumero = validatePhone(phone.trim());
    if (erreurNumero) {
      alert(t('auth.invalidPhone'), t(erreurNumero));
      return;
    }
    if (!email || !password) {
      alert(t('auth.fieldsRequired'), t('auth.emailPasswordRequired'));
      return;
    }
    const erreurMotDePasse = validatePassword(password);
    if (erreurMotDePasse) {
      alert(t('auth.passwordRejected'), t(erreurMotDePasse, { min: PASSWORD_MIN_LENGTH }));
      return;
    }

    // Dernière relecture du numéro avant de créer le compte.
    // C'est le seul moyen de contact de l'institut : une faute de frappe et
    // la cliente ne peut être ni rappelée pour sa commande, ni pour son RDV.
    show({
      title: t('auth.checkPhoneTitle'),
      message: t('auth.checkPhoneMessage', { phone: formatPhoneForDisplay(phone.trim()) }),
      buttons: [
        { text: t('auth.editPhone'), style: 'cancel' },
        { text: t('auth.phoneCorrect'), onPress: submitRegistration },
      ],
    });
  };

  const submitRegistration = async () => {
    try {
      await register(email.trim(), password, firstName.trim(), lastName.trim(), phone.trim());
      // Le compte est créé ET connecté : on enchaîne sur la saisie du code
      // reçu par email. `replace` et non `navigate` — l'inscription est
      // terminée, revenir en arrière dessus n'aurait aucun sens.
      //
      // L'étape reste facultative (« Plus tard »), et la quitter ramène au même
      // endroit que le retour direct d'avant.
      navigation.replace('VerifyEmail', { skippable: true });
    } catch (error) {
      alert(t('common.error'), apiErrorMessage(error, t('auth.registerFailed')));
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
      {navigation.canGoBack() && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name={mirroredIcon('chevron-back')} size={26} color={theme.text} />
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={[typography.display, { color: theme.text, textAlign: 'center' }]}>{t('auth.registerTitle')}</Text>
        <Text style={[typography.caption, { color: theme.textSecondary, textAlign: 'center', marginBottom: spacing.xl }]}>
          {t('auth.registerSubtitle')}
        </Text>

        <TextInput style={inputStyle} placeholder={t('auth.firstName')} placeholderTextColor={theme.textMuted} value={firstName} onChangeText={setFirstName} />
        <TextInput style={inputStyle} placeholder={t('auth.lastName')} placeholderTextColor={theme.textMuted} value={lastName} onChangeText={setLastName} />
        <TextInput
          style={inputStyle}
          placeholder={t('auth.phone')}
          placeholderTextColor={theme.textMuted}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <TextInput
          style={inputStyle}
          placeholder={t('auth.email')}
          placeholderTextColor={theme.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={inputStyle}
          // Le minimum vient de la constante et non d'un « 8 » recopié : les
          // deux pouvaient diverger.
          placeholder={t('auth.passwordMinPlaceholder', { min: PASSWORD_MIN_LENGTH })}
          placeholderTextColor={theme.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Button
          label={isLoading ? t('auth.registering') : t('auth.register')}
          onPress={handleRegister}
          loading={isLoading}
          style={{ marginTop: spacing.sm }}
        />

        <TouchableOpacity onPress={() => { if (navigation.canGoBack()) navigation.goBack(); }} style={{ marginTop: spacing.lg }}>
          <Text style={[typography.caption, { color: theme.textSecondary, textAlign: 'center' }]}>
            {t('auth.alreadyAccount')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: { position: 'absolute', top: spacing.xxl, left: spacing.md, zIndex: 10, padding: spacing.sm },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xxl },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
});