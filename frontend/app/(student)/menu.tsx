import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
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
import { makeStyles, useTheme } from "@/src/theme";
import type { MenuItem } from "@/src/types";

const CATEGORIES = ["All", "Meals", "Snacks", "Beverages"];
const DIETS = [
  { key: "VEG", label: "Veg" },
  { key: "NON_VEG", label: "Non-Veg" },
];

export default function StudentMenu() {
  const styles = useStyles();
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

  return (
    <View style={styles.root}>
      {/* Sticky header + chip row (chrome) */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.greeting}>Hi {user?.name?.split(" ")[0] ?? "there"} 👋</Text>
        <Text style={styles.title}>What are you craving?</Text>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            testID="menu-search"
            value={search}
            onChangeText={setSearch}
            placeholder="Search the canteen…"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={styles.chipScroller}
        >
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              testID={`cat-chip-${c}`}
              onPress={() => {
                setCategory(c);
                haptic("selection");
              }}
              style={[styles.chip, category === c && styles.chipActive]}
            >
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          ))}
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
                style={[styles.chip, styles.dietChip, active && styles.chipActive]}
              >
                <DietDot dietary={d.key as any} size={12} />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{d.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
          <Text style={styles.centerText}>Warming up the ovens…</Text>
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <EmptyState title="Couldn't load menu" message="Please check your connection." ctaLabel="Retry" onCta={refetch} image={false} />
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
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: count > 0 ? 110 : insets.bottom + 24, gap: 12 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <MenuCard item={item} />}
        />
      )}

      {count > 0 ? (
        <Pressable
          testID="view-cart-btn"
          onPress={() => router.push("/checkout")}
          style={[styles.cartBar, { bottom: 16 }]}
        >
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{count}</Text>
          </View>
          <Text style={styles.cartBarText}>View Cart</Text>
          <Text style={styles.cartBarTotal}>₹{total}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function MenuCard({ item }: { item: MenuItem }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const cart = useCart();
  const line = cart.lines[item.id];
  const disabled = !item.available;

  return (
    <View style={[styles.card, disabled && styles.cardDisabled]} testID={`menu-card-${item.id}`}>
      <View style={styles.cardImgWrap}>
        <Image source={{ uri: item.image_url }} style={styles.cardImg} contentFit="cover" transition={200} />
        <LinearGradient colors={["transparent", "rgba(28,25,23,0.55)"]} style={styles.cardScrim} />
        <View style={styles.cardTopRow}>
          <DietDot dietary={item.dietary} />
        </View>
        {disabled ? (
          <View style={styles.oosOverlay}>
            <Badge label={item.in_stock ? "Not available now" : "Out of Stock"} tone="error" testID={`oos-${item.id}`} />
          </View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.cardDesc} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={styles.price}>₹{item.price}</Text>
          {disabled ? (
            <View style={[styles.addBtn, styles.addBtnDisabled]}>
              <Ionicons name="close" size={16} color={colors.muted} />
            </View>
          ) : line ? (
            <View style={styles.stepper}>
              <Pressable
                testID={`dec-${item.id}`}
                onPress={() => {
                  cart.decrement(item.id);
                  haptic("light");
                }}
                style={styles.stepBtn}
              >
                <Ionicons name="remove" size={16} color={colors.onBrandPrimary} />
              </Pressable>
              <Text style={styles.qty}>{line.qty}</Text>
              <Pressable
                testID={`inc-${item.id}`}
                onPress={() => {
                  cart.increment(item.id);
                  haptic("light");
                }}
                style={styles.stepBtn}
              >
                <Ionicons name="add" size={16} color={colors.onBrandPrimary} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              testID={`add-${item.id}`}
              onPress={() => {
                cart.add(item);
                haptic("light");
              }}
              style={styles.addBtn}
            >
              <Ionicons name="add" size={20} color={colors.onBrandPrimary} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  greeting: { fontSize: 14, color: colors.muted, fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "800", color: colors.onSurface, letterSpacing: -0.5, marginTop: 2 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginTop: 12,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.onSurface },
  chipScroller: { marginTop: 12, marginHorizontal: -20 },
  chipRow: { gap: 8, paddingHorizontal: 20, alignItems: "center" },
  chip: {
    height: 36,
    flexShrink: 0,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  dietChip: { flexDirection: "row", gap: 6 },
  chipActive: { backgroundColor: colors.brandPrimary },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.onSurfaceTertiary },
  chipTextActive: { color: colors.onBrandPrimary },
  chipDivider: { width: 1, height: 24, backgroundColor: colors.border, marginHorizontal: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  centerText: { color: colors.muted, fontSize: 14 },
  card: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardDisabled: { opacity: 0.75 },
  cardImgWrap: { height: 110, backgroundColor: colors.surfaceTertiary },
  cardImg: { ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as any) },
  cardScrim: { ...({ position: "absolute", left: 0, right: 0, bottom: 0, height: 50 } as any) },
  cardTopRow: { position: "absolute", top: 8, left: 8 },
  oosOverlay: {
    ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as any),
    backgroundColor: "rgba(253,251,247,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { padding: 12, gap: 4 },
  cardName: { fontSize: 15, fontWeight: "800", color: colors.onSurface },
  cardDesc: { fontSize: 12, color: colors.muted, lineHeight: 16, minHeight: 32 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  price: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnDisabled: { backgroundColor: colors.surfaceTertiary },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brandPrimary,
    borderRadius: 10,
    gap: 4,
    paddingHorizontal: 2,
  },
  stepBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  qty: { color: colors.onBrandPrimary, fontSize: 14, fontWeight: "800", minWidth: 16, textAlign: "center" },
  cartBar: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.surfaceInverse,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
  },
  cartBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  cartBadgeText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 13 },
  cartBarText: { flex: 1, color: colors.onSurfaceInverse, fontWeight: "800", fontSize: 16 },
  cartBarTotal: { color: colors.onSurfaceInverse, fontWeight: "800", fontSize: 16 },
}));
