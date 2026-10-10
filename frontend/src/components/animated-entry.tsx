import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { haptic } from "@/src/lib/haptics";

type AnimatedEntryProps = {
  children: React.ReactNode;
  index?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
  pressable?: boolean;
  onPress?: () => void;
  testID?: string;
  activeScale?: number;
};

/**
 * Universal silky-smooth animated wrapper for cards and list items.
 * Provides staggered entrance glide (fade-in + slide-up) and tactile spring press physics.
 */
export function AnimatedEntry({
  children,
  index = 0,
  delay,
  style,
  pressable = false,
  onPress,
  testID,
  activeScale = 0.975,
}: AnimatedEntryProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const computedDelay = delay !== undefined ? delay : Math.min(index * 45, 240);
    Animated.timing(anim, {
      toValue: 1,
      duration: 320,
      delay: computedDelay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, index, delay]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });

  const handlePressIn = () => {
    if (!pressable && !onPress) return;
    Animated.spring(pressScale, {
      toValue: activeScale,
      speed: 35,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (!pressable && !onPress) return;
    Animated.spring(pressScale, {
      toValue: 1,
      speed: 24,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  };

  const animatedStyle: StyleProp<ViewStyle> = [
    {
      opacity: anim,
      transform: [{ translateY }, { scale: pressScale }],
    },
    style,
  ];

  if (pressable || onPress) {
    return (
      <Animated.View style={animatedStyle}>
        <Pressable
          testID={testID}
          onPress={() => {
            haptic("light");
            onPress?.();
          }}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={{ width: "100%" }}
        >
          {children}
        </Pressable>
      </Animated.View>
    );
  }

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}
