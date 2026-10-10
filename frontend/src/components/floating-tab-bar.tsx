import { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { haptic } from "@/src/lib/haptics";
import { useTheme } from "@/src/theme";

type TabBarProps = {
  state: any;
  descriptors: any;
  navigation: any;
};

const TAB_CONFIG: Record<string, { label: string; iconActive: string; iconInactive: string }> = {
  menu: {
    label: "Menu",
    iconActive: "fast-food",
    iconInactive: "fast-food-outline",
  },
  orders: {
    label: "Orders",
    iconActive: "receipt",
    iconInactive: "receipt-outline",
  },
  profile: {
    label: "Profile",
    iconActive: "person",
    iconInactive: "person-outline",
  },
  dashboard: {
    label: "Analytics",
    iconActive: "stats-chart",
    iconInactive: "stats-chart-outline",
  },
  slots: {
    label: "Slots",
    iconActive: "time",
    iconInactive: "time-outline",
  },
  queue: {
    label: "Queue",
    iconActive: "albums",
    iconInactive: "albums-outline",
  },
  stock: {
    label: "Stock",
    iconActive: "layers",
    iconInactive: "layers-outline",
  },
};

export function FloatingGlassTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.floatingContainer,
        {
          bottom: Platform.OS === "ios" ? Math.max(insets.bottom, 12) + 6 : 18,
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.glassBar}>
        {/* Frosted Glass Blur Background */}
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />

        {/* Specular top glass edge line */}
        <View style={styles.specularShine} />

        {/* Tabs Row */}
        <View style={styles.tabsRow}>
          {state.routes.map((route: any, index: number) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;
            const config = TAB_CONFIG[route.name] ?? {
              label: options.title ?? route.name,
              iconActive: "ellipse",
              iconInactive: "ellipse-outline",
            };

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                haptic("selection");
                navigation.navigate(route.name, route.params);
              }
            };

            return (
              <TabItem
                key={route.key}
                label={config.label}
                iconName={isFocused ? config.iconActive : config.iconInactive}
                isFocused={isFocused}
                onPress={onPress}
                activeColor={colors.saffronCoral}
                inactiveColor={colors.mutedSilver}
                accentColor={colors.warmGold}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

type TabItemProps = {
  label: string;
  iconName: string;
  isFocused: boolean;
  onPress: () => void;
  activeColor: string;
  inactiveColor: string;
  accentColor: string;
};

function TabItem({
  label,
  iconName,
  isFocused,
  onPress,
  activeColor,
  inactiveColor,
  accentColor,
}: TabItemProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;
  const iconBounceAnim = useRef(new Animated.Value(isFocused ? 1.05 : 1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(glowAnim, {
        toValue: isFocused ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(iconBounceAnim, {
        toValue: isFocused ? 1.08 : 1,
        speed: 24,
        bounciness: isFocused ? 8 : 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isFocused, glowAnim, iconBounceAnim]);

  function handlePressIn() {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      speed: 40,
      bounciness: 2,
      useNativeDriver: true,
    }).start();
  }

  function handlePressOut() {
    Animated.spring(scaleAnim, {
      toValue: 1,
      speed: 25,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
  }

  return (
    <Animated.View style={[styles.tabItemWrapper, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        testID={`tab-btn-${label.toLowerCase()}`}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.tabPressable}
      >
        {/* Animated glowing pill background for active tab */}
        {isFocused ? (
          <Animated.View
            style={[
              styles.activePillGlow,
              {
                opacity: glowAnim,
                backgroundColor: "rgba(255, 107, 74, 0.16)",
                borderColor: "rgba(255, 107, 74, 0.35)",
              },
            ]}
          />
        ) : null}

        <Animated.View style={[styles.iconContainer, { transform: [{ scale: iconBounceAnim }] }]}>
          <Ionicons
            name={iconName as any}
            size={22}
            color={isFocused ? activeColor : inactiveColor}
          />
          {/* Active Glowing Micro Indicator Dot */}
          {isFocused ? (
            <View
              style={[
                styles.activeDot,
                {
                  backgroundColor: accentColor,
                  shadowColor: accentColor,
                },
              ]}
            />
          ) : null}
        </Animated.View>

        <Text
          style={[
            styles.tabLabel,
            {
              color: isFocused ? "#F2F2F7" : inactiveColor,
              fontWeight: isFocused ? "700" : "500",
            },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 999,
  },
  glassBar: {
    height: 66,
    borderRadius: 33,
    backgroundColor: "rgba(22, 22, 26, 0.82)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.15)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 16,
  },
  specularShine: {
    position: "absolute",
    top: 0,
    left: 24,
    right: 24,
    height: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  tabsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8,
  },
  tabItemWrapper: {
    flex: 1,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  tabPressable: {
    width: "88%",
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    gap: 2,
  },
  activePillGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 24,
    position: "relative",
  },
  activeDot: {
    position: "absolute",
    bottom: -3,
    width: 4,
    height: 4,
    borderRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
  tabLabel: {
    fontSize: 11,
    letterSpacing: -0.1,
  },
});
