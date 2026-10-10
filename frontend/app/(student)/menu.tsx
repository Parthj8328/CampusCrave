import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { apiFetch } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { Badge, DietDot } from "@/src/components/ui";
import { EmptyState } from "@/src/components/empty-state";
import { cartCount, cartTotal, useCart } from "@/src/store/cart";
import { haptic } from "@/src/lib/haptics";
import { useTheme } from "@/src/theme";
import type { MenuItem } from "@/src/types";

const CATEGORIES = ["All", "Meals", "Snacks", "Beverages"];
const DIETS = [
  { key: "VEG", label: "Veg" },
  { key: "NON_VEG", label: "Non-Veg" },
];

export default function StudentMenu() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const cart = useCart();

  const [category, setCategory] = useState("All");
  const [diet, setDiet] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["menu"],
    queryFn: () => apiFetch<MenuItem[]>("/menu"),
    refetchInterval: 15000,
  });

  const items = useMemo(() => {
    let list = data ?? [];
    if (category !== "All") list = list.filter((i) => i.category === category);
    if (diet) list = list.filter((i) => i.dietary === diet);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    return list;
  }, [data, category, diet, search]);

  const count = cartCount(cart.lines);
  const total = cartTotal(cart.lines);

  // Floating Cart Bar Animation
  const cartBarAnim = useRef(new Animated.Value(count > 0 ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(cartBarAnim, {
      toValue: count > 0 ? 1 : 0,
      speed: 24,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }, [count, cartBarAnim]);

  return (
    <View style={[styles.root, { backgroundColor: colors.deepObsidian }]}>
      {/* Sticky Header + Chip Row (Upper text kept as requested) */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={[styles.greeting, { color: colors.mutedSilver }]}>
          Hi {user?.name?.split(" ")[0] ?? "there"} 👋
        </Text>
        <Text style={[styles.title, { color: colors.softChalk }]}>
          What are you craving?
        </Text>

        {/* Frosted Glass Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.mutedSilver} />
          <TextInput
            testID="menu-search"
            value={search}
            onChangeText={setSearch}
            placeholder="Search the canteen…"
            placeholderTextColor={colors.mutedSilver}
            style={[styles.searchInput, { color: colors.softChalk }]}
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.mutedSilver} />
            </Pressable>
          ) : null}
        </View>

        {/* Category & Dietary Chips Scroller */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={styles.chipScroller}
        >
          {CATEGORIES.map((c) => {
            const active = category === c;
            return (
              <Pressable
                key={c}
                testID={`cat-chip-${c}`}
                onPress={() => {
                  setCategory(c);
                  haptic("selection");
                }}
                style={[
                  styles.glassChip,
                  active && styles.glassChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    active ? styles.chipTextActive : { color: colors.mutedSilver },
                  ]}
                >
                  {c}
                </Text>
              </Pressable>
            );
          })}
          <View style={styles.chipDivider} />
          {DIETS.map((d) => {
            const active = diet === d.key;
            return (
              <Pressable
                key={d.key}
                testID={`diet-chip-${d.key}`}
                onPress={() => {
                  setDiet(active ? null : d.key);
                  haptic("selection");
                }}
                style={[
                  styles.glassChip,
                  styles.dietChip,
                  active && styles.glassChipActive,
                ]}
              >
                <DietDot dietary={d.key as any} size={12} />
                <Text
                  style={[
                    styles.chipText,
                    active ? styles.chipTextActive : { color: colors.mutedSilver },
                  ]}
                >
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content Area */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.saffronCoral} />
          <Text style={[styles.centerText, { color: colors.mutedSilver }]}>
            Warming up the ovens…
          </Text>
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <EmptyState
            title="Couldn't load menu"
            message="Please check your connection."
            ctaLabel="Retry"
            onCta={refetch}
            image={false}
          />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            title="No items match your filter"
            message="Try a different category or clear filters."
            ctaLabel="Clear Filters"
            onCta={() => {
              setCategory("All");
              setDiet(null);
              setSearch("");
            }}
          />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={{
            paddingTop: 16,
            paddingBottom: insets.bottom + (count > 0 ? 168 : 100),
            gap: 14,
          }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => <MenuCard item={item} index={index} />}
        />
      )}

      {/* Floating Glassmorphic "View Cart" Bar (Floats gracefully above the floating home bar) */}
      <Animated.View
        style={[
          styles.cartBarWrapper,
          {
            bottom: Math.max(insets.bottom, 12) + 82,
            opacity: cartBarAnim,
            transform: [
              {
                translateY: cartBarAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [60, 0],
                }),
              },
              {
                scale: cartBarAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.92, 1],
                }),
              },
            ],
          },
        ]}
        pointerEvents={count > 0 ? "auto" : "none"}
      >
        <Pressable
          testID="view-cart-btn"
          onPress={() => {
            haptic("medium");
            router.push("/checkout");
          }}
          style={styles.cartBarPressable}
        >
          {/* Frosted Glass Background */}
          <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFill} />
          {/* Glass Top Edge Specular Shine */}
          <View style={styles.cartGlassShine} />

          <View style={styles.cartBarContent}>
            {/* Glowing Badge with Count */}
            <View style={styles.cartBadgeGlow}>
              <Text style={styles.cartBadgeText}>{count}</Text>
            </View>
            <View style={styles.cartLabelArea}>
              <Text style={styles.cartBarText}>View Tray & Order</Text>
              <Text style={styles.cartBarSubtext}>Fresh hot pickup</Text>
            </View>
            <View style={styles.cartTotalPill}>
              <Text style={styles.cartBarTotal}>₹{total}</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Redesigned Glowy Glassmorphic Food Card with Smooth Spring Animations
// ----------------------------------------------------------------------------
function MenuCard({ item, index }: { item: MenuItem; index: number }) {
  const { colors } = useTheme();
  const cart = useCart();
  const line = cart.lines[item.id];
  const disabled = !item.available;

  // Spring animations
  const cardScale = useRef(new Animated.Value(1)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Subtle staggered mount fade
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      delay: Math.min(index * 35, 300),
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, index]);

  const translateY = fadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });

  function handleCardPressIn() {
    Animated.spring(cardScale, {
      toValue: 0.965,
      speed: 40,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }

  function handleCardPressOut() {
    Animated.spring(cardScale, {
      toValue: 1,
      speed: 25,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }

  function handleAddPress() {
    haptic("light");
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.8, duration: 90, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1.15, speed: 45, bounciness: 8, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1, speed: 30, bounciness: 6, useNativeDriver: true }),
    ]).start();
    cart.add(item);
  }

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY }, { scale: cardScale }],
        },
      ]}
    >
      <Pressable
        testID={`menu-card-${item.id}`}
        onPressIn={handleCardPressIn}
        onPressOut={handleCardPressOut}
        disabled={disabled}
        style={[
          styles.glassCard,
          disabled && styles.cardDisabled,
        ]}
      >
        {/* Top Specular Rim Shine */}
        <View style={styles.cardTopShine} />

        {/* Food Image with 3-Stop Gradient Scrim */}
        <View style={styles.cardImgWrap}>
          <Image
            source={{ uri: item.image_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
          {/* Gradient Scrim: Melts image smoothly into dark glass surface */}
          <LinearGradient
            colors={["transparent", "rgba(18, 18, 22, 0.2)", "rgba(22, 22, 28, 0.95)"]}
            style={StyleSheet.absoluteFill}
          />

          {/* Floating Glass Dietary Pill at Top-Left */}
          <View style={styles.cardDietaryBadge}>
            <DietDot dietary={item.dietary} size={12} />
          </View>

          {/* Out of Stock / Not Available Frosted Scrim */}
          {disabled ? (
            <View style={styles.oosOverlay}>
              <View style={styles.oosGlassBadge}>
                <Ionicons name="time-outline" size={13} color="#FF453A" />
                <Text style={styles.oosText}>
                  {item.in_stock ? "Not available now" : "Out of Stock"}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* Card Body */}
        <View style={styles.cardBody}>
          <Text style={[styles.cardName, { color: colors.softChalk }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.cardDesc, { color: colors.mutedSilver }]} numberOfLines={2}>
            {item.description}
          </Text>

          {/* Card Footer: Price & Add / Stepper CTA */}
          <View style={styles.cardFooter}>
            <View style={styles.priceRow}>
              <Text style={styles.currencySymbol}>₹</Text>
              <Text style={[styles.priceValue, { color: colors.softChalk }]}>
                {item.price}
              </Text>
            </View>

            {disabled ? (
              <View style={styles.disabledBtn}>
                <Ionicons name="close" size={16} color={colors.mutedSilver} />
              </View>
            ) : line ? (
              /* Active Glassmorphic Stepper Pill */
              <View style={styles.stepperPill}>
                <Pressable
                  testID={`dec-${item.id}`}
                  onPress={() => {
                    cart.decrement(item.id);
                    haptic("light");
                  }}
                  style={styles.stepBtn}
                  hitSlop={6}
                >
                  <Ionicons name="remove" size={16} color="#FFFFFF" />
                </Pressable>
                <Text style={styles.qtyText}>{line.qty}</Text>
                <Pressable
                  testID={`inc-${item.id}`}
                  onPress={() => {
                    cart.increment(item.id);
                    haptic("light");
                  }}
                  style={styles.stepBtn}
                  hitSlop={6}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : (
              /* Glowing Animated Add Button */
              <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                <Pressable
                  testID={`add-${item.id}`}
                  onPress={handleAddPress}
                  style={styles.addBtnGlow}
                  hitSlop={8}
                >
                  <LinearGradient
                    colors={["#FF6B4A", "#FA5838"]}
                    style={styles.addBtnGradient}
                  >
                    <Ionicons name="add" size={20} color="#FFFFFF" />
                  </LinearGradient>
                </Pressable>
              </Animated.View>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  // --------------------------------------------------------------------------
  // Upper Header (Text and controls kept as requested)
  // --------------------------------------------------------------------------
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  greeting: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(38, 38, 44, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 48,
    marginTop: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
  chipScroller: {
    marginTop: 14,
    marginHorizontal: -20,
  },
  chipRow: {
    gap: 8,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  glassChip: {
    height: 38,
    flexShrink: 0,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: "rgba(36, 36, 42, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  glassChipActive: {
    backgroundColor: "#FF6B4A",
    borderColor: "#FF6B4A",
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 6,
  },
  dietChip: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  chipDivider: {
    width: 1,
    height: 22,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    marginHorizontal: 4,
  },

  // --------------------------------------------------------------------------
  // Grid and State Styles
  // --------------------------------------------------------------------------
  columnWrapper: {
    gap: 12,
    paddingHorizontal: 16,
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
  // Glowy Dark Glassmorphic Food Card Styles
  // --------------------------------------------------------------------------
  cardContainer: {
    flex: 1,
  },
  glassCard: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: "rgba(28, 28, 34, 0.78)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.13)",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  cardTopShine: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    height: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    zIndex: 10,
  },
  cardDisabled: {
    opacity: 0.75,
  },
  cardImgWrap: {
    height: 126,
    position: "relative",
    backgroundColor: "#16161A",
    overflow: "hidden",
  },
  cardDietaryBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(16, 16, 20, 0.78)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    padding: 5,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  oosOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(12, 12, 16, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    zIndex: 15,
  },
  oosGlassBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255, 69, 58, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 69, 58, 0.45)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  oosText: {
    color: "#FF453A",
    fontSize: 10,
    fontWeight: "700",
  },
  cardBody: {
    padding: 13,
    gap: 4,
  },
  cardName: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  cardDesc: {
    fontSize: 12,
    lineHeight: 16,
    minHeight: 32,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  currencySymbol: {
    fontSize: 13,
    fontWeight: "800",
    color: "#E5A93B",
  },
  priceValue: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  addBtnGlow: {
    width: 36,
    height: 36,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.65,
    shadowRadius: 10,
    elevation: 6,
  },
  addBtnGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(44, 44, 50, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  stepperPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF6B4A",
    borderRadius: 12,
    gap: 4,
    paddingHorizontal: 4,
    height: 36,
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  stepBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    minWidth: 16,
    textAlign: "center",
  },

  // --------------------------------------------------------------------------
  // Floating "View Cart" Bar (Positioned above floating glass home bar)
  // --------------------------------------------------------------------------
  cartBarWrapper: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 998,
  },
  cartBarPressable: {
    height: 60,
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: "rgba(24, 24, 28, 0.86)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 107, 74, 0.4)",
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 14,
  },
  cartGlassShine: {
    position: "absolute",
    top: 0,
    left: 30,
    right: 30,
    height: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  cartBarContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
  },
  cartBadgeGlow: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FF6B4A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  cartBadgeText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  cartLabelArea: {
    flex: 1,
  },
  cartBarText: {
    color: "#F2F2F7",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: -0.2,
  },
  cartBarSubtext: {
    color: "#8E8E93",
    fontSize: 11,
    fontWeight: "500",
  },
  cartTotalPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 107, 74, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 74, 0.35)",
  },
  cartBarTotal: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
});
