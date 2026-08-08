import { useState } from 'react';
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
import { authApi } from '../api/auth';
import { validatePassword, PASSWORD_MIN_LENGTH } from '../utils/passwordRules';
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
    } catch (e: any) {
      const msg = e.response?.data?.message;
      alert(
        'Erreur',
        Array.isArray(msg) ? msg.join('\n') : msg || 'Réinitialisation impossible.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleResend = async () => {
    try {
      await authApi.forgotPassword(email);
      alert('Code renvoyé', `Un nouveau code a été envoyé à ${email}.`);
    } catch {
      alert('Erreur', 'Envoi impossible. Réessayez dans un instant.');
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
          accessibilityRole="button"
          style={{ marginTop: spacing.lg }}
        >
          <Text
            style={[typography.caption, { color: theme.gold, textAlign: 'center' }]}
          >
            Je n’ai rien reçu — renvoyer le code
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
