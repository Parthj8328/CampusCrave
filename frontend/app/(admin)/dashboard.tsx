import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";

import { apiFetch } from "@/src/api/client";
import { ScreenHeader } from "@/src/components/header";
import { EmptyState } from "@/src/components/empty-state";
import { makeStyles, useTheme } from "@/src/theme";
import type { Analytics } from "@/src/types";

export default function AdminDashboard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => apiFetch<Analytics>("/admin/analytics"),
    refetchInterval: 10000,
  });

  const maxPeak = Math.max(1, ...(data?.peak_intervals ?? []).map((p) => p.orders));
  const maxSeller = Math.max(1, ...(data?.top_sellers ?? []).map((s) => s.qty));

  return (
    <View style={styles.root}>
      <ScreenHeader title="Analytics" subtitle="Live sales & rush insights" />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : isError || !data ? (
        <View style={styles.center}>
          <EmptyState title="Failed to load analytics" message="Please retry." ctaLabel="Retry" onCta={refetch} image={false} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
        >
          {/* Stat cards */}
          <View style={styles.statRow}>
            <Stat icon="cash-outline" label="Revenue" value={`₹${data.total_revenue}`} tone="brand" />
            <Stat icon="receipt-outline" label="Orders" value={`${data.total_orders}`} tone="info" />
          </View>
          <View style={styles.statRow}>
            <Stat icon="trending-up-outline" label="Avg Order" value={`₹${data.avg_order}`} tone="success" />
            <Stat
              icon="flame-outline"
              label="Preparing"
              value={`${data.status_counts?.PREPARING ?? 0}`}
              tone="warning"
            />
          </View>

          {/* Peak intervals */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Peak Interval Distribution</Text>
            {data.peak_intervals.length === 0 ? (
              <Text style={styles.emptyLine}>No orders yet today.</Text>
            ) : (
              <View style={{ gap: 10, marginTop: 12 }}>
                {data.peak_intervals.map((p) => (
                  <View key={p.label} style={styles.barRow}>
                    <Text style={styles.barLabel} numberOfLines={1}>
                      {p.label.replace(" – ", "–")}
                    </Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${(p.orders / maxPeak) * 100}%` }]} />
                    </View>
                    <Text style={styles.barValue}>{p.orders}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Top sellers */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top Sellers</Text>
            {data.top_sellers.length === 0 ? (
              <Text style={styles.emptyLine}>No sales yet.</Text>
            ) : (
              <View style={{ gap: 12, marginTop: 12 }}>
                {data.top_sellers.map((s, i) => (
                  <View key={s.name} style={styles.sellerRow}>
                    <View style={styles.rank}>
                      <Text style={styles.rankText}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.sellerTop}>
                        <Text style={styles.sellerName} numberOfLines={1}>
                          {s.name}
                        </Text>
                        <Text style={styles.sellerQty}>{s.qty} sold</Text>
                      </View>
                      <View style={styles.barTrackThin}>
                        <View style={[styles.barFillAlt, { width: `${(s.qty / maxSeller) * 100}%` }]} />
                      </View>
                    </View>
                    <Text style={styles.sellerRev}>₹{s.revenue}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          {/* Ratings & Feedback */}
          <View style={styles.card}>
            <View style={styles.ratingHead}>
              <Text style={styles.cardTitle}>Ratings & Feedback</Text>
              {data.rated_count > 0 ? (
                <View style={styles.avgPill}>
                  <Ionicons name="star" size={14} color={colors.warning} />
                  <Text style={styles.avgText}>
                    {data.avg_rating} · {data.rated_count}
                  </Text>
                </View>
              ) : null}
            </View>
            {(!data.recent_feedback || data.recent_feedback.length === 0) ? (
              <Text style={styles.emptyLine}>No ratings yet.</Text>
            ) : (
              <View style={{ gap: 12, marginTop: 12 }}>
                {data.recent_feedback.map((f, i) => (
                  <View key={`${f.order_token}-${i}`} style={styles.fbRow}>
                    <View style={styles.fbStars}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Ionicons key={n} name={n <= f.rating ? "star" : "star-outline"} size={13} color={colors.warning} />
                      ))}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fbName}>{f.user_name}</Text>
                      {f.comment ? (
                        <Text style={styles.fbComment} numberOfLines={2}>
                          “{f.comment}”
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  tone: "brand" | "info" | "success" | "warning";
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const bg = {
    brand: colors.brandTertiary,
    info: colors.surfaceTertiary,
    success: colors.surfaceTertiary,
    warning: colors.surfaceTertiary,
  }[tone];
  const fg = {
    brand: colors.brandPrimary,
    info: colors.info,
    success: colors.success,
    warning: colors.warning,
  }[tone];
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <Ionicons name={icon as any} size={22} color={fg} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  statRow: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, borderRadius: 16, padding: 16, gap: 6 },
  statValue: { fontSize: 24, fontWeight: "800", color: colors.onSurface },
  statLabel: { fontSize: 13, color: colors.onSurfaceTertiary, fontWeight: "600" },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  emptyLine: { fontSize: 13, color: colors.muted, marginTop: 12 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  barLabel: { width: 96, fontSize: 11, color: colors.onSurfaceTertiary, fontWeight: "600" },
  barTrack: { flex: 1, height: 20, backgroundColor: colors.surfaceTertiary, borderRadius: 6, overflow: "hidden" },
  barFill: { height: 20, backgroundColor: colors.brandPrimary, borderRadius: 6, minWidth: 4 },
  barValue: { width: 24, textAlign: "right", fontSize: 13, fontWeight: "800", color: colors.onSurface },
  sellerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  rank: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  rankText: { fontSize: 13, fontWeight: "800", color: colors.onBrandTertiary },
  sellerTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  sellerName: { fontSize: 14, fontWeight: "700", color: colors.onSurface, flex: 1 },
  sellerQty: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  barTrackThin: { height: 6, backgroundColor: colors.surfaceTertiary, borderRadius: 3, overflow: "hidden" },
  barFillAlt: { height: 6, backgroundColor: colors.brandSecondary, borderRadius: 3, minWidth: 4 },
  sellerRev: { fontSize: 14, fontWeight: "800", color: colors.onSurface, width: 56, textAlign: "right" },
  ratingHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  avgPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surfaceTertiary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  avgText: { fontSize: 13, fontWeight: "800", color: colors.onSurface },
  fbRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  fbStars: { flexDirection: "row", gap: 1, paddingTop: 2 },
  fbName: { fontSize: 13, fontWeight: "700", color: colors.onSurface },
  fbComment: { fontSize: 13, color: colors.onSurfaceTertiary, fontStyle: "italic", marginTop: 2 },
}));
