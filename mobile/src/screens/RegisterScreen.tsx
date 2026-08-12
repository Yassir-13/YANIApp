import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { useAuthStore } from '../stores/authStore';
import Button from '../components/Button';
import { useAlert } from '../components/AlertProvider';
import { validatePassword } from '../utils/passwordRules';
import { validatePhone, formatPhoneForDisplay } from '../utils/phoneRules';
import { apiErrorMessage } from '../utils/apiError';

// Les règles de numéro et de mot de passe vivaient ici, recopiées à la main.
// Elles sont désormais dans utils/ : trois écrans les appliquaient, chacun à sa
// façon — et celui du changement de mot de passe en avait oublié la moitié.

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
    const erreurNumero = validatePhone(phone.trim());
    if (erreurNumero) {
      alert('Numéro invalide', erreurNumero);
      return;
    }
    if (!email || !password) {
      alert('Champs requis', 'Email et mot de passe sont obligatoires.');
      return;
    }
    const erreurMotDePasse = validatePassword(password);
    if (erreurMotDePasse) {
      alert('Mot de passe refusé', erreurMotDePasse);
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
    } catch (error) {
      alert('Erreur', apiErrorMessage(error, 'Inscription impossible. Réessayez.'));
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