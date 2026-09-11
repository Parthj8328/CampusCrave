import { useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, Switch, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";

import { apiFetch } from "@/src/api/client";
import { ScreenHeader } from "@/src/components/header";
import { Badge, Button, DietDot } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { haptic } from "@/src/lib/haptics";
import { makeStyles, useTheme } from "@/src/theme";
import type { Dietary, MenuItem } from "@/src/types";

const CATS = ["Meals", "Snacks", "Beverages"];

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
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

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
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }
  function openEdit(item: MenuItem) {
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

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Menu Manager"
        subtitle={`${data?.length ?? 0} items`}
        right={
          <Pressable testID="add-item-btn" onPress={openAdd} style={styles.addBtn}>
            <Ionicons name="add" size={24} color={colors.onBrandPrimary} />
          </Pressable>
        }
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 10 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.row} testID={`admin-item-${item.id}`}>
              <Image source={{ uri: item.image_url }} style={styles.thumb} contentFit="cover" />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.nameRow}>
                  <DietDot dietary={item.dietary} size={12} />
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
                <Text style={styles.meta}>
                  ₹{item.price} · {item.category}
                </Text>
                <View style={styles.tagRow}>
                  {!item.in_stock ? <Badge label="86'd" tone="error" /> : null}
                  {item.available_until !== "23:59" || item.available_from !== "00:00" ? (
                    <Badge label={`${item.available_from}–${item.available_until}`} tone="brand" />
                  ) : null}
                </View>
              </View>
              <View style={styles.actions}>
                <Pressable testID={`edit-${item.id}`} onPress={() => openEdit(item)} style={styles.iconBtn}>
                  <Ionicons name="create-outline" size={20} color={colors.onSurfaceTertiary} />
                </Pressable>
                <Pressable testID={`delete-${item.id}`} onPress={() => del.mutate(item.id)} style={styles.iconBtn}>
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{form.id ? "Edit Item" : "New Item"}</Text>
              <Pressable testID="close-modal" onPress={() => setModalOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.onSurface} />
              </Pressable>
            </View>

            <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ gap: 14, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
              <Field label="Name">
                <TextInput testID="f-name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="e.g. Veg Sandwich" placeholderTextColor={colors.muted} style={styles.input} />
              </Field>
              <Field label="Description">
                <TextInput testID="f-desc" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} placeholder="Short description" placeholderTextColor={colors.muted} style={styles.input} />
              </Field>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Price (₹)">
                    <TextInput testID="f-price" value={form.price} onChangeText={(v) => setForm({ ...form, price: v })} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.muted} style={styles.input} />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Diet">
                    <View style={styles.dietToggle}>
                      {(["VEG", "NON_VEG"] as Dietary[]).map((d) => (
                        <Pressable key={d} testID={`f-diet-${d}`} onPress={() => setForm({ ...form, dietary: d })} style={[styles.dietBtn, form.dietary === d && styles.dietBtnActive]}>
                          <DietDot dietary={d} size={12} />
                          <Text style={[styles.dietText, form.dietary === d && styles.dietTextActive]}>{d === "VEG" ? "Veg" : "Non"}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </Field>
                </View>
              </View>
              <Field label="Category">
                <View style={styles.catRow}>
                  {CATS.map((c) => (
                    <Pressable key={c} testID={`f-cat-${c}`} onPress={() => setForm({ ...form, category: c })} style={[styles.catChip, form.category === c && styles.catChipActive]}>
                      <Text style={[styles.catText, form.category === c && styles.catTextActive]}>{c}</Text>
                    </Pressable>
                  ))}
                </View>
              </Field>
              <Field label="Image URL">
                <TextInput testID="f-image" value={form.image_url} onChangeText={(v) => setForm({ ...form, image_url: v })} placeholder="https://…" placeholderTextColor={colors.muted} autoCapitalize="none" style={styles.input} />
              </Field>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Available From">
                    <TextInput testID="f-from" value={form.available_from} onChangeText={(v) => setForm({ ...form, available_from: v })} placeholder="00:00" placeholderTextColor={colors.muted} style={styles.input} />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Available Until">
                    <TextInput testID="f-until" value={form.available_until} onChangeText={(v) => setForm({ ...form, available_until: v })} placeholder="23:59" placeholderTextColor={colors.muted} style={styles.input} />
                  </Field>
                </View>
              </View>
              <View style={styles.stockRow}>
                <Text style={styles.stockLabel}>In Stock</Text>
                <Switch testID="f-stock" value={form.in_stock} onValueChange={(v) => setForm({ ...form, in_stock: v })} trackColor={{ true: colors.success, false: colors.borderStrong }} thumbColor={colors.surfaceSecondary} />
              </View>
              <Button testID="save-item" label={form.id ? "Save Changes" : "Add Item"} onPress={submit} loading={save.isPending} size="lg" fullWidth />
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceSecondary, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.border },
  thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: colors.surfaceTertiary },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 15, fontWeight: "700", color: colors.onSurface, flex: 1 },
  meta: { fontSize: 13, color: colors.muted },
  tagRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  actions: { flexDirection: "row", gap: 4 },
  iconBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.surfaceTertiary },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(28,25,23,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "92%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: colors.onSurfaceTertiary },
  input: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 15, color: colors.onSurface },
  dietToggle: { flexDirection: "row", gap: 6 },
  dietBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  dietBtnActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  dietText: { fontSize: 13, fontWeight: "700", color: colors.onSurfaceTertiary },
  dietTextActive: { color: colors.onBrandTertiary },
  catRow: { flexDirection: "row", gap: 8 },
  catChip: { flex: 1, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  catChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  catText: { fontSize: 13, fontWeight: "700", color: colors.onSurfaceTertiary },
  catTextActive: { color: colors.onBrandPrimary },
  stockRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, height: 52 },
  stockLabel: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
}));
