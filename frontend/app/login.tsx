import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { homeRouteFor, useAuth } from "@/src/auth/auth-context";
import { AuthHeaderArt } from "@/src/components/auth-header-art";
import { SocialButton } from "@/src/components/social-button";
import { useToast } from "@/src/components/toast";
import { haptic } from "@/src/lib/haptics";
import { useTheme } from "@/src/theme";
import type { Role } from "@/src/types";

const HERO_WELCOME =
  "https://images.unsplash.com/photo-1559560329-e4b17eb5726b?crop=entropy&cs=srgb&fm=jpg&w=1000&q=80";

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

export default function LoginScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { login, register } = useAuth();

  // Screen modes: "welcome" | "login" | "register"
  const [screenMode, setScreenMode] = useState<"welcome" | "login" | "register">("login");

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<Role>("STUDENT");

  // UI toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);

  // Field focus states for glowing aura
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Smooth Transition Animations
  const contentFadeAnim = useRef(new Animated.Value(1)).current;
  const contentSlideAnim = useRef(new Animated.Value(0)).current;

  // Button Spring Animation
  const ctaScaleAnim = useRef(new Animated.Value(1)).current;

  // Checkbox Pulse Animation
  const checkScaleAnim = useRef(new Animated.Value(1)).current;

  function switchMode(newMode: "welcome" | "login" | "register") {
    Animated.sequence([
      Animated.timing(contentFadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(contentSlideAnim, {
        toValue: 12,
        duration: 10,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setScreenMode(newMode);
      setFocusedField(null);
      Animated.parallel([
        Animated.timing(contentFadeAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentSlideAnim, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
  }

  function handleCtaPressIn() {
    Animated.spring(ctaScaleAnim, {
      toValue: 0.96,
      speed: 35,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }

  function handleCtaPressOut() {
    Animated.spring(ctaScaleAnim, {
      toValue: 1,
      speed: 25,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }

  async function handleSubmit() {
    if (!email.trim() || !password) {
      toast.show("Please fill in email and password", "error");
      haptic("error");
      return;
    }

    if (screenMode === "register") {
      if (!name.trim()) {
        toast.show("Please enter your full name", "error");
        haptic("error");
        return;
      }
      if (password !== confirmPassword) {
        toast.show("Passwords do not match", "error");
        haptic("error");
        return;
      }
      if (password.length < 6) {
        toast.show("Password must be at least 6 characters", "error");
        haptic("error");
        return;
      }
    }

    setBusy(true);
    try {
      const user =
        screenMode === "login"
          ? await login(email.trim(), password)
          : await register(email.trim(), password, name.trim(), role);

      haptic("success");
      toast.show(
        screenMode === "login" ? `Welcome back, ${user.name}!` : "Account created successfully!",
        "success"
      );
      router.replace(homeRouteFor(user.role) as any);
    } catch (e: any) {
      haptic("error");
      toast.show(e?.message ?? "Authentication failed", "error");
    } finally {
      setBusy(false);
    }
  }

  function handleDemoFill(d: (typeof DEMOS)[number]) {
    if (screenMode !== "login") {
      switchMode("login");
    }
    setEmail(d.email);
    setPassword("password123");
    haptic("selection");
    toast.show(`Filled demo credentials for ${d.label}`, "info");
  }

  function handleSocialLogin(provider: "apple" | "google") {
    haptic("selection");
    toast.show(`${provider === "apple" ? "Apple" : "Google"} Sign-In is active for iOS builds`, "info");
  }

  function handleForgotPassword() {
    haptic("light");
    toast.show("Password reset instructions sent to your campus email", "info");
  }

  function toggleRememberMe() {
    haptic("selection");
    setRememberMe(!rememberMe);
    Animated.sequence([
      Animated.timing(checkScaleAnim, { toValue: 1.2, duration: 100, useNativeDriver: true }),
      Animated.spring(checkScaleAnim, { toValue: 1, speed: 30, bounciness: 6, useNativeDriver: true }),
    ]).start();
  }

  // --------------------------------------------------------------------------
  // SCREEN 1: WELCOME SCREEN (Reference Screen 1)
  // --------------------------------------------------------------------------
  if (screenMode === "welcome") {
    return (
      <View style={[styles.root, { backgroundColor: colors.deepObsidian }]}>
        <KeyboardAwareScrollView
          bounces={false}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Hero Visual with soft gradient scrim */}
          <View style={styles.welcomeHeroContainer}>
            <Image
              source={{ uri: HERO_WELCOME }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={400}
            />
            <LinearGradient
              colors={["rgba(18,18,18,0.2)", "rgba(18,18,18,0.55)", colors.deepObsidian]}
              style={StyleSheet.absoluteFill}
            />

            {/* Glowing Glass Top Badge */}
            <View style={[styles.welcomeTopBadge, { top: insets.top + 16 }]}>
              <View style={styles.glassBadgePill}>
                <Ionicons name="sparkles" size={13} color={colors.warmGold} />
                <Text style={[styles.glassBadgeText, { color: colors.warmGold }]}>
                  Campus Canteen Redefined
                </Text>
              </View>
            </View>
          </View>

          {/* Frosted Glass Bottom Sheet */}
          <View style={styles.sheetOuterGlow}>
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.glassTopBorder} />

            <View
              style={[
                styles.sheetInnerContainer,
                { paddingBottom: insets.bottom + 36 },
              ]}
            >
              {/* Sheet Drag Handle */}
              <View style={styles.sheetHandleGlow} />

              <View style={styles.welcomeBody}>
                {/* Brand Logo with Glowing Amber Ring */}
                <View style={styles.brandRow}>
                  <View style={styles.logoIconGlowRing}>
                    <Ionicons name="fast-food" size={26} color={colors.saffronCoral} />
                  </View>
                  <Text style={[styles.brandTitle, { color: colors.softChalk }]}>
                    Campus<Text style={{ color: colors.warmGold }}>Crave</Text>
                  </Text>
                </View>

                {/* Headline */}
                <Text style={[styles.welcomeHeadline, { color: colors.softChalk }]}>
                  Let's Get You Set Up for Flavor
                </Text>

                {/* Description */}
                <Text style={[styles.welcomeDescription, { color: colors.mutedSilver }]}>
                  Skip the cafeteria queues. Order ahead from campus canteens and pick up hot, fresh
                  meals on your exact timetable.
                </Text>

                {/* Glowing "Get Started" CTA Button */}
                <Animated.View style={{ width: "100%", transform: [{ scale: ctaScaleAnim }] }}>
                  <Pressable
                    testID="welcome-get-started"
                    onPress={() => {
                      haptic("medium");
                      switchMode("login");
                    }}
                    onPressIn={handleCtaPressIn}
                    onPressOut={handleCtaPressOut}
                    style={styles.ctaButtonGradientWrap}
                  >
                    <LinearGradient
                      colors={["#FF6B4A", "#FA5838", "#E5A93B"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.ctaLinearGradient}
                    >
                      <View style={styles.ctaGlassShine} />
                      <Text style={[styles.primaryCtaText, { color: "#FFFFFF" }]}>Get Started</Text>
                      <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                    </LinearGradient>
                  </Pressable>
                </Animated.View>

                {/* Switch to Sign Up */}
                <Pressable
                  onPress={() => {
                    haptic("light");
                    switchMode("register");
                  }}
                  style={styles.welcomeSubLink}
                >
                  <Text style={[styles.subLinkText, { color: colors.mutedSilver }]}>
                    New to campus?{" "}
                    <Text style={{ color: colors.warmGold, fontWeight: "700" }}>Create an account</Text>
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAwareScrollView>
      </View>
    );
  }

  // --------------------------------------------------------------------------
  // SCREENS 2 & 3: LOGIN & SIGN UP (Reference Screens 2 & 3)
  // --------------------------------------------------------------------------
  const isLogin = screenMode === "login";

  return (
    <View style={[styles.root, { backgroundColor: colors.deepObsidian }]}>
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 28 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Dynamic Header Section with Animated Glowing Orbs & 3D Phone Mockup */}
        <View style={styles.headerSection}>
          <AuthHeaderArt mode={screenMode} />

          {/* Top Bar with Glass Back Button and Quick Role Chips */}
          <View style={[styles.headerTopBar, { top: insets.top + 8 }]}>
            <Pressable
              onPress={() => {
                haptic("light");
                switchMode("welcome");
              }}
              style={styles.glassIconButton}
              accessibilityLabel="Back to welcome"
            >
              <Ionicons name="chevron-back" size={22} color={colors.softChalk} />
            </Pressable>

            {/* Glowing Demo Pills */}
            <View style={styles.demoHeaderPills}>
              {DEMOS.map((d) => (
                <Pressable
                  key={d.role}
                  testID={`quick-demo-${d.role}`}
                  onPress={() => handleDemoFill(d)}
                  style={styles.glassHeaderChip}
                >
                  <Text style={[styles.demoHeaderChipText, { color: colors.warmGold }]}>
                    {d.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Header Headline (Matches reference screen headers) */}
          <View style={styles.headerHeadlineArea}>
            <Text style={[styles.headerHeadlineText, { color: colors.softChalk }]}>
              {isLogin
                ? "Log in to stay on top of your cravings & meals."
                : "Create Your Account and Satisfy Your Campus Cravings"}
            </Text>
          </View>
        </View>

        {/* Frosted Glass Elevated Bottom Sheet (Charcoal Lift with Glassmorphism) */}
        <View style={styles.sheetOuterGlow}>
          <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
          {/* Glass Top Edge Rim */}
          <View style={styles.glassTopBorder} />

          <Animated.View
            style={[
              styles.sheetInnerContainer,
              {
                opacity: contentFadeAnim,
                transform: [{ translateY: contentSlideAnim }],
              },
            ]}
          >
            {/* iOS Sheet Handle with subtle glow */}
            <View style={styles.sheetHandleGlow} />

            <View style={styles.formContent}>
              {/* Sheet Title: "Login" or "Sign up" */}
              <Text style={[styles.sheetTitle, { color: colors.softChalk }]}>
                {isLogin ? "Login" : "Sign up"}
              </Text>

              {/* Subtitle with Switch Mode Link */}
              <View style={styles.subtitleRow}>
                <Text style={[styles.subtitleText, { color: colors.mutedSilver }]}>
                  {isLogin ? "Don't Have An Account? " : "Already Have An Account? "}
                </Text>
                <Pressable
                  testID="auth-mode-switch"
                  onPress={() => {
                    haptic("selection");
                    switchMode(isLogin ? "register" : "login");
                  }}
                >
                  <Text style={[styles.subtitleLink, { color: colors.warmGold }]}>
                    {isLogin ? "Sign Up" : "Sign In"}
                  </Text>
                </Pressable>
              </View>

              {/* ----------------- FORM FIELDS WITH LUMINESCENT GLOW ----------------- */}
              <View style={styles.fieldsContainer}>
                {/* Full Name Field (Sign Up Only) */}
                {!isLogin ? (
                  <View style={styles.inputWrapper}>
                    <View
                      style={[
                        styles.glassInputField,
                        focusedField === "name" && styles.glassInputFieldFocused,
                      ]}
                    >
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color={focusedField === "name" ? colors.warmGold : colors.mutedSilver}
                        style={styles.fieldLeftIcon}
                      />
                      <TextInput
                        testID="name-input"
                        value={name}
                        onChangeText={setName}
                        placeholder="Enter your full name"
                        placeholderTextColor={colors.mutedSilver}
                        onFocus={() => setFocusedField("name")}
                        onBlur={() => setFocusedField(null)}
                        style={[styles.textInput, { color: colors.softChalk }]}
                      />
                    </View>
                  </View>
                ) : null}

                {/* Email Address Field */}
                <View style={styles.inputWrapper}>
                  <View
                    style={[
                      styles.glassInputField,
                      focusedField === "email" && styles.glassInputFieldFocused,
                    ]}
                  >
                    <Ionicons
                      name="mail-outline"
                      size={20}
                      color={focusedField === "email" ? colors.warmGold : colors.mutedSilver}
                      style={styles.fieldLeftIcon}
                    />
                    <TextInput
                      testID="email-input"
                      value={email}
                      onChangeText={setEmail}
                      placeholder="Enter your email address"
                      placeholderTextColor={colors.mutedSilver}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      onFocus={() => setFocusedField("email")}
                      onBlur={() => setFocusedField(null)}
                      style={[styles.textInput, { color: colors.softChalk }]}
                    />
                  </View>
                </View>

                {/* Password Field */}
                <View style={styles.inputWrapper}>
                  <View
                    style={[
                      styles.glassInputField,
                      focusedField === "password" && styles.glassInputFieldFocused,
                    ]}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={focusedField === "password" ? colors.warmGold : colors.mutedSilver}
                      style={styles.fieldLeftIcon}
                    />
                    <TextInput
                      testID="password-input"
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Password"
                      placeholderTextColor={colors.mutedSilver}
                      secureTextEntry={!showPassword}
                      onFocus={() => setFocusedField("password")}
                      onBlur={() => setFocusedField(null)}
                      style={[styles.textInput, { color: colors.softChalk }]}
                    />
                    <Pressable
                      onPress={() => {
                        haptic("light");
                        setShowPassword(!showPassword);
                      }}
                      style={styles.fieldRightIcon}
                      hitSlop={8}
                    >
                      <Ionicons
                        name={showPassword ? "eye-outline" : "eye-off-outline"}
                        size={20}
                        color={colors.mutedSilver}
                      />
                    </Pressable>
                  </View>
                </View>

                {/* Confirm Password Field (Sign Up Only) */}
                {!isLogin ? (
                  <View style={styles.inputWrapper}>
                    <View
                      style={[
                        styles.glassInputField,
                        focusedField === "confirmPassword" && styles.glassInputFieldFocused,
                      ]}
                    >
                      <Ionicons
                        name="shield-checkmark-outline"
                        size={20}
                        color={
                          focusedField === "confirmPassword"
                            ? colors.warmGold
                            : colors.mutedSilver
                        }
                        style={styles.fieldLeftIcon}
                      />
                      <TextInput
                        testID="confirm-password-input"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Confirm password"
                        placeholderTextColor={colors.mutedSilver}
                        secureTextEntry={!showConfirmPassword}
                        onFocus={() => setFocusedField("confirmPassword")}
                        onBlur={() => setFocusedField(null)}
                        style={[styles.textInput, { color: colors.softChalk }]}
                      />
                      <Pressable
                        onPress={() => {
                          haptic("light");
                          setShowConfirmPassword(!showConfirmPassword);
                        }}
                        style={styles.fieldRightIcon}
                        hitSlop={8}
                      >
                        <Ionicons
                          name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                          size={20}
                          color={colors.mutedSilver}
                        />
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {/* Campus Role Selection with Glowing Active Pill (Sign Up Only) */}
                {!isLogin ? (
                  <View style={styles.roleSelectionWrapper}>
                    <Text style={[styles.roleSectionLabel, { color: colors.mutedSilver }]}>
                      Select Your Campus Role
                    </Text>
                    <View style={styles.roleChipsRow}>
                      {ROLES.map((r) => {
                        const isSelected = role === r.value;
                        return (
                          <Pressable
                            key={r.value}
                            testID={`role-${r.value}`}
                            onPress={() => {
                              haptic("selection");
                              setRole(r.value);
                            }}
                            style={[
                              styles.glassRoleChip,
                              isSelected && styles.glassRoleChipActive,
                            ]}
                          >
                            <Ionicons
                              name={r.icon as any}
                              size={16}
                              color={isSelected ? colors.deepObsidian : colors.mutedSilver}
                            />
                            <Text
                              style={[
                                styles.roleChipText,
                                {
                                  color: isSelected
                                    ? colors.deepObsidian
                                    : colors.softChalk,
                                },
                              ]}
                            >
                              {r.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
              </View>

              {/* Options Row: Animated Remember Me Checkbox & Forgot Password */}
              <View style={styles.optionsRow}>
                <Pressable onPress={toggleRememberMe} style={styles.rememberMeRow}>
                  <Animated.View
                    style={[
                      styles.glassCheckbox,
                      {
                        backgroundColor: rememberMe
                          ? colors.saffronCoral
                          : "rgba(44, 44, 48, 0.65)",
                        borderColor: rememberMe
                          ? colors.saffronCoral
                          : "rgba(255, 255, 255, 0.15)",
                        transform: [{ scale: checkScaleAnim }],
                      },
                    ]}
                  >
                    {rememberMe ? (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    ) : null}
                  </Animated.View>
                  <Text style={[styles.rememberMeText, { color: colors.mutedSilver }]}>
                    Remember Me
                  </Text>
                </Pressable>

                <Pressable onPress={handleForgotPassword} hitSlop={8}>
                  <Text style={[styles.forgotPasswordText, { color: colors.saffronCoral }]}>
                    Forgot Password?
                  </Text>
                </Pressable>
              </View>

              {/* Glowing Primary Action CTA Button: "Login" or "Sign up" */}
              <Animated.View style={{ width: "100%", transform: [{ scale: ctaScaleAnim }] }}>
                <Pressable
                  testID="auth-submit"
                  onPress={handleSubmit}
                  onPressIn={handleCtaPressIn}
                  onPressOut={handleCtaPressOut}
                  disabled={busy}
                  style={[styles.ctaButtonGradientWrap, busy && { opacity: 0.75 }]}
                >
                  <LinearGradient
                    colors={["#FF6B4A", "#FA5838", "#E5A93B"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.ctaLinearGradient}
                  >
                    <View style={styles.ctaGlassShine} />
                    {busy ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={[styles.primaryCtaText, { color: "#FFFFFF" }]}>
                        {isLogin ? "Login" : "Sign up"}
                      </Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </Animated.View>

              {/* "Or Continue With" Divider with Subtle Glowing Rule */}
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: "rgba(255,255,255,0.08)" }]} />
                <Text style={[styles.dividerText, { color: colors.mutedSilver }]}>
                  Or Continue With
                </Text>
                <View style={[styles.dividerLine, { backgroundColor: "rgba(255,255,255,0.08)" }]} />
              </View>

              {/* Social Logins: Glassmorphic Apple & Google Buttons */}
              <View style={styles.socialButtonsRow}>
                <SocialButton
                  provider="apple"
                  onPress={() => handleSocialLogin("apple")}
                  disabled={busy}
                />
                <SocialButton
                  provider="google"
                  onPress={() => handleSocialLogin("google")}
                  disabled={busy}
                />
              </View>

              {/* Quick Demo Access Frosted Glass Box */}
              <View style={styles.demoGlassBox}>
                <View style={styles.demoBoxHeader}>
                  <Ionicons name="flash" size={14} color={colors.warmGold} />
                  <Text style={[styles.demoBoxTitle, { color: colors.warmGold }]}>
                    Instant Demo Access
                  </Text>
                </View>
                <View style={styles.demoButtonsRow}>
                  {DEMOS.map((d) => (
                    <Pressable
                      key={d.role}
                      onPress={() => handleDemoFill(d)}
                      style={styles.demoGlassRoleBtn}
                    >
                      <Text style={[styles.demoRoleBtnText, { color: colors.softChalk }]}>
                        {d.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </Animated.View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  // --------------------------------------------------------------------------
  // Screen 1: Welcome Screen Styles
  // --------------------------------------------------------------------------
  welcomeHeroContainer: {
    height: 390,
    width: "100%",
    position: "relative",
    justifyContent: "flex-start",
  },
  welcomeTopBadge: {
    position: "absolute",
    left: 20,
    zIndex: 10,
  },
  glassBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(22, 22, 26, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.4)",
    shadowColor: "#E5A93B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  glassBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  welcomeBody: {
    paddingTop: 12,
    alignItems: "center",
    gap: 16,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  logoIconGlowRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#FF6B4A",
    backgroundColor: "rgba(255, 107, 74, 0.16)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
  },
  brandTitle: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  welcomeHeadline: {
    fontSize: 25,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.4,
    lineHeight: 32,
    paddingHorizontal: 12,
  },
  welcomeDescription: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    paddingHorizontal: 16,
    opacity: 0.9,
  },
  welcomeSubLink: {
    marginTop: 4,
    paddingVertical: 8,
  },
  subLinkText: {
    fontSize: 14,
  },

  // --------------------------------------------------------------------------
  // Screens 2 & 3: Header Section Styles
  // --------------------------------------------------------------------------
  headerSection: {
    minHeight: 230,
    position: "relative",
    justifyContent: "flex-end",
  },
  headerTopBar: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  glassIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(28, 28, 34, 0.7)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.16)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  demoHeaderPills: {
    flexDirection: "row",
    gap: 6,
  },
  glassHeaderChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "rgba(36, 36, 42, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.35)",
    shadowColor: "#E5A93B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  demoHeaderChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  headerHeadlineArea: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 68,
    maxWidth: 330,
  },
  headerHeadlineText: {
    fontSize: 27,
    fontWeight: "800",
    lineHeight: 33,
    letterSpacing: -0.5,
  },

  // --------------------------------------------------------------------------
  // Glassmorphic Bottom Sheet Container
  // --------------------------------------------------------------------------
  sheetOuterGlow: {
    flex: 1,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    overflow: "hidden",
    backgroundColor: "rgba(26, 26, 30, 0.82)",
    borderTopWidth: 1.5,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    elevation: 14,
  },
  glassTopBorder: {
    position: "absolute",
    top: 0,
    left: 40,
    right: 40,
    height: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  sheetInnerContainer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },
  sheetHandleGlow: {
    width: 44,
    height: 4.5,
    borderRadius: 3,
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    marginBottom: 20,
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  formContent: {
    gap: 16,
  },
  sheetTitle: {
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: -0.4,
    textAlign: "center",
  },
  subtitleRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  subtitleText: {
    fontSize: 14,
  },
  subtitleLink: {
    fontSize: 14,
    fontWeight: "700",
  },

  // --------------------------------------------------------------------------
  // Glassmorphic Form Fields & Glowing Focus
  // --------------------------------------------------------------------------
  fieldsContainer: {
    gap: 14,
    marginTop: 4,
  },
  inputWrapper: {
    width: "100%",
  },
  glassInputField: {
    flexDirection: "row",
    alignItems: "center",
    height: 54,
    borderRadius: 18,
    backgroundColor: "rgba(40, 40, 46, 0.65)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 16,
  },
  glassInputFieldFocused: {
    borderColor: "#E5A93B",
    backgroundColor: "rgba(48, 48, 56, 0.8)",
    shadowColor: "#E5A93B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 14,
    elevation: 6,
  },
  fieldLeftIcon: {
    marginRight: 12,
  },
  fieldRightIcon: {
    padding: 6,
  },
  textInput: {
    flex: 1,
    height: "100%",
    fontSize: 15,
    fontWeight: "500",
  },

  // Role Selector
  roleSelectionWrapper: {
    marginTop: 4,
    gap: 8,
  },
  roleSectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  roleChipsRow: {
    flexDirection: "row",
    gap: 8,
  },
  glassRoleChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(40, 40, 46, 0.65)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  glassRoleChipActive: {
    backgroundColor: "#E5A93B",
    borderColor: "#E5A93B",
    shadowColor: "#E5A93B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
  },
  roleChipText: {
    fontSize: 13,
    fontWeight: "700",
  },

  // Options Row
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 2,
    marginTop: 2,
  },
  rememberMeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  glassCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.2,
    alignItems: "center",
    justifyContent: "center",
  },
  rememberMeText: {
    fontSize: 13,
    fontWeight: "500",
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // --------------------------------------------------------------------------
  // Glowing Primary Action CTA Button
  // --------------------------------------------------------------------------
  ctaButtonGradientWrap: {
    height: 54,
    borderRadius: 27,
    marginTop: 6,
    overflow: "hidden",
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 10,
  },
  ctaLinearGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    position: "relative",
  },
  ctaGlassShine: {
    position: "absolute",
    top: 0,
    left: 20,
    right: 20,
    height: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
  },
  primaryCtaText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },

  // Divider
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: "500",
  },

  // Social Buttons Row
  socialButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },

  // Demo Box with Frosted Glass
  demoGlassBox: {
    marginTop: 8,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(34, 34, 40, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.28)",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  demoBoxHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  demoBoxTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  demoButtonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  demoGlassRoleBtn: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(22, 22, 26, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  demoRoleBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
