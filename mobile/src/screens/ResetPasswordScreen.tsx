import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { authApi, RESEND_COOLDOWN_SECONDS } from '../api/auth';
import { validatePassword, PASSWORD_MIN_LENGTH } from '../utils/passwordRules';
import { apiErrorMessage } from '../utils/apiError';
import Header from '../components/Header';
import Button from '../components/Button';
import { useAlert } from '../components/AlertProvider';

const CODE_LENGTH = 6;

export default function ResetPasswordScreen({ navigation, route }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { alert } = useAlert();

  const email: string = route?.params?.email ?? '';

  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  // Un code vient d'être envoyé par l'écran précédent : le compte à rebours
  // démarre donc plein, comme sur l'écran de confirmation d'email.
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const handleReset = async () => {
    if (code.length !== CODE_LENGTH) {
      alert('Code incomplet', `Le code contient ${CODE_LENGTH} chiffres.`);
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      alert('Mot de passe refusé', passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('Non concordant', 'La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    setSaving(true);
    try {
      await authApi.resetPassword({ email, code, newPassword });
      alert(
        'Mot de passe réinitialisé',
        'Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.',
      );
      // Retour à l'écran de connexion : la réinitialisation a révoqué toutes
      // les sessions, il n'y a donc rien à reprendre en arrière.
      navigation.navigate('Login');
    } catch (e) {
      alert('Erreur', apiErrorMessage(e, 'Réinitialisation impossible.'));
    } finally {
      setSaving(false);
    }
  };

  // Le serveur refuse d'émettre un second code avant 60 s. Cet écran annonçait
  // pourtant « un nouveau code a été envoyé » dans tous les cas : la cliente
  // attendait un email qui n'était jamais parti. L'écran de confirmation
  // d'email gérait déjà ce délai — pas celui-ci.
  const handleResend = async () => {
    if (secondsLeft > 0) return;
    try {
      await authApi.forgotPassword(email);
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
      setCode('');
      alert('Code renvoyé', `Un nouveau code a été envoyé à ${email}.`);
    } catch (e) {
      alert('Erreur', apiErrorMessage(e, 'Envoi impossible. Réessayez dans un instant.'));
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
      <Header title="Nouveau mot de passe" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          style={[
            typography.body,
            {
              color: theme.textSecondary,
              textAlign: 'center',
              lineHeight: 22,
              marginTop: spacing.lg,
            },
          ]}
        >
          Si un compte existe pour
        </Text>
        <Text
          style={[
            typography.subtitle,
            { color: theme.text, textAlign: 'center', marginTop: spacing.xs },
          ]}
        >
          {email}
        </Text>
        <Text
          style={[
            typography.caption,
            {
              color: theme.textMuted,
              textAlign: 'center',
              marginTop: spacing.xs,
              lineHeight: 20,
            },
          ]}
        >
          un code à {CODE_LENGTH} chiffres vient d’y être envoyé. Il expire au
          bout de 15 minutes.
        </Text>

        <Field label="Code reçu par email" theme={theme}>
          <TextInput
            style={[
              styles.codeInput,
              {
                backgroundColor: theme.surface,
                color: theme.text,
                borderColor: code.length === CODE_LENGTH ? theme.gold : theme.border,
              },
            ]}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, CODE_LENGTH))}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            placeholder="••••••"
            placeholderTextColor={theme.textMuted}
            textContentType="oneTimeCode"
            autoFocus
          />
        </Field>

        <Field
          label={`Nouveau mot de passe (min. ${PASSWORD_MIN_LENGTH} caractères)`}
          theme={theme}
        >
          <TextInput
            style={inputStyle}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={theme.textMuted}
          />
        </Field>

        <Field label="Confirmer le nouveau mot de passe" theme={theme}>
          <TextInput
            style={inputStyle}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={theme.textMuted}
          />
        </Field>

        <Button
          label={saving ? 'Enregistrement…' : 'Réinitialiser le mot de passe'}
          onPress={handleReset}
          loading={saving}
          style={{ marginTop: spacing.lg }}
        />

        <TouchableOpacity
          onPress={handleResend}
          disabled={secondsLeft > 0}
          accessibilityRole="button"
          accessibilityState={{ disabled: secondsLeft > 0 }}
          style={{ marginTop: spacing.lg }}
        >
          <Text
            style={[
              typography.caption,
              {
                color: secondsLeft > 0 ? theme.textMuted : theme.gold,
                textAlign: 'center',
              },
            ]}
          >
            {secondsLeft > 0
              ? `Renvoyer le code dans ${secondsLeft} s`
              : 'Je n’ai rien reçu — renvoyer le code'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, theme, children }: any) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text
        style={[
          typography.caption,
          { color: theme.textSecondary, marginBottom: spacing.sm },
        ]}
      >
        {label}
      </Text>
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
  codeInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
});
