import { Platform } from "react-native";
import { Tabs } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { RoleGate } from "@/src/auth/role-gate";
import { useTheme } from "@/src/theme";

export default function KitchenLayout() {
  const { colors } = useTheme();
  return (
    <RoleGate allow={["KITCHEN_STAFF"]}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.brandPrimary,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.surfaceSecondary,
            borderTopColor: colors.divider,
            ...(Platform.OS === "web" ? { height: 64 } : {}),
          },
          tabBarItemStyle: { alignSelf: "center" },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        }}
      >
        <Tabs.Screen
          name="queue"
          options={{
            title: "Queue",
            tabBarIcon: ({ color, size }) => <Ionicons name="albums-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="stock"
          options={{
            title: "Stock",
            tabBarIcon: ({ color, size }) => <Ionicons name="toggle-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
          }}
        />
      </Tabs>
    </RoleGate>
  );
}
