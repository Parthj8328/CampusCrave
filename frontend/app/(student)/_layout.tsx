import { Tabs } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { RoleGate } from "@/src/auth/role-gate";
import { FloatingGlassTabBar } from "@/src/components/floating-tab-bar";

export default function StudentLayout() {
  return (
    <RoleGate allow={["STUDENT"]}>
      <Tabs
        tabBar={(props) => <FloatingGlassTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="menu"
          options={{
            title: "Menu",
            tabBarIcon: ({ color, size }) => <Ionicons name="fast-food-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: "Orders",
            tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
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
