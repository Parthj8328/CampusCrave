import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { useAuth } from "@/src/auth/auth-context";
import { ScreenHeader } from "@/src/components/header";
import { Button } from "@/src/components/ui";
import { haptic } from "@/src/lib/haptics";
import { makeStyles, useTheme } from "@/src/theme";

const ROLE_LABEL: Record<string, string> = {
  STUDENT: "Student",
  KITCHEN_STAFF: "Kitchen Staff",
  ADMIN: "Administrator",
};

export function ProfileScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();

  async function onLogout() {
    haptic("medium");
    await logout();
    router.replace("/login");
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title="Profile" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 16 }}>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name ?? "?").charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.rolePill}>
            <Ionicons name="shield-checkmark" size={14} color={colors.onBrandTertiary} />
            <Text style={styles.roleText}>{ROLE_LABEL[user?.role ?? ""] ?? user?.role}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Row icon="fast-food-outline" label="App" value="CampusCrave" />
          <View style={styles.divider} />
          <Row icon="wallet-outline" label="Payments" value="Sandbox mode" />
          <View style={styles.divider} />
          <Row icon="pulse-outline" label="Live updates" value="Enabled" />
        </View>

        <Button testID="logout-btn" label="Log Out" onPress={onLogout} variant="danger" icon="log-out-outline" fullWidth />
      </ScrollView>
    </View>
  );
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Ionicons name={icon as any} size={20} color={colors.onSurfaceTertiary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  avatarText: { fontSize: 32, fontWeight: "800", color: colors.onBrandPrimary },
  name: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  email: { fontSize: 14, color: colors.muted },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 6,
  },
  roleText: { fontSize: 13, fontWeight: "700", color: colors.onBrandTertiary },
  infoCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16 },
  rowLabel: { fontSize: 15, color: colors.onSurface, flex: 1 },
  rowValue: { fontSize: 14, color: colors.muted, fontWeight: "600" },
  divider: { height: 1, backgroundColor: colors.divider },
}));
