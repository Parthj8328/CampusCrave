import { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import Ionicons from "@react-native-vector-icons/ionicons";
import { haptic } from "@/src/lib/haptics";
import { useTheme } from "@/src/theme";

type SocialButtonProps = {
  provider: "apple" | "google";
  onPress: () => void;
  disabled?: boolean;
};

export function SocialButton({ provider, onPress, disabled }: SocialButtonProps) {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  }

  function handlePressOut() {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 25,
      bounciness: 6,
    }).start();
  }

  function handlePress() {
    haptic("light");
    onPress();
  }

  const isApple = provider === "apple";

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }] }}>
      <Pressable
        testID={`social-btn-${provider}`}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={({ pressed }) => [
          styles.glassButton,
          {
            backgroundColor: isApple
              ? "rgba(16, 16, 18, 0.85)"
              : "rgba(40, 40, 46, 0.65)",
            borderColor: pressed
              ? colors.warmGold
              : isApple
                ? "rgba(255, 255, 255, 0.14)"
                : "rgba(255, 255, 255, 0.12)",
          },
          pressed && styles.glassButtonPressed,
          disabled && styles.disabled,
        ]}
      >
        {/* Subtle glass reflection highlight */}
        <View style={styles.topGlassRim} />

        <View style={styles.content}>
          {isApple ? (
            <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
          ) : (
            <GoogleIcon size={18} />
          )}
          <Text
            style={[
              styles.label,
              { color: isApple ? "#FFFFFF" : colors.softChalk },
            ]}
          >
            {isApple ? "Apple" : "Google"}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  glassButton: {
    height: 50,
    borderRadius: 25,
    borderWidth: 1.2,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  topGlassRim: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  glassButtonPressed: {
    borderColor: "rgba(229, 169, 59, 0.6)",
    shadowColor: "#E5A93B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  disabled: {
    opacity: 0.4,
  },
});
