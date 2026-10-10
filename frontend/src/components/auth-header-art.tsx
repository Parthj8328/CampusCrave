import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path, Defs, RadialGradient, Stop } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useTheme } from "@/src/theme";

type AuthHeaderArtProps = {
  mode: "welcome" | "login" | "register";
};

export function AuthHeaderArt({ mode }: AuthHeaderArtProps) {
  const { colors } = useTheme();

  // Floating animation for 3D preview phone
  const floatAnim = useRef(new Animated.Value(0)).current;
  // Breathing animation for glow orbs
  const glowPulseAnim = useRef(new Animated.Value(1)).current;
  // Sparkle twinkling animation
  const sparkleAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    // 1. Smooth vertical floating bobbing
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 6,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // 2. Gentle pulsing breathing glow
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulseAnim, {
          toValue: 1.15,
          duration: 3400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulseAnim, {
          toValue: 0.92,
          duration: 3400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    // 3. Ambient sparkle twinkle
    const sparkleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleAnim, {
          toValue: 0.95,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sparkleAnim, {
          toValue: 0.35,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    pulseLoop.start();
    sparkleLoop.start();

    return () => {
      floatLoop.stop();
      pulseLoop.stop();
      sparkleLoop.stop();
    };
  }, [floatAnim, glowPulseAnim, sparkleAnim]);

  return (
    <View style={styles.container}>
      {/* Deep Obsidian gradient foundation */}
      <LinearGradient
        colors={["#1A1715", "#121212", "#0E0E10"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Animated Glowing Atmospheric Orbs */}
      <Animated.View
        style={[
          styles.glowOrbContainer,
          {
            transform: [{ scale: glowPulseAnim }],
            opacity: 0.85,
          },
        ]}
      >
        <Svg height="100%" width="100%" viewBox="0 0 390 260" style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="coralAura" cx="80%" cy="30%" rx="65%" ry="65%" fx="80%" fy="30%">
              <Stop offset="0%" stopColor="#FF6B4A" stopOpacity="0.45" />
              <Stop offset="50%" stopColor="#FF6B4A" stopOpacity="0.18" />
              <Stop offset="100%" stopColor="#121212" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="goldAura" cx="20%" cy="80%" rx="60%" ry="60%" fx="20%" fy="80%">
              <Stop offset="0%" stopColor="#E5A93B" stopOpacity="0.38" />
              <Stop offset="55%" stopColor="#E5A93B" stopOpacity="0.12" />
              <Stop offset="100%" stopColor="#121212" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="310" cy="80" r="140" fill="url(#coralAura)" />
          <Circle cx="80" cy="180" r="130" fill="url(#goldAura)" />
        </Svg>
      </Animated.View>

      {/* Glowing Neon Arc Lines & Sparkles */}
      <Svg height="100%" width="100%" style={StyleSheet.absoluteFill} viewBox="0 0 390 260">
        <Path
          d="M -20 110 C 60 70, 140 170, 240 90 S 360 150, 420 80"
          stroke={colors.warmGold}
          strokeWidth="1.5"
          strokeDasharray="5 7"
          strokeOpacity="0.45"
          fill="none"
        />
        <Path
          d="M 10 190 C 110 130, 190 210, 300 150 S 370 190, 420 160"
          stroke={colors.saffronCoral}
          strokeWidth="1.2"
          strokeDasharray="6 8"
          strokeOpacity="0.38"
          fill="none"
        />
      </Svg>

      {/* Twinkling Micro-Sparkles */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: sparkleAnim }]} pointerEvents="none">
        <View style={[styles.sparkleDot, { top: 48, left: 75, backgroundColor: colors.warmGold }]} />
        <View style={[styles.sparkleDot, { top: 92, left: 160, backgroundColor: colors.saffronCoral }]} />
        <View style={[styles.sparkleDot, { top: 120, right: 60, backgroundColor: colors.warmGold }]} />
        <View style={[styles.sparkleDot, { top: 40, right: 130, backgroundColor: "#FFFFFF" }]} />
      </Animated.View>

      {/* Floating 3D Phone Preview Mockup with Glowing Rim & Frosted Glass Content */}
      <Animated.View
        style={[
          styles.phoneMockupWrapper,
          {
            transform: [{ translateY: floatAnim }, { rotate: "11deg" }],
          },
        ]}
      >
        <View style={styles.mockupPhoneGlass}>
          {/* Glass Rim Highlight */}
          <View style={styles.mockupGlassShine} />

          {/* Dynamic Island */}
          <View style={styles.mockupDynamicIsland} />

          {/* Mini Live Food Status Card (Frosted Glass) */}
          <View style={styles.mockupContent}>
            <View style={styles.mockupGlassCard}>
              <View style={styles.mockupCardTop}>
                <View style={styles.liveOrderIndicator}>
                  <View style={styles.liveOrderDot} />
                  <Ionicons name="flame" size={11} color={colors.saffronCoral} />
                </View>
                <View style={styles.mockupBadge}>
                  <Text style={styles.mockupBadgeText}>Fresh in 5m</Text>
                </View>
              </View>
              <View style={[styles.mockupLine, { width: "75%", backgroundColor: colors.softChalk, opacity: 0.9 }]} />
              <View style={[styles.mockupLine, { width: "50%", backgroundColor: colors.mutedSilver, opacity: 0.55 }]} />
            </View>

            {/* Quick Status Pill */}
            <View style={[styles.mockupGlassCard, styles.mockupGlassCardSuccess]}>
              <View style={styles.mockupCardTop}>
                <Ionicons name="checkmark-circle" size={13} color={colors.sageMint} />
                <View style={[styles.mockupLine, { width: "55%", backgroundColor: colors.sageMint, opacity: 0.85 }]} />
              </View>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 195,
    width: "100%",
    position: "relative",
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  glowOrbContainer: {
    ...StyleSheet.absoluteFill,
  },
  sparkleDot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    shadowColor: "#FFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  phoneMockupWrapper: {
    position: "absolute",
    right: 22,
    top: 15,
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 22,
    elevation: 12,
  },
  mockupPhoneGlass: {
    width: 148,
    height: 172,
    borderRadius: 26,
    backgroundColor: "rgba(22, 22, 26, 0.88)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.18)",
    padding: 10,
    alignItems: "center",
    overflow: "hidden",
  },
  mockupGlassShine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  mockupDynamicIsland: {
    width: 42,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#000000",
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  mockupContent: {
    width: "100%",
    gap: 8,
  },
  mockupGlassCard: {
    backgroundColor: "rgba(36, 36, 42, 0.72)",
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  mockupGlassCardSuccess: {
    borderColor: "rgba(48, 209, 88, 0.35)",
    backgroundColor: "rgba(48, 209, 88, 0.08)",
  },
  mockupCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  liveOrderIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  liveOrderDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#FF6B4A",
  },
  mockupBadge: {
    backgroundColor: "rgba(229, 169, 59, 0.2)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: "rgba(229, 169, 59, 0.4)",
  },
  mockupBadgeText: {
    fontSize: 8,
    fontWeight: "700",
    color: "#E5A93B",
  },
  mockupLine: {
    height: 4.5,
    borderRadius: 3,
    marginBottom: 3.5,
  },
});
