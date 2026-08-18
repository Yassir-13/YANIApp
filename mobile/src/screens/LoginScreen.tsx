import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { useAuthStore } from '../stores/authStore';
import Button from '../components/Button';
import { useAlert } from '../components/AlertProvider';
import { mirroredIcon } from '../i18n';

export default function LoginScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const { alert } = useAlert();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      alert(t('auth.fieldsRequired'), t('auth.loginFieldsMessage'));
      return;
    }
    try {
      await login(email.trim(), password);
      if (navigation.canGoBack()) navigation.goBack();
    } catch (error: any) {
      alert(t('common.error'), error.response?.data?.message || t('auth.loginFailed'));
    }
  };

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

      <View style={styles.content}>
        <Text style={[typography.heading, { color: theme.gold, textAlign: 'center' }]}>{t('auth.loginBrand')}</Text>
        <Text style={[typography.caption, { color: theme.textSecondary, textAlign: 'center', marginBottom: spacing.xl }]}>
          {t('auth.loginSubtitle')}
        </Text>

        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
          placeholder={t('auth.email')}
          placeholderTextColor={theme.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
          placeholder={t('auth.password')}
          placeholderTextColor={theme.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Button
          label={isLoading ? t('auth.loggingIn') : t('common.signIn')}
          onPress={handleLogin}
          loading={isLoading}
          style={{ marginTop: spacing.sm }}
        />

        <TouchableOpacity
          onPress={() => navigation.navigate('ForgotPassword')}
          accessibilityRole="button"
          style={{ marginTop: spacing.lg }}
        >
          <Text style={[typography.caption, { color: theme.gold, textAlign: 'center' }]}>
            {t('auth.forgotPassword')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')} style={{ marginTop: spacing.lg }}>
          <Text style={[typography.caption, { color: theme.textSecondary, textAlign: 'center' }]}>
            {t('auth.noAccount')}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: { position: 'absolute', top: spacing.xxl, left: spacing.md, zIndex: 10, padding: spacing.sm },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    fontSize: 15,
  },
});