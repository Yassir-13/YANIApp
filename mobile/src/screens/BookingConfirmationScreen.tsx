import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import Button from '../components/Button';

export default function BookingConfirmationScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { serviceName, date, time } = route.params;

  const formattedDate = new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        {/* Coche de succès */}
        <View style={[styles.checkCircle, { backgroundColor: theme.gold }]}>
          <Ionicons name="checkmark" size={48} color="#1E1B16" />
        </View>

        <Text style={[typography.heading, { color: theme.text, textAlign: 'center', marginTop: spacing.lg }]}>
          Réservation confirmée
        </Text>
        <Text style={[typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
          Votre rendez-vous pour {serviceName} le {formattedDate} à {time} est enregistré.
        </Text>
      </View>

      <View style={{ padding: spacing.lg }}>
        <Button
          label="Voir mes rendez-vous"
          onPress={() => {
            navigation.popToTop(); // revient à la racine de la pile
            navigation.navigate('MyAppointments');
          }}
        />
        <Button
          label="Retour à l'accueil"
          variant="outline"
          onPress={() => navigation.popToTop()}
          style={{ marginTop: spacing.md }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
});