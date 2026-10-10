import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { apiFetch } from "@/src/api/client";
import { ScreenHeader } from "@/src/components/header";
import { Badge, STATUS_META } from "@/src/components/ui";
import { EmptyState } from "@/src/components/empty-state";
import { AnimatedEntry } from "@/src/components/animated-entry";
import { useToast } from "@/src/components/toast";
import { useCart } from "@/src/store/cart";
import { buildReorderLines } from "@/src/lib/reorder";
import { haptic } from "@/src/lib/haptics";
import { useTheme } from "@/src/theme";
import type { MenuItem, Order } from "@/src/types";

export default function StudentOrders() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const cart = useCart();

  const { data, isLoading } = useQuery({
    queryKey: ["orders", "mine"],
    queryFn: () => apiFetch<Order[]>("/orders/mine"),
    refetchInterval: 6000,
  });

  const { data: menu } = useQuery({
    queryKey: ["menu"],
    queryFn: () => apiFetch<MenuItem[]>("/menu"),
  });

  function reorder(order: Order) {
    if (!menu) return;
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
      <ScreenHeader title="My Orders" subtitle="Track your pickups live" />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.saffronCoral} />
        </View>
      ) : !data || data.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            title="No orders yet"
            message="Your pre-orders will show up here."
            ctaLabel="Browse Menu"
            onCta={() => router.replace("/(student)/menu" as any)}
          />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 100,
            gap: 14,
          }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const meta = STATUS_META[item.status];
            return (
              <AnimatedEntry
                index={index}
                pressable
                onPress={() => router.push(`/order/${item.id}` as any)}
                testID={`order-card-${item.id}`}
              >
                <View style={styles.glassCard}>
                  {/* Top Specular Rim Shine */}
                  <View style={styles.cardTopShine} />

                  <View style={styles.cardTop}>
                    <View style={{ gap: 2 }}>
                      <Text style={[styles.token, { color: colors.saffronCoral }]}>
                        {item.token}
                      </Text>
                      <View style={styles.slotRow}>
                        <Ionicons name="time-outline" size={13} color={colors.warmGold} />
                        <Text style={[styles.slot, { color: colors.warmGold }]}>
                          {item.slot_label}
                        </Text>
                      </View>
                    </View>
                    <Badge label={meta.label} tone={meta.tone} testID={`order-status-${item.id}`} />
                  </View>

                  <View style={styles.cardBottom}>
                    <Text style={[styles.items, { color: colors.mutedSilver }]} numberOfLines={1}>
                      {item.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                    </Text>
                    <View style={styles.right}>
                      <Text style={[styles.total, { color: colors.softChalk }]}>
                        ₹{item.total}
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color={colors.mutedSilver} />
                    </View>
                  </View>

                  <View style={styles.actionRow}>
                    {item.status === "COLLECTED" && item.rating ? (
                      <View style={styles.ratedPill}>
                        <Ionicons name="star" size={13} color={colors.warmGold} />
                        <Text style={[styles.ratedText, { color: colors.mutedSilver }]}>
                          You rated {item.rating}/5
                        </Text>
                      </View>
                    ) : (
                      <View />
                    )}
                    <Pressable
                      testID={`reorder-${item.id}`}
                      onPress={(e) => {
                        e.stopPropagation();
                        reorder(item);
                      }}
                      style={styles.reorderBtn}
                      hitSlop={6}
                    >
                      <Ionicons name="repeat" size={15} color="#FFFFFF" />
                      <Text style={styles.reorderText}>Reorder</Text>
                    </Pressable>
                  </View>
                </View>
              </AnimatedEntry>
            );
          }}
        />
      )}
    </View>
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
    padding: 24,
  },
  glassCard: {
    backgroundColor: "rgba(28, 28, 34, 0.78)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.12)",
    gap: 12,
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  cardTopShine: {
    position: "absolute",
    top: 0,
    left: 20,
    right: 20,
    height: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  token: {
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  slot: {
    fontSize: 12,
    fontWeight: "600",
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  items: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  total: {
    fontSize: 16,
    fontWeight: "800",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    paddingTop: 12,
  },
  ratedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  ratedText: {
    fontSize: 12,
    fontWeight: "600",
  },
  reorderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FF6B4A",
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 12,
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  reorderText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
