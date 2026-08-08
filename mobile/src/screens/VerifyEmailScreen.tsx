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
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { useAuthStore } from '../stores/authStore';
import Header from '../components/Header';
import Button from '../components/Button';
import { useAlert } from '../components/AlertProvider';

const CODE_LENGTH = 6;

// Doit rester aligné sur RESEND_COOLDOWN_SECONDS côté backend : c'est ce délai
// que le serveur applique avant d'accepter d'émettre un nouveau code. Sans ce
// compte à rebours visible, la cliente appuierait sur « Renvoyer », ne
// recevrait rien, et croirait le service en panne.
const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailScreen({ navigation, route }: any) {
  const { theme } = useTheme();
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
      alert('Adresse confirmée', 'Merci, votre adresse email est confirmée.');
      navigation.goBack();
    } catch (e: any) {
      const msg = e.response?.data?.message;
      setCode('');
      submittedCode.current = null;
      alert(
        'Code refusé',
        Array.isArray(msg) ? msg.join('\n') : msg || 'Code invalide ou expiré.',
      );
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
      alert('Code envoyé', `Un nouveau code a été envoyé à ${user?.email}.`);
    } catch (e: any) {
      alert('Erreur', e.response?.data?.message || 'Envoi impossible. Réessayez.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <Header title="Confirmer votre email" onBack={() => navigation.goBack()} />

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
          label={submitting ? 'Vérification…' : 'Confirmer'}
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
              ? `Renvoyer le code dans ${secondsLeft} s`
              : 'Je n’ai rien reçu — renvoyer le code'}
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
          Le code expire au bout de 15 minutes. Pensez à regarder dans vos
          courriers indésirables.
        </Text>

        {skippable && (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            style={{ marginTop: spacing.xl }}
          >
            <Text
              style={[
                typography.caption,
                { color: theme.textSecondary, textAlign: 'center' },
              ]}
            >
              Plus tard
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
