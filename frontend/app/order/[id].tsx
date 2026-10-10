import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import QRCode from "react-native-qrcode-svg";

import { apiFetch } from "@/src/api/client";
import { EmptyState } from "@/src/components/empty-state";
import { useToast } from "@/src/components/toast";
import { useCart } from "@/src/store/cart";
import { buildReorderLines } from "@/src/lib/reorder";
import { haptic } from "@/src/lib/haptics";
import { useTheme } from "@/src/theme";
import type { MenuItem, Order, OrderStatus } from "@/src/types";

const STEPS: OrderStatus[] = ["PLACED", "PREPARING", "READY_FOR_PICKUP", "COLLECTED"];

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; icon: string; message: string; color: string }
> = {
  PLACED: {
    label: "Placed",
    icon: "receipt",
    message: "We've received your order at the canteen.",
    color: "#64D2FF",
  },
  PREPARING: {
    label: "Preparing",
    icon: "flame",
    message: "The kitchen is actively cooking your meal.",
    color: "#FF6B4A",
  },
  READY_FOR_PICKUP: {
    label: "Ready for Pickup",
    icon: "bag-check",
    message: "Your food is hot & ready — collect at the counter!",
    color: "#30D158",
  },
  COLLECTED: {
    label: "Collected",
    icon: "checkmark-done-circle",
    message: "Enjoy your campus meal! 🎉",
    color: "#E5A93B",
  },
  CANCELLED: {
    label: "Cancelled",
    icon: "close-circle",
    message: "This order was cancelled.",
    color: "#FF453A",
  },
};

export default function OrderTracker() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const cart = useCart();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [live, setLive] = useState(false);

  // Live Pulse Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.9,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const { data: order, isLoading, isError, refetch } = useQuery({
    queryKey: ["order", id],
    queryFn: () => apiFetch<Order>(`/orders/${id}`),
    refetchInterval: 12000,
    enabled: !!id,
  });

  const { data: menu } = useQuery({
    queryKey: ["menu"],
    queryFn: () => apiFetch<MenuItem[]>("/menu"),
  });

  // WebSocket Live Updates
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
          haptic("medium");
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
    <View style={[styles.root, { backgroundColor: colors.deepObsidian }]}>
      {/* Frosted Glass Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          testID="tracker-back"
          onPress={() => {
            haptic("light");
            router.back();
          }}
          style={styles.glassBackBtn}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.softChalk} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.softChalk }]}>Order Tracker</Text>
        <View style={styles.liveSyncBadge}>
          <Animated.View
            style={[
              styles.livePulseDot,
              {
                backgroundColor: live ? colors.sageMint : colors.warmGold,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
          <Text
            style={[
              styles.liveSyncText,
              { color: live ? colors.sageMint : colors.warmGold },
            ]}
          >
            {live ? "LIVE" : "SYNC"}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.saffronCoral} />
          <Text style={[styles.centerText, { color: colors.mutedSilver }]}>
            Fetching live order status…
          </Text>
        </View>
      ) : isError || !order ? (
        <View style={styles.center}>
          <EmptyState
            title="Failed to load order"
            message="Please check your connection and retry."
            ctaLabel="Refresh"
            onCta={refetch}
            image={false}
          />
        </View>
      ) : (
        <KeyboardAwareScrollView
          bottomOffset={24}
          contentContainerStyle={{
            padding: 18,
            paddingBottom: insets.bottom + 36,
            gap: 20,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* -------------------------------------------------------- */}
          {/* HERO CARD: TOKEN & GLOWING QR CODE */}
          {/* -------------------------------------------------------- */}
          <View style={styles.heroGlassCard}>
            {/* Top Specular Shine */}
            <View style={styles.cardTopShine} />

            <Text style={[styles.heroLabel, { color: colors.mutedSilver }]}>
              Pickup Token
            </Text>

            {/* Glowing Saffron Coral Token */}
            <View style={styles.tokenWrapper}>
              <Text
                style={[styles.tokenValue, { color: colors.saffronCoral }]}
                testID="pickup-token"
              >
                {order.token}
              </Text>
            </View>

            {/* Crisp QR Code with Glass Border */}
            <View style={styles.qrCodeCard}>
              <QRCode value={order.token} size={156} backgroundColor="#FFFFFF" />
            </View>

            <Text style={[styles.heroHint, { color: colors.mutedSilver }]}>
              Show this QR at the counter to collect
            </Text>

            {/* Pickup Slot Pill with Glowing Warm Gold Accent */}
            <View style={styles.slotGlassPill}>
              <Ionicons name="time" size={16} color={colors.warmGold} />
              <Text style={[styles.slotPillText, { color: colors.warmGold }]}>
                {order.slot_label}
              </Text>
            </View>
          </View>

          {/* -------------------------------------------------------- */}
          {/* CURRENT STATUS BANNER WITH GLOWING ACCENT */}
          {/* -------------------------------------------------------- */}
          <View style={styles.statusGlassBanner}>
            <View style={styles.bannerTopShine} />

            <View
              style={[
                styles.statusIconCircle,
                {
                  backgroundColor: "rgba(255, 107, 74, 0.16)",
                  borderColor: colors.saffronCoral,
                },
              ]}
            >
              <Ionicons
                name={STATUS_CONFIG[order.status]?.icon as any ?? "receipt"}
                size={22}
                color={STATUS_CONFIG[order.status]?.color ?? colors.saffronCoral}
              />
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.statusTitle, { color: colors.softChalk }]}>
                {STATUS_CONFIG[order.status]?.label ?? order.status}
              </Text>
              <Text style={[styles.statusSub, { color: colors.mutedSilver }]}>
                {STATUS_CONFIG[order.status]?.message}
              </Text>
            </View>

            <View
              style={[
                styles.liveTagPill,
                {
                  backgroundColor: live ? "rgba(48, 209, 88, 0.16)" : "rgba(229, 169, 59, 0.16)",
                  borderColor: live ? "rgba(48, 209, 88, 0.4)" : "rgba(229, 169, 59, 0.4)",
                },
              ]}
            >
              <Text
                style={[
                  styles.liveTagText,
                  { color: live ? colors.sageMint : colors.warmGold },
                ]}
              >
                {live ? "LIVE" : "SYNC"}
              </Text>
            </View>
          </View>

          {/* -------------------------------------------------------- */}
          {/* VERTICAL STATUS STEPPER CARD */}
          {/* -------------------------------------------------------- */}
          <View style={styles.stepperGlassCard}>
            <View style={styles.cardTopShine} />
            <Text style={[styles.stepperCardTitle, { color: colors.mutedSilver }]}>
              Order Milestones
            </Text>

            {STEPS.map((step, idx) => {
              const done = idx < currentIdx;
              const active = idx === currentIdx;
              const meta = STATUS_CONFIG[step];
              const t = timeFor(step);

              return (
                <View key={step} style={styles.stepRow}>
                  {/* Left Node & Connecting Line */}
                  <View style={styles.stepLeftCol}>
                    <View
                      style={[
                        styles.stepNode,
                        done && styles.stepNodeDone,
                        active && styles.stepNodeActive,
                      ]}
                    >
                      <Ionicons
                        name={done ? "checkmark" : (meta.icon as any)}
                        size={15}
                        color={done || active ? "#FFFFFF" : colors.mutedSilver}
                      />
                    </View>
                    {idx < STEPS.length - 1 ? (
                      <View
                        style={[
                          styles.stepConnectorLine,
                          done && styles.stepLineDone,
                        ]}
                      />
                    ) : null}
                  </View>

                  {/* Step Body */}
                  <View style={styles.stepBody}>
                    <Text
                      style={[
                        styles.stepLabel,
                        (done || active)
                          ? { color: colors.softChalk, fontWeight: "700" }
                          : { color: colors.mutedSilver },
                      ]}
                    >
                      {meta.label}
                    </Text>
                    {t ? (
                      <Text style={[styles.stepTimeText, { color: colors.sageMint }]}>
                        {t}
                      </Text>
                    ) : (
                      <Text style={[styles.stepPendingText, { color: colors.mutedSilver }]}>
                        Pending
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Rating Block (When Order is Collected) */}
          {order.status === "COLLECTED" ? <RatingBlock order={order} /> : null}

          {/* -------------------------------------------------------- */}
          {/* ITEMS SUMMARY CARD */}
          {/* -------------------------------------------------------- */}
          <View style={styles.itemsGlassCard}>
            <View style={styles.cardTopShine} />

            <View style={styles.itemsHeaderRow}>
              <Text style={[styles.itemsTitle, { color: colors.softChalk }]}>
                {order.items.length} {order.items.length === 1 ? "Item" : "Items"}
              </Text>
              <View style={styles.itemsTotalBadge}>
                <Text style={styles.itemsTotalCurrency}>₹</Text>
                <Text style={[styles.itemsTotalAmount, { color: colors.softChalk }]}>
                  {order.total}
                </Text>
              </View>
            </View>

            <View style={styles.itemsList}>
              {order.items.map((it) => (
                <View key={it.menu_item_id} style={styles.itemRow}>
                  <View style={styles.itemQtyBadge}>
                    <Text style={styles.itemQtyText}>{it.qty}×</Text>
                  </View>
                  <Text style={[styles.itemName, { color: colors.softChalk }]} numberOfLines={1}>
                    {it.name}
                  </Text>
                  <Text style={[styles.itemAmt, { color: colors.softChalk }]}>
                    ₹{it.price * it.qty}
                  </Text>
                </View>
              ))}
            </View>

            {/* Payment Method Details */}
            <View style={styles.paymentMethodRow}>
              <Ionicons name="wallet-outline" size={16} color={colors.warmGold} />
              <Text style={[styles.paymentMethodText, { color: colors.mutedSilver }]}>
                Paid with{" "}
                <Text style={{ color: colors.softChalk, fontWeight: "700" }}>
                  {order.payment_method === "CAMPUS_CARD"
                    ? "Campus Meal Card"
                    : order.payment_method === "CASH"
                      ? "Cash at Counter"
                      : "UPI Payment"}
                </Text>
              </Text>
            </View>
          </View>

          {/* Reorder Button */}
          <Pressable
            testID="tracker-reorder"
            onPress={reorder}
            style={({ pressed }) => [
              styles.reorderBtn,
              pressed && styles.btnPressed,
            ]}
          >
            <Ionicons name="repeat" size={18} color={colors.saffronCoral} />
            <Text style={[styles.reorderBtnText, { color: colors.saffronCoral }]}>
              Reorder These Items
            </Text>
          </Pressable>
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}

// ----------------------------------------------------------------------------
// Rating Block Component with Interactive Glowing Stars
// ----------------------------------------------------------------------------
function RatingBlock({ order }: { order: Order }) {
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const [stars, setStars] = useState(order.rating ?? 0);
  const [comment, setComment] = useState(order.rating_comment ?? "");
  const inputRef = useRef<TextInput>(null);

  const submit = useMutation({
    mutationFn: () =>
      apiFetch(`/orders/${order.id}/rating`, {
        method: "POST",
        body: { rating: stars, comment },
      }),
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
      <View style={styles.ratingGlassCard}>
        <View style={styles.cardTopShine} />
        <Text style={[styles.ratingTitle, { color: colors.softChalk }]}>Your Review</Text>
        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Ionicons
              key={n}
              name={n <= order.rating! ? "star" : "star-outline"}
              size={24}
              color={colors.warmGold}
            />
          ))}
        </View>
        {order.rating_comment ? (
          <Text style={[styles.ratingComment, { color: colors.mutedSilver }]}>
            “{order.rating_comment}”
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.ratingGlassCard}>
      <View style={styles.cardTopShine} />
      <Text style={[styles.ratingTitle, { color: colors.softChalk }]}>Rate your meal</Text>
      <Text style={[styles.ratingSub, { color: colors.mutedSilver }]}>
        Help the canteen team cook what you love.
      </Text>

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
            <Ionicons
              name={n <= stars ? "star" : "star-outline"}
              size={32}
              color={colors.warmGold}
            />
          </Pressable>
        ))}
      </View>

      <TextInput
        ref={inputRef}
        testID="rating-comment"
        value={comment}
        onChangeText={setComment}
        placeholder="Add a comment (optional)…"
        placeholderTextColor={colors.mutedSilver}
        style={[styles.ratingInput, { color: colors.softChalk }]}
        multiline
      />

      <Pressable
        testID="submit-rating"
        onPress={() => (stars > 0 ? submit.mutate() : toast.show("Pick a star rating", "error"))}
        disabled={submit.isPending}
        style={styles.submitRatingBtn}
      >
        <LinearGradient
          colors={["#FF6B4A", "#FA5838", "#E5A93B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.submitRatingGradient}
        >
          {submit.isPending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitRatingText}>Submit Rating</Text>
          )}
        </LinearGradient>
      </Pressable>
    </View>
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
  liveSyncBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(48, 209, 88, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(48, 209, 88, 0.3)",
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveSyncText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
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
  // Hero Pickup Card Styles
  // --------------------------------------------------------------------------
  heroGlassCard: {
    backgroundColor: "rgba(28, 28, 34, 0.8)",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    gap: 12,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.14)",
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
  cardTopShine: {
    position: "absolute",
    top: 0,
    left: 24,
    right: 24,
    height: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  tokenWrapper: {
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 14,
  },
  tokenValue: {
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  qrCodeCard: {
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    marginTop: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  heroHint: {
    fontSize: 13,
    marginTop: 4,
  },
  slotGlassPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(229, 169, 59, 0.15)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.35)",
    marginTop: 4,
  },
  slotPillText: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  // --------------------------------------------------------------------------
  // Status Glass Banner Styles
  // --------------------------------------------------------------------------
  statusGlassBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(34, 34, 42, 0.78)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.12)",
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  bannerTopShine: {
    position: "absolute",
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  statusIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  statusSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  liveTagPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  liveTagText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  // --------------------------------------------------------------------------
  // Vertical Stepper Styles
  // --------------------------------------------------------------------------
  stepperGlassCard: {
    backgroundColor: "rgba(28, 28, 34, 0.78)",
    borderRadius: 22,
    padding: 20,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.12)",
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  stepperCardTitle: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: "row",
    gap: 14,
  },
  stepLeftCol: {
    alignItems: "center",
    width: 32,
  },
  stepNode: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(44, 44, 52, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  stepNodeDone: {
    backgroundColor: "#30D158",
    borderColor: "#30D158",
    shadowColor: "#30D158",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  stepNodeActive: {
    backgroundColor: "#FF6B4A",
    borderColor: "#FF6B4A",
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
  },
  stepConnectorLine: {
    width: 2,
    flex: 1,
    minHeight: 28,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginVertical: 4,
  },
  stepLineDone: {
    backgroundColor: "#30D158",
  },
  stepBody: {
    flex: 1,
    paddingBottom: 22,
  },
  stepLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  stepTimeText: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  stepPendingText: {
    fontSize: 12,
    marginTop: 2,
  },

  // --------------------------------------------------------------------------
  // Items Summary Card Styles
  // --------------------------------------------------------------------------
  itemsGlassCard: {
    backgroundColor: "rgba(28, 28, 34, 0.78)",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.12)",
    gap: 12,
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  itemsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  itemsTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  itemsTotalBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 1,
  },
  itemsTotalCurrency: {
    fontSize: 13,
    fontWeight: "800",
    color: "#E5A93B",
  },
  itemsTotalAmount: {
    fontSize: 18,
    fontWeight: "800",
  },
  itemsList: {
    gap: 10,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  itemQtyBadge: {
    backgroundColor: "rgba(255, 107, 74, 0.16)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: "rgba(255, 107, 74, 0.35)",
  },
  itemQtyText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FF6B4A",
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  itemAmt: {
    fontSize: 14,
    fontWeight: "700",
  },
  paymentMethodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  paymentMethodText: {
    fontSize: 13,
  },

  // --------------------------------------------------------------------------
  // Rating Block Styles
  // --------------------------------------------------------------------------
  ratingGlassCard: {
    backgroundColor: "rgba(28, 28, 34, 0.78)",
    borderRadius: 22,
    padding: 20,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.12)",
    gap: 12,
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  ratingTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  ratingSub: {
    fontSize: 13,
    textAlign: "center",
  },
  starRow: {
    flexDirection: "row",
    gap: 10,
    marginVertical: 4,
  },
  ratingComment: {
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
  },
  ratingInput: {
    alignSelf: "stretch",
    backgroundColor: "rgba(44, 44, 52, 0.65)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 12,
    minHeight: 64,
    fontSize: 14,
    textAlignVertical: "top",
  },
  submitRatingBtn: {
    alignSelf: "stretch",
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  submitRatingGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  submitRatingText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // --------------------------------------------------------------------------
  // Reorder Button
  // --------------------------------------------------------------------------
  reorderBtn: {
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255, 107, 74, 0.12)",
    borderWidth: 1.5,
    borderColor: "#FF6B4A",
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  reorderBtnText: {
    fontSize: 15,
    fontWeight: "800",
  },
  btnPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
});
