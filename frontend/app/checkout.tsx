import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { apiFetch } from "@/src/api/client";
import { Button } from "@/src/components/ui";
import { EmptyState } from "@/src/components/empty-state";
import { useToast } from "@/src/components/toast";
import { cartTotal, useCart } from "@/src/store/cart";
import { haptic } from "@/src/lib/haptics";
import { makeStyles, useTheme } from "@/src/theme";
import type { Order, TimeSlot } from "@/src/types";

const PAYMENTS = [
  { key: "UPI", label: "UPI", sub: "Pay via any UPI app", icon: "phone-portrait-outline" },
  { key: "CAMPUS_CARD", label: "Campus Card", sub: "Deduct from wallet", icon: "card-outline" },
  { key: "CASH", label: "Cash at Counter", sub: "Pay on pickup", icon: "cash-outline" },
];

export default function Checkout() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const cart = useCart();

  const lines = Object.values(cart.lines);
  const total = cartTotal(cart.lines);

  const [slotId, setSlotId] = useState<string | null>(null);
  const [payment, setPayment] = useState<string>("UPI");

  const { data: slots, isLoading } = useQuery({
    queryKey: ["slots"],
    queryFn: () => apiFetch<TimeSlot[]>("/slots"),
    refetchInterval: 10000,
  });

  const grouped = useMemo(() => {
    const g: Record<string, TimeSlot[]> = {};
    (slots ?? []).forEach((s) => {
      (g[s.part_of_day] = g[s.part_of_day] ?? []).push(s);
    });
    return g;
  }, [slots]);

  const placeOrder = useMutation({
    mutationFn: () =>
      apiFetch<Order>("/orders", {
        method: "POST",
        body: {
          items: lines.map((l) => ({ menu_item_id: l.id, qty: l.qty })),
          slot_id: slotId,
          payment_method: payment,
        },
      }),
    onSuccess: (order) => {
      haptic("success");
      cart.clear();
      qc.invalidateQueries({ queryKey: ["slots"] });
      qc.invalidateQueries({ queryKey: ["orders", "mine"] });
      router.replace(`/order/${order.id}` as any);
    },
    onError: (e: any) => {
      haptic("error");
      toast.show(e?.message ?? "Order failed", "error");
      qc.invalidateQueries({ queryKey: ["slots"] });
    },
  });

  function confirm() {
    if (lines.length === 0) return;
    if (!slotId) {
      toast.show("Pick a pickup slot", "error");
      return;
    }
    placeOrder.mutate();
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="checkout-back" onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      {lines.length === 0 ? (
        <EmptyState
          title="Your tray is empty"
          message="Add some tasty items to get started."
          ctaLabel="Browse Menu"
          onCta={() => router.replace("/(student)/menu" as any)}
        />
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 140, gap: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Cart items */}
            <View>
              <Text style={styles.section}>Your Order</Text>
              <View style={styles.card}>
                {lines.map((l, idx) => (
                  <View key={l.id} style={[styles.cartRow, idx > 0 && styles.cartRowBorder]}>
                    <Image source={{ uri: l.image_url }} style={styles.thumb} contentFit="cover" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{l.name}</Text>
                      <Text style={styles.itemPrice}>₹{l.price}</Text>
                    </View>
                    <View style={styles.stepper}>
                      <Pressable testID={`co-dec-${l.id}`} onPress={() => { cart.decrement(l.id); haptic("light"); }} style={styles.stepBtn}>
                        <Ionicons name="remove" size={16} color={colors.onSurface} />
                      </Pressable>
                      <Text style={styles.qty}>{l.qty}</Text>
                      <Pressable testID={`co-inc-${l.id}`} onPress={() => { cart.increment(l.id); haptic("light"); }} style={styles.stepBtn}>
                        <Ionicons name="add" size={16} color={colors.onSurface} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Slot picker */}
            <View>
              <Text style={styles.section}>Pickup Slot</Text>
              {isLoading ? (
                <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 12 }} />
              ) : (
                Object.entries(grouped).map(([part, list]) => (
                  <View key={part} style={{ marginTop: 8 }}>
                    <Text style={styles.partLabel}>{part}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slotRow}>
                      {list.map((s) => {
                        const full = s.status === "FULL";
                        const selected = slotId === s.id;
                        return (
                          <Pressable
                            key={s.id}
                            testID={`slot-${s.id}`}
                            disabled={full}
                            onPress={() => { setSlotId(s.id); haptic("selection"); }}
                            style={[styles.slot, selected && styles.slotSelected, full && styles.slotFull]}
                          >
                            <Text style={[styles.slotLabel, selected && styles.slotLabelSelected, full && styles.slotLabelFull]}>
                              {s.label}
                            </Text>
                            <Text style={[styles.slotMeta, selected && styles.slotLabelSelected, full && styles.slotLabelFull]}>
                              {full ? "Sold out" : `${s.remaining} left`}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ))
              )}
            </View>

            {/* Payment */}
            <View>
              <Text style={styles.section}>Payment Method</Text>
              <View style={{ gap: 10, marginTop: 8 }}>
                {PAYMENTS.map((p) => {
                  const selected = payment === p.key;
                  return (
                    <Pressable
                      key={p.key}
                      testID={`pay-${p.key}`}
                      onPress={() => { setPayment(p.key); haptic("selection"); }}
                      style={[styles.payCard, selected && styles.payCardSelected]}
                    >
                      <View style={[styles.payIcon, selected && styles.payIconSelected]}>
                        <Ionicons name={p.icon as any} size={20} color={selected ? colors.onBrandPrimary : colors.onSurfaceTertiary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.payLabel}>{p.label}</Text>
                        <Text style={styles.paySub}>{p.sub}</Text>
                      </View>
                      <Ionicons
                        name={selected ? "radio-button-on" : "radio-button-off"}
                        size={22}
                        color={selected ? colors.brandPrimary : colors.border}
                      />
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.sandboxNote}>
                <Ionicons name="shield-checkmark-outline" size={14} color={colors.info} />
                <Text style={styles.sandboxText}>Sandbox mode — no real money is charged.</Text>
              </View>
            </View>
          </ScrollView>

          {/* Sticky CTA */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₹{total}</Text>
            </View>
            <Button
              testID="pay-confirm"
              label={`Pay & Confirm · ₹${total}`}
              onPress={confirm}
              loading={placeOrder.isPending}
              size="lg"
              fullWidth
            />
          </View>
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  section: { fontSize: 13, fontWeight: "800", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, marginTop: 8 },
  cartRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  cartRowBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  thumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.surfaceTertiary },
  itemName: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  itemPrice: { fontSize: 13, color: colors.muted, marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceTertiary, borderRadius: 10, gap: 2 },
  stepBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  qty: { fontSize: 14, fontWeight: "800", color: colors.onSurface, minWidth: 18, textAlign: "center" },
  partLabel: { fontSize: 13, fontWeight: "700", color: colors.onSurfaceTertiary, marginBottom: 8, marginTop: 4 },
  slotRow: { gap: 10, paddingRight: 8, paddingBottom: 4 },
  slot: {
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    minWidth: 140,
  },
  slotSelected: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  slotFull: { opacity: 0.55, backgroundColor: colors.surfaceTertiary },
  slotLabel: { fontSize: 14, fontWeight: "800", color: colors.onSurface },
  slotLabelSelected: { color: colors.onBrandTertiary },
  slotLabelFull: { textDecorationLine: "line-through", color: colors.muted },
  slotMeta: { fontSize: 12, color: colors.muted, marginTop: 2, fontWeight: "600" },
  payCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  payCardSelected: { borderColor: colors.brandPrimary },
  payIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  payIconSelected: { backgroundColor: colors.brandPrimary },
  payLabel: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  paySub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  sandboxNote: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  sandboxText: { fontSize: 12, color: colors.muted },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 15, color: colors.muted, fontWeight: "600" },
  totalValue: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
}));
