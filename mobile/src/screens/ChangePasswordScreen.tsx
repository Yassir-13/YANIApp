import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { usersApi } from '../api/users';
import { useAuthStore } from '../stores/authStore';
import { validatePassword, PASSWORD_MIN_LENGTH } from '../utils/passwordRules';
import { apiErrorMessage } from '../utils/apiError';
import Header from '../components/Header';
import Button from '../components/Button';
import { useAlert } from '../components/AlertProvider';

export default function ChangePasswordScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { alert } = useAlert();

  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!currentPassword || !newPassword) {
      alert('Champs requis', 'Tous les champs sont obligatoires.');
      return;
    }
    // La règle complète, celle du serveur : longueur, majuscule, minuscule.
    // Cet écran n'en vérifiait que la longueur — son libellé « min. 8
    // caractères » énonçait donc une règle fausse, et le refus tombait du
    // serveur après coup.
    const erreurMotDePasse = validatePassword(newPassword);
    if (erreurMotDePasse) {
      alert('Mot de passe refusé', erreurMotDePasse);
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('Non concordant', 'La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }
    setSaving(true);
    try {
      const { message } = await usersApi.changePassword(currentPassword, newPassword);

      // ── Reprendre la session immédiatement ──
      //
      // Le serveur vient de révoquer TOUTES les sessions, celle-ci comprise.
      // Sans ce qui suit, l'app gardait un refresh token mort et continuait
      // comme si de rien n'était : la cliente était éjectée quelques minutes
      // plus tard, au premier appel qui renvoyait 401 — en plein panier ou en
      // pleine réservation, et sans aucun lien visible avec ce qu'elle venait
      // de faire.
      //
      // On rouvre donc une session ici, sur CET appareil seulement. C'est
      // exactement ce que le message du serveur annonce : les autres appareils
      // restent déconnectés.
      try {
        if (!user?.email) throw new Error('session inconnue');
        await login(user.email, newPassword);
      } catch {
        // La reprise a échoué (réseau). Mieux vaut une déconnexion propre et
        // annoncée qu'une session fantôme qui lâchera sans prévenir. On ramène
        // à l'accueil : rester sur ce formulaire, désormais déconnectée,
        // n'aurait aucun sens.
        await logout();
        alert(
          'Mot de passe modifié',
          'Votre mot de passe a bien été changé. Reconnectez-vous avec le nouveau.',
        );
        navigation.popToTop();
        return;
      }

      // Le message du serveur, et non un texte codé en dur : il dit déjà ce
      // qu'il faut, y compris que les autres appareils ont été déconnectés.
      alert('Mot de passe modifié', message);
      navigation.goBack();
    } catch (e) {
      alert(
        'Erreur',
        apiErrorMessage(e, 'Modification impossible. Vérifiez votre mot de passe actuel.'),
      );
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
      <Header title="Mot de passe" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Field label="Mot de passe actuel" theme={theme}>
          <TextInput style={inputStyle} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry placeholder="••••••••" placeholderTextColor={theme.textMuted} />
        </Field>
        <Field
          label={`Nouveau mot de passe (min. ${PASSWORD_MIN_LENGTH} caractères, une majuscule et une minuscule)`}
          theme={theme}
        >
          <TextInput style={inputStyle} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="••••••••" placeholderTextColor={theme.textMuted} />
        </Field>
        <Field label="Confirmer le nouveau mot de passe" theme={theme}>
          <TextInput style={inputStyle} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="••••••••" placeholderTextColor={theme.textMuted} />
        </Field>

        <Button label={saving ? 'Modification…' : 'Modifier le mot de passe'} onPress={handleSave} loading={saving} style={{ marginTop: spacing.lg }} />
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
});