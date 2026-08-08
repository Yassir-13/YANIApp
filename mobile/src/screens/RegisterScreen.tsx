import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { useAuthStore } from '../stores/authStore';
import Button from '../components/Button';
import { useAlert } from '../components/AlertProvider';


// Validation basique d'un numéro marocain (0XXXXXXXXX ou +212XXXXXXXXX)
const PHONE_RE = /^(?:\+212|0)([5-7]\d{8})$/;

// Mêmes règles que le backend (IsAppPassword) : au moins 8 caractères,
// une majuscule et une minuscule. Dupliqué ici pour donner un message
// immédiat plutôt que d'attendre le refus du serveur.
const PASSWORD_MIN = 8;
const HAS_UPPER = /[A-Z]/;
const HAS_LOWER = /[a-z]/;

// « 0612345678 » → « 06 12 34 56 78 », plus lisible pour une relecture.
function formatPhoneForDisplay(raw: string): string {
  const national = raw.startsWith('+212') ? '0' + raw.slice(4) : raw;
  return national.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
}

export default function RegisterScreen({ navigation }: any) {
  const { theme } = useTheme();
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
      alert('Champ requis', 'Le prénom est obligatoire.');
      return;
    }
    if (!lastName.trim()) {
      alert('Champ requis', 'Le nom est obligatoire.');
      return;
    }
    if (!PHONE_RE.test(phone.trim())) {
      alert('Numéro invalide', 'Saisissez un numéro marocain valide (ex. 0612345678).');
      return;
    }
    if (!email || !password) {
      alert('Champs requis', 'Email et mot de passe sont obligatoires.');
      return;
    }
    if (password.length < PASSWORD_MIN) {
      alert('Mot de passe trop court', `Au moins ${PASSWORD_MIN} caractères.`);
      return;
    }
    if (!HAS_UPPER.test(password) || !HAS_LOWER.test(password)) {
      alert(
        'Mot de passe trop simple',
        'Il doit contenir au moins une majuscule et une minuscule.',
      );
      return;
    }

    // Dernière relecture du numéro avant de créer le compte.
    // C'est le seul moyen de contact de l'institut : une faute de frappe et
    // la cliente ne peut être ni rappelée pour sa commande, ni pour son RDV.
    show({
      title: 'Vérifiez votre numéro',
      message: `${formatPhoneForDisplay(phone.trim())}\n\nC'est avec ce numéro que l'institut vous contactera pour vos commandes et vos rendez-vous.`,
      buttons: [
        { text: 'Modifier', style: 'cancel' },
        { text: "C'est correct", onPress: submitRegistration },
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
    } catch (error: any) {
      const msg = error.response?.data?.message;
      alert('Erreur', Array.isArray(msg) ? msg.join('\n') : msg || 'Inscription impossible. Réessayez.');
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
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={[typography.display, { color: theme.text, textAlign: 'center' }]}>Créer un compte</Text>
        <Text style={[typography.caption, { color: theme.textSecondary, textAlign: 'center', marginBottom: spacing.xl }]}>
          Rejoignez Yani Concept
        </Text>

        <TextInput style={inputStyle} placeholder="Prénom" placeholderTextColor={theme.textMuted} value={firstName} onChangeText={setFirstName} />
        <TextInput style={inputStyle} placeholder="Nom" placeholderTextColor={theme.textMuted} value={lastName} onChangeText={setLastName} />
        <TextInput
          style={inputStyle}
          placeholder="Téléphone (ex. 0612345678)"
          placeholderTextColor={theme.textMuted}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <TextInput
          style={inputStyle}
          placeholder="Email"
          placeholderTextColor={theme.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={inputStyle}
          placeholder="Mot de passe (min. 8 caractères)"
          placeholderTextColor={theme.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Button
          label={isLoading ? 'Création…' : "S'inscrire"}
          onPress={handleRegister}
          loading={isLoading}
          style={{ marginTop: spacing.sm }}
        />

        <TouchableOpacity onPress={() => { if (navigation.canGoBack()) navigation.goBack(); }} style={{ marginTop: spacing.lg }}>
          <Text style={[typography.caption, { color: theme.textSecondary, textAlign: 'center' }]}>
            Déjà un compte ? Se connecter
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