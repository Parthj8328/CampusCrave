import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";

import { apiFetch } from "@/src/api/client";
import { ScreenHeader } from "@/src/components/header";
import { Badge, STATUS_META } from "@/src/components/ui";
import { EmptyState } from "@/src/components/empty-state";
import { haptic } from "@/src/lib/haptics";
import { useTheme } from "@/src/theme";
import type { Order, OrderStatus } from "@/src/types";

const NEXT: Record<string, { status: OrderStatus; label: string; icon: string; gradient: [string, string] } | null> = {
  PLACED: {
    status: "PREPARING",
    label: "Start Preparing",
    icon: "flame",
    gradient: ["#FF6B4A", "#FA5838"],
  },
  PREPARING: {
    status: "READY_FOR_PICKUP",
    label: "Mark Ready for Pickup",
    icon: "bag-check",
    gradient: ["#30D158", "#28B84C"],
  },
  READY_FOR_PICKUP: {
    status: "COLLECTED",
    label: "Mark Collected",
    icon: "checkmark-done",
    gradient: ["#E5A93B", "#D4AF37"],
  },
};

type KitchenData = { orders: Order[]; aggregate: { name: string; qty: number }[] };

export default function KitchenQueue() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const qc = useQueryClient();

  const [aggOpen, setAggOpen] = useState(true);
  const [undo, setUndo] = useState<{ orderId: string; prev: OrderStatus; label: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["kitchen", "orders"],
    queryFn: () => apiFetch<KitchenData>("/kitchen/orders"),
    refetchInterval: 4000,
  });

  const mutate = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderStatus }) =>
      apiFetch<Order>(`/orders/${orderId}/status`, { method: "PATCH", body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kitchen", "orders"] }),
  });

  function advance(order: Order) {
    const next = NEXT[order.status];
    if (!next) return;
    haptic("medium");
    mutate.mutate({ orderId: order.id, status: next.status });
    setUndo({ orderId: order.id, prev: order.status, label: STATUS_META[next.status].label });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 4000);
  }

  function doUndo() {
    if (!undo) return;
    haptic("warning");
    mutate.mutate({ orderId: undo.orderId, status: undo.prev });
    setUndo(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }

  const orders = data?.orders ?? [];
  const aggregate = data?.aggregate ?? [];
  const cols = width >= 720 ? 2 : 1;

  return (
    <View style={[styles.root, { backgroundColor: colors.deepObsidian }]}>
      <ScreenHeader
        title="Kitchen Queue"
        subtitle={`${orders.length} active order${orders.length === 1 ? "" : "s"}`}
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.saffronCoral} />
          <Text style={[styles.centerText, { color: colors.mutedSilver }]}>
            Loading kitchen tickets…
          </Text>
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <EmptyState
            title="Connection issue"
            message="Could not reach the kitchen feed."
            ctaLabel="Retry"
            onCta={refetch}
            image={false}
          />
        </View>
      ) : (
        <>
          {/* -------------------------------------------------------- */}
          {/* FROSTED GLASS BATCH AGGREGATOR */}
          {/* -------------------------------------------------------- */}
          <View style={styles.aggGlassContainer}>
            <View style={styles.cardTopShine} />

            <Pressable
              testID="agg-toggle"
              onPress={() => {
                haptic("light");
                setAggOpen((v) => !v);
              }}
              style={styles.aggHeader}
            >
              <View style={styles.aggHeaderLeft}>
                <Ionicons name="layers" size={18} color={colors.warmGold} />
                <Text style={[styles.aggTitle, { color: colors.softChalk }]}>
                  Batch Prep ({aggregate.length})
                </Text>
              </View>
              <Ionicons
                name={aggOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.warmGold}
              />
            </Pressable>

            {aggOpen ? (
              aggregate.length === 0 ? (
                <Text style={[styles.aggEmpty, { color: colors.mutedSilver }]}>
                  All caught up! Nothing to batch prep.
                </Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.aggRow}
                >
                  {aggregate.map((a) => (
                    <View key={a.name} style={styles.aggGlassPill}>
                      <Text style={styles.aggQtyText}>{a.qty}×</Text>
                      <Text style={[styles.aggNameText, { color: colors.softChalk }]}>
                        {a.name}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              )
            ) : null}
          </View>

          {/* -------------------------------------------------------- */}
          {/* KITCHEN TICKETS LIST */}
          {/* -------------------------------------------------------- */}
          {orders.length === 0 ? (
            <View style={styles.center}>
              <EmptyState
                title="All caught up!"
                message="The kitchen queue is clear. Great work!"
                image
              />
            </View>
          ) : (
            <FlatList
              key={cols}
              data={orders}
              keyExtractor={(o) => o.id}
              numColumns={cols}
              columnWrapperStyle={cols > 1 ? { gap: 14, paddingHorizontal: 16 } : undefined}
              contentContainerStyle={{
                padding: 16,
                paddingBottom: insets.bottom + 110,
                gap: 14,
              }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => (
                <KitchenTicket
                  order={item}
                  index={index}
                  onAdvance={() => advance(item)}
                />
              )}
            />
          )}
        </>
      )}

      {/* -------------------------------------------------------- */}
      {/* FLOATING GLASS UNDO SNACKBAR */}
      {/* -------------------------------------------------------- */}
      {undo ? (
        <View
          style={[
            styles.undoGlassBar,
            { bottom: insets.bottom + 88 },
          ]}
        >
          <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.cardTopShine} />

          <View style={styles.undoInner}>
            <View style={styles.undoTextRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.sageMint} />
              <Text style={[styles.undoText, { color: colors.softChalk }]}>
                Status updated to {undo.label}
              </Text>
            </View>
            <Pressable
              testID="undo-btn"
              onPress={doUndo}
              style={styles.undoActionBtn}
              hitSlop={8}
            >
              <Text style={[styles.undoActionText, { color: colors.warmGold }]}>
                UNDO
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ----------------------------------------------------------------------------
// Kitchen Ticket Card with High-Visibility Typography & Gradient CTA
// ----------------------------------------------------------------------------
function KitchenTicket({
  order,
  index = 0,
  onAdvance,
}: {
  order: Order;
  index?: number;
  onAdvance: () => void;
}) {
  const { colors } = useTheme();
  const meta = STATUS_META[order.status];
  const next = NEXT[order.status];
  const btnScale = useRef(new Animated.Value(1)).current;
  const entryAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entryAnim, {
      toValue: 1,
      duration: 300,
      delay: Math.min(index * 45, 240),
      useNativeDriver: true,
    }).start();
  }, [entryAnim, index]);

  const translateY = entryAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });

  function handlePressIn() {
    Animated.spring(btnScale, {
      toValue: 0.96,
      speed: 40,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }

  function handlePressOut() {
    Animated.spring(btnScale, {
      toValue: 1,
      speed: 25,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }

  return (
    <Animated.View
      style={[
        {
          opacity: entryAnim,
          transform: [{ translateY }],
        },
        styles.ticketGlassCard,
      ]}
      testID={`ticket-${order.id}`}
    >
      {/* Specular Top Shine Line */}
      <View style={styles.cardTopShine} />

      {/* Header Row: Token, Customer & Slot */}
      <View style={styles.ticketTopRow}>
        <View style={{ gap: 2 }}>
          <Text style={[styles.ticketToken, { color: colors.softChalk }]}>
            {order.token}
          </Text>
          <Text style={[styles.ticketCustomer, { color: colors.mutedSilver }]}>
            {order.user_name}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <Badge label={meta.label} tone={meta.tone} />
          <View style={styles.slotCapsule}>
            <Ionicons name="time-outline" size={12} color={colors.warmGold} />
            <Text style={[styles.ticketSlotText, { color: colors.warmGold }]}>
              {order.slot_label}
            </Text>
          </View>
        </View>
      </View>

      {/* Items Container with High-Visibility Typography */}
      <View style={styles.ticketItemsContainer}>
        {order.items.map((it) => (
          <View key={it.menu_item_id} style={styles.ticketItemRow}>
            <View style={styles.itemQtyPill}>
              <Text style={styles.ticketItemQty}>{it.qty}×</Text>
            </View>
            <Text
              style={[styles.ticketItemName, { color: colors.softChalk }]}
              numberOfLines={2}
            >
              {it.name}
            </Text>
          </View>
        ))}
      </View>

      {/* Action CTA with Glowing Shadow */}
      {next ? (
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <Pressable
            testID={`advance-${order.id}`}
            onPress={() => {
              haptic("medium");
              onAdvance();
            }}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={[
              styles.advanceBtnWrap,
              { shadowColor: next.gradient[0] },
            ]}
          >
            <LinearGradient
              colors={next.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.advanceGradient}
            >
              <View style={styles.btnGlassShine} />
              <Ionicons name={next.icon as any} size={20} color="#FFFFFF" />
              <Text style={styles.advanceBtnText}>{next.label}</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  centerText: {
    fontSize: 14,
  },

  // --------------------------------------------------------------------------
  // Batch Aggregator Styles
  // --------------------------------------------------------------------------
  aggGlassContainer: {
    margin: 16,
    marginBottom: 4,
    borderRadius: 20,
    backgroundColor: "rgba(34, 30, 26, 0.8)",
    borderWidth: 1.2,
    borderColor: "rgba(229, 169, 59, 0.35)",
    padding: 16,
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  cardTopShine: {
    position: "absolute",
    top: 0,
    left: 20,
    right: 20,
    height: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  aggHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  aggHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  aggTitle: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  aggEmpty: {
    fontSize: 13,
    marginTop: 10,
  },
  aggRow: {
    gap: 8,
    paddingTop: 12,
  },
  aggGlassPill: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(44, 44, 52, 0.75)",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  aggQtyText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FF6B4A",
  },
  aggNameText: {
    fontSize: 14,
    fontWeight: "700",
  },

  // --------------------------------------------------------------------------
  // Kitchen Ticket Card Styles
  // --------------------------------------------------------------------------
  ticketGlassCard: {
    flex: 1,
    backgroundColor: "rgba(28, 28, 34, 0.78)",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.13)",
    gap: 14,
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  ticketTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  ticketToken: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  ticketCustomer: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  slotCapsule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(229, 169, 59, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "rgba(229, 169, 59, 0.35)",
  },
  ticketSlotText: {
    fontSize: 11,
    fontWeight: "700",
  },
  ticketItemsContainer: {
    gap: 8,
    backgroundColor: "rgba(40, 40, 48, 0.65)",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  ticketItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  itemQtyPill: {
    backgroundColor: "rgba(255, 107, 74, 0.16)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "rgba(255, 107, 74, 0.35)",
  },
  ticketItemQty: {
    fontSize: 17,
    fontWeight: "900",
    color: "#FF6B4A",
  },
  ticketItemName: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },

  // --------------------------------------------------------------------------
  // Advance Button Styles
  // --------------------------------------------------------------------------
  advanceBtnWrap: {
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.65,
    shadowRadius: 16,
    elevation: 8,
  },
  advanceGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    position: "relative",
  },
  btnGlassShine: {
    position: "absolute",
    top: 0,
    left: 24,
    right: 24,
    height: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
  },
  advanceBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },

  // --------------------------------------------------------------------------
  // Undo Snackbar Styles
  // --------------------------------------------------------------------------
  undoGlassBar: {
    position: "absolute",
    left: 20,
    right: 20,
    height: 54,
    borderRadius: 27,
    overflow: "hidden",
    backgroundColor: "rgba(24, 24, 28, 0.88)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.15)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 12,
  },
  undoInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },
  undoTextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  undoText: {
    fontSize: 14,
    fontWeight: "600",
  },
  undoActionBtn: {
    backgroundColor: "rgba(229, 169, 59, 0.18)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.35)",
  },
  undoActionText: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
