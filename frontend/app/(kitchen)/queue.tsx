import { useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";

import { apiFetch } from "@/src/api/client";
import { ScreenHeader } from "@/src/components/header";
import { Badge, STATUS_META } from "@/src/components/ui";
import { EmptyState } from "@/src/components/empty-state";
import { haptic } from "@/src/lib/haptics";
import { makeStyles, useTheme } from "@/src/theme";
import type { Order, OrderStatus } from "@/src/types";

const NEXT: Record<string, { status: OrderStatus; label: string } | null> = {
  PLACED: { status: "PREPARING", label: "Start Preparing" },
  PREPARING: { status: "READY_FOR_PICKUP", label: "Mark Ready" },
  READY_FOR_PICKUP: { status: "COLLECTED", label: "Mark Collected" },
};

type KitchenData = { orders: Order[]; aggregate: { name: string; qty: number }[] };

export default function KitchenQueue() {
  const styles = useStyles();
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
  const cols = width >= 700 ? 2 : 1;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Kitchen Queue" subtitle={`${orders.length} active order(s)`} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
          <Text style={styles.centerText}>Loading active tickets…</Text>
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <EmptyState title="Connection issue" message="Could not reach the kitchen feed." ctaLabel="Retry" onCta={refetch} image={false} />
        </View>
      ) : (
        <>
          {/* Batch Aggregator */}
          <View style={styles.aggWrap}>
            <Pressable testID="agg-toggle" onPress={() => setAggOpen((v) => !v)} style={styles.aggHeader}>
              <Ionicons name="layers-outline" size={18} color={colors.onBrandTertiary} />
              <Text style={styles.aggTitle}>Batch Prep ({aggregate.length})</Text>
              <Ionicons name={aggOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.onBrandTertiary} />
            </Pressable>
            {aggOpen ? (
              aggregate.length === 0 ? (
                <Text style={styles.aggEmpty}>Nothing to prep right now.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.aggRow}>
                  {aggregate.map((a) => (
                    <View key={a.name} style={styles.aggPill}>
                      <Text style={styles.aggQty}>{a.qty}×</Text>
                      <Text style={styles.aggName}>{a.name}</Text>
                    </View>
                  ))}
                </ScrollView>
              )
            ) : null}
          </View>

          {orders.length === 0 ? (
            <View style={styles.center}>
              <EmptyState title="All caught up!" message="The queue is clear. Great work." image />
            </View>
          ) : (
            <FlatList
              key={cols}
              data={orders}
              keyExtractor={(o) => o.id}
              numColumns={cols}
              columnWrapperStyle={cols > 1 ? { gap: 12, paddingHorizontal: 16 } : undefined}
              contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80, gap: 12 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => <Ticket order={item} onAdvance={() => advance(item)} />}
            />
          )}
        </>
      )}

      {undo ? (
        <View style={[styles.undoBar, { bottom: insets.bottom + 16 }]}>
          <Text style={styles.undoText}>Order updated</Text>
          <Pressable testID="undo-btn" onPress={doUndo} hitSlop={8}>
            <Text style={styles.undoAction}>UNDO</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Ticket({ order, onAdvance }: { order: Order; onAdvance: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const meta = STATUS_META[order.status];
  const next = NEXT[order.status];

  return (
    <View style={[styles.ticket, { flex: 1 }]} testID={`ticket-${order.id}`}>
      <View style={styles.ticketTop}>
        <View>
          <Text style={styles.ticketToken}>{order.token}</Text>
          <Text style={styles.ticketName}>{order.user_name}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Badge label={meta.label} tone={meta.tone} />
          <Text style={styles.ticketSlot}>{order.slot_label}</Text>
        </View>
      </View>

      <View style={styles.ticketItems}>
        {order.items.map((it) => (
          <View key={it.menu_item_id} style={styles.ticketItemRow}>
            <Text style={styles.ticketItemQty}>{it.qty}×</Text>
            <Text style={styles.ticketItemName}>{it.name}</Text>
          </View>
        ))}
      </View>

      {next ? (
        <Pressable testID={`advance-${order.id}`} onPress={onAdvance} style={styles.advanceBtn}>
          <Ionicons name="arrow-forward-circle" size={22} color={colors.onBrandPrimary} />
          <Text style={styles.advanceText}>{next.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  centerText: { color: colors.muted, fontSize: 14 },
  aggWrap: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: colors.brandTertiary,
    borderRadius: 16,
    padding: 14,
  },
  aggHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  aggTitle: { flex: 1, fontSize: 15, fontWeight: "800", color: colors.onBrandTertiary },
  aggEmpty: { fontSize: 13, color: colors.onBrandTertiary, marginTop: 8, opacity: 0.8 },
  aggRow: { gap: 8, paddingTop: 12 },
  aggPill: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  aggQty: { fontSize: 16, fontWeight: "800", color: colors.brandPrimary },
  aggName: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  ticket: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  ticketTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  ticketToken: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  ticketName: { fontSize: 13, color: colors.muted, marginTop: 2 },
  ticketSlot: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  ticketItems: { gap: 8, backgroundColor: colors.surfaceTertiary, borderRadius: 12, padding: 12 },
  ticketItemRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  ticketItemQty: { fontSize: 18, fontWeight: "800", color: colors.brandPrimary, width: 34 },
  ticketItemName: { fontSize: 16, fontWeight: "700", color: colors.onSurface, flex: 1 },
  advanceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brandPrimary,
    height: 52,
    borderRadius: 14,
  },
  advanceText: { color: colors.onBrandPrimary, fontSize: 17, fontWeight: "800" },
  undoBar: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: colors.surfaceInverse,
    borderRadius: 14,
    paddingHorizontal: 18,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  undoText: { color: colors.onSurfaceInverse, fontSize: 15, fontWeight: "600" },
  undoAction: { color: colors.brandSecondary, fontSize: 15, fontWeight: "800", letterSpacing: 0.5 },
}));
