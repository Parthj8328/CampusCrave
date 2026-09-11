import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";

import { apiFetch } from "@/src/api/client";
import { ScreenHeader } from "@/src/components/header";
import { Badge, slotTone } from "@/src/components/ui";
import { haptic } from "@/src/lib/haptics";
import { makeStyles, useTheme } from "@/src/theme";
import type { TimeSlot } from "@/src/types";

export default function AdminSlots() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["slots"],
    queryFn: () => apiFetch<TimeSlot[]>("/slots"),
    refetchInterval: 8000,
  });

  const setCap = useMutation({
    mutationFn: ({ id, capacity }: { id: string; capacity: number }) =>
      apiFetch(`/admin/slots/${id}`, { method: "PATCH", body: { capacity } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["slots"] }),
  });

  function change(slot: TimeSlot, delta: number) {
    const next = Math.max(slot.booked, slot.capacity + delta);
    if (next === slot.capacity) return;
    haptic("light");
    setCap.mutate({ id: slot.id, capacity: next });
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title="Slot Throttling" subtitle="Cap orders per 15-min slot" />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 10 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const pct = item.capacity > 0 ? Math.min(100, (item.booked / item.capacity) * 100) : 100;
            return (
              <View style={styles.card} testID={`slot-config-${item.id}`}>
                <View style={styles.top}>
                  <Text style={styles.label}>{item.label}</Text>
                  <Badge
                    label={item.status === "OPEN" ? "Open" : item.status === "FILLING" ? "Filling" : "Full"}
                    tone={slotTone(item.status)}
                  />
                </View>

                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${pct}%`, backgroundColor: slotColor(item.status, colors) }]} />
                </View>
                <Text style={styles.usage}>
                  {item.booked} / {item.capacity} booked · {item.remaining} left
                </Text>

                <View style={styles.controls}>
                  <Text style={styles.capLabel}>Capacity</Text>
                  <View style={styles.stepper}>
                    <Pressable testID={`cap-dec-${item.id}`} onPress={() => change(item, -1)} style={styles.stepBtn}>
                      <Ionicons name="remove" size={18} color={colors.onSurface} />
                    </Pressable>
                    <Text style={styles.capValue}>{item.capacity}</Text>
                    <Pressable testID={`cap-inc-${item.id}`} onPress={() => change(item, 1)} style={styles.stepBtn}>
                      <Ionicons name="add" size={18} color={colors.onSurface} />
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function slotColor(status: TimeSlot["status"], colors: any) {
  return status === "OPEN" ? colors.success : status === "FILLING" ? colors.warning : colors.error;
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
    gap: 8,
  },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 15, fontWeight: "800", color: colors.onSurface },
  track: { height: 8, backgroundColor: colors.surfaceTertiary, borderRadius: 4, overflow: "hidden", marginTop: 4 },
  fill: { height: 8, borderRadius: 4, minWidth: 4 },
  usage: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  capLabel: { fontSize: 14, fontWeight: "700", color: colors.onSurfaceTertiary },
  stepper: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceTertiary, borderRadius: 10 },
  stepBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  capValue: { fontSize: 16, fontWeight: "800", color: colors.onSurface, minWidth: 32, textAlign: "center" },
}));
