import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { homeRouteFor, useAuth } from "@/src/auth/auth-context";
import { Button } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { haptic } from "@/src/lib/haptics";
import { makeStyles, useTheme } from "@/src/theme";
import type { Role } from "@/src/types";

const HERO = "https://images.unsplash.com/photo-1559560329-e4b17eb5726b?crop=entropy&cs=srgb&fm=jpg&w=1000&q=80";

const ROLES: { value: Role; label: string; icon: string }[] = [
  { value: "STUDENT", label: "Student", icon: "school-outline" },
  { value: "KITCHEN_STAFF", label: "Kitchen", icon: "restaurant-outline" },
  { value: "ADMIN", label: "Admin", icon: "briefcase-outline" },
];

const DEMOS: { role: Role; email: string; label: string }[] = [
  { role: "STUDENT", email: "student@campus.edu", label: "Student" },
  { role: "KITCHEN_STAFF", email: "kitchen@campus.edu", label: "Kitchen" },
  { role: "ADMIN", email: "admin@campus.edu", label: "Admin" },
];

export default function Login() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("STUDENT");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      toast.show("Enter email and password", "error");
      return;
    }
    if (mode === "register" && !name.trim()) {
      toast.show("Enter your name", "error");
      return;
    }
    setBusy(true);
    try {
      const user =
        mode === "login"
          ? await login(email.trim(), password)
          : await register(email.trim(), password, name.trim(), role);
      haptic("success");
      router.replace(homeRouteFor(user.role) as any);
    } catch (e: any) {
      haptic("error");
      toast.show(e?.message ?? "Something went wrong", "error");
    } finally {
      setBusy(false);
    }
  }

  function fillDemo(d: { email: string }) {
    setMode("login");
    setEmail(d.email);
    setPassword("password123");
    haptic("selection");
  }

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Image source={{ uri: HERO }} style={styles.heroImg} contentFit="cover" />
          <LinearGradient
            colors={["rgba(28,25,23,0.15)", "rgba(28,25,23,0.55)", "rgba(28,25,23,0.92)"]}
            style={styles.scrim}
          />
          <View style={[styles.heroContent, { paddingTop: insets.top + 24 }]}>
            <View style={styles.logoRow}>
              <Ionicons name="fast-food" size={26} color={colors.onBrandPrimary} />
              <Text style={styles.logo}>CampusCrave</Text>
            </View>
            <Text style={styles.tagline}>Skip the queue. Pre-order your campus meals.</Text>
          </View>
        </View>

        <View style={styles.form}>
          <View style={styles.segment}>
            {(["login", "register"] as const).map((m) => (
              <Pressable
                key={m}
                testID={`auth-tab-${m}`}
                onPress={() => setMode(m)}
                style={[styles.segItem, mode === m && styles.segItemActive]}
              >
                <Text style={[styles.segText, mode === m && styles.segTextActive]}>
                  {m === "login" ? "Sign In" : "Sign Up"}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === "register" ? (
            <View style={styles.field}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                testID="name-input"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Aarav Sharma"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="email-input"
              value={email}
              onChangeText={setEmail}
              placeholder="you@campus.edu"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              testID="password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
              secureTextEntry
              style={styles.input}
            />
          </View>

          {mode === "register" ? (
            <View style={styles.field}>
              <Text style={styles.label}>I am a…</Text>
              <View style={styles.roleRow}>
                {ROLES.map((r) => (
                  <Pressable
                    key={r.value}
                    testID={`role-${r.value}`}
                    onPress={() => {
                      setRole(r.value);
                      haptic("selection");
                    }}
                    style={[styles.roleChip, role === r.value && styles.roleChipActive]}
                  >
                    <Ionicons
                      name={r.icon as any}
                      size={18}
                      color={role === r.value ? colors.onBrandPrimary : colors.onSurfaceTertiary}
                    />
                    <Text style={[styles.roleText, role === r.value && styles.roleTextActive]}>{r.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <Button
            testID="auth-submit"
            label={mode === "login" ? "Sign In" : "Create Account"}
            onPress={submit}
            loading={busy}
            size="lg"
            fullWidth
            style={{ marginTop: 8 }}
          />

          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>Quick demo login</Text>
            <View style={styles.demoRow}>
              {DEMOS.map((d) => (
                <Pressable
                  key={d.role}
                  testID={`demo-${d.role}`}
                  onPress={() => fillDemo(d)}
                  style={styles.demoChip}
                >
                  <Text style={styles.demoChipText}>{d.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.demoHint}>Tap a role, then Sign In · password: password123</Text>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 260, backgroundColor: colors.surfaceInverse },
  heroImg: { ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as any) },
  scrim: { ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as any) },
  heroContent: { flex: 1, justifyContent: "flex-end", padding: 24 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logo: { color: colors.onBrandPrimary, fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  tagline: { color: colors.onBrandPrimary, fontSize: 15, marginTop: 6, opacity: 0.92 },
  form: { padding: 20, gap: 16 },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 12,
    padding: 4,
  },
  segItem: { flex: 1, height: 40, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  segItemActive: { backgroundColor: colors.surfaceSecondary },
  segText: { fontSize: 14, fontWeight: "700", color: colors.muted },
  segTextActive: { color: colors.onSurface },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "700", color: colors.onSurfaceTertiary },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 15,
    color: colors.onSurface,
  },
  roleRow: { flexDirection: "row", gap: 8 },
  roleChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  roleChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  roleText: { fontSize: 13, fontWeight: "700", color: colors.onSurfaceTertiary },
  roleTextActive: { color: colors.onBrandPrimary },
  demoBox: {
    marginTop: 4,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.brandTertiary,
    gap: 10,
  },
  demoTitle: { fontSize: 13, fontWeight: "800", color: colors.onBrandTertiary },
  demoRow: { flexDirection: "row", gap: 8 },
  demoChip: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  demoChipText: { fontSize: 13, fontWeight: "700", color: colors.onSurface },
  demoHint: { fontSize: 11, color: colors.onBrandTertiary, opacity: 0.8 },
}));
