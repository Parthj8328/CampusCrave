import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";

import { apiFetch } from "@/src/api/client";
import { ScreenHeader } from "@/src/components/header";
import { EmptyState } from "@/src/components/empty-state";
import { haptic } from "@/src/lib/haptics";
import { useTheme } from "@/src/theme";
import type { Analytics } from "@/src/types";

export default function AdminDashboard() {
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
    <View style={[styles.root, { backgroundColor: colors.deepObsidian }]}>
      {/* Kept upper text exact as requested */}
      <ScreenHeader
        title="Analytics"
        subtitle="Live sales & rush insights"
        right={
          <View style={styles.liveIndicatorPill}>
            <View style={[styles.liveDot, { backgroundColor: colors.sageMint }]} />
            <Text style={[styles.liveText, { color: colors.sageMint }]}>LIVE</Text>
          </View>
        }
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.saffronCoral} />
          <Text style={[styles.loadingText, { color: colors.mutedSilver }]}>
            Aggregating canteen sales…
          </Text>
        </View>
      ) : isError || !data ? (
        <View style={styles.center}>
          <EmptyState
            title="Failed to load analytics"
            message="Unable to reach reporting service."
            ctaLabel="Retry"
            onCta={refetch}
            image={false}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 120 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                haptic("light");
                refetch();
              }}
              tintColor={colors.warmGold}
            />
          }
        >
          {/* Executive Stat Bento Cards (2x2 Grid) */}
          <View style={styles.statGrid}>
            <View style={styles.statRow}>
              <AnalyticsStatCard
                icon="wallet-outline"
                label="Total Revenue"
                value={`₹${data.total_revenue}`}
                subtag="Gross Sales"
                accentColor={colors.warmGold}
                gradient={["rgba(229, 169, 59, 0.18)", "rgba(229, 169, 59, 0.02)"]}
                delay={0}
              />
              <AnalyticsStatCard
                icon="receipt-outline"
                label="Orders Placed"
                value={`${data.total_orders}`}
                subtag="Tickets"
                accentColor={colors.saffronCoral}
                gradient={["rgba(255, 107, 74, 0.18)", "rgba(255, 107, 74, 0.02)"]}
                delay={50}
              />
            </View>

            <View style={styles.statRow}>
              <AnalyticsStatCard
                icon="trending-up-outline"
                label="Avg Order Value"
                value={`₹${data.avg_order}`}
                subtag="Per Ticket"
                accentColor={colors.sageMint}
                gradient={["rgba(48, 209, 88, 0.16)", "rgba(48, 209, 88, 0.02)"]}
                delay={100}
              />
              <AnalyticsStatCard
                icon="flame-outline"
                label="In Kitchen"
                value={`${data.status_counts?.PREPARING ?? 0}`}
                subtag="Preparing"
                accentColor={
                  (data.status_counts?.PREPARING ?? 0) > 0
                    ? colors.saffronCoral
                    : colors.mutedSilver
                }
                gradient={
                  (data.status_counts?.PREPARING ?? 0) > 0
                    ? ["rgba(255, 69, 58, 0.22)", "rgba(255, 107, 74, 0.04)"]
                    : ["rgba(142, 142, 147, 0.12)", "transparent"]
                }
                delay={150}
              />
            </View>
          </View>

          {/* Peak Interval Distribution Card */}
          <View style={styles.glassCard}>
            <View style={styles.cardTopShine} />

            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderTitleRow}>
                <View style={[styles.cardHeaderIconBadge, { backgroundColor: "rgba(255, 107, 74, 0.15)" }]}>
                  <Ionicons name="time-outline" size={17} color={colors.saffronCoral} />
                </View>
                <View>
                  <Text style={[styles.cardTitle, { color: colors.softChalk }]}>
                    Peak Interval Distribution
                  </Text>
                  <Text style={[styles.cardSubtitle, { color: colors.mutedSilver }]}>
                    Rush volume by pickup window
                  </Text>
                </View>
              </View>

              {data.peak_intervals.length > 0 && (
                <View style={styles.peakPill}>
                  <Text style={[styles.peakPillText, { color: colors.saffronCoral }]}>
                    {maxPeak} peak max
                  </Text>
                </View>
              )}
            </View>

            {data.peak_intervals.length === 0 ? (
              <View style={styles.emptyCardBox}>
                <Ionicons name="calendar-outline" size={32} color={colors.mutedSilver} />
                <Text style={[styles.emptyLine, { color: colors.mutedSilver }]}>
                  No interval sales recorded yet today.
                </Text>
              </View>
            ) : (
              <View style={styles.intervalsList}>
                {data.peak_intervals.map((p) => {
                  const percentage = Math.round((p.orders / maxPeak) * 100);
                  const isTopPeak = p.orders === maxPeak;

                  return (
                    <View key={p.label} style={styles.intervalRow}>
                      <View style={styles.intervalLabelCol}>
                        <Text style={[styles.intervalTime, { color: colors.softChalk }]} numberOfLines={1}>
                          {p.label.replace(" – ", "–")}
                        </Text>
                        {p.revenue > 0 ? (
                          <Text style={[styles.intervalRevenue, { color: colors.warmGold }]}>
                            ₹{p.revenue}
                          </Text>
                        ) : null}
                      </View>

                      {/* Glowing Gradient Progress Bar */}
                      <View style={styles.progressTrack}>
                        <LinearGradient
                          colors={
                            isTopPeak
                              ? ["#FF6B4A", "#E5A93B"]
                              : ["rgba(255, 107, 74, 0.8)", "rgba(229, 169, 59, 0.7)"]
                          }
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[
                            styles.progressFill,
                            { width: `${Math.max(percentage, 6)}%` },
                            isTopPeak && styles.progressFillTop,
                          ]}
                        />
                      </View>

                      {/* Orders Count Badge */}
                      <View style={[styles.ordersPill, isTopPeak && styles.ordersPillTop]}>
                        <Text
                          style={[
                            styles.ordersPillValue,
                            { color: isTopPeak ? colors.saffronCoral : colors.softChalk },
                          ]}
                        >
                          {p.orders}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Top Sellers Leaderboard Card */}
          <View style={styles.glassCard}>
            <View style={styles.cardTopShine} />

            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderTitleRow}>
                <View style={[styles.cardHeaderIconBadge, { backgroundColor: "rgba(229, 169, 59, 0.15)" }]}>
                  <Ionicons name="trophy-outline" size={17} color={colors.warmGold} />
                </View>
                <View>
                  <Text style={[styles.cardTitle, { color: colors.softChalk }]}>
                    Top Sellers
                  </Text>
                  <Text style={[styles.cardSubtitle, { color: colors.mutedSilver }]}>
                    Most demanded items by volume
                  </Text>
                </View>
              </View>

              <View style={styles.badgeCount}>
                <Text style={[styles.badgeCountText, { color: colors.warmGold }]}>
                  {data.top_sellers.length} Items
                </Text>
              </View>
            </View>

            {data.top_sellers.length === 0 ? (
              <View style={styles.emptyCardBox}>
                <Ionicons name="fast-food-outline" size={32} color={colors.mutedSilver} />
                <Text style={[styles.emptyLine, { color: colors.mutedSilver }]}>
                  No item sales registered yet today.
                </Text>
              </View>
            ) : (
              <View style={styles.sellersList}>
                {data.top_sellers.map((s, i) => {
                  const rank = i + 1;
                  const ratio = Math.round((s.qty / maxSeller) * 100);

                  return (
                    <View key={s.name} style={styles.sellerRow}>
                      {/* Rank Medal Circle */}
                      <View
                        style={[
                          styles.rankCircle,
                          rank === 1
                            ? styles.rankGold
                            : rank === 2
                              ? styles.rankSilver
                              : rank === 3
                                ? styles.rankBronze
                                : styles.rankNormal,
                        ]}
                      >
                        <Text
                          style={[
                            styles.rankNumber,
                            {
                              color:
                                rank === 1
                                  ? colors.warmGold
                                  : rank === 2
                                    ? "#E5E5EA"
                                    : rank === 3
                                      ? "#D4AF37"
                                      : colors.mutedSilver,
                            },
                          ]}
                        >
                          {rank}
                        </Text>
                      </View>

                      {/* Item Info & Progress Bar */}
                      <View style={styles.sellerInfoCol}>
                        <View style={styles.sellerDetailsTop}>
                          <Text style={[styles.sellerName, { color: colors.softChalk }]} numberOfLines={1}>
                            {s.name}
                          </Text>
                          <View style={styles.soldBadge}>
                            <Text style={[styles.soldText, { color: colors.mutedSilver }]}>
                              {s.qty} sold
                            </Text>
                          </View>
                        </View>

                        {/* Thin Relative Bar */}
                        <View style={styles.sellerBarTrack}>
                          <LinearGradient
                            colors={
                              rank === 1
                                ? ["#E5A93B", "#FF6B4A"]
                                : ["rgba(229, 169, 59, 0.8)", "rgba(229, 169, 59, 0.4)"]
                            }
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[
                              styles.sellerBarFill,
                              { width: `${Math.max(ratio, 8)}%` },
                            ]}
                          />
                        </View>
                      </View>

                      {/* Revenue Pill */}
                      <View style={styles.revenuePill}>
                        <Text style={[styles.revenueText, { color: colors.softChalk }]}>
                          ₹{s.revenue}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Ratings & Customer Sentiment Card */}
          <View style={styles.glassCard}>
            <View style={styles.cardTopShine} />

            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderTitleRow}>
                <View style={[styles.cardHeaderIconBadge, { backgroundColor: "rgba(229, 169, 59, 0.15)" }]}>
                  <Ionicons name="star-outline" size={17} color={colors.warmGold} />
                </View>
                <View>
                  <Text style={[styles.cardTitle, { color: colors.softChalk }]}>
                    Ratings & Feedback
                  </Text>
                  <Text style={[styles.cardSubtitle, { color: colors.mutedSilver }]}>
                    Student reviews & dining experience
                  </Text>
                </View>
              </View>

              {data.rated_count > 0 ? (
                <View style={styles.avgRatingCapsule}>
                  <Ionicons name="star" size={14} color={colors.warmGold} />
                  <Text style={[styles.avgRatingScore, { color: colors.softChalk }]}>
                    {data.avg_rating}
                  </Text>
                  <Text style={[styles.avgRatingCount, { color: colors.mutedSilver }]}>
                    ({data.rated_count})
                  </Text>
                </View>
              ) : null}
            </View>

            {!data.recent_feedback || data.recent_feedback.length === 0 ? (
              <View style={styles.emptyCardBox}>
                <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.mutedSilver} />
                <Text style={[styles.emptyLine, { color: colors.mutedSilver }]}>
                  No feedback ratings received yet today.
                </Text>
              </View>
            ) : (
              <View style={styles.feedbackList}>
                {data.recent_feedback.map((f, i) => (
                  <View key={`${f.order_token}-${i}`} style={styles.feedbackCard}>
                    {/* User Avatar Circle */}
                    <View style={styles.userAvatar}>
                      <Text style={styles.userAvatarInitial}>
                        {(f.user_name || "S")[0].toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.feedbackContentCol}>
                      <View style={styles.feedbackMetaRow}>
                        <Text style={[styles.feedbackUserName, { color: colors.softChalk }]}>
                          {f.user_name}
                        </Text>
                        <View style={styles.starsRow}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Ionicons
                              key={star}
                              name={star <= f.rating ? "star" : "star-outline"}
                              size={12}
                              color={colors.warmGold}
                            />
                          ))}
                        </View>
                      </View>

                      {f.comment ? (
                        <Text
                          style={[styles.feedbackComment, { color: colors.mutedSilver }]}
                          numberOfLines={2}
                        >
                          "{f.comment}"
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

// ---------------------------------------------------------------------------
// Tactile Glass Stat Card Component
// ---------------------------------------------------------------------------
function AnalyticsStatCard({
  icon,
  label,
  value,
  subtag,
  accentColor,
  gradient,
  delay = 0,
}: {
  icon: string;
  label: string;
  value: string;
  subtag: string;
  accentColor: string;
  gradient: [string, string];
  delay?: number;
}) {
  const { colors } = useTheme();
  const pressScale = useRef(new Animated.Value(1)).current;
  const entryAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entryAnim, {
      toValue: 1,
      duration: 320,
      delay,
      useNativeDriver: true,
    }).start();
  }, [entryAnim, delay]);

  const translateY = entryAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.97,
      speed: 30,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      speed: 24,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        {
          opacity: entryAnim,
          transform: [{ translateY }, { scale: pressScale }],
        },
        styles.statCardWrapper,
      ]}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.statCardInner}
      >
        {/* Specular Top Shine */}
        <View style={styles.cardTopShine} />

        {/* Ambient Gradient Tint */}
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
        />

        {/* Top Icon & Subtag */}
        <View style={styles.statHeaderRow}>
          <View style={[styles.statIconBadge, { backgroundColor: "rgba(255, 255, 255, 0.08)" }]}>
            <Ionicons name={icon as any} size={18} color={accentColor} />
          </View>
          <View style={[styles.statSubtagPill, { borderColor: "rgba(255, 255, 255, 0.08)" }]}>
            <Text style={[styles.statSubtagText, { color: colors.mutedSilver }]}>
              {subtag}
            </Text>
          </View>
        </View>

        {/* Main Stat Value */}
        <Text style={[styles.statMainValue, { color: colors.softChalk }]}>
          {value}
        </Text>

        {/* Label */}
        <Text style={[styles.statLabelText, { color: colors.mutedSilver }]}>
          {label}
        </Text>
      </Pressable>
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
  scrollContent: {
    padding: 16,
    gap: 16,
  },

  // Live indicator in header
  liveIndicatorPill: {
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
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.6,
  },

  // 2x2 Stat Grid
  statGrid: {
    gap: 12,
  },
  statRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCardWrapper: {
    flex: 1,
  },
  statCardInner: {
    backgroundColor: "rgba(28, 28, 34, 0.85)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 18,
    padding: 14,
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTopShine: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    height: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.28)",
  },
  statHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  statIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statSubtagPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
  },
  statSubtagText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statMainValue: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  statLabelText: {
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: 2,
  },

  // Glass Container Cards (Peak Intervals & Top Sellers)
  glassCard: {
    backgroundColor: "rgba(28, 28, 34, 0.88)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 22,
    padding: 16,
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardHeaderIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 15.5,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 11.5,
    fontWeight: "500",
    marginTop: 1,
  },
  peakPill: {
    backgroundColor: "rgba(255, 107, 74, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 107, 74, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  peakPillText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  badgeCount: {
    backgroundColor: "rgba(229, 169, 59, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeCountText: {
    fontSize: 11,
    fontWeight: "800",
  },

  // Peak Interval Rows
  intervalsList: {
    gap: 12,
  },
  intervalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  intervalLabelCol: {
    width: 100,
  },
  intervalTime: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  intervalRevenue: {
    fontSize: 10.5,
    fontWeight: "800",
    marginTop: 1,
  },
  progressTrack: {
    flex: 1,
    height: 18,
    backgroundColor: "rgba(44, 44, 52, 0.7)",
    borderRadius: 6,
    overflow: "hidden",
    justifyContent: "center",
  },
  progressFill: {
    height: "100%",
    borderRadius: 6,
  },
  progressFillTop: {
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  ordersPill: {
    width: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  ordersPillTop: {
    backgroundColor: "rgba(255, 107, 74, 0.15)",
    borderRadius: 6,
    paddingVertical: 2,
  },
  ordersPillValue: {
    fontSize: 13,
    fontWeight: "800",
  },

  // Top Sellers Rows
  sellersList: {
    gap: 12,
  },
  sellerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rankCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  rankGold: {
    backgroundColor: "rgba(229, 169, 59, 0.18)",
    borderColor: "rgba(229, 169, 59, 0.4)",
  },
  rankSilver: {
    backgroundColor: "rgba(180, 180, 190, 0.15)",
    borderColor: "rgba(200, 200, 210, 0.3)",
  },
  rankBronze: {
    backgroundColor: "rgba(212, 175, 55, 0.12)",
    borderColor: "rgba(212, 175, 55, 0.25)",
  },
  rankNormal: {
    backgroundColor: "rgba(44, 44, 52, 0.5)",
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  rankNumber: {
    fontSize: 12.5,
    fontWeight: "800",
  },
  sellerInfoCol: {
    flex: 1,
    gap: 4,
  },
  sellerDetailsTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sellerName: {
    fontSize: 13.5,
    fontWeight: "700",
    flex: 1,
  },
  soldBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  soldText: {
    fontSize: 11,
    fontWeight: "600",
  },
  sellerBarTrack: {
    height: 5,
    backgroundColor: "rgba(44, 44, 52, 0.7)",
    borderRadius: 3,
    overflow: "hidden",
  },
  sellerBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  revenuePill: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    minWidth: 54,
    alignItems: "center",
  },
  revenueText: {
    fontSize: 12.5,
    fontWeight: "800",
    letterSpacing: -0.2,
  },

  // Ratings & Feedback
  avgRatingCapsule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(229, 169, 59, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.35)",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  avgRatingScore: {
    fontSize: 12.5,
    fontWeight: "800",
  },
  avgRatingCount: {
    fontSize: 11,
    fontWeight: "600",
  },
  feedbackList: {
    gap: 10,
  },
  feedbackCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(20, 20, 24, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 14,
    padding: 10,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(229, 169, 59, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.35)",
  },
  userAvatarInitial: {
    fontSize: 13,
    fontWeight: "800",
    color: "#E5A93B",
  },
  feedbackContentCol: {
    flex: 1,
    gap: 2,
  },
  feedbackMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  feedbackUserName: {
    fontSize: 13,
    fontWeight: "700",
  },
  starsRow: {
    flexDirection: "row",
    gap: 1.5,
  },
  feedbackComment: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 2,
    lineHeight: 16,
  },

  // Empty state in card
  emptyCardBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 6,
  },
  emptyLine: {
    fontSize: 12.5,
    fontWeight: "500",
  },
});
