import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  SectionList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";

import { apiFetch } from "@/src/api/client";
import { ScreenHeader } from "@/src/components/header";
import { DietDot } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { haptic } from "@/src/lib/haptics";
import { useTheme } from "@/src/theme";
import type { MenuItem } from "@/src/types";

const CATEGORIES = ["All", "Meals", "Snacks", "Beverages"];
const ORDER = ["Meals", "Snacks", "Beverages"];

export default function KitchenStock() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["menu"],
    queryFn: () => apiFetch<MenuItem[]>("/menu"),
    refetchInterval: 15000,
  });

  const toggle = useMutation({
    mutationFn: ({ id, in_stock }: { id: string; in_stock: boolean }) =>
      apiFetch<MenuItem>(`/menu/${id}/stock`, { method: "PATCH", body: { in_stock } }),
    onSuccess: (item) => {
      qc.invalidateQueries({ queryKey: ["menu"] });
      toast.show(
        `${item.name} ${item.in_stock ? "is now In Stock" : "marked 86'd (Sold Out)"}`,
        item.in_stock ? "success" : "info"
      );
    },
  });

  // Calculate live stats
  const allItems = data ?? [];
  const totalCount = allItems.length;
  const inStockCount = allItems.filter((i) => i.in_stock).length;
  const outOfStockCount = totalCount - inStockCount;

  // Filter items based on category & search
  const filteredItems = useMemo(() => {
    let list = allItems;
    if (selectedCategory !== "All") {
      list = list.filter((i) => i.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.description && i.description.toLowerCase().includes(q))
      );
    }
    return list;
  }, [allItems, selectedCategory, searchQuery]);

  // Group into sections
  const sections = useMemo(() => {
    if (selectedCategory !== "All") {
      return [{ title: selectedCategory, data: filteredItems }];
    }
    return ORDER.map((cat) => ({
      title: cat,
      data: filteredItems.filter((i) => i.category === cat),
    })).filter((s) => s.data.length > 0);
  }, [selectedCategory, filteredItems]);

  return (
    <View style={[styles.root, { backgroundColor: colors.deepObsidian }]}>
      {/* Kept exact upper text as requested */}
      <ScreenHeader
        title="Stock Control"
        subtitle="Toggle items in / out of stock"
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.saffronCoral} />
          <Text style={[styles.loadingText, { color: colors.mutedSilver }]}>
            Syncing inventory…
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(i) => i.id}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 115 },
          ]}
          ListHeaderComponent={
            <View style={styles.headerContainer}>
              {/* Inventory Live Stats HUD */}
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <View style={styles.cardTopShine} />
                  <Ionicons name="layers-outline" size={16} color={colors.mutedSilver} />
                  <Text style={[styles.statValue, { color: colors.softChalk }]}>
                    {totalCount}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.mutedSilver }]}>
                    Total
                  </Text>
                </View>

                <View style={[styles.statCard, styles.statCardActive]}>
                  <View style={styles.cardTopShine} />
                  <View style={styles.pulseRow}>
                    <View style={[styles.statusDotLive, { backgroundColor: colors.sageMint }]} />
                    <Text style={[styles.statValue, { color: colors.sageMint }]}>
                      {inStockCount}
                    </Text>
                  </View>
                  <Text style={[styles.statLabel, { color: colors.mutedSilver }]}>
                    In Stock
                  </Text>
                </View>

                <View style={[styles.statCard, outOfStockCount > 0 && styles.statCardWarning]}>
                  <View style={styles.cardTopShine} />
                  <View style={styles.pulseRow}>
                    <View
                      style={[
                        styles.statusDotLive,
                        { backgroundColor: outOfStockCount > 0 ? colors.saffronCoral : colors.mutedSilver },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statValue,
                        { color: outOfStockCount > 0 ? colors.saffronCoral : colors.mutedSilver },
                      ]}
                    >
                      {outOfStockCount}
                    </Text>
                  </View>
                  <Text style={[styles.statLabel, { color: colors.mutedSilver }]}>
                    86'd (Out)
                  </Text>
                </View>
              </View>

              {/* Quick Search Field */}
              <View style={styles.searchBar}>
                <Ionicons name="search" size={17} color={colors.mutedSilver} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Quick search items or ingredients…"
                  placeholderTextColor={colors.mutedSilver}
                  style={[styles.searchInput, { color: colors.softChalk }]}
                  clearButtonMode="while-editing"
                />
                {searchQuery.length > 0 && (
                  <Pressable
                    onPress={() => setSearchQuery("")}
                    hitSlop={8}
                    style={styles.searchClearBtn}
                  >
                    <Ionicons name="close-circle" size={16} color={colors.mutedSilver} />
                  </Pressable>
                )}
              </View>

              {/* Category Filter Pills */}
              <View style={styles.filterRow}>
                {CATEGORIES.map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => {
                        haptic("selection");
                        setSelectedCategory(cat);
                      }}
                      style={[
                        styles.filterChip,
                        active && styles.filterChipActive,
                      ]}
                    >
                      {active && (
                        <LinearGradient
                          colors={["rgba(229, 169, 59, 0.25)", "rgba(255, 107, 74, 0.15)"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                      <Text
                        style={[
                          styles.filterChipText,
                          { color: active ? colors.warmGold : colors.mutedSilver },
                          active && styles.filterChipTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="restaurant-outline" size={13} color={colors.warmGold} />
                <Text style={[styles.sectionTitle, { color: colors.mutedSilver }]}>
                  {section.title}
                </Text>
                <View style={styles.sectionBadge}>
                  <Text style={[styles.sectionBadgeText, { color: colors.warmGold }]}>
                    {section.data.length}
                  </Text>
                </View>
              </View>
              <View style={styles.sectionDivider} />
            </View>
          )}
          renderItem={({ item, index }) => (
            <StockItemCard
              item={item}
              index={index}
              onToggle={(v) => {
                haptic("rigid");
                toggle.mutate({ id: item.id, in_stock: v });
              }}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="fast-food-outline" size={44} color={colors.mutedSilver} />
              <Text style={[styles.emptyTitle, { color: colors.softChalk }]}>
                No items found
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedSilver }]}>
                Try adjusting your search or category filter.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Premium Tactile Stock Card Component
// ---------------------------------------------------------------------------
function StockItemCard({
  item,
  index = 0,
  onToggle,
}: {
  item: MenuItem;
  index?: number;
  onToggle: (inStock: boolean) => void;
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

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.985,
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
        styles.cardContainer,
      ]}
    >
      <Pressable
        testID={`stock-row-${item.id}`}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.card,
          !item.in_stock && styles.cardOOS,
          item.in_stock && styles.cardInStockBorder,
        ]}
      >
        {/* Top Edge Specular Shine */}
        <View style={styles.cardTopShine} />

        {/* Ambient Subtle Stock Halo */}
        {item.in_stock && (
          <LinearGradient
            colors={["rgba(48, 209, 88, 0.05)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
          />
        )}

        <View style={styles.cardInner}>
          {/* Left Hero: Food Thumbnail with Dietary Badge */}
          <View style={styles.imageWrapper}>
            {item.image_url ? (
              <Image
                source={{ uri: item.image_url }}
                style={[styles.thumbnail, !item.in_stock && styles.thumbnailOOS]}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={[styles.thumbnailPlaceholder, { backgroundColor: colors.slateGray }]}>
                <Ionicons name="fast-food-outline" size={26} color={colors.mutedSilver} />
              </View>
            )}

            {/* Dietary Badge pinned top-left */}
            <View style={styles.dietBadgeWrapper}>
              <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />
              <DietDot dietary={item.dietary} size={13} />
            </View>

            {/* 86'd Overlay Banner if Out of Stock */}
            {!item.in_stock && (
              <View style={styles.oosOverlay}>
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={styles.oosTag}>
                  <Text style={styles.oosTagText}>86'D</Text>
                </View>
              </View>
            )}
          </View>

          {/* Center Info Column */}
          <View style={styles.infoCol}>
            <View style={styles.titleRow}>
              <Text
                numberOfLines={1}
                style={[
                  styles.itemName,
                  { color: item.in_stock ? colors.softChalk : colors.mutedSilver },
                  !item.in_stock && styles.itemNameOOS,
                ]}
              >
                {item.name}
              </Text>
            </View>

            {/* Truncated Ingredients / Description */}
            {item.description ? (
              <Text
                numberOfLines={1}
                style={[
                  styles.itemDesc,
                  { color: colors.mutedSilver },
                  !item.in_stock && { opacity: 0.6 },
                ]}
              >
                {item.description}
              </Text>
            ) : (
              <Text style={[styles.itemCategory, { color: colors.mutedSilver }]}>
                {item.category}
              </Text>
            )}

            {/* Price Pill */}
            <View style={styles.metaRow}>
              <View style={styles.pricePill}>
                <Text style={[styles.priceText, { color: colors.warmGold }]}>
                  ₹{item.price}
                </Text>
              </View>
              <Text style={[styles.categoryTag, { color: colors.mutedSilver }]}>
                {item.category}
              </Text>
            </View>
          </View>

          {/* Right Action Hub: Status Badge & iOS Switch */}
          <View style={styles.actionCol}>
            {/* Live Status Pill */}
            <View
              style={[
                styles.statusBadge,
                item.in_stock ? styles.statusBadgeInStock : styles.statusBadgeOOS,
              ]}
            >
              <View
                style={[
                  styles.statusBeacon,
                  {
                    backgroundColor: item.in_stock ? colors.sageMint : colors.saffronCoral,
                  },
                ]}
              />
              <Text
                style={[
                  styles.statusBadgeText,
                  {
                    color: item.in_stock ? colors.sageMint : colors.saffronCoral,
                  },
                ]}
              >
                {item.in_stock ? "In Stock" : "86'd"}
              </Text>
            </View>

            {/* Tactile Toggle Switch */}
            <Switch
              testID={`stock-switch-${item.id}`}
              value={item.in_stock}
              onValueChange={onToggle}
              trackColor={{
                true: colors.sageMint,
                false: "rgba(255, 69, 58, 0.35)",
              }}
              thumbColor={colors.softChalk}
              style={styles.switchControl}
            />
          </View>
        </View>
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
    letterSpacing: 0.2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  headerContainer: {
    marginBottom: 8,
    gap: 12,
  },

  // Inventory Stats HUD
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(28, 28, 34, 0.85)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  statCardActive: {
    borderColor: "rgba(48, 209, 88, 0.22)",
    backgroundColor: "rgba(28, 36, 30, 0.85)",
  },
  statCardWarning: {
    borderColor: "rgba(255, 107, 74, 0.25)",
    backgroundColor: "rgba(36, 26, 26, 0.85)",
  },
  pulseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDotLive: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // Quick Search Bar
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(44, 44, 46, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 2,
  },

  // Category Filter Pills
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: "rgba(28, 28, 34, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
    position: "relative",
  },
  filterChipActive: {
    borderColor: "rgba(229, 169, 59, 0.4)",
    backgroundColor: "rgba(40, 34, 26, 0.9)",
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  filterChipTextActive: {
    fontWeight: "800",
  },

  // Section Headers
  sectionHeader: {
    marginTop: 18,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sectionBadge: {
    backgroundColor: "rgba(229, 169, 59, 0.15)",
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 8,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  sectionDivider: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    marginLeft: 12,
  },

  // Card Container & Layout
  cardContainer: {
    marginBottom: 12,
  },
  card: {
    backgroundColor: "rgba(28, 28, 34, 0.88)",
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.1)",
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  cardInStockBorder: {
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  cardOOS: {
    backgroundColor: "rgba(20, 20, 24, 0.65)",
    borderColor: "rgba(255, 69, 58, 0.28)",
  },
  cardTopShine: {
    position: "absolute",
    top: 0,
    left: 20,
    right: 20,
    height: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },

  // Thumbnail
  imageWrapper: {
    width: 74,
    height: 74,
    borderRadius: 16,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#1F1F24",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  thumbnailOOS: {
    opacity: 0.35,
  },
  thumbnailPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  dietBadgeWrapper: {
    position: "absolute",
    top: 5,
    left: 5,
    backgroundColor: "rgba(18, 18, 22, 0.75)",
    borderRadius: 6,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    overflow: "hidden",
  },
  oosOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 10, 10, 0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  oosTag: {
    backgroundColor: "rgba(255, 69, 58, 0.9)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  oosTagText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  // Info Column
  infoCol: {
    flex: 1,
    justifyContent: "center",
    gap: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemName: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  itemNameOOS: {
    textDecorationLine: "line-through",
  },
  itemDesc: {
    fontSize: 11.5,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
  itemCategory: {
    fontSize: 11.5,
    fontWeight: "500",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  pricePill: {
    backgroundColor: "rgba(229, 169, 59, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  priceText: {
    fontSize: 12.5,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  categoryTag: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  // Action Column
  actionCol: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 8,
    minWidth: 70,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeInStock: {
    backgroundColor: "rgba(48, 209, 88, 0.12)",
    borderColor: "rgba(48, 209, 88, 0.28)",
  },
  statusBadgeOOS: {
    backgroundColor: "rgba(255, 69, 58, 0.14)",
    borderColor: "rgba(255, 69, 58, 0.3)",
  },
  statusBeacon: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  switchControl: {
    transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
  },

  // Empty State
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
  },
});
