import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme/typography';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import { ordersApi, FulfillmentType } from '../api/orders';
import { formatPrice } from '../utils/format';
import { useAlert } from '../components/AlertProvider';
import Header from '../components/Header';
import Button from '../components/Button';

export default function CheckoutScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { alert } = useAlert();
  const lines = useCartStore((s) => s.lines);
  const subtotal = useCartStore((s) => s.subtotal);
  const clear = useCartStore((s) => s.clear);
  const user = useAuthStore((s) => s.user);

  const [fulfillment, setFulfillment] = useState<FulfillmentType>('PICKUP');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const total = subtotal();

  const handleConfirm = async () => {
    if (!user) {
      navigation.navigate('Login');
      return;
    }
    if (fulfillment === 'DELIVERY' && !address.trim()) {
      alert('Adresse requise', 'Merci d’indiquer une adresse de livraison.');
      return;
    }
    setSubmitting(true);
    try {
      const order = await ordersApi.create({
        items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        fulfillment,
        address: fulfillment === 'DELIVERY' ? address.trim() : undefined,
        note: note.trim() || undefined,
      });
      clear();
      navigation.replace('OrderConfirmation', {
        orderId: order.id,
        fulfillment,
        total: order.total,
      });
    } catch (e: any) {
      alert('Erreur', e.response?.data?.message || 'Commande impossible. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  const Option = ({ type, icon, label, desc }: any) => {
    const active = fulfillment === type;
    return (
      <TouchableOpacity
        onPress={() => setFulfillment(type)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={[
          styles.option,
          { borderColor: active ? theme.gold : theme.border, backgroundColor: active ? theme.goldSoft : theme.surface },
        ]}
      >
        <Ionicons name={icon} size={22} color={active ? theme.gold : theme.textSecondary} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={[typography.subtitle, { color: theme.text }]}>{label}</Text>
          <Text style={[typography.caption, { color: theme.textSecondary }]}>{desc}</Text>
        </View>
        <Ionicons
          name={active ? 'radio-button-on' : 'radio-button-off'}
          size={22}
          color={active ? theme.gold : theme.textMuted}
        />
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <Header title="Finaliser" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[typography.sectionLabel, { color: theme.gold, marginBottom: spacing.md }]}>
          Mode de récupération
        </Text>

        <Option type="PICKUP" icon="storefront-outline" label="Retrait à l'institut" desc="Récupérez votre commande sur place" />
        <View style={{ height: spacing.sm }} />
        <Option type="DELIVERY" icon="bicycle-outline" label="Livraison à domicile" desc="Nous vous livrons à l'adresse indiquée" />

        {fulfillment === 'DELIVERY' && (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={[typography.caption, { color: theme.textSecondary, marginBottom: spacing.sm }]}>
              Adresse de livraison
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
              placeholder="14 rue des Oliviers, Casablanca"
              placeholderTextColor={theme.textMuted}
              value={address}
              onChangeText={setAddress}
              multiline
            />
          </View>
        )}

        <View style={{ marginTop: spacing.lg }}>
          <Text style={[typography.caption, { color: theme.textSecondary, marginBottom: spacing.sm }]}>
            Note (optionnel)
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            placeholder="Une précision pour l'institut…"
            placeholderTextColor={theme.textMuted}
            value={note}
            onChangeText={setNote}
            multiline
          />
        </View>

        <View style={[styles.payNote, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="cash-outline" size={20} color={theme.gold} />
          <Text style={[typography.caption, { color: theme.textSecondary, flex: 1, marginLeft: spacing.sm }]}>
            Paiement {fulfillment === 'PICKUP' ? 'sur place au retrait' : 'à la livraison'}.
          </Text>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: insets.bottom + spacing.md },
        ]}
      >
        <View style={styles.totalRow}>
          <Text style={[typography.body, { color: theme.textSecondary }]}>Total à régler</Text>
          <Text style={[typography.priceLg, { color: theme.gold }]}>{formatPrice(total)}</Text>
        </View>
        <Button
          label={submitting ? 'Envoi…' : user ? 'Confirmer la commande' : 'Se connecter pour commander'}
          onPress={handleConfirm}
          loading={submitting}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    minHeight: 52,
    textAlignVertical: 'top',
  },
  payNote: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
});