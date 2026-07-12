import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { appointmentsApi, Slot } from '../api/appointments';


// Génère les 14 prochains jours
function getNextDays(count: number) {
  const days = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
    const label = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    days.push({ dateStr, label });
  }
  return days;
}

export default function BookingScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { serviceId } = route.params;

  const days = getNextDays(14);
  const [selectedDate, setSelectedDate] = useState(days[0].dateStr);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [closed, setClosed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Recharge les créneaux quand la date change
  useEffect(() => {
    setIsLoading(true);
    setSelectedSlot(null);
    appointmentsApi
      .getAvailability(serviceId, selectedDate)
      .then((res) => {
        setSlots(res.slots);
        setClosed(res.closed);
      })
      .catch(() => setSlots([]))
      .finally(() => setIsLoading(false));
  }, [selectedDate, serviceId]);

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    setSubmitting(true);
    try {
      // Construit l'instant à envoyer : date + heure locale → le backend valide
      const startAt = buildStartAt(selectedDate, selectedSlot);
      await appointmentsApi.create(serviceId, startAt);
      Alert.alert('Réservation confirmée', `Votre rendez-vous du ${selectedDate} à ${selectedSlot} est enregistré.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.message || 'Réservation impossible.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={[styles.backText, { color: theme.text }]}>‹ Retour</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xxl }}>
        <Text style={[typography.heading, { color: theme.text, marginBottom: spacing.lg }]}>
          Choisir un créneau
        </Text>

        {/* Sélecteur de date (défilement horizontal) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
          {days.map((day) => {
            const active = day.dateStr === selectedDate;
            return (
              <TouchableOpacity
                key={day.dateStr}
                onPress={() => setSelectedDate(day.dateStr)}
                style={[
                  styles.dayChip,
                  {
                    backgroundColor: active ? theme.gold : theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={[typography.caption, { color: active ? '#1E1B16' : theme.text }]}>
                  {day.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Créneaux */}
        {isLoading ? (
          <ActivityIndicator size="large" color={theme.gold} style={{ marginTop: spacing.xl }} />
        ) : closed ? (
          <Text style={[typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: spacing.xl }]}>
            Le centre est fermé ce jour-là.
          </Text>
        ) : slots.length === 0 ? (
          <Text style={[typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: spacing.xl }]}>
            Aucun créneau disponible.
          </Text>
        ) : (
          <View style={styles.slotsGrid}>
            {slots.map((slot) => {
              const active = slot.time === selectedSlot;
              return (
                <TouchableOpacity
                  key={slot.time}
                  disabled={!slot.available}
                  onPress={() => setSelectedSlot(slot.time)}
                  style={[
                    styles.slotChip,
                    {
                      backgroundColor: active ? theme.gold : theme.surface,
                      borderColor: theme.border,
                      opacity: slot.available ? 1 : 0.35,
                    },
                  ]}
                >
                  <Text style={[typography.caption, { color: active ? '#1E1B16' : theme.text }]}>
                    {slot.time}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Barre de confirmation */}
      <View style={[styles.bottomBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={[
            styles.confirmBtn,
            { backgroundColor: theme.gold, opacity: selectedSlot && !submitting ? 1 : 0.4 },
          ]}
          onPress={handleConfirm}
          disabled={!selectedSlot || submitting}
        >
          <Text style={[typography.subtitle, { color: '#1E1B16' }]}>
            {submitting ? 'Réservation...' : selectedSlot ? `Confirmer · ${selectedSlot}` : 'Choisir un créneau'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Construit l'ISO string à envoyer au backend.
// On envoie l'heure locale ; le backend interprète selon le fuseau du centre.
// Le centre est à UTC+1 (Africa/Casablanca).
// L'utilisateur choisit une heure LOCALE ; on la convertit en UTC pour le backend.
function buildStartAt(dateStr: string, time: string): string {
  const [h, m] = time.split(':').map(Number);
  // Heure locale marocaine → UTC : on retranche le décalage (+1h)
  // On construit l'instant UTC directement.
  const CASABLANCA_OFFSET_HOURS = 1; // UTC+1
  const utcHour = h - CASABLANCA_OFFSET_HOURS;
  // Construit une date UTC explicite
  const [year, month, day] = dateStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day, utcHour, m, 0));
  return utcDate.toISOString();
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: { position: 'absolute', top: spacing.xxl, left: spacing.md, zIndex: 10, padding: spacing.sm },
  backText: { fontSize: 17, fontWeight: '500' },
  dayChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slotChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    minWidth: 72,
    alignItems: 'center',
  },
  bottomBar: { padding: spacing.lg, borderTopWidth: 1 },
  confirmBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});