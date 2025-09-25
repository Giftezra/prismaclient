import {
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import React from "react";
import { Tabs } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useThemeContext } from "@/app/contexts/ThemeProvider";

const TabsLayout = () => {
  const backgroundColor = useThemeColor({}, "background");
  const { currentTheme } = useThemeContext();

  // Set status bar style based on theme
  // Light theme -> dark content, Dark theme -> light content
  const statusBarStyle =
    currentTheme === "dark" ? "light-content" : "dark-content";

  return (
    <KeyboardAvoidingView style={{ flex: 1 }}>
      <StatusBar barStyle={statusBarStyle} />
      <Tabs
        screenOptions={{
          tabBarStyle: {
            backgroundColor: backgroundColor,
            maxHeight: 60,
          },
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            headerShown: false,
            title: "Profile",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="bookings"
          options={{
            headerShown: false,
            title: "Bookings",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="garage"
          options={{
            headerShown: false,
            title: "My Garage",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="car" color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </KeyboardAvoidingView>
  );
};

export default TabsLayout;

const styles = StyleSheet.create({
  maincontainer: {
    flex: 1,
    padding: 5,
  },
});
