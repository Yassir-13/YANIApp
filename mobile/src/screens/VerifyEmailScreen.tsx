import { useEffect, useRef, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { useAuthStore } from '../stores/authStore';
import { RESEND_COOLDOWN_SECONDS } from '../api/auth';
import { apiErrorMessage } from '../utils/apiError';
import Header from '../components/Header';
import Button from '../components/Button';
import { useAlert } from '../components/AlertProvider';

const CODE_LENGTH = 6;

export default function VerifyEmailScreen({ navigation, route }: any) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { alert } = useAlert();

  const user = useAuthStore((s) => s.user);
  const verifyEmail = useAuthStore((s) => s.verifyEmail);
  const resendCode = useAuthStore((s) => s.resendCode);

  // Depuis l'inscription, la confirmation peut être remise à plus tard : le
  // compte est déjà utilisable. Depuis le profil, la cliente est venue
  // volontairement, le bouton n'a plus lieu d'être.
  const skippable: boolean = route?.params?.skippable ?? false;

  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);

  // Où retourner en quittant cet écran.
  //
  // Depuis l'inscription, `goBack()` ramenait sur le formulaire de CONNEXION :
  // `Register` s'était fait remplacer par cet écran, la pile valait donc
  // [Main, Login, VerifyEmail] et l'écran précédent était Login — alors que la
  // cliente vient précisément de s'inscrire ET d'être connectée. On remonte
  // donc à l'accueil, qui est toujours le fond de la pile.
  //
  // Depuis le profil, `goBack()` reste juste : elle est venue volontairement
  // et doit retrouver son profil.
  const quitter = () =>
    skippable ? navigation.popToTop() : navigation.goBack();

  // Un code vient d'être envoyé à l'arrivée sur l'écran (à l'inscription) : le
  // compte à rebours démarre donc plein.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  // Empêche une double soumission : la saisie du 6ᵉ chiffre déclenche l'envoi,
  // et un caractère de plus (ou un collage) ne doit pas relancer la requête.
  const submittedCode = useRef<string | null>(null);

  const handleChange = (value: string) => {
    // On retire tout ce qui n'est pas un chiffre : le code est présenté espacé
    // dans l'email (« 482 913 »), et il est souvent collé tel quel.
    const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);

    if (digits.length === CODE_LENGTH && submittedCode.current !== digits) {
      submit(digits);
    }
  };

  const submit = async (value: string) => {
    if (submitting) return;
    submittedCode.current = value;
    setSubmitting(true);
    try {
      await verifyEmail(value);
      alert(t('auth.verifiedTitle'), t('auth.verifiedMessage'));
      quitter();
    } catch (e) {
      setCode('');
      submittedCode.current = null;
      alert(t('auth.codeRejected'), apiErrorMessage(e, t('auth.codeInvalid')));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    try {
      await resendCode();
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
      setCode('');
      submittedCode.current = null;
      alert(t('auth.codeSentTitle'), t('auth.codeResentMessage', { email: user?.email }));
    } catch (e) {
      alert(t('common.error'), apiErrorMessage(e, t('auth.resendFailed')));
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <Header title={t('auth.verifyTitle')} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.iconCircle, { borderColor: theme.gold }]}>
          <Ionicons name="mail-outline" size={28} color={theme.gold} />
        </View>

        <Text
          style={[
            typography.body,
            { color: theme.textSecondary, textAlign: 'center', lineHeight: 22 },
          ]}
        >
          Nous avons envoyé un code à {CODE_LENGTH} chiffres à
        </Text>
        <Text
          style={[
            typography.subtitle,
            { color: theme.text, textAlign: 'center', marginTop: spacing.xs },
          ]}
        >
          {user?.email}
        </Text>

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
          onChangeText={handleChange}
          keyboardType="number-pad"
          maxLength={CODE_LENGTH}
          placeholder="••••••"
          placeholderTextColor={theme.textMuted}
          // Propose le code depuis les suggestions du clavier sur iOS.
          textContentType="oneTimeCode"
          autoFocus
          editable={!submitting}
        />

        <Button
          label={submitting ? t('auth.verifying') : t('common.confirm')}
          onPress={() => submit(code)}
          loading={submitting}
          disabled={code.length !== CODE_LENGTH}
          style={{ marginTop: spacing.md }}
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
              ? t('auth.resendIn', { seconds: secondsLeft })
              : t('auth.nothingReceived')}
          </Text>
        </TouchableOpacity>

        <Text
          style={[
            typography.caption,
            {
              color: theme.textMuted,
              textAlign: 'center',
              marginTop: spacing.lg,
              lineHeight: 20,
            },
          ]}
        >
          {t('auth.codeExpiry')}
        </Text>

        {skippable && (
          <TouchableOpacity
            onPress={quitter}
            accessibilityRole="button"
            style={{ marginTop: spacing.xl }}
          >
            <Text
              style={[
                typography.caption,
                { color: theme.textSecondary, textAlign: 'center' },
              ]}
            >
              {t('common.later')}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  codeInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.xl,
    fontSize: 28,
    letterSpacing: 10,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
});
