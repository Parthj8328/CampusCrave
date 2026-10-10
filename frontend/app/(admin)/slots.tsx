import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";

import { apiFetch } from "@/src/api/client";
import { ScreenHeader } from "@/src/components/header";
import { haptic } from "@/src/lib/haptics";
import { useTheme } from "@/src/theme";
import type { TimeSlot } from "@/src/types";

export default function AdminSlots() {
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
    <View style={[styles.root, { backgroundColor: colors.deepObsidian }]}>
      <ScreenHeader
        title="Slot Throttling"
        subtitle="Cap orders per 15-min slot"
        right={
          <View style={styles.livePill}>
            <View style={[styles.liveDot, { backgroundColor: colors.sageMint }]} />
            <Text style={[styles.liveText, { color: colors.sageMint }]}>AUTO-SYNC</Text>
          </View>
        }
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.saffronCoral} />
          <Text style={[styles.loadingText, { color: colors.mutedSilver }]}>
            Syncing delivery slots…
          </Text>
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(s) => s.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 120 },
          ]}
          renderItem={({ item, index }) => (
            <SlotThrottleCard
              item={item}
              index={index}
              onChange={(delta) => change(item, delta)}
            />
          )}
        />
      )}
    </View>
  );
}

function SlotThrottleCard({
  item,
  index = 0,
  onChange,
}: {
  item: TimeSlot;
  index?: number;
  onChange: (delta: number) => void;
}) {
  const { colors } = useTheme();
  const pressScale = useRef(new Animated.Value(1)).current;
  const entryAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entryAnim, {
      toValue: 1,
      duration: 300,
      delay: Math.min(index * 40, 220),
      useNativeDriver: true,
    }).start();
  }, [entryAnim, index]);

  const translateY = entryAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  const pct = item.capacity > 0 ? Math.min(100, (item.booked / item.capacity) * 100) : 100;

  const toneConfig = {
    OPEN: {
      color: colors.sageMint,
      bg: "rgba(48, 209, 88, 0.12)",
      border: "rgba(48, 209, 88, 0.3)",
      label: "Open",
      gradient: ["#30D158", "#34C759"],
    },
    FILLING: {
      color: colors.warmGold,
      bg: "rgba(229, 169, 59, 0.14)",
      border: "rgba(229, 169, 59, 0.3)",
      label: "Filling",
      gradient: ["#E5A93B", "#FF9500"],
    },
    FULL: {
      color: colors.saffronCoral,
      bg: "rgba(255, 69, 58, 0.14)",
      border: "rgba(255, 69, 58, 0.3)",
      label: "Full",
      gradient: ["#FF6B4A", "#FF453A"],
    },
  }[item.status] ?? {
    color: colors.mutedSilver,
    bg: "rgba(142, 142, 147, 0.1)",
    border: "rgba(142, 142, 147, 0.2)",
    label: "Unknown",
    gradient: ["#8E8E93", "#636366"],
  };

  return (
    <Animated.View
      style={[
        {
          opacity: entryAnim,
          transform: [{ translateY }, { scale: pressScale }],
        },
        styles.cardContainer,
      ]}
    >
      <View style={styles.card} testID={`slot-config-${item.id}`}>
        {/* Specular Top Shine Line */}
        <View style={styles.cardTopShine} />

        {/* Top Header */}
        <View style={styles.topRow}>
          <View style={styles.timeRow}>
            <View style={styles.clockIconBadge}>
              <Ionicons name="time-outline" size={16} color={colors.warmGold} />
            </View>
            <Text style={[styles.timeLabel, { color: colors.softChalk }]}>
              {item.label}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: toneConfig.bg, borderColor: toneConfig.border }]}>
            <View style={[styles.statusDot, { backgroundColor: toneConfig.color }]} />
            <Text style={[styles.statusLabel, { color: toneConfig.color }]}>
              {toneConfig.label}
            </Text>
          </View>
        </View>

        {/* Capacity Progress Bar */}
        <View style={styles.track}>
          <LinearGradient
            colors={toneConfig.gradient as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.fill, { width: `${Math.max(pct, 4)}%` }]}
          />
        </View>

        {/* Usage & Remaining */}
        <View style={styles.usageRow}>
          <Text style={[styles.usageText, { color: colors.softChalk }]}>
            <Text style={{ fontWeight: "800" }}>{item.booked}</Text> / {item.capacity} booked
          </Text>
          <Text style={[styles.remainingText, { color: colors.mutedSilver }]}>
            {item.remaining} slots left
          </Text>
        </View>

        {/* Controls Row */}
        <View style={styles.controlsRow}>
          <Text style={[styles.capLabel, { color: colors.mutedSilver }]}>
            MAX CAPACITY
          </Text>

          <View style={styles.stepper}>
            <Pressable
              testID={`cap-dec-${item.id}`}
              onPress={() => onChange(-1)}
              style={styles.stepBtn}
              hitSlop={4}
            >
              <Ionicons name="remove" size={18} color={colors.softChalk} />
            </Pressable>

            <Text style={[styles.capValue, { color: colors.softChalk }]}>
              {item.capacity}
            </Text>

            <Pressable
              testID={`cap-inc-${item.id}`}
              onPress={() => onChange(1)}
              style={styles.stepBtn}
              hitSlop={4}
            >
              <Ionicons name="add" size={18} color={colors.softChalk} />
            </Pressable>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(48, 209, 88, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(48, 209, 88, 0.3)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },

  // Card Container & Layout
  cardContainer: {
    marginBottom: 4,
  },
  card: {
    backgroundColor: "rgba(28, 28, 34, 0.88)",
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 16,
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
    gap: 10,
  },
  cardTopShine: {
    position: "absolute",
    top: 0,
    left: 20,
    right: 20,
    height: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  clockIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(229, 169, 59, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  timeLabel: {
    fontSize: 15.5,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  // Progress Bar
  track: {
    height: 9,
    backgroundColor: "rgba(44, 44, 52, 0.7)",
    borderRadius: 5,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 5,
  },
  usageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  usageText: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  remainingText: {
    fontSize: 12,
    fontWeight: "500",
  },

  // Controls Row
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  capLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(44, 44, 52, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    overflow: "hidden",
  },
  stepBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  capValue: {
    fontSize: 15.5,
    fontWeight: "800",
    minWidth: 36,
    textAlign: "center",
  },
});
