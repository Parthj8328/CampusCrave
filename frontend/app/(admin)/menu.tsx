import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";

import { apiFetch } from "@/src/api/client";
import { ScreenHeader } from "@/src/components/header";
import { DietDot } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { haptic } from "@/src/lib/haptics";
import { useTheme } from "@/src/theme";
import type { Dietary, MenuItem } from "@/src/types";

const CATS = ["Meals", "Snacks", "Beverages"];
const FILTER_CATS = ["All", "Meals", "Snacks", "Beverages"];

type FormState = {
  id?: string;
  name: string;
  description: string;
  price: string;
  category: string;
  dietary: Dietary;
  image_url: string;
  in_stock: boolean;
  available_from: string;
  available_until: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  price: "",
  category: "Meals",
  dietary: "VEG",
  image_url: "",
  in_stock: true,
  available_from: "00:00",
  available_until: "23:59",
};

export default function AdminMenu() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["menu"],
    queryFn: () => apiFetch<MenuItem[]>("/menu"),
  });

  const save = useMutation({
    mutationFn: (f: FormState) => {
      const body = {
        name: f.name.trim(),
        description: f.description.trim(),
        price: parseFloat(f.price) || 0,
        category: f.category,
        dietary: f.dietary,
        image_url: f.image_url.trim(),
        in_stock: f.in_stock,
        available_from: f.available_from.trim(),
        available_until: f.available_until.trim(),
      };
      return f.id
        ? apiFetch(`/admin/menu/${f.id}`, { method: "PATCH", body })
        : apiFetch("/admin/menu", { method: "POST", body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu"] });
      setModalOpen(false);
      haptic("success");
      toast.show(form.id ? "Item updated" : "Item added", "success");
    },
    onError: (e: any) => toast.show(e?.message ?? "Save failed", "error"),
  });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/menu/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu"] });
      haptic("warning");
      toast.show("Item removed", "info");
    },
  });

  function openAdd() {
    haptic("selection");
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(item: MenuItem) {
    haptic("selection");
    setForm({
      id: item.id,
      name: item.name,
      description: item.description,
      price: String(item.price),
      category: item.category,
      dietary: item.dietary,
      image_url: item.image_url,
      in_stock: item.in_stock,
      available_from: item.available_from,
      available_until: item.available_until,
    });
    setModalOpen(true);
  }

  function submit() {
    if (!form.name.trim()) return toast.show("Enter item name", "error");
    if (!form.price.trim()) return toast.show("Enter price", "error");
    save.mutate(form);
  }

  const allItems = data ?? [];

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

  return (
    <View style={[styles.root, { backgroundColor: colors.deepObsidian }]}>
      {/* Kept upper text as requested */}
      <ScreenHeader
        title="Menu Manager"
        subtitle={`${allItems.length} items`}
        right={
          <Pressable
            testID="add-item-btn"
            onPress={openAdd}
            style={styles.addBtnWrapper}
          >
            <LinearGradient
              colors={["#FF6B4A", "#E5A93B"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.addBtnGradient}
            >
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        }
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.saffronCoral} />
          <Text style={[styles.loadingText, { color: colors.mutedSilver }]}>
            Loading menu items…
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(i) => i.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 120 },
          ]}
          ListHeaderComponent={
            <View style={styles.headerControls}>
              {/* Search Field */}
              <View style={styles.searchBar}>
                <Ionicons name="search" size={17} color={colors.mutedSilver} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search menu items…"
                  placeholderTextColor={colors.mutedSilver}
                  style={[styles.searchInput, { color: colors.softChalk }]}
                  clearButtonMode="while-editing"
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color={colors.mutedSilver} />
                  </Pressable>
                )}
              </View>

              {/* Category Filter Tabs */}
              <View style={styles.filterRow}>
                {FILTER_CATS.map((cat) => {
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
          renderItem={({ item, index }) => (
            <AdminMenuItemCard
              item={item}
              index={index}
              onEdit={() => openEdit(item)}
              onDelete={() => {
                haptic("warning");
                del.mutate(item.id);
              }}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="fast-food-outline" size={44} color={colors.mutedSilver} />
              <Text style={[styles.emptyTitle, { color: colors.softChalk }]}>
                No items match your filter
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedSilver }]}>
                Try adjusting your search query or category filter.
              </Text>
            </View>
          }
        />
      )}

      {/* Edit / New Item Modal Sheet */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
          <View
            style={[
              styles.modalSheet,
              { paddingBottom: insets.bottom + 16, backgroundColor: colors.deepObsidian },
            ]}
          >
            {/* Sheet Handle */}
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.softChalk }]}>
                  {form.id ? "Edit Item" : "New Item"}
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.mutedSilver }]}>
                  {form.id ? "Update canteen catalog entry" : "Add item to student menu"}
                </Text>
              </View>
              <Pressable
                testID="close-modal"
                onPress={() => setModalOpen(false)}
                hitSlop={8}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color={colors.softChalk} />
              </Pressable>
            </View>

            <KeyboardAwareScrollView
              bottomOffset={20}
              contentContainerStyle={styles.formScroll}
              showsVerticalScrollIndicator={false}
            >
              <FormField label="Item Name">
                <TextInput
                  testID="f-name"
                  value={form.name}
                  onChangeText={(v) => setForm({ ...form, name: v })}
                  placeholder="e.g. Veg Burger Deluxe"
                  placeholderTextColor={colors.mutedSilver}
                  style={[styles.input, { color: colors.softChalk }]}
                />
              </FormField>

              <FormField label="Description">
                <TextInput
                  testID="f-desc"
                  value={form.description}
                  onChangeText={(v) => setForm({ ...form, description: v })}
                  placeholder="Crispy patty, lettuce, house sauce"
                  placeholderTextColor={colors.mutedSilver}
                  style={[styles.input, { color: colors.softChalk }]}
                />
              </FormField>

              <View style={styles.rowFields}>
                <View style={{ flex: 1 }}>
                  <FormField label="Price (₹)">
                    <TextInput
                      testID="f-price"
                      value={form.price}
                      onChangeText={(v) => setForm({ ...form, price: v })}
                      keyboardType="numeric"
                      placeholder="90"
                      placeholderTextColor={colors.mutedSilver}
                      style={[styles.input, { color: colors.softChalk }]}
                    />
                  </FormField>
                </View>

                <View style={{ flex: 1 }}>
                  <FormField label="Dietary Preference">
                    <View style={styles.dietToggle}>
                      {(["VEG", "NON_VEG"] as Dietary[]).map((d) => (
                        <Pressable
                          key={d}
                          testID={`f-diet-${d}`}
                          onPress={() => {
                            haptic("selection");
                            setForm({ ...form, dietary: d });
                          }}
                          style={[
                            styles.dietBtn,
                            form.dietary === d && (d === "VEG" ? styles.dietBtnVeg : styles.dietBtnNonVeg),
                          ]}
                        >
                          <DietDot dietary={d} size={12} />
                          <Text
                            style={[
                              styles.dietText,
                              form.dietary === d && { color: colors.softChalk, fontWeight: "800" },
                            ]}
                          >
                            {d === "VEG" ? "Veg" : "Non-Veg"}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </FormField>
                </View>
              </View>

              <FormField label="Category">
                <View style={styles.catRow}>
                  {CATS.map((c) => (
                    <Pressable
                      key={c}
                      testID={`f-cat-${c}`}
                      onPress={() => {
                        haptic("selection");
                        setForm({ ...form, category: c });
                      }}
                      style={[
                        styles.catChip,
                        form.category === c && styles.catChipActive,
                      ]}
                    >
                      {form.category === c && (
                        <LinearGradient
                          colors={["rgba(229, 169, 59, 0.3)", "rgba(255, 107, 74, 0.2)"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                      <Text
                        style={[
                          styles.catText,
                          { color: form.category === c ? colors.warmGold : colors.mutedSilver },
                          form.category === c && styles.catTextActive,
                        ]}
                      >
                        {c}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </FormField>

              <FormField label="Photo URL">
                <TextInput
                  testID="f-image"
                  value={form.image_url}
                  onChangeText={(v) => setForm({ ...form, image_url: v })}
                  placeholder="https://images.unsplash.com/…"
                  placeholderTextColor={colors.mutedSilver}
                  autoCapitalize="none"
                  style={[styles.input, { color: colors.softChalk }]}
                />
              </FormField>

              <View style={styles.rowFields}>
                <View style={{ flex: 1 }}>
                  <FormField label="Available From">
                    <TextInput
                      testID="f-from"
                      value={form.available_from}
                      onChangeText={(v) => setForm({ ...form, available_from: v })}
                      placeholder="00:00"
                      placeholderTextColor={colors.mutedSilver}
                      style={[styles.input, { color: colors.softChalk }]}
                    />
                  </FormField>
                </View>
                <View style={{ flex: 1 }}>
                  <FormField label="Available Until">
                    <TextInput
                      testID="f-until"
                      value={form.available_until}
                      onChangeText={(v) => setForm({ ...form, available_until: v })}
                      placeholder="23:59"
                      placeholderTextColor={colors.mutedSilver}
                      style={[styles.input, { color: colors.softChalk }]}
                    />
                  </FormField>
                </View>
              </View>

              {/* In Stock Switch */}
              <View style={styles.stockRow}>
                <View>
                  <Text style={[styles.stockLabel, { color: colors.softChalk }]}>
                    In Stock
                  </Text>
                  <Text style={[styles.stockSub, { color: colors.mutedSilver }]}>
                    Active for student ordering
                  </Text>
                </View>
                <Switch
                  testID="f-stock"
                  value={form.in_stock}
                  onValueChange={(v) => {
                    haptic("rigid");
                    setForm({ ...form, in_stock: v });
                  }}
                  trackColor={{
                    true: colors.sageMint,
                    false: "rgba(255, 69, 58, 0.35)",
                  }}
                  thumbColor={colors.softChalk}
                />
              </View>

              {/* Submit CTA Button */}
              <Pressable
                testID="save-item"
                onPress={submit}
                disabled={save.isPending}
                style={styles.submitBtn}
              >
                <LinearGradient
                  colors={["#FF6B4A", "#E5A93B"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitGradient}
                >
                  {save.isPending ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitBtnText}>
                      {form.id ? "Save Changes" : "Create Item"}
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tactile Bento Item Card
// ---------------------------------------------------------------------------
function AdminMenuItemCard({
  item,
  index = 0,
  onEdit,
  onDelete,
}: {
  item: MenuItem;
  index?: number;
  onEdit: () => void;
  onDelete: () => void;
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

  const hasCustomHours =
    item.available_from !== "00:00" || item.available_until !== "23:59";

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
        testID={`admin-item-${item.id}`}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.card,
          !item.in_stock && styles.cardOOS,
        ]}
      >
        {/* Specular Top Shine Line */}
        <View style={styles.cardTopShine} />

        <View style={styles.cardInner}>
          {/* Food Thumbnail */}
          <View style={styles.thumbWrapper}>
            {item.image_url ? (
              <Image
                source={{ uri: item.image_url }}
                style={[styles.thumb, !item.in_stock && styles.thumbOOS]}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={[styles.thumbPlaceholder, { backgroundColor: colors.slateGray }]}>
                <Ionicons name="fast-food-outline" size={26} color={colors.mutedSilver} />
              </View>
            )}

            {/* Dietary Badge */}
            <View style={styles.dietPill}>
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
              <DietDot dietary={item.dietary} size={12} />
            </View>

            {/* 86'd Overlay */}
            {!item.in_stock && (
              <View style={styles.oosOverlay}>
                <View style={styles.oosTag}>
                  <Text style={styles.oosText}>86'D</Text>
                </View>
              </View>
            )}
          </View>

          {/* Details Column */}
          <View style={styles.infoCol}>
            <Text
              style={[
                styles.itemName,
                { color: item.in_stock ? colors.softChalk : colors.mutedSilver },
                !item.in_stock && styles.itemNameOOS,
              ]}
              numberOfLines={1}
            >
              {item.name}
            </Text>

            {/* Tags & Price Row */}
            <View style={styles.metaRow}>
              <View style={styles.pricePill}>
                <Text style={[styles.priceText, { color: colors.warmGold }]}>
                  ₹{item.price}
                </Text>
              </View>

              <Text style={[styles.categoryText, { color: colors.mutedSilver }]}>
                {item.category}
              </Text>

              {hasCustomHours && (
                <View style={styles.hoursPill}>
                  <Ionicons name="time-outline" size={11} color={colors.warmGold} />
                  <Text style={[styles.hoursText, { color: colors.warmGold }]}>
                    {item.available_from}–{item.available_until}
                  </Text>
                </View>
              )}
            </View>

            {/* In Stock vs 86'd status pill */}
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: item.in_stock ? colors.sageMint : colors.saffronCoral },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: item.in_stock ? colors.sageMint : colors.saffronCoral },
                ]}
              >
                {item.in_stock ? "Available" : "86'd (Out)"}
              </Text>
            </View>
          </View>

          {/* Edit & Delete Action Capsule */}
          <View style={styles.actionsCol}>
            <Pressable
              testID={`edit-${item.id}`}
              onPress={onEdit}
              style={styles.iconBtn}
              hitSlop={4}
            >
              <Ionicons name="create-outline" size={18} color={colors.softChalk} />
            </Pressable>

            <Pressable
              testID={`delete-${item.id}`}
              onPress={onDelete}
              style={[styles.iconBtn, styles.deleteBtn]}
              hitSlop={4}
            >
              <Ionicons name="trash-outline" size={18} color={colors.error} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.fieldContainer}>
      <Text style={[styles.fieldLabel, { color: colors.mutedSilver }]}>{label}</Text>
      {children}
    </View>
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
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // Add Item Header Button
  addBtnWrapper: {
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  addBtnGradient: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },

  // Header Controls (Search + Filters)
  headerControls: {
    marginBottom: 12,
    gap: 10,
  },
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
  filterRow: {
    flexDirection: "row",
    gap: 8,
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
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  cardOOS: {
    backgroundColor: "rgba(20, 20, 24, 0.65)",
    borderColor: "rgba(255, 69, 58, 0.25)",
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
  thumbWrapper: {
    width: 72,
    height: 72,
    borderRadius: 16,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#1F1F24",
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  thumbOOS: {
    opacity: 0.35,
  },
  thumbPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  dietPill: {
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
  oosText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  // Info Column
  infoCol: {
    flex: 1,
    gap: 4,
  },
  itemName: {
    fontSize: 15.5,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  itemNameOOS: {
    textDecorationLine: "line-through",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
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
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "600",
  },
  hoursPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3.5,
    backgroundColor: "rgba(229, 169, 59, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.25)",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  hoursText: {
    fontSize: 10.5,
    fontWeight: "800",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // Action Buttons
  actionsCol: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(44, 44, 52, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtn: {
    backgroundColor: "rgba(255, 69, 58, 0.12)",
    borderColor: "rgba(255, 69, 58, 0.28)",
  },

  // Empty Box
  emptyBox: {
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

  // Modal Sheet
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "92%",
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    alignSelf: "center",
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12.5,
    fontWeight: "500",
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(44, 44, 52, 0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  formScroll: {
    gap: 14,
    paddingBottom: 24,
  },
  fieldContainer: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "rgba(44, 44, 52, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 14.5,
    fontWeight: "500",
  },
  rowFields: {
    flexDirection: "row",
    gap: 12,
  },
  dietToggle: {
    flexDirection: "row",
    gap: 6,
  },
  dietBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(44, 44, 52, 0.5)",
  },
  dietBtnVeg: {
    borderColor: "rgba(48, 209, 88, 0.4)",
    backgroundColor: "rgba(48, 209, 88, 0.15)",
  },
  dietBtnNonVeg: {
    borderColor: "rgba(255, 69, 58, 0.4)",
    backgroundColor: "rgba(255, 69, 58, 0.15)",
  },
  dietText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#8E8E93",
  },
  catRow: {
    flexDirection: "row",
    gap: 8,
  },
  catChip: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(44, 44, 52, 0.5)",
    overflow: "hidden",
    position: "relative",
  },
  catChipActive: {
    borderColor: "rgba(229, 169, 59, 0.4)",
    backgroundColor: "rgba(40, 34, 26, 0.9)",
  },
  catText: {
    fontSize: 13,
    fontWeight: "700",
  },
  catTextActive: {
    fontWeight: "800",
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(44, 44, 52, 0.5)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stockLabel: {
    fontSize: 14.5,
    fontWeight: "700",
  },
  stockSub: {
    fontSize: 12,
    marginTop: 2,
  },
  submitBtn: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 6,
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  submitGradient: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
