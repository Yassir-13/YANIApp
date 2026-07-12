import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { useAuthStore } from '../stores/authStore';

export default function LoginScreen({ navigation }: any) {
  const { theme } = useTheme();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Champs requis', 'Merci de saisir votre email et mot de passe.');
      return;
    }
    try {
      await login(email.trim(), password);
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch (error: any) {
      const message =
        error.response?.data?.message || 'Connexion impossible. Réessayez.';
      Alert.alert('Erreur', message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* Bouton retour */}
      {navigation.canGoBack() && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.backText, { color: theme.text }]}>‹ Retour</Text>
        </TouchableOpacity>
      )}

      <View style={styles.content}>
        <Text style={[typography.heading, { color: theme.gold, textAlign: 'center' }]}>
          Yani Concept
        </Text>
        <Text
          style={[
            typography.caption,
            { color: theme.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
          ]}
        >
          Connectez-vous à votre compte
        </Text>

        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
          placeholder="Email"
          placeholderTextColor={theme.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
          placeholder="Mot de passe"
          placeholderTextColor={theme.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.gold, opacity: isLoading ? 0.6 : 1 }]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          <Text style={[typography.subtitle, { color: '#1E1B16' }]}>
            {isLoading ? 'Connexion...' : 'Se connecter'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')} style={{ marginTop: spacing.lg }}>
          <Text style={[typography.caption, { color: theme.textSecondary, textAlign: 'center' }]}>
            Pas encore de compte ? Créer un compte
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: {
    position: 'absolute',
    top: spacing.xxl,
    left: spacing.md,
    zIndex: 10,
    padding: spacing.sm,
  },
  backText: { fontSize: 17, fontWeight: '500' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    fontSize: 15,
  },
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
});