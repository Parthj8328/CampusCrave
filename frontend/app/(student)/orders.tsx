import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { apiFetch } from "@/src/api/client";
import { ScreenHeader } from "@/src/components/header";
import { Badge, STATUS_META } from "@/src/components/ui";
import { EmptyState } from "@/src/components/empty-state";
import { useToast } from "@/src/components/toast";
import { useCart } from "@/src/store/cart";
import { buildReorderLines } from "@/src/lib/reorder";
import { haptic } from "@/src/lib/haptics";
import { makeStyles, useTheme } from "@/src/theme";
import type { MenuItem, Order } from "@/src/types";

export default function StudentOrders() {
  const styles = useStyles();
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
    <View style={styles.root}>
      <ScreenHeader title="My Orders" subtitle="Track your pickups live" />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
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
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 12 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const meta = STATUS_META[item.status];
            return (
              <Pressable
                testID={`order-card-${item.id}`}
                onPress={() => router.push(`/order/${item.id}` as any)}
                style={styles.card}
              >
                <View style={styles.cardTop}>
                  <View>
                    <Text style={styles.token}>{item.token}</Text>
                    <Text style={styles.slot}>{item.slot_label}</Text>
                  </View>
                  <Badge label={meta.label} tone={meta.tone} testID={`order-status-${item.id}`} />
                </View>
                <View style={styles.cardBottom}>
                  <Text style={styles.items} numberOfLines={1}>
                    {item.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                  </Text>
                  <View style={styles.right}>
                    <Text style={styles.total}>₹{item.total}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                  </View>
                </View>
                <View style={styles.actionRow}>
                  {item.status === "COLLECTED" && item.rating ? (
                    <View style={styles.ratedPill}>
                      <Ionicons name="star" size={13} color={colors.warning} />
                      <Text style={styles.ratedText}>You rated {item.rating}/5</Text>
                    </View>
                  ) : (
                    <View />
                  )}
                  <Pressable
                    testID={`reorder-${item.id}`}
                    onPress={() => reorder(item)}
                    style={styles.reorderBtn}
                    hitSlop={6}
                  >
                    <Ionicons name="repeat" size={16} color={colors.onBrandPrimary} />
                    <Text style={styles.reorderText}>Reorder</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  token: { fontSize: 16, fontWeight: "800", color: colors.brandPrimary },
  slot: { fontSize: 13, color: colors.muted, marginTop: 2 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  items: { flex: 1, fontSize: 13, color: colors.onSurfaceTertiary },
  right: { flexDirection: "row", alignItems: "center", gap: 4 },
  total: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 12,
  },
  ratedPill: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratedText: { fontSize: 12, fontWeight: "700", color: colors.onSurfaceTertiary },
  reorderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 10,
  },
  reorderText: { color: colors.onBrandPrimary, fontSize: 14, fontWeight: "800" },
}));
