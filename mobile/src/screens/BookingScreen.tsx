import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { appointmentsApi, Slot } from '../api/appointments';
import { servicesApi, Service } from '../api/services';
import Header from '../components/Header';
import Button from '../components/Button';
import ServiceMiniCard from '../components/ServiceMiniCard';

function getNextDays(count: number) {
  const days = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const weekday = d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
    const dayNum = d.getDate();
    const month = d.toLocaleDateString('fr-FR', { month: 'long' });
    days.push({ dateStr, weekday, dayNum, month });
  }
  return days;
}

export default function BookingScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { serviceId } = route.params;

  const days = getNextDays(14);
  const [service, setService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState(days[0].dateStr);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    servicesApi.getOne(serviceId).then(setService).catch(() => {});
  }, [serviceId]);

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
    navigation.navigate('BookingSummary', { serviceId, date: selectedDate, time: selectedSlot });
  };

  // Libellé du mois de la date sélectionnée (ex. « MARS 2026 »)
  const selectedDay = days.find((d) => d.dateStr === selectedDate)!;
  const monthLabel = `${selectedDay.month} ${selectedDate.split('-')[0]}`.toUpperCase();
  const slotsLabel = `Créneaux du ${selectedDay.dayNum} ${selectedDay.month}`;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Choisir un créneau" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {service && (
          <View style={{ marginBottom: spacing.xl }}>
            <ServiceMiniCard service={service} />
          </View>
        )}

        {/* Mois */}
        <Text style={[typography.sectionLabel, { color: theme.gold, marginBottom: spacing.md }]}>
          {monthLabel}
        </Text>

        {/* Sélecteur de dates en cases carrées */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {days.map((day) => {
            const active = day.dateStr === selectedDate;
            return (
              <TouchableOpacity
                key={day.dateStr}
                onPress={() => setSelectedDate(day.dateStr)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.dayCell,
                  {
                    backgroundColor: active ? theme.gold : theme.surface,
                    borderColor: active ? theme.gold : theme.border,
                  },
                ]}
              >
                <Text style={[typography.small, { color: active ? '#1A1712' : theme.textSecondary }]}>
                  {day.weekday}
                </Text>
                <Text style={[typography.title, { color: active ? '#1A1712' : theme.text, marginTop: 2 }]}>
                  {day.dayNum}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Créneaux */}
        <Text style={[typography.sectionLabel, { color: theme.gold, marginTop: spacing.xl, marginBottom: spacing.md }]}>
          {slotsLabel}
        </Text>

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
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: !slot.available }}
                  style={[
                    styles.slotChip,
                    {
                      backgroundColor: active ? theme.gold : theme.surface,
                      borderColor: active ? theme.gold : theme.border,
                      opacity: slot.available ? 1 : 0.4,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.bodyMedium,
                      {
                        color: active ? '#1A1712' : slot.available ? theme.text : theme.textMuted,
                        textDecorationLine: slot.available ? 'none' : 'line-through',
                      },
                    ]}
                  >
                    {slot.time}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Barre de confirmation */}
      <View
        style={[
          styles.bottomBar,
          { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: insets.bottom + spacing.md },
        ]}
      >
        <Button
          label={selectedSlot ? `Continuer · ${selectedDay.dayNum} ${selectedDay.month}, ${selectedSlot}` : 'Choisir un créneau'}
          onPress={handleContinue}
          disabled={!selectedSlot}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dayCell: {
    width: 64,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  slotChip: {
    width: '31%',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
});