import { Tabs } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { RoleGate } from "@/src/auth/role-gate";
import { FloatingGlassTabBar } from "@/src/components/floating-tab-bar";

export default function AdminLayout() {
  return (
    <RoleGate allow={["ADMIN"]}>
      <Tabs
        tabBar={(props) => <FloatingGlassTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "Analytics",
            tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="menu"
          options={{
            title: "Menu",
            tabBarIcon: ({ color, size }) => <Ionicons name="restaurant-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="slots"
          options={{
            title: "Slots",
            tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />,
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
