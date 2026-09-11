import { ActivityIndicator, SectionList, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/src/api/client";
import { ScreenHeader } from "@/src/components/header";
import { Badge, DietDot } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { haptic } from "@/src/lib/haptics";
import { makeStyles, useTheme } from "@/src/theme";
import type { MenuItem } from "@/src/types";

const ORDER = ["Meals", "Snacks", "Beverages"];

export default function KitchenStock() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();

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
      toast.show(`${item.name} ${item.in_stock ? "back in stock" : "marked 86'd"}`, item.in_stock ? "success" : "info");
    },
  });

  const sections = ORDER.map((cat) => ({
    title: cat,
    data: (data ?? []).filter((i) => i.category === cat),
  })).filter((s) => s.data.length > 0);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Stock Control" subtitle="Toggle items in / out of stock" />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(i) => i.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
          renderItem={({ item }) => (
            <View style={styles.row} testID={`stock-row-${item.id}`}>
              <DietDot dietary={item.dietary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.price}>₹{item.price}</Text>
              </View>
              {item.in_stock ? (
                <Badge label="In Stock" tone="success" />
              ) : (
                <Badge label="86'd" tone="error" />
              )}
              <Switch
                testID={`stock-switch-${item.id}`}
                value={item.in_stock}
                onValueChange={(v) => {
                  haptic("rigid");
                  toggle.mutate({ id: item.id, in_stock: v });
                }}
                trackColor={{ true: colors.success, false: colors.borderStrong }}
                thumbColor={colors.surfaceSecondary}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  price: { fontSize: 13, color: colors.muted, marginTop: 2 },
}));
