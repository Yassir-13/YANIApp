import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { appointmentsApi, Slot } from '../api/appointments';
import Button from '../components/Button';

function getNextDays(count: number) {
  const days = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    days.push({ dateStr, label });
  }
  return days;
}

function buildStartAt(dateStr: string, time: string): string {
  const [h, m] = time.split(':').map(Number);
  const CASABLANCA_OFFSET_HOURS = 1;
  const utcHour = h - CASABLANCA_OFFSET_HOURS;
  const [year, month, day] = dateStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day, utcHour, m, 0));
  return utcDate.toISOString();
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

  const handleContinue = () => {
    if (!selectedSlot) return;
    navigation.navigate('BookingSummary', {
      serviceId,
      date: selectedDate,
      time: selectedSlot,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="chevron-back" size={26} color={theme.text} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xxl * 1.5 }}>
        <Text style={[typography.heading, { color: theme.text, marginBottom: spacing.lg }]}>
          Choisir un créneau
        </Text>

        {/* Sélecteur de date */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
          {days.map((day) => {
            const active = day.dateStr === selectedDate;
            return (
              <TouchableOpacity
                key={day.dateStr}
                onPress={() => setSelectedDate(day.dateStr)}
                style={[
                  styles.dayChip,
                  { backgroundColor: active ? theme.gold : theme.surface, borderColor: theme.border },
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
        <Button
          label={selectedSlot ? `Continuer · ${selectedSlot}` : 'Choisir un créneau'}
          onPress={handleContinue}
          disabled={!selectedSlot}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: { position: 'absolute', top: spacing.xxl, left: spacing.md, zIndex: 10, padding: spacing.sm },
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
});