import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { apiFetch } from "@/src/api/client";
import { EmptyState } from "@/src/components/empty-state";
import { useToast } from "@/src/components/toast";
import { cartTotal, useCart } from "@/src/store/cart";
import { haptic } from "@/src/lib/haptics";
import { useTheme } from "@/src/theme";
import type { Order, TimeSlot } from "@/src/types";

const PAYMENTS = [
  {
    key: "UPI",
    label: "UPI Payment",
    sub: "Instant pay via GPay, PhonePe, Paytm",
    icon: "phone-portrait-outline",
  },
  {
    key: "CAMPUS_CARD",
    label: "Campus Meal Card",
    sub: "Deduct directly from campus wallet",
    icon: "card-outline",
  },
  {
    key: "CASH",
    label: "Cash at Counter",
    sub: "Pay when picking up fresh meal",
    icon: "cash-outline",
  },
];

export default function Checkout() {
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

  // Button Spring Animation
  const ctaScale = useRef(new Animated.Value(1)).current;

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
      toast.show("Please select a pickup time slot", "error");
      haptic("error");
      return;
    }
    placeOrder.mutate();
  }

  function handleCtaPressIn() {
    Animated.spring(ctaScale, {
      toValue: 0.96,
      speed: 35,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }

  function handleCtaPressOut() {
    Animated.spring(ctaScale, {
      toValue: 1,
      speed: 25,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.deepObsidian }]}>
      {/* Frosted Glass Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          testID="checkout-back"
          onPress={() => {
            haptic("light");
            router.back();
          }}
          style={styles.glassBackBtn}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.softChalk} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.softChalk }]}>Checkout</Text>
        <View style={styles.headerRightBadge}>
          <Text style={[styles.headerBadgeText, { color: colors.warmGold }]}>
            {lines.length} {lines.length === 1 ? "item" : "items"}
          </Text>
        </View>
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
            contentContainerStyle={{
              padding: 18,
              paddingBottom: insets.bottom + 150,
              gap: 24,
            }}
            showsVerticalScrollIndicator={false}
          >
            {/* -------------------------------------------------------- */}
            {/* SECTION 1: YOUR ORDER (Frosted Glass Card) */}
            {/* -------------------------------------------------------- */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="fast-food-outline" size={16} color={colors.warmGold} />
                <Text style={[styles.sectionTitle, { color: colors.mutedSilver }]}>
                  Your Order
                </Text>
              </View>

              <View style={styles.glassCard}>
                {/* Specular Top Shine */}
                <View style={styles.cardTopShine} />

                {lines.map((l, idx) => (
                  <View
                    key={l.id}
                    style={[styles.cartRow, idx > 0 && styles.cartRowBorder]}
                  >
                    <Image
                      source={{ uri: l.image_url }}
                      style={styles.thumb}
                      contentFit="cover"
                      transition={200}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.itemName, { color: colors.softChalk }]} numberOfLines={1}>
                        {l.name}
                      </Text>
                      <View style={styles.itemPriceRow}>
                        <Text style={styles.currencyGold}>₹</Text>
                        <Text style={[styles.itemPrice, { color: colors.warmGold }]}>
                          {l.price}
                        </Text>
                      </View>
                    </View>

                    {/* Stepper with animated feedback */}
                    <View style={styles.stepperContainer}>
                      <Pressable
                        testID={`co-dec-${l.id}`}
                        onPress={() => {
                          cart.decrement(l.id);
                          haptic("light");
                        }}
                        style={styles.stepBtn}
                        hitSlop={6}
                      >
                        <Ionicons name="remove" size={16} color={colors.softChalk} />
                      </Pressable>
                      <Text style={[styles.qtyText, { color: colors.softChalk }]}>
                        {l.qty}
                      </Text>
                      <Pressable
                        testID={`co-inc-${l.id}`}
                        onPress={() => {
                          cart.increment(l.id);
                          haptic("light");
                        }}
                        style={styles.stepBtn}
                        hitSlop={6}
                      >
                        <Ionicons name="add" size={16} color={colors.softChalk} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* -------------------------------------------------------- */}
            {/* SECTION 2: PICKUP SLOT PICKER (Glow & Glass Pills) */}
            {/* -------------------------------------------------------- */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="time-outline" size={16} color={colors.warmGold} />
                <Text style={[styles.sectionTitle, { color: colors.mutedSilver }]}>
                  Pickup Slot
                </Text>
              </View>

              {isLoading ? (
                <ActivityIndicator color={colors.saffronCoral} style={{ marginTop: 12 }} />
              ) : (
                Object.entries(grouped).map(([part, list]) => (
                  <View key={part} style={{ marginTop: 10 }}>
                    <Text style={[styles.partLabel, { color: colors.mutedSilver }]}>
                      {part}
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.slotRow}
                    >
                      {list.map((s) => {
                        const full = s.status === "FULL";
                        const selected = slotId === s.id;
                        return (
                          <SlotPill
                            key={s.id}
                            slot={s}
                            selected={selected}
                            disabled={full}
                            onPress={() => {
                              setSlotId(s.id);
                              haptic("selection");
                            }}
                          />
                        );
                      })}
                    </ScrollView>
                  </View>
                ))
              )}
            </View>

            {/* -------------------------------------------------------- */}
            {/* SECTION 3: PAYMENT METHOD (Selectable Glass Cards) */}
            {/* -------------------------------------------------------- */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="wallet-outline" size={16} color={colors.warmGold} />
                <Text style={[styles.sectionTitle, { color: colors.mutedSilver }]}>
                  Payment Method
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 6 }}>
                {PAYMENTS.map((p) => {
                  const selected = payment === p.key;
                  return (
                    <PaymentCard
                      key={p.key}
                      payment={p}
                      selected={selected}
                      onPress={() => {
                        setPayment(p.key);
                        haptic("selection");
                      }}
                    />
                  );
                })}
              </View>

              {/* Sandbox info badge */}
              <View style={styles.sandboxNote}>
                <Ionicons name="shield-checkmark" size={14} color={colors.sageMint} />
                <Text style={[styles.sandboxText, { color: colors.mutedSilver }]}>
                  Campus Sandbox Mode · No real charge occurs
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* -------------------------------------------------------- */}
          {/* STICKY GLASSMORPHIC FOOTER WITH GLOWING CTA */}
          {/* -------------------------------------------------------- */}
          <View style={styles.footerContainer}>
            <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.footerTopShine} />

            <View
              style={[
                styles.footerContent,
                { paddingBottom: Math.max(insets.bottom, 12) + 6 },
              ]}
            >
              {/* Total Summary Row */}
              <View style={styles.totalRow}>
                <View>
                  <Text style={[styles.totalSublabel, { color: colors.mutedSilver }]}>
                    Total Amount
                  </Text>
                  <Text style={[styles.totalItemsCount, { color: colors.mutedSilver }]}>
                    {lines.length} {lines.length === 1 ? "item" : "items"}
                  </Text>
                </View>
                <View style={styles.totalAmountRow}>
                  <Text style={styles.totalCurrency}>₹</Text>
                  <Text style={[styles.totalValue, { color: colors.softChalk }]}>
                    {total}
                  </Text>
                </View>
              </View>

              {/* Glowing CTA Button */}
              <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
                <Pressable
                  testID="pay-confirm"
                  onPress={confirm}
                  onPressIn={handleCtaPressIn}
                  onPressOut={handleCtaPressOut}
                  disabled={placeOrder.isPending}
                  style={[
                    styles.ctaBtnWrap,
                    placeOrder.isPending && { opacity: 0.75 },
                  ]}
                >
                  <LinearGradient
                    colors={["#FF6B4A", "#FA5838", "#E5A93B"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.ctaLinearGradient}
                  >
                    <View style={styles.ctaGlassShine} />
                    {placeOrder.isPending ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Text style={styles.ctaBtnText}>
                          Pay & Confirm · ₹{total}
                        </Text>
                        <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
              </Animated.View>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

// ----------------------------------------------------------------------------
// Slot Pill Component with Selection Animation and Glowing Halo
// ----------------------------------------------------------------------------
function SlotPill({
  slot,
  selected,
  disabled,
  onPress,
}: {
  slot: TimeSlot;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.spring(scale, {
      toValue: 0.94,
      speed: 40,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }

  function handlePressOut() {
    Animated.spring(scale, {
      toValue: 1,
      speed: 25,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        testID={`slot-${slot.id}`}
        disabled={disabled}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.glassSlot,
          selected && styles.glassSlotSelected,
          disabled && styles.glassSlotFull,
        ]}
      >
        <View style={styles.slotHeaderRow}>
          <Text
            style={[
              styles.slotLabel,
              selected ? styles.slotLabelSelected : { color: "#F2F2F7" },
              disabled && styles.slotLabelFull,
            ]}
          >
            {slot.label}
          </Text>
          {selected ? (
            <Ionicons name="checkmark-circle" size={14} color="#E5A93B" />
          ) : null}
        </View>
        <Text
          style={[
            styles.slotMeta,
            selected ? { color: "#E5A93B" } : { color: "#8E8E93" },
            disabled && styles.slotLabelFull,
          ]}
        >
          {disabled ? "Sold out" : `${slot.remaining} slots left`}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ----------------------------------------------------------------------------
// Payment Method Card with Glassmorphism and Glowing Radio Indicator
// ----------------------------------------------------------------------------
function PaymentCard({
  payment,
  selected,
  onPress,
}: {
  payment: (typeof PAYMENTS)[number];
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.spring(scale, {
      toValue: 0.97,
      speed: 40,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }

  function handlePressOut() {
    Animated.spring(scale, {
      toValue: 1,
      speed: 25,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        testID={`pay-${payment.key}`}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.glassPayCard,
          selected && styles.glassPayCardSelected,
        ]}
      >
        {/* Specular Rim Shine */}
        <View style={styles.payCardTopShine} />

        {/* Payment Method Icon Circle */}
        <View
          style={[
            styles.payIconCircle,
            selected && styles.payIconCircleSelected,
          ]}
        >
          <Ionicons
            name={payment.icon as any}
            size={20}
            color={selected ? "#FFFFFF" : "#8E8E93"}
          />
        </View>

        {/* Label & Description */}
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={[
              styles.payLabel,
              selected ? { color: "#F2F2F7", fontWeight: "800" } : { color: "#F2F2F7" },
            ]}
          >
            {payment.label}
          </Text>
          <Text style={styles.paySub}>{payment.sub}</Text>
        </View>

        {/* Radio Indicator */}
        <View
          style={[
            styles.radioOuter,
            selected && styles.radioOuterSelected,
          ]}
        >
          {selected ? <View style={styles.radioInner} /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  // --------------------------------------------------------------------------
  // Header Styles
  // --------------------------------------------------------------------------
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  glassBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(36, 36, 42, 0.7)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerRightBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(229, 169, 59, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.35)",
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // --------------------------------------------------------------------------
  // Section Headers
  // --------------------------------------------------------------------------
  sectionContainer: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  // --------------------------------------------------------------------------
  // Frosted Glass Order Card
  // --------------------------------------------------------------------------
  glassCard: {
    backgroundColor: "rgba(28, 28, 34, 0.78)",
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.13)",
    paddingHorizontal: 14,
    paddingVertical: 4,
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  cardTopShine: {
    position: "absolute",
    top: 0,
    left: 20,
    right: 20,
    height: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  cartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  cartRowBorder: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(40, 40, 46, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  itemName: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  itemPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 1,
  },
  currencyGold: {
    fontSize: 12,
    fontWeight: "800",
    color: "#E5A93B",
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "800",
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(44, 44, 52, 0.75)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 3,
    height: 34,
  },
  stepBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    fontSize: 14,
    fontWeight: "800",
    minWidth: 18,
    textAlign: "center",
  },

  // --------------------------------------------------------------------------
  // Slot Picker Styles
  // --------------------------------------------------------------------------
  partLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  slotRow: {
    gap: 10,
    paddingRight: 10,
    paddingBottom: 4,
  },
  glassSlot: {
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(32, 32, 38, 0.7)",
    minWidth: 146,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  glassSlotSelected: {
    backgroundColor: "rgba(229, 169, 59, 0.16)",
    borderColor: "#E5A93B",
    shadowColor: "#E5A93B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
  },
  glassSlotFull: {
    opacity: 0.45,
    backgroundColor: "rgba(22, 22, 26, 0.5)",
  },
  slotHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  slotLabel: {
    fontSize: 13,
    fontWeight: "800",
  },
  slotLabelSelected: {
    color: "#F2F2F7",
  },
  slotLabelFull: {
    textDecorationLine: "line-through",
    color: "#8E8E93",
  },
  slotMeta: {
    fontSize: 11,
    fontWeight: "600",
  },

  // --------------------------------------------------------------------------
  // Payment Cards
  // --------------------------------------------------------------------------
  glassPayCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(30, 30, 36, 0.75)",
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  glassPayCardSelected: {
    borderColor: "#FF6B4A",
    backgroundColor: "rgba(255, 107, 74, 0.12)",
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 6,
  },
  payCardTopShine: {
    position: "absolute",
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  payIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(44, 44, 52, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  payIconCircleSelected: {
    backgroundColor: "#FF6B4A",
    borderColor: "#FF6B4A",
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  payLabel: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  paySub: {
    fontSize: 12,
    color: "#8E8E93",
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: {
    borderColor: "#FF6B4A",
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: "#FF6B4A",
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  sandboxNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  sandboxText: {
    fontSize: 12,
    fontWeight: "500",
  },

  // --------------------------------------------------------------------------
  // Sticky Footer Styles
  // --------------------------------------------------------------------------
  footerContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    backgroundColor: "rgba(20, 20, 24, 0.88)",
    borderTopWidth: 1.5,
    borderTopColor: "rgba(255, 255, 255, 0.15)",
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 16,
  },
  footerTopShine: {
    position: "absolute",
    top: 0,
    left: 40,
    right: 40,
    height: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  footerContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 12,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalSublabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  totalItemsCount: {
    fontSize: 11,
    marginTop: 1,
  },
  totalAmountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  totalCurrency: {
    fontSize: 16,
    fontWeight: "800",
    color: "#E5A93B",
  },
  totalValue: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  ctaBtnWrap: {
    height: 54,
    borderRadius: 27,
    overflow: "hidden",
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 10,
  },
  ctaLinearGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    position: "relative",
  },
  ctaGlassShine: {
    position: "absolute",
    top: 0,
    left: 24,
    right: 24,
    height: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
});
