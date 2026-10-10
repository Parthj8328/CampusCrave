import { useRef } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { useAuth } from "@/src/auth/auth-context";
import { ScreenHeader } from "@/src/components/header";
import { haptic } from "@/src/lib/haptics";
import { useTheme } from "@/src/theme";

const ROLE_LABEL: Record<string, string> = {
  STUDENT: "Student",
  KITCHEN_STAFF: "Kitchen Staff",
  ADMIN: "Administrator",
};

export function ProfileScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();

  const logoutBtnScale = useRef(new Animated.Value(1)).current;

  function handleLogoutPressIn() {
    Animated.spring(logoutBtnScale, {
      toValue: 0.96,
      speed: 40,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }

  function handleLogoutPressOut() {
    Animated.spring(logoutBtnScale, {
      toValue: 1,
      speed: 25,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }

  async function onLogout() {
    haptic("medium");
    await logout();
    router.replace("/login");
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.deepObsidian }]}>
      <ScreenHeader title="Profile" />
      <ScrollView
        contentContainerStyle={{
          padding: 18,
          paddingBottom: insets.bottom + 110,
          gap: 18,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* -------------------------------------------------------- */}
        {/* HERO USER PROFILE CARD */}
        {/* -------------------------------------------------------- */}
        <View style={styles.glassProfileCard}>
          {/* Specular Top Shine */}
          <View style={styles.cardTopShine} />

          {/* Glowing Avatar */}
          <View style={styles.avatarAuraWrap}>
            <LinearGradient
              colors={["#FF6B4A", "#FA5838", "#E5A93B"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarGradient}
            >
              <View style={styles.avatarInnerShine} />
              <Text style={styles.avatarText}>
                {(user?.name ?? "?").charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          </View>

          {/* User Name & Email */}
          <Text style={[styles.userName, { color: colors.softChalk }]}>
            {user?.name}
          </Text>
          <Text style={[styles.userEmail, { color: colors.mutedSilver }]}>
            {user?.email}
          </Text>

          {/* Role Glass Pill */}
          <View style={styles.roleGlassPill}>
            <Ionicons name="shield-checkmark" size={14} color={colors.warmGold} />
            <Text style={[styles.rolePillText, { color: colors.warmGold }]}>
              {ROLE_LABEL[user?.role ?? ""] ?? user?.role}
            </Text>
          </View>
        </View>

        {/* -------------------------------------------------------- */}
        {/* APP INFO & STATUS CARD */}
        {/* -------------------------------------------------------- */}
        <View style={styles.glassInfoCard}>
          <View style={styles.cardTopShine} />

          <Row
            icon="fast-food-outline"
            label="App"
            value="CampusCrave"
            accentColor={colors.saffronCoral}
          />
          <View style={styles.divider} />
          <Row
            icon="wallet-outline"
            label="Payments"
            value="Sandbox mode"
            tag="Safe"
            tagColor={colors.sageMint}
          />
          <View style={styles.divider} />
          <Row
            icon="pulse-outline"
            label="Live updates"
            value="WebSocket active"
            isLive
          />
          <View style={styles.divider} />
          <Row
            icon="color-palette-outline"
            label="Theme"
            value="iOS Dark Glass"
            accentColor={colors.warmGold}
          />
        </View>

        {/* -------------------------------------------------------- */}
        {/* LOG OUT BUTTON */}
        {/* -------------------------------------------------------- */}
        <Animated.View style={{ transform: [{ scale: logoutBtnScale }] }}>
          <Pressable
            testID="logout-btn"
            onPress={onLogout}
            onPressIn={handleLogoutPressIn}
            onPressOut={handleLogoutPressOut}
            style={styles.logoutBtn}
          >
            <Ionicons name="log-out-outline" size={18} color="#FF453A" />
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  accentColor,
  tag,
  tagColor,
  isLive,
}: {
  icon: string;
  label: string;
  value: string;
  accentColor?: string;
  tag?: string;
  tagColor?: string;
  isLive?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.rowIconCircle}>
        <Ionicons
          name={icon as any}
          size={18}
          color={accentColor ?? colors.mutedSilver}
        />
      </View>
      <Text style={[styles.rowLabel, { color: colors.softChalk }]}>{label}</Text>
      <View style={styles.rowValueContainer}>
        {isLive ? <View style={styles.rowLiveDot} /> : null}
        {tag ? (
          <View
            style={[
              styles.tagPill,
              {
                backgroundColor: "rgba(48, 209, 88, 0.15)",
                borderColor: "rgba(48, 209, 88, 0.35)",
              },
            ]}
          >
            <Text style={[styles.tagText, { color: tagColor ?? colors.sageMint }]}>
              {tag}
            </Text>
          </View>
        ) : null}
        <Text style={[styles.rowValue, { color: colors.mutedSilver }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  // --------------------------------------------------------------------------
  // Profile Card Styles
  // --------------------------------------------------------------------------
  glassProfileCard: {
    backgroundColor: "rgba(28, 28, 34, 0.78)",
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 8,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.14)",
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  cardTopShine: {
    position: "absolute",
    top: 0,
    left: 24,
    right: 24,
    height: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  avatarAuraWrap: {
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.65,
    shadowRadius: 18,
    elevation: 10,
    marginBottom: 6,
  },
  avatarGradient: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarInnerShine: {
    position: "absolute",
    top: 2,
    left: 12,
    right: 12,
    height: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
  },
  avatarText: {
    fontSize: 34,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  userName: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  userEmail: {
    fontSize: 14,
    fontWeight: "500",
  },
  roleGlassPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(229, 169, 59, 0.15)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.35)",
    marginTop: 6,
    shadowColor: "#E5A93B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  // --------------------------------------------------------------------------
  // Info Card Styles
  // --------------------------------------------------------------------------
  glassInfoCard: {
    backgroundColor: "rgba(28, 28, 34, 0.78)",
    borderRadius: 22,
    paddingHorizontal: 16,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.12)",
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
  },
  rowIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(44, 44, 52, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  rowValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rowLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#30D158",
    shadowColor: "#30D158",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  tagPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "700",
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },

  // --------------------------------------------------------------------------
  // Log Out Button
  // --------------------------------------------------------------------------
  logoutBtn: {
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255, 69, 58, 0.12)",
    borderWidth: 1.5,
    borderColor: "#FF453A",
    shadowColor: "#FF453A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  logoutText: {
    color: "#FF453A",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
});
