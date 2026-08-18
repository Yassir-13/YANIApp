import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
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
import { authApi } from '../api/auth';
import Header from '../components/Header';
import Button from '../components/Button';
import { useAlert } from '../components/AlertProvider';

export default function ForgotPasswordScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { alert } = useAlert();

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const cleaned = email.trim();
    if (!cleaned) {
      alert(t('auth.fieldRequired'), t('auth.emailRequired'));
      return;
    }

    setSending(true);
    try {
      await authApi.forgotPassword(cleaned);
      // Le serveur répond la même chose que le compte existe ou non : on
      // enchaîne donc toujours sur la saisie du code. Afficher ici « adresse
      // inconnue » reviendrait à publier la liste des clientes de l'institut.
      navigation.navigate('ResetPassword', { email: cleaned });
    } catch (e: any) {
      const msg = e.response?.data?.message;
      alert(
        t('common.error'),
        Array.isArray(msg) ? msg.join('\n') : msg || t('auth.resendFailed'),
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <Header title={t('auth.forgotTitle')} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.iconCircle, { borderColor: theme.gold }]}>
          <Ionicons name="key-outline" size={28} color={theme.gold} />
        </View>

        <Text
          style={[
            typography.body,
            {
              color: theme.textSecondary,
              textAlign: 'center',
              lineHeight: 22,
              marginBottom: spacing.xl,
            },
          ]}
        >
          {t('auth.forgotIntro')}
        </Text>

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.surface,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder={t('auth.email')}
          placeholderTextColor={theme.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoFocus
        />

        <Button
          label={sending ? t('auth.sending') : t('auth.receiveCode')}
          onPress={handleSend}
          loading={sending}
          style={{ marginTop: spacing.md }}
        />
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
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
});
