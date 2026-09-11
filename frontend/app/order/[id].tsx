import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import QRCode from "react-native-qrcode-svg";

import { apiFetch } from "@/src/api/client";
import { Badge, Button, STATUS_META } from "@/src/components/ui";
import { EmptyState } from "@/src/components/empty-state";
import { useToast } from "@/src/components/toast";
import { useCart } from "@/src/store/cart";
import { buildReorderLines } from "@/src/lib/reorder";
import { haptic } from "@/src/lib/haptics";
import { makeStyles, useTheme } from "@/src/theme";
import type { MenuItem, Order, OrderStatus } from "@/src/types";

const STEPS: OrderStatus[] = ["PLACED", "PREPARING", "READY_FOR_PICKUP", "COLLECTED"];

export default function OrderTracker() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const cart = useCart();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [live, setLive] = useState(false);

  const { data: order, isLoading, isError, refetch } = useQuery({
    queryKey: ["order", id],
    queryFn: () => apiFetch<Order>(`/orders/${id}`),
    refetchInterval: 15000, // fallback; WebSocket delivers instant updates
    enabled: !!id,
  });

  const { data: menu } = useQuery({ queryKey: ["menu"], queryFn: () => apiFetch<MenuItem[]>("/menu") });

  // ---- Live WebSocket updates ----
  useEffect(() => {
    if (!id) return;
    const base = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";
    const wsUrl = base.replace(/^http/, "ws") + `/api/ws?order_id=${id}`;
    let socket: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      try {
        socket = new WebSocket(wsUrl);
        socket.onopen = () => setLive(true);
        socket.onmessage = () => {
          qc.invalidateQueries({ queryKey: ["order", id] });
        };
        socket.onclose = () => {
          setLive(false);
          if (!closed) retry = setTimeout(connect, 3000);
        };
        socket.onerror = () => {
          try {
            socket?.close();
          } catch {
            // ignore
          }
        };
      } catch {
        if (!closed) retry = setTimeout(connect, 3000);
      }
    }
    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      try {
        socket?.close();
      } catch {
        // ignore
      }
    };
  }, [id, qc]);

  const currentIdx = order ? STEPS.indexOf(order.status) : -1;

  function timeFor(status: OrderStatus): string | null {
    const h = order?.status_history?.find((s) => s.status === status);
    if (!h) return null;
    return new Date(h.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function reorder() {
    if (!order || !menu) return;
    const { lines, skipped } = buildReorderLines(order, menu);
    if (lines.length === 0) {
      haptic("error");
      toast.show("Those items aren't available right now", "error");
      return;
    }
    cart.clear();
    cart.addMany(lines);
    haptic("success");
    if (skipped > 0) toast.show(`${skipped} item(s) unavailable — added the rest`, "info");
    router.push("/checkout");
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="tracker-back" onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Order Tracker</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
          <Text style={styles.centerText}>Fetching live order status…</Text>
        </View>
      ) : isError || !order ? (
        <View style={styles.center}>
          <EmptyState title="Failed to load order" message="Please try again." ctaLabel="Refresh" onCta={refetch} image={false} />
        </View>
      ) : (
        <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 20 }}>
          {/* Token + QR hero */}
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>Pickup Token</Text>
            <Text style={styles.token} testID="pickup-token">
              {order.token}
            </Text>
            <View style={styles.qrWrap}>
              <QRCode value={order.token} size={150} backgroundColor="white" />
            </View>
            <Text style={styles.heroHint}>Show this QR at the counter to collect</Text>
            <View style={styles.slotPill}>
              <Ionicons name="time-outline" size={16} color={colors.onBrandTertiary} />
              <Text style={styles.slotText}>{order.slot_label}</Text>
            </View>
          </View>

          {/* Current status banner */}
          <View style={styles.statusBanner}>
            <Ionicons name={STATUS_META[order.status].icon as any} size={22} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>{STATUS_META[order.status].label}</Text>
              <Text style={styles.statusSub}>
                {order.status === "READY_FOR_PICKUP"
                  ? "Your order is ready — head to the counter!"
                  : order.status === "COLLECTED"
                    ? "Enjoy your meal! 🎉"
                    : order.status === "PREPARING"
                      ? "The kitchen is cooking your order."
                      : "We've received your order."}
              </Text>
            </View>
            <Badge label={live ? "LIVE" : "SYNC"} tone={live ? "success" : "neutral"} testID="live-badge" />
          </View>

          {/* Stepper */}
          <View style={styles.stepperCard}>
            {STEPS.map((step, idx) => {
              const done = idx < currentIdx;
              const active = idx === currentIdx;
              const meta = STATUS_META[step];
              const t = timeFor(step);
              return (
                <View key={step} style={styles.step}>
                  <View style={styles.stepLeft}>
                    <View style={[styles.node, done && styles.nodeDone, active && styles.nodeActive]}>
                      <Ionicons
                        name={done ? "checkmark" : (meta.icon as any)}
                        size={16}
                        color={done || active ? colors.onBrandPrimary : colors.muted}
                      />
                    </View>
                    {idx < STEPS.length - 1 ? <View style={[styles.line, (done || active) && styles.lineActive]} /> : null}
                  </View>
                  <View style={styles.stepBody}>
                    <Text style={[styles.stepLabel, (done || active) && styles.stepLabelActive]}>{meta.label}</Text>
                    {t ? <Text style={styles.stepTime}>{t}</Text> : <Text style={styles.stepPending}>Pending</Text>}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Rating (after collected) */}
          {order.status === "COLLECTED" ? <RatingBlock order={order} /> : null}

          {/* Items summary */}
          <View style={styles.itemsCard}>
            <Text style={styles.itemsTitle}>
              {order.items.length} item(s) · ₹{order.total}
            </Text>
            {order.items.map((it) => (
              <View key={it.menu_item_id} style={styles.itemRow}>
                <Text style={styles.itemQty}>{it.qty}×</Text>
                <Text style={styles.itemName}>{it.name}</Text>
                <Text style={styles.itemAmt}>₹{it.price * it.qty}</Text>
              </View>
            ))}
            <View style={styles.payRow}>
              <Ionicons name="wallet-outline" size={16} color={colors.muted} />
              <Text style={styles.payText}>
                {order.payment_method === "CAMPUS_CARD" ? "Campus Card" : order.payment_method === "CASH" ? "Cash at Counter" : "UPI"}
              </Text>
            </View>
          </View>

          <Button testID="tracker-reorder" label="Reorder these items" onPress={reorder} variant="secondary" icon="repeat" fullWidth />
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}

function RatingBlock({ order }: { order: Order }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const [stars, setStars] = useState(order.rating ?? 0);
  const [comment, setComment] = useState(order.rating_comment ?? "");
  const inputRef = useRef<TextInput>(null);

  const submit = useMutation({
    mutationFn: () => apiFetch(`/orders/${order.id}/rating`, { method: "POST", body: { rating: stars, comment } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order", order.id] });
      qc.invalidateQueries({ queryKey: ["orders", "mine"] });
      haptic("success");
      toast.show("Thanks for your feedback!", "success");
    },
    onError: (e: any) => toast.show(e?.message ?? "Could not submit rating", "error"),
  });

  if (order.rating) {
    return (
      <View style={styles.ratingCard}>
        <Text style={styles.ratingTitle}>Your Rating</Text>
        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Ionicons key={n} name={n <= order.rating! ? "star" : "star-outline"} size={26} color={colors.warning} />
          ))}
        </View>
        {order.rating_comment ? <Text style={styles.ratingComment}>“{order.rating_comment}”</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.ratingCard}>
      <Text style={styles.ratingTitle}>Rate your meal</Text>
      <Text style={styles.ratingSub}>Help the canteen cook what students love.</Text>
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            testID={`star-${n}`}
            onPress={() => {
              setStars(n);
              haptic("selection");
            }}
            hitSlop={6}
          >
            <Ionicons name={n <= stars ? "star" : "star-outline"} size={34} color={colors.warning} />
          </Pressable>
        ))}
      </View>
      <TextInput
        ref={inputRef}
        testID="rating-comment"
        value={comment}
        onChangeText={setComment}
        placeholder="Add a comment (optional)"
        placeholderTextColor={colors.muted}
        style={styles.ratingInput}
        multiline
      />
      <Button
        testID="submit-rating"
        label="Submit Rating"
        onPress={() => (stars > 0 ? submit.mutate() : toast.show("Pick a star rating", "error"))}
        loading={submit.isPending}
        fullWidth
      />
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  centerText: { color: colors.muted, fontSize: 14 },
  hero: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroLabel: { fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 1 },
  token: { fontSize: 28, fontWeight: "800", color: colors.brandPrimary, letterSpacing: 1 },
  qrWrap: { padding: 12, backgroundColor: "#FFFFFF", borderRadius: 16, marginTop: 4 },
  heroHint: { fontSize: 13, color: colors.muted },
  slotPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 4,
  },
  slotText: { fontSize: 13, fontWeight: "700", color: colors.onBrandTertiary },
  statusBanner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.brandTertiary, borderRadius: 16, padding: 16 },
  statusTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  statusSub: { fontSize: 13, color: colors.onSurfaceTertiary, marginTop: 2 },
  stepperCard: { backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border },
  step: { flexDirection: "row", gap: 14 },
  stepLeft: { alignItems: "center", width: 32 },
  node: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  nodeDone: { backgroundColor: colors.success },
  nodeActive: { backgroundColor: colors.brandPrimary },
  line: { width: 2, flex: 1, minHeight: 28, backgroundColor: colors.border, marginVertical: 2 },
  lineActive: { backgroundColor: colors.success },
  stepBody: { flex: 1, paddingBottom: 20 },
  stepLabel: { fontSize: 15, fontWeight: "700", color: colors.muted },
  stepLabelActive: { color: colors.onSurface },
  stepTime: { fontSize: 12, color: colors.success, fontWeight: "600", marginTop: 2 },
  stepPending: { fontSize: 12, color: colors.muted, marginTop: 2 },
  ratingCard: { backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border, gap: 10, alignItems: "center" },
  ratingTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  ratingSub: { fontSize: 13, color: colors.muted, textAlign: "center" },
  starRow: { flexDirection: "row", gap: 8, marginVertical: 4 },
  ratingComment: { fontSize: 14, color: colors.onSurfaceTertiary, fontStyle: "italic", textAlign: "center" },
  ratingInput: {
    alignSelf: "stretch",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 12,
    padding: 12,
    minHeight: 60,
    fontSize: 14,
    color: colors.onSurface,
    textAlignVertical: "top",
  },
  itemsCard: { backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 8 },
  itemsTitle: { fontSize: 15, fontWeight: "800", color: colors.onSurface, marginBottom: 4 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  itemQty: { fontSize: 14, fontWeight: "800", color: colors.brandPrimary, width: 28 },
  itemName: { flex: 1, fontSize: 14, color: colors.onSurface },
  itemAmt: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  payRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.divider },
  payText: { fontSize: 13, color: colors.muted, fontWeight: "600" },
}));
